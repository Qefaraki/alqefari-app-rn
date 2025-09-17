-- ============================================================================
-- CASCADE DELETE SYSTEM WITH IMPACT PREVIEW
-- ============================================================================
-- This migration creates a comprehensive cascade delete system with:
-- 1. Impact preview showing exactly what will be deleted
-- 2. Safe cascade soft delete
-- 3. Restore capabilities
-- 4. Audit logging

-- Function to preview delete impact (shows what would be deleted)
CREATE OR REPLACE FUNCTION admin_preview_delete_impact(p_profile_id UUID)
RETURNS TABLE (
    total_affected INT,
    direct_children INT,
    total_descendants INT,
    generations_affected INT,
    details JSONB
)
SECURITY DEFINER
AS $$
DECLARE
    v_profile profiles;
    v_direct_children INT;
    v_descendants_by_generation JSONB;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get the profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or already deleted';
    END IF;
    
    -- Count direct children
    SELECT COUNT(*) INTO v_direct_children 
    FROM profiles 
    WHERE (father_id = p_profile_id OR mother_id = p_profile_id)
        AND deleted_at IS NULL;
    
    -- Get all descendants with generation breakdown
    WITH RECURSIVE descendants AS (
        -- Start with direct children
        SELECT 
            id, 
            name, 
            gender,
            1 as relative_generation,
            CASE 
                WHEN father_id = p_profile_id THEN 'father'
                ELSE 'mother'
            END as parent_type
        FROM profiles 
        WHERE (father_id = p_profile_id OR mother_id = p_profile_id)
            AND deleted_at IS NULL
        
        UNION ALL
        
        -- Recursively get all descendants
        SELECT 
            p.id, 
            p.name, 
            p.gender,
            d.relative_generation + 1,
            d.parent_type
        FROM profiles p
        INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
        WHERE p.deleted_at IS NULL
    ),
    generation_counts AS (
        SELECT 
            relative_generation,
            COUNT(*) as count,
            jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'name', name,
                    'gender', gender
                ) ORDER BY name
            ) as members
        FROM descendants
        GROUP BY relative_generation
        ORDER BY relative_generation
    )
    SELECT jsonb_object_agg(
        CASE relative_generation
            WHEN 1 THEN 'أبناء'
            WHEN 2 THEN 'أحفاد'
            WHEN 3 THEN 'أبناء أحفاد'
            ELSE 'الجيل ' || relative_generation
        END,
        jsonb_build_object(
            'count', count,
            'members', members
        )
    ) INTO v_descendants_by_generation
    FROM generation_counts;
    
    -- Return the impact summary
    RETURN QUERY
    SELECT 
        1 + COALESCE((SELECT COUNT(*) FROM descendants), 0)::INT as total_affected,
        v_direct_children as direct_children,
        COALESCE((SELECT COUNT(*) FROM descendants), 0)::INT as total_descendants,
        COALESCE((SELECT MAX(relative_generation) FROM descendants), 0)::INT as generations_affected,
        jsonb_build_object(
            'profile', jsonb_build_object(
                'id', v_profile.id,
                'name', v_profile.name,
                'hid', v_profile.hid
            ),
            'descendants_by_generation', COALESCE(v_descendants_by_generation, '{}'::jsonb),
            'has_marriages', EXISTS(
                SELECT 1 FROM marriages 
                WHERE (husband_id = p_profile_id OR wife_id = p_profile_id)
            )
        ) as details;
END;
$$ LANGUAGE plpgsql;

-- Enhanced cascade delete function with safety checks
CREATE OR REPLACE FUNCTION admin_cascade_delete_profile(
    p_profile_id UUID,
    p_confirm_cascade BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_deleted_count INT := 0;
    v_deleted_ids UUID[];
    v_profile profiles;
    v_has_children BOOLEAN;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    v_actor_id := auth.uid();
    
    -- Get the profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or already deleted';
    END IF;
    
    -- Check for children
    SELECT EXISTS(
        SELECT 1 FROM profiles 
        WHERE (father_id = p_profile_id OR mother_id = p_profile_id)
            AND deleted_at IS NULL
    ) INTO v_has_children;
    
    -- If has children and cascade not confirmed, raise exception with details
    IF v_has_children AND NOT p_confirm_cascade THEN
        RAISE EXCEPTION 'Profile has children. Call admin_preview_delete_impact first, then confirm cascade delete.';
    END IF;
    
    -- Perform cascade soft delete if confirmed
    IF p_confirm_cascade AND v_has_children THEN
        -- Delete all descendants
        WITH RECURSIVE descendants AS (
            SELECT id FROM profiles WHERE id = p_profile_id
            UNION ALL
            SELECT p.id 
            FROM profiles p
            INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
            WHERE p.deleted_at IS NULL
        )
        UPDATE profiles
        SET 
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id IN (SELECT id FROM descendants)
            AND deleted_at IS NULL
        RETURNING id INTO v_deleted_ids;
        
        v_deleted_count := array_length(v_deleted_ids, 1);
        
        -- Log cascade deletion
        INSERT INTO audit_log (
            actor_id,
            action,
            table_name,
            record_id,
            old_data,
            metadata
        )
        VALUES (
            v_actor_id,
            'CASCADE_DELETE',
            'profiles',
            p_profile_id,
            to_jsonb(v_profile),
            jsonb_build_object(
                'deleted_count', v_deleted_count,
                'deleted_ids', v_deleted_ids,
                'cascade', true
            )
        );
    ELSE
        -- Simple soft delete (no children or single profile)
        UPDATE profiles
        SET 
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = p_profile_id
            AND deleted_at IS NULL
        RETURNING id INTO v_deleted_ids;
        
        v_deleted_count := 1;
        
        -- Log simple deletion
        INSERT INTO audit_log (
            actor_id,
            action,
            table_name,
            record_id,
            old_data,
            metadata
        )
        VALUES (
            v_actor_id,
            'DELETE',
            'profiles',
            p_profile_id,
            to_jsonb(v_profile),
            jsonb_build_object('cascade', false)
        );
    END IF;
    
    -- Trigger layout recalculation for parent
    IF v_profile.father_id IS NOT NULL THEN
        PERFORM trigger_layout_recalc_async(v_profile.father_id);
    ELSIF v_profile.mother_id IS NOT NULL THEN
        PERFORM trigger_layout_recalc_async(v_profile.mother_id);
    END IF;
    
    -- Return summary
    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'deleted_ids', v_deleted_ids,
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'name', v_profile.name,
            'hid', v_profile.hid
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft-deleted profiles
CREATE OR REPLACE FUNCTION admin_restore_deleted_profile(
    p_profile_id UUID,
    p_restore_descendants BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_restored_count INT := 0;
    v_profile profiles;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    v_actor_id := auth.uid();
    
    -- Get the deleted profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id AND deleted_at IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deleted profile not found';
    END IF;
    
    -- Restore the profile
    UPDATE profiles
    SET 
        deleted_at = NULL,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_profile_id;
    
    v_restored_count := 1;
    
    -- Optionally restore descendants
    IF p_restore_descendants THEN
        WITH RECURSIVE descendants AS (
            SELECT id FROM profiles WHERE id = p_profile_id
            UNION ALL
            SELECT p.id 
            FROM profiles p
            INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
            WHERE p.deleted_at IS NOT NULL
        )
        UPDATE profiles
        SET 
            deleted_at = NULL,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id IN (SELECT id FROM descendants WHERE id != p_profile_id)
            AND deleted_at IS NOT NULL;
        
        GET DIAGNOSTICS v_restored_count = ROW_COUNT;
        v_restored_count := v_restored_count + 1;
    END IF;
    
    -- Log restoration
    INSERT INTO audit_log (
        actor_id,
        action,
        table_name,
        record_id,
        new_data,
        metadata
    )
    VALUES (
        v_actor_id,
        'RESTORE',
        'profiles',
        p_profile_id,
        to_jsonb(v_profile),
        jsonb_build_object(
            'restored_count', v_restored_count,
            'restore_descendants', p_restore_descendants
        )
    );
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(p_profile_id);
    
    RETURN jsonb_build_object(
        'success', true,
        'restored_count', v_restored_count,
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'name', v_profile.name,
            'hid', v_profile.hid
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to list deleted profiles (for restore UI)
CREATE OR REPLACE FUNCTION admin_list_deleted_profiles()
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    gender TEXT,
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT,
    parent_name TEXT,
    descendants_count BIGINT
)
SECURITY DEFINER
AS $$
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    RETURN QUERY
    WITH descendant_counts AS (
        SELECT 
            p.id,
            COUNT(DISTINCT d.id) as desc_count
        FROM profiles p
        LEFT JOIN profiles d ON (d.father_id = p.id OR d.mother_id = p.id)
            AND d.deleted_at IS NOT NULL
        WHERE p.deleted_at IS NOT NULL
        GROUP BY p.id
    )
    SELECT 
        p.id,
        p.hid,
        p.name,
        p.gender,
        p.deleted_at,
        COALESCE(u.email, 'Unknown') as deleted_by,
        COALESCE(father.name, mother.name) as parent_name,
        COALESCE(dc.desc_count, 0) as descendants_count
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.updated_by
    LEFT JOIN profiles father ON father.id = p.father_id
    LEFT JOIN profiles mother ON mother.id = p.mother_id
    LEFT JOIN descendant_counts dc ON dc.id = p.id
    WHERE p.deleted_at IS NOT NULL
    ORDER BY p.deleted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if one profile is a descendant of another
CREATE OR REPLACE FUNCTION check_is_descendant(
    p_profile_id UUID,
    p_ancestor_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    -- Check if p_profile_id is a descendant of p_ancestor_id
    RETURN EXISTS(
        WITH RECURSIVE ancestors AS (
            SELECT id, father_id, mother_id
            FROM profiles
            WHERE id = p_profile_id
            
            UNION ALL
            
            SELECT p.id, p.father_id, p.mother_id
            FROM profiles p
            INNER JOIN ancestors a ON (p.id = a.father_id OR p.id = a.mother_id)
            WHERE p.id IS NOT NULL
        )
        SELECT 1 FROM ancestors WHERE father_id = p_ancestor_id OR mother_id = p_ancestor_id
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_is_descendant TO authenticated;
GRANT EXECUTE ON FUNCTION admin_preview_delete_impact TO authenticated;
GRANT EXECUTE ON FUNCTION admin_cascade_delete_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_restore_deleted_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_deleted_profiles TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION admin_preview_delete_impact IS 'Preview the impact of deleting a profile, showing all descendants that would be affected';
COMMENT ON FUNCTION admin_cascade_delete_profile IS 'Soft delete a profile with optional cascade to all descendants';
COMMENT ON FUNCTION admin_restore_deleted_profile IS 'Restore a soft-deleted profile with optional restoration of descendants';
COMMENT ON FUNCTION admin_list_deleted_profiles IS 'List all soft-deleted profiles for restoration UI';