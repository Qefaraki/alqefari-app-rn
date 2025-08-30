-- Admin revert action function
-- Enables safe reversal of recent changes from the audit log

-- First ensure we have soft delete capability on profiles
DO $$
BEGIN
    -- Add deleted_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMPTZ;
        
        -- Create partial index for non-deleted profiles
        CREATE INDEX idx_profiles_not_deleted ON profiles (id) WHERE deleted_at IS NULL;
        
        -- Update existing views/functions to respect soft delete
        -- This would need to be done in production
    END IF;
END $$;

-- Add revert tracking to audit_log
DO $$
BEGIN
    -- Add reverted_by column to track which audit entry reverted this one
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'reverted_by'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN reverted_by UUID REFERENCES audit_log(id);
        CREATE INDEX idx_audit_log_reverted ON audit_log (reverted_by);
    END IF;
    
    -- Add is_revertible computed column or function
    -- This helps identify which actions can be reverted
END $$;

-- Helper function to check if an audit entry can be reverted
CREATE OR REPLACE FUNCTION is_audit_entry_revertible(
    p_audit_log_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    audit_entry RECORD;
BEGIN
    SELECT * INTO audit_entry
    FROM audit_log
    WHERE id = p_audit_log_id;
    
    -- Entry must exist
    IF audit_entry IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot revert if already reverted
    IF audit_entry.reverted_by IS NOT NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot revert REVERT actions (prevent revert loops)
    IF audit_entry.action = 'REVERT' THEN
        RETURN FALSE;
    END IF;
    
    -- Only support profiles table for now
    IF audit_entry.table_name != 'profiles' THEN
        RETURN FALSE;
    END IF;
    
    -- Must have valid action type
    IF audit_entry.action NOT IN ('INSERT', 'UPDATE', 'DELETE') THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Main revert function
CREATE OR REPLACE FUNCTION admin_revert_action(
    p_audit_log_id UUID,
    p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    audit_entry RECORD;
    target_profile RECORD;
    revert_result JSONB;
    fields_restored TEXT[];
    revert_audit_id UUID;
    affected_node_id UUID;
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
    
    -- Get the audit entry
    SELECT * INTO audit_entry
    FROM audit_log
    WHERE id = p_audit_log_id;
    
    IF audit_entry IS NULL THEN
        RAISE EXCEPTION 'Audit log entry not found: %', p_audit_log_id;
    END IF;
    
    -- Check if revertible
    IF NOT is_audit_entry_revertible(p_audit_log_id) THEN
        RAISE EXCEPTION 'This audit entry cannot be reverted';
    END IF;
    
    -- Get current state of target profile
    SELECT * INTO target_profile
    FROM profiles
    WHERE id = audit_entry.target_profile_id;
    
    -- Initialize result
    revert_result := jsonb_build_object(
        'audit_log_id', p_audit_log_id,
        'action', audit_entry.action,
        'target_profile_id', audit_entry.target_profile_id,
        'dry_run', p_dry_run
    );
    
    -- Handle each action type
    CASE audit_entry.action
        WHEN 'INSERT' THEN
            -- Revert INSERT by soft-deleting the profile
            IF target_profile IS NULL OR target_profile.deleted_at IS NOT NULL THEN
                RAISE EXCEPTION 'Cannot revert INSERT: profile already deleted or not found';
            END IF;
            
            IF NOT p_dry_run THEN
                UPDATE profiles
                SET deleted_at = NOW(),
                    updated_at = NOW()
                WHERE id = audit_entry.target_profile_id;
                
                affected_node_id := audit_entry.target_profile_id;
            END IF;
            
            revert_result := revert_result || jsonb_build_object(
                'operation', 'soft_delete',
                'summary', format('Soft-deleted profile: %s', target_profile.name)
            );
            
        WHEN 'UPDATE' THEN
            -- Revert UPDATE by restoring old values
            IF target_profile IS NULL THEN
                RAISE EXCEPTION 'Cannot revert UPDATE: profile not found';
            END IF;
            
            IF audit_entry.old_data IS NULL THEN
                RAISE EXCEPTION 'Cannot revert UPDATE: no old data recorded';
            END IF;
            
            -- Build list of fields to restore
            fields_restored := ARRAY[]::TEXT[];
            
            IF NOT p_dry_run THEN
                -- Dynamically build and execute update based on old_data
                UPDATE profiles
                SET 
                    name = COALESCE((audit_entry.old_data->>'name')::TEXT, name),
                    gender = COALESCE((audit_entry.old_data->>'gender')::gender, gender),
                    father_id = CASE 
                        WHEN audit_entry.old_data ? 'father_id' 
                        THEN (audit_entry.old_data->>'father_id')::UUID 
                        ELSE father_id 
                    END,
                    generation = COALESCE((audit_entry.old_data->>'generation')::INT, generation),
                    sibling_order = COALESCE((audit_entry.old_data->>'sibling_order')::INT, sibling_order),
                    dob_data = CASE 
                        WHEN audit_entry.old_data ? 'dob_data' 
                        THEN (audit_entry.old_data->'dob_data')::JSONB 
                        ELSE dob_data 
                    END,
                    photo_url = CASE 
                        WHEN audit_entry.old_data ? 'photo_url' 
                        THEN (audit_entry.old_data->>'photo_url')::TEXT 
                        ELSE photo_url 
                    END,
                    bio = CASE 
                        WHEN audit_entry.old_data ? 'bio' 
                        THEN (audit_entry.old_data->>'bio')::TEXT 
                        ELSE bio 
                    END,
                    notes = CASE 
                        WHEN audit_entry.old_data ? 'notes' 
                        THEN (audit_entry.old_data->>'notes')::TEXT 
                        ELSE notes 
                    END,
                    updated_at = NOW()
                WHERE id = audit_entry.target_profile_id;
                
                affected_node_id := audit_entry.target_profile_id;
                
                -- Track which fields were restored
                SELECT array_agg(key) INTO fields_restored
                FROM jsonb_object_keys(audit_entry.old_data) AS key;
            ELSE
                -- For dry run, just list fields that would be restored
                SELECT array_agg(key) INTO fields_restored
                FROM jsonb_object_keys(audit_entry.old_data) AS key;
            END IF;
            
            revert_result := revert_result || jsonb_build_object(
                'operation', 'restore_fields',
                'fields_restored', fields_restored,
                'summary', format('Restored %s fields for profile: %s', 
                    array_length(fields_restored, 1), 
                    target_profile.name)
            );
            
        WHEN 'DELETE' THEN
            -- Revert DELETE by removing soft delete
            IF target_profile IS NULL THEN
                RAISE EXCEPTION 'Cannot revert DELETE: profile not found';
            END IF;
            
            IF target_profile.deleted_at IS NULL THEN
                RAISE EXCEPTION 'Cannot revert DELETE: profile is not deleted';
            END IF;
            
            IF NOT p_dry_run THEN
                UPDATE profiles
                SET deleted_at = NULL,
                    updated_at = NOW()
                WHERE id = audit_entry.target_profile_id;
                
                affected_node_id := audit_entry.target_profile_id;
            END IF;
            
            revert_result := revert_result || jsonb_build_object(
                'operation', 'undelete',
                'summary', format('Restored deleted profile: %s', target_profile.name)
            );
    END CASE;
    
    -- Record the revert in audit log (only if not dry run)
    IF NOT p_dry_run THEN
        revert_audit_id := write_audit_log(
            'REVERT',
            'profiles',
            audit_entry.target_profile_id,
            to_jsonb(target_profile),  -- Current state becomes old_data
            CASE 
                WHEN audit_entry.action = 'UPDATE' THEN audit_entry.old_data
                ELSE NULL
            END,
            jsonb_build_object(
                'reverted_audit_id', p_audit_log_id,
                'original_action', audit_entry.action,
                'revert_summary', revert_result
            )
        );
        
        -- Mark original audit entry as reverted
        UPDATE audit_log
        SET reverted_by = revert_audit_id
        WHERE id = p_audit_log_id;
        
        -- Trigger layout recalculation if needed
        IF affected_node_id IS NOT NULL THEN
            PERFORM trigger_layout_recalc_async(affected_node_id);
        END IF;
        
        revert_result := revert_result || jsonb_build_object(
            'revert_audit_id', revert_audit_id,
            'reverted', true
        );
    ELSE
        revert_result := revert_result || jsonb_build_object(
            'reverted', false,
            'message', 'Dry run - no changes made'
        );
    END IF;
    
    RETURN revert_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error in result
        RETURN jsonb_build_object(
            'reverted', false,
            'error', SQLERRM,
            'audit_log_id', p_audit_log_id
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get revertible audit entries for UI
CREATE OR REPLACE FUNCTION get_revertible_audit_entries(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_filter_branch UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    action TEXT,
    table_name TEXT,
    target_profile_id UUID,
    target_profile_name TEXT,
    actor_id UUID,
    actor_name TEXT,
    created_at TIMESTAMPTZ,
    is_revertible BOOLEAN,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.action,
        al.table_name,
        al.target_profile_id,
        p.name AS target_profile_name,
        al.actor_id,
        actor.name AS actor_name,
        al.created_at,
        is_audit_entry_revertible(al.id) AS is_revertible,
        al.details
    FROM audit_log al
    LEFT JOIN profiles p ON al.target_profile_id = p.id
    LEFT JOIN profiles actor ON al.actor_id = actor.id
    WHERE al.table_name = 'profiles'
    AND (p_filter_branch IS NULL OR 
         EXISTS (
             SELECT 1 FROM profiles branch_check 
             WHERE branch_check.id = al.target_profile_id 
             AND branch_check.hid LIKE (
                 SELECT hid || '%' FROM profiles WHERE id = p_filter_branch
             )
         )
    )
    ORDER BY al.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_revert_action TO authenticated;
GRANT EXECUTE ON FUNCTION is_audit_entry_revertible TO authenticated;
GRANT EXECUTE ON FUNCTION get_revertible_audit_entries TO authenticated;