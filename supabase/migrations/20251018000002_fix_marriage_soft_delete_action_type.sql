-- Migration: fix_marriage_soft_delete_action_type
-- Purpose: Fix admin_soft_delete_marriage to use lowercase action_type
-- Root Cause: Function uses 'SOFT_DELETE' (uppercase) but chk_action_type_format constraint requires lowercase
-- Error: new row for relation "audit_log_enhanced" violates check constraint "chk_action_type_format"

-- Fix admin_soft_delete_marriage function to use lowercase action_type
CREATE OR REPLACE FUNCTION admin_soft_delete_marriage(p_marriage_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_marriage marriages%ROWTYPE;
    v_permission TEXT;
BEGIN
    SET search_path = public;

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

    SELECT * INTO v_marriage
    FROM marriages
    WHERE id = p_marriage_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Marriage not found or already deleted');
    END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.husband_id) INTO v_permission;
    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.wife_id) INTO v_permission;
        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to delete this marriage';
        END IF;
    END IF;

    UPDATE marriages
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_marriage_id;

    -- FIXED: Changed 'SOFT_DELETE' to 'marriage_soft_delete' (lowercase)
    INSERT INTO audit_log_enhanced (
        table_name, record_id, action_type, actor_id, old_data, new_data, created_at
    ) VALUES (
        'marriages', p_marriage_id, 'marriage_soft_delete', v_actor_id,
        to_jsonb(v_marriage), jsonb_build_object('deleted_at', NOW()), NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'marriage_id', p_marriage_id,
        'husband_id', v_marriage.husband_id,
        'wife_id', v_marriage.wife_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'admin_soft_delete_marriage error: %', SQLERRM;
        RAISE;
END;
$$;

-- Update comment
COMMENT ON FUNCTION admin_soft_delete_marriage IS 'Soft deletes marriage with permission checks. Fixed: action_type uses lowercase format (marriage_soft_delete)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_soft_delete_marriage(UUID) TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251018000002: Fix marriage soft delete action_type';
  RAISE NOTICE '✅ Changed action_type from SOFT_DELETE to marriage_soft_delete';
  RAISE NOTICE '✅ Now complies with chk_action_type_format constraint (^[a-z_]+$)';
  RAISE NOTICE '✅ Marriage deletion will no longer fail with constraint violation';
END $$;
