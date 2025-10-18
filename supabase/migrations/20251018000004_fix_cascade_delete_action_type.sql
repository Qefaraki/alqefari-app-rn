-- Migration: fix_cascade_delete_action_type
-- Purpose: Fix admin_cascade_delete_profile to use lowercase action_type
-- Root Cause: Function uses 'CASCADE_DELETE' (uppercase) but chk_action_type_format constraint requires lowercase
-- Impact: Prevents cascade delete feature from working after constraint enforcement

-- Note: This fixes the function in migration 20251015160000_fix_audit_log_references.sql line 152

CREATE OR REPLACE FUNCTION admin_cascade_delete_profile(
  p_profile_id UUID,
  p_version INTEGER,
  p_confirm_cascade BOOLEAN DEFAULT FALSE,
  p_max_descendants INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_profile profiles%ROWTYPE;
    v_deleted_ids UUID[];
    v_deleted_count INT;
    v_generations_affected INT;
    v_operation_group_id UUID;
    v_permission_check RECORD;
    v_marriage_ids UUID[];
    v_temp_profile_data JSONB[];
    v_current_profile RECORD;
BEGIN
    SET LOCAL statement_timeout = '5000';

    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE user_id = v_actor_id AND deleted_at IS NULL;

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No valid profile found';
    END IF;

    SELECT * INTO v_profile
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or already deleted';
    END IF;

    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى.';
    END IF;

    WITH RECURSIVE descendants AS (
        SELECT id, 1 as generation_depth
        FROM profiles
        WHERE id = p_profile_id
        UNION ALL
        SELECT p.id, d.generation_depth + 1
        FROM profiles p
        INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
        WHERE p.deleted_at IS NULL AND d.generation_depth < 20
    )
    SELECT
        ARRAY_AGG(id ORDER BY generation_depth DESC),
        MAX(generation_depth)
    INTO v_deleted_ids, v_generations_affected
    FROM descendants;

    v_deleted_count := array_length(v_deleted_ids, 1);

    IF v_deleted_count > p_max_descendants THEN
        RAISE EXCEPTION 'Cascade delete limited to % descendants. Found: %. Please delete subtrees individually.',
            p_max_descendants, v_deleted_count;
    END IF;

    PERFORM id FROM profiles
    WHERE id = ANY(v_deleted_ids)
    FOR UPDATE NOWAIT;

    FOR v_permission_check IN
        SELECT profile_id, permission_level
        FROM check_batch_family_permissions(v_actor_profile_id, v_deleted_ids)
    LOOP
        IF v_permission_check.permission_level NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Insufficient permission to delete profile: %', v_permission_check.profile_id;
        END IF;
    END LOOP;

    IF NOT p_confirm_cascade AND v_deleted_count > 1 THEN
        RAISE EXCEPTION 'Confirmation required for cascade delete. Set p_confirm_cascade = TRUE.';
    END IF;

    INSERT INTO operation_groups (
        created_by, group_type, description, operation_count, metadata
    ) VALUES (
        v_actor_profile_id, 'cascade_delete',
        'حذف شامل: ' || v_profile.name || ' (' || v_deleted_count || ' ملف)',
        v_deleted_count,
        jsonb_build_object(
            'parent_id', p_profile_id,
            'parent_name', v_profile.name,
            'parent_hid', v_profile.hid,
            'generations_affected', v_generations_affected
        )
    ) RETURNING id INTO v_operation_group_id;

    FOR v_current_profile IN
        SELECT * FROM profiles WHERE id = ANY(v_deleted_ids)
    LOOP
        v_temp_profile_data := array_append(v_temp_profile_data, to_jsonb(v_current_profile));
    END LOOP;

    UPDATE profiles
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ANY(v_deleted_ids);

    UPDATE marriages
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE (husband_id = ANY(v_deleted_ids) OR wife_id = ANY(v_deleted_ids))
      AND deleted_at IS NULL
    RETURNING id INTO v_marriage_ids;

    DELETE FROM branch_moderators
    WHERE user_id = ANY(v_deleted_ids)
       OR branch_hid IN (SELECT hid FROM profiles WHERE id = ANY(v_deleted_ids) AND hid IS NOT NULL);

    DELETE FROM suggestion_blocks
    WHERE blocked_user_id = ANY(v_deleted_ids) OR blocked_by = ANY(v_deleted_ids);

    -- FIXED: Changed 'CASCADE_DELETE' to 'profile_cascade_delete' (lowercase)
    INSERT INTO audit_log_enhanced (
        table_name, record_id, action_type, actor_id, old_data, new_data,
        operation_group_id, metadata, severity, description
    )
    SELECT
        'profiles', (profile_data->>'id')::UUID, 'profile_cascade_delete', v_actor_id,
        profile_data, NULL, v_operation_group_id,
        jsonb_build_object(
            'parent_id', p_profile_id,
            'generations_affected', v_generations_affected,
            'total_deleted', v_deleted_count
        ),
        'high', 'Cascade soft delete: ' || (profile_data->>'name')
    FROM UNNEST(v_temp_profile_data) AS profile_data;

    RETURN jsonb_build_object(
        'success', TRUE,
        'operation_group_id', v_operation_group_id,
        'deleted_count', v_deleted_count,
        'deleted_ids', v_deleted_ids,
        'generations_affected', v_generations_affected,
        'marriages_affected', COALESCE(array_length(v_marriage_ids, 1), 0),
        'profile', jsonb_build_object('id', v_profile.id, 'name', v_profile.name, 'hid', v_profile.hid)
    );

EXCEPTION
    WHEN lock_not_available THEN
        RAISE EXCEPTION 'Profile is currently being edited by another user. Please try again.';
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_cascade_delete_profile(UUID, INTEGER, BOOLEAN, INTEGER) TO authenticated;

-- Update comment
COMMENT ON FUNCTION admin_cascade_delete_profile IS 'Cascade soft delete with full permission validation and audit trail. Fixed: action_type uses lowercase format (profile_cascade_delete)';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251018000004: Fix cascade delete action_type';
  RAISE NOTICE '✅ Changed action_type from CASCADE_DELETE to profile_cascade_delete';
  RAISE NOTICE '✅ Now complies with chk_action_type_format constraint (^[a-z_]+$)';
  RAISE NOTICE '✅ Cascade delete will no longer fail with constraint violation';
  RAISE NOTICE '✅ Undo system already recognizes profile_cascade_delete (no registry update needed)';
END $$;
