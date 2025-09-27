-- Create admin_revert_action RPC for safe reversal of recent changes
-- First ensure soft delete capability exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create partial index for non-deleted profiles
CREATE INDEX IF NOT EXISTS idx_profiles_not_deleted ON profiles (id) WHERE deleted_at IS NULL;

-- Update profiles view to exclude soft-deleted records
CREATE OR REPLACE VIEW active_profiles AS
SELECT * FROM profiles WHERE deleted_at IS NULL;

-- Helper function to check if an audit entry can be reverted
CREATE OR REPLACE FUNCTION is_audit_entry_revertible(
    p_audit_log_id UUID
) RETURNS BOOLEAN AS $$
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
    IF audit_entry.reverted_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Cannot revert REVERT or BULK_INSERT actions
    IF audit_entry.action IN ('REVERT', 'BULK_INSERT') THEN
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
) RETURNS JSONB AS $$
DECLARE
    v_audit_entry RECORD;
    v_target_profile RECORD;
    v_revert_result JSONB;
    v_fields_restored TEXT[];
    v_revert_audit_id UUID;
    v_affected_node_id UUID;
    v_actor_id UUID;
BEGIN
    -- Check admin permissions
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    v_actor_id := auth.uid();
    
    -- Get the audit entry
    SELECT * INTO v_audit_entry
    FROM audit_log
    WHERE id = p_audit_log_id;
    
    IF v_audit_entry IS NULL THEN
        RAISE EXCEPTION 'Audit log entry not found: %', p_audit_log_id;
    END IF;
    
    -- Check if revertible
    IF NOT is_audit_entry_revertible(p_audit_log_id) THEN
        RAISE EXCEPTION 'This audit entry cannot be reverted';
    END IF;
    
    -- Get current state of target profile
    SELECT * INTO v_target_profile
    FROM profiles
    WHERE id = v_audit_entry.target_profile_id;
    
    -- Initialize result
    v_revert_result := jsonb_build_object(
        'audit_log_id', p_audit_log_id,
        'action', v_audit_entry.action,
        'target_profile_id', v_audit_entry.target_profile_id,
        'dry_run', p_dry_run
    );
    
    -- Handle each action type
    CASE v_audit_entry.action
        WHEN 'INSERT' THEN
            -- Revert INSERT by soft-deleting the profile
            IF v_target_profile IS NULL OR v_target_profile.deleted_at IS NOT NULL THEN
                RAISE EXCEPTION 'Cannot revert INSERT: profile already deleted or not found';
            END IF;
            
            IF NOT p_dry_run THEN
                UPDATE profiles
                SET deleted_at = NOW()
                WHERE id = v_audit_entry.target_profile_id;
                
                v_affected_node_id := v_audit_entry.target_profile_id;
            END IF;
            
            v_revert_result := v_revert_result || jsonb_build_object(
                'operation', 'soft_delete',
                'summary', format('Soft-deleted profile: %s', v_target_profile.name)
            );
            
        WHEN 'UPDATE' THEN
            -- Revert UPDATE by restoring old values
            IF v_target_profile IS NULL THEN
                RAISE EXCEPTION 'Cannot revert UPDATE: profile not found';
            END IF;
            
            IF v_audit_entry.old_data IS NULL THEN
                RAISE EXCEPTION 'Cannot revert UPDATE: no old data recorded';
            END IF;
            
            -- Build list of fields to restore
            v_fields_restored := ARRAY[]::TEXT[];
            
            IF NOT p_dry_run THEN
                -- Restore fields from old_data
                UPDATE profiles
                SET 
                    name = COALESCE((v_audit_entry.old_data->>'name')::TEXT, name),
                    gender = COALESCE((v_audit_entry.old_data->>'gender')::TEXT, gender),
                    parent_id = CASE 
                        WHEN v_audit_entry.old_data ? 'parent_id' 
                        THEN (v_audit_entry.old_data->>'parent_id')::UUID 
                        ELSE parent_id 
                    END,
                    generation = COALESCE((v_audit_entry.old_data->>'generation')::INT, generation),
                    sibling_order = COALESCE((v_audit_entry.old_data->>'sibling_order')::INT, sibling_order),
                    birth_year = CASE 
                        WHEN v_audit_entry.old_data ? 'birth_year' 
                        THEN (v_audit_entry.old_data->>'birth_year')::INT 
                        ELSE birth_year 
                    END,
                    photo_url = CASE 
                        WHEN v_audit_entry.old_data ? 'photo_url' 
                        THEN (v_audit_entry.old_data->>'photo_url')::TEXT 
                        ELSE photo_url 
                    END,
                    bio = CASE 
                        WHEN v_audit_entry.old_data ? 'bio' 
                        THEN (v_audit_entry.old_data->>'bio')::TEXT 
                        ELSE bio 
                    END,
                    notes = CASE 
                        WHEN v_audit_entry.old_data ? 'notes' 
                        THEN (v_audit_entry.old_data->>'notes')::TEXT 
                        ELSE notes 
                    END
                WHERE id = v_audit_entry.target_profile_id;
                
                v_affected_node_id := v_audit_entry.target_profile_id;
                
                -- Track which fields were restored
                SELECT array_agg(key) INTO v_fields_restored
                FROM jsonb_object_keys(v_audit_entry.old_data) AS key;
            ELSE
                -- For dry run, just list fields that would be restored
                SELECT array_agg(key) INTO v_fields_restored
                FROM jsonb_object_keys(v_audit_entry.old_data) AS key;
            END IF;
            
            v_revert_result := v_revert_result || jsonb_build_object(
                'operation', 'restore_fields',
                'fields_restored', v_fields_restored,
                'summary', format('Restored %s fields for profile: %s', 
                    array_length(v_fields_restored, 1), 
                    v_target_profile.name)
            );
            
        WHEN 'DELETE' THEN
            -- Revert DELETE by removing soft delete
            IF v_target_profile IS NULL THEN
                RAISE EXCEPTION 'Cannot revert DELETE: profile not found';
            END IF;
            
            IF v_target_profile.deleted_at IS NULL THEN
                RAISE EXCEPTION 'Cannot revert DELETE: profile is not deleted';
            END IF;
            
            IF NOT p_dry_run THEN
                UPDATE profiles
                SET deleted_at = NULL
                WHERE id = v_audit_entry.target_profile_id;
                
                v_affected_node_id := v_audit_entry.target_profile_id;
            END IF;
            
            v_revert_result := v_revert_result || jsonb_build_object(
                'operation', 'undelete',
                'summary', format('Restored deleted profile: %s', v_target_profile.name)
            );
    END CASE;
    
    -- Record the revert in audit log (only if not dry run)
    IF NOT p_dry_run THEN
        -- Create revert audit entry
        INSERT INTO audit_log (
            id, action, table_name, target_profile_id,
            actor_id, old_data, new_data, details, created_at
        ) VALUES (
            gen_random_uuid(),
            'REVERT',
            'profiles',
            v_audit_entry.target_profile_id,
            v_actor_id,
            to_jsonb(v_target_profile),  -- Current state becomes old_data
            CASE 
                WHEN v_audit_entry.action = 'UPDATE' THEN v_audit_entry.old_data
                WHEN v_audit_entry.action = 'INSERT' THEN NULL  -- Soft deleted
                WHEN v_audit_entry.action = 'DELETE' THEN v_audit_entry.old_data  -- Restored
            END,
            jsonb_build_object(
                'reverted_audit_id', p_audit_log_id,
                'original_action', v_audit_entry.action,
                'revert_summary', v_revert_result
            ),
            now()
        ) RETURNING id INTO v_revert_audit_id;
        
        -- Mark original audit entry as reverted
        UPDATE audit_log
        SET reverted_at = now(),
            reverted_by = v_actor_id
        WHERE id = p_audit_log_id;
        
        -- Trigger layout recalculation if needed
        IF v_affected_node_id IS NOT NULL THEN
            -- Get the root for this profile
            DECLARE
                v_root_id UUID;
            BEGIN
                SELECT COALESCE(root, id) INTO v_root_id
                FROM profiles
                WHERE id = v_affected_node_id;
                
                PERFORM trigger_layout_recalc_async(v_root_id);
            END;
        END IF;
        
        v_revert_result := v_revert_result || jsonb_build_object(
            'revert_audit_id', v_revert_audit_id,
            'reverted', true
        );
    ELSE
        v_revert_result := v_revert_result || jsonb_build_object(
            'reverted', false,
            'message', 'Dry run - no changes made'
        );
    END IF;
    
    RETURN v_revert_result;
    
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
    p_root_id UUID DEFAULT NULL
) RETURNS TABLE (
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
    AND (p_root_id IS NULL OR 
         p.root = p_root_id OR p.id = p_root_id
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