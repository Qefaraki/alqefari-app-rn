-- Admin Functions with Async Operations and Comprehensive Checks

-- Create sequence for efficient HID generation
CREATE SEQUENCE IF NOT EXISTS hid_counter START WITH 1;

-- Function to generate next HID efficiently
CREATE OR REPLACE FUNCTION generate_next_hid(parent_hid TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    next_sibling_num INT;
BEGIN
    IF parent_hid IS NULL THEN
        -- Root level node
        RETURN 'R' || nextval('hid_counter');
    ELSE
        -- Get next sibling number efficiently
        SELECT COALESCE(MAX(
            CAST(
                SUBSTRING(hid FROM LENGTH(parent_hid) + 2) 
                AS INTEGER
            )
        ), 0) + 1
        INTO next_sibling_num
        FROM profiles
        WHERE hid LIKE parent_hid || '.%'
        AND hid NOT LIKE parent_hid || '.%.%'
        AND deleted_at IS NULL;
        
        RETURN parent_hid || '.' || next_sibling_num;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Async function to trigger layout recalculation
CREATE OR REPLACE FUNCTION trigger_layout_recalc_async(affected_node_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Queue the recalculation job (in production, this would call an Edge Function)
    -- For now, we'll insert into a job queue table
    INSERT INTO layout_recalc_queue (node_id, queued_at, status)
    VALUES (affected_node_id, NOW(), 'pending')
    ON CONFLICT (node_id) 
    DO UPDATE SET queued_at = NOW(), status = 'pending';
    
    result := jsonb_build_object(
        'status', 'queued',
        'node_id', affected_node_id,
        'timestamp', NOW()
    );
    
    -- In production, this would invoke Edge Function:
    -- PERFORM net.http_post(
    --     url := current_setting('app.edge_function_url') || '/recalculate-layout',
    --     body := jsonb_build_object('affected_node_id', affected_node_id)
    -- );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create layout recalculation queue table
CREATE TABLE IF NOT EXISTS layout_recalc_queue (
    node_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    queued_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT
);

-- Enhanced admin create profile function
CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT,
    p_father_id UUID DEFAULT NULL,
    p_generation INT DEFAULT 1,
    p_dob_data JSONB DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_current_residence TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL,
    p_social_media_links JSONB DEFAULT '{}'::JSONB
)
RETURNS profiles AS $$
DECLARE
    new_profile profiles;
    new_hid TEXT;
    parent_hid TEXT;
    max_sibling_order INT;
    validation_error TEXT;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Validate input parameters
    IF LENGTH(TRIM(p_name)) = 0 THEN
        RAISE EXCEPTION 'Name cannot be empty';
    END IF;
    
    IF p_gender NOT IN ('male', 'female') THEN
        RAISE EXCEPTION 'Gender must be either male or female';
    END IF;
    
    IF p_generation < 1 THEN
        RAISE EXCEPTION 'Generation must be positive';
    END IF;
    
    -- Validate parent exists and get parent's HID
    IF p_father_id IS NOT NULL THEN
        SELECT hid, generation INTO parent_hid
        FROM profiles
        WHERE id = p_father_id AND deleted_at IS NULL;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Father not found';
        END IF;
    END IF;
    
    -- Generate HID efficiently
    new_hid := generate_next_hid(parent_hid);
    
    -- Get sibling order
    IF p_father_id IS NOT NULL THEN
        SELECT COALESCE(MAX(sibling_order), -1) + 1
        INTO max_sibling_order
        FROM profiles
        WHERE father_id = p_father_id AND deleted_at IS NULL;
    ELSE
        max_sibling_order := 0;
    END IF;
    
    -- Insert the new profile with validation
    BEGIN
        INSERT INTO profiles (
            name, gender, father_id, generation, hid, sibling_order,
            dob_data, photo_url, bio, current_residence, occupation,
            social_media_links, created_by
        )
        VALUES (
            TRIM(p_name), p_gender, p_father_id, p_generation, new_hid, max_sibling_order,
            p_dob_data, p_photo_url, p_bio, p_current_residence, p_occupation,
            p_social_media_links, auth.uid()
        )
        RETURNING * INTO new_profile;
    EXCEPTION
        WHEN check_violation THEN
            GET STACKED DIAGNOSTICS validation_error = MESSAGE_TEXT;
            RAISE EXCEPTION 'Validation failed: %', validation_error;
    END;
    
    -- Trigger async layout recalculation
    PERFORM trigger_layout_recalc_async(COALESCE(p_father_id, new_profile.id));
    
    -- Update parent's descendants count
    IF p_father_id IS NOT NULL THEN
        UPDATE profiles 
        SET descendants_count = descendants_count + 1
        WHERE id = p_father_id;
    END IF;
    
    RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced admin update profile function
CREATE OR REPLACE FUNCTION admin_update_profile(
    p_id UUID,
    p_version INT,
    p_updates JSONB
)
RETURNS profiles AS $$
DECLARE
    updated_profile profiles;
    old_father_id UUID;
    new_father_id UUID;
    validation_error TEXT;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Get current father_id for comparison
    SELECT father_id INTO old_father_id
    FROM profiles
    WHERE id = p_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;
    
    -- Extract new father_id if being updated
    new_father_id := COALESCE((p_updates->>'father_id')::UUID, old_father_id);
    
    -- Validate parent change if applicable
    IF new_father_id IS DISTINCT FROM old_father_id THEN
        IF NOT check_no_circular_parents(p_id, new_father_id) THEN
            RAISE EXCEPTION 'Update would create circular parent relationship';
        END IF;
    END IF;
    
    -- Update with version check and validation
    BEGIN
        UPDATE profiles
        SET
            name = COALESCE(p_updates->>'name', name),
            bio = COALESCE(p_updates->>'bio', bio),
            dob_data = COALESCE(p_updates->'dob_data', dob_data),
            dod_data = COALESCE(p_updates->'dod_data', dod_data),
            current_residence = COALESCE(p_updates->>'current_residence', current_residence),
            occupation = COALESCE(p_updates->>'occupation', occupation),
            education = COALESCE(p_updates->>'education', education),
            photo_url = COALESCE(p_updates->>'photo_url', photo_url),
            social_media_links = COALESCE(p_updates->'social_media_links', social_media_links),
            father_id = new_father_id,
            updated_at = NOW(),
            updated_by = auth.uid()
        WHERE id = p_id AND version = p_version AND deleted_at IS NULL
        RETURNING * INTO updated_profile;
    EXCEPTION
        WHEN check_violation THEN
            GET STACKED DIAGNOSTICS validation_error = MESSAGE_TEXT;
            RAISE EXCEPTION 'Validation failed: %', validation_error;
    END;
    
    IF updated_profile IS NULL THEN
        RAISE EXCEPTION 'Profile not found or version mismatch';
    END IF;
    
    -- Trigger layout recalculation if structure changed
    IF new_father_id IS DISTINCT FROM old_father_id THEN
        -- Recalculate both old and new parent branches
        PERFORM trigger_layout_recalc_async(old_father_id);
        PERFORM trigger_layout_recalc_async(new_father_id);
        PERFORM trigger_layout_recalc_async(p_id);
        
        -- Update descendants count
        IF old_father_id IS NOT NULL THEN
            UPDATE profiles 
            SET descendants_count = descendants_count - 1
            WHERE id = old_father_id;
        END IF;
        
        IF new_father_id IS NOT NULL THEN
            UPDATE profiles 
            SET descendants_count = descendants_count + 1
            WHERE id = new_father_id;
        END IF;
    END IF;
    
    RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe soft delete function
CREATE OR REPLACE FUNCTION admin_delete_profile(
    p_id UUID,
    p_cascade BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    affected_count INT := 0;
    has_children BOOLEAN;
BEGIN
    -- Check super admin permissions for delete
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Only super admins can delete profiles';
    END IF;
    
    -- Check if profile has children
    SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE (father_id = p_id OR mother_id = p_id) 
        AND deleted_at IS NULL
    ) INTO has_children;
    
    IF has_children AND NOT p_cascade THEN
        RAISE EXCEPTION 'Cannot delete profile with children. Use cascade option or delete children first.';
    END IF;
    
    -- Perform soft delete
    IF p_cascade THEN
        -- Cascade delete to all descendants
        WITH RECURSIVE descendants AS (
            SELECT id FROM profiles WHERE id = p_id
            UNION ALL
            SELECT p.id 
            FROM profiles p
            INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
            WHERE p.deleted_at IS NULL
        )
        UPDATE profiles
        SET deleted_at = NOW()
        WHERE id IN (SELECT id FROM descendants)
        AND deleted_at IS NULL;
        
        GET DIAGNOSTICS affected_count = ROW_COUNT;
    ELSE
        -- Delete single profile
        UPDATE profiles
        SET deleted_at = NOW()
        WHERE id = p_id AND deleted_at IS NULL;
        
        GET DIAGNOSTICS affected_count = ROW_COUNT;
    END IF;
    
    -- Trigger layout recalculation for parent
    PERFORM trigger_layout_recalc_async(
        (SELECT father_id FROM profiles WHERE id = p_id)
    );
    
    RETURN jsonb_build_object(
        'success', affected_count > 0,
        'affected_count', affected_count,
        'cascade', p_cascade
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore soft-deleted profiles
CREATE OR REPLACE FUNCTION admin_restore_profile(p_id UUID)
RETURNS profiles AS $$
DECLARE
    restored_profile profiles;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name = 'SUPER_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Only super admins can restore profiles';
    END IF;
    
    -- Restore profile
    UPDATE profiles
    SET deleted_at = NULL
    WHERE id = p_id
    RETURNING * INTO restored_profile;
    
    IF restored_profile IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(restored_profile.father_id);
    
    RETURN restored_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reorder siblings efficiently
CREATE OR REPLACE FUNCTION admin_reorder_siblings(
    p_parent_id UUID,
    p_ordered_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
    i INT;
    updated_count INT := 0;
BEGIN
    -- Check admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() 
        AND r.name IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Validate all IDs belong to the same parent
    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE id = ANY(p_ordered_ids)
        AND (father_id IS DISTINCT FROM p_parent_id OR deleted_at IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'All profiles must have the same parent and not be deleted';
    END IF;
    
    -- Update sibling orders in a single query for efficiency
    UPDATE profiles
    SET sibling_order = ordered.new_order - 1
    FROM (
        SELECT unnest(p_ordered_ids) AS id, 
               generate_series(1, array_length(p_ordered_ids, 1)) AS new_order
    ) AS ordered
    WHERE profiles.id = ordered.id
    AND profiles.father_id IS NOT DISTINCT FROM p_parent_id
    AND profiles.deleted_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(p_parent_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'updated_count', updated_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;