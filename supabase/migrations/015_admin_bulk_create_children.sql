-- Admin bulk create children function
-- Enables high-velocity data entry by creating multiple children in a single atomic operation

-- First, ensure we have the audit_log table structure we need
-- Check if audit_log exists and has the required columns
DO $$
BEGIN
    -- Add action column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'action'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN action TEXT;
    END IF;
    
    -- Add table_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'table_name'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN table_name TEXT DEFAULT 'profiles';
    END IF;
    
    -- Add target_profile_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'target_profile_id'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN target_profile_id UUID;
    END IF;
    
    -- Add old_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'old_data'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN old_data JSONB;
    END IF;
    
    -- Add new_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'new_data'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN new_data JSONB;
    END IF;
    
    -- Add actor_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'actor_id'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN actor_id UUID DEFAULT auth.uid();
    END IF;
END $$;

-- Helper function to write audit log entries
CREATE OR REPLACE FUNCTION write_audit_log(
    p_action TEXT,
    p_table_name TEXT,
    p_target_profile_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_log (
        action,
        table_name,
        target_profile_id,
        old_data,
        new_data,
        details,
        actor_id,
        created_at
    ) VALUES (
        p_action,
        p_table_name,
        p_target_profile_id,
        p_old_data,
        p_new_data,
        p_details,
        auth.uid(),
        NOW()
    )
    RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main bulk create children function
CREATE OR REPLACE FUNCTION admin_bulk_create_children(
    p_parent_id UUID,
    p_children JSONB
)
RETURNS SETOF profiles AS $$
DECLARE
    parent_profile profiles;
    parent_hid TEXT;
    parent_generation INT;
    max_sibling_order INT;
    child_record RECORD;
    new_profile profiles;
    job_id UUID;
    created_profiles UUID[];
    audit_details JSONB;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Validate parent exists and get info
    SELECT * INTO parent_profile
    FROM profiles
    WHERE id = p_parent_id;
    
    IF parent_profile IS NULL THEN
        RAISE EXCEPTION 'Parent profile not found: %', p_parent_id;
    END IF;
    
    parent_hid := parent_profile.hid;
    parent_generation := parent_profile.generation;
    
    -- Lock existing siblings to prevent race conditions
    SELECT COALESCE(MAX(sibling_order), 0) INTO max_sibling_order
    FROM profiles
    WHERE father_id = p_parent_id
    FOR UPDATE;
    
    -- Initialize created profiles array
    created_profiles := ARRAY[]::UUID[];
    
    -- Parse and validate children data
    FOR child_record IN 
        SELECT 
            name,
            gender,
            COALESCE(birth_year, NULL) as birth_year,
            COALESCE(notes, '') as notes,
            row_number() OVER () as position
        FROM jsonb_to_recordset(p_children) AS x(
            name TEXT,
            gender TEXT,
            birth_year INT,
            notes TEXT
        )
    LOOP
        -- Validate required fields
        IF child_record.name IS NULL OR trim(child_record.name) = '' THEN
            RAISE EXCEPTION 'Child at position % must have a name', child_record.position;
        END IF;
        
        IF child_record.gender NOT IN ('M', 'F') THEN
            RAISE EXCEPTION 'Child at position % must have gender M or F', child_record.position;
        END IF;
        
        -- Generate HID and sibling order
        max_sibling_order := max_sibling_order + 1;
        
        -- Create the child profile
        INSERT INTO profiles (
            name,
            gender,
            father_id,
            generation,
            hid,
            sibling_order,
            dob_data,
            notes,
            created_at,
            updated_at
        ) VALUES (
            child_record.name,
            child_record.gender::gender,
            p_parent_id,
            parent_generation + 1,
            generate_next_hid(parent_hid),
            max_sibling_order,
            CASE 
                WHEN child_record.birth_year IS NOT NULL 
                THEN jsonb_build_object('year', child_record.birth_year)
                ELSE NULL
            END,
            child_record.notes,
            NOW(),
            NOW()
        )
        RETURNING * INTO new_profile;
        
        -- Track created profile
        created_profiles := array_append(created_profiles, new_profile.id);
        
        -- Write audit log entry for this child
        PERFORM write_audit_log(
            'INSERT',
            'profiles',
            new_profile.id,
            NULL,
            to_jsonb(new_profile),
            jsonb_build_object(
                'bulk_operation', true,
                'parent_id', p_parent_id,
                'position_in_batch', child_record.position,
                'total_in_batch', jsonb_array_length(p_children)
            )
        );
        
        -- Return the created profile
        RETURN NEXT new_profile;
    END LOOP;
    
    -- Create a single background job for layout recalculation
    IF array_length(created_profiles, 1) > 0 THEN
        job_id := create_background_job(
            'layout_recalculation'::job_type,
            jsonb_build_object(
                'affected_node_id', p_parent_id,
                'operation', 'bulk_create_children',
                'created_count', array_length(created_profiles, 1),
                'created_ids', created_profiles,
                'parent_info', jsonb_build_object(
                    'id', parent_profile.id,
                    'name', parent_profile.name,
                    'hid', parent_profile.hid
                )
            )
        );
        
        -- Trigger async layout recalculation
        PERFORM trigger_layout_recalc_async(p_parent_id);
    END IF;
    
    RETURN;
EXCEPTION
    WHEN OTHERS THEN
        -- Ensure transaction rollback on any error
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (RLS will handle authorization)
GRANT EXECUTE ON FUNCTION admin_bulk_create_children TO authenticated;
GRANT EXECUTE ON FUNCTION write_audit_log TO authenticated, service_role;

-- Create index on audit_log for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_recent ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log (target_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_id);