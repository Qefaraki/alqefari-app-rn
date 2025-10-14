-- Migration 083: Fix admin_update_marriage Audit Log Column Error
-- Date: 2025-01-10
-- Fixes: admin_update_marriage tries to INSERT into 'action' column
--        but audit_log_enhanced table has 'action_type' column
-- Error: "column action of relation audit_log_enhanced does not exist"

BEGIN;

-- ============================================================================
-- Fix admin_update_marriage to Use Correct Column Name
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_update_marriage(
    p_marriage_id UUID,
    p_updates JSONB
) RETURNS marriages AS $$
DECLARE
    v_old_marriage marriages%ROWTYPE;
    v_updated_marriage marriages%ROWTYPE;
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_permission TEXT;
BEGIN
    -- Set search path for security
    SET search_path = public;

    -- Get current user's auth ID
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    -- Get actor's profile ID
    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE user_id = v_actor_id AND deleted_at IS NULL;

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No valid profile found';
    END IF;

    -- Lock and fetch the marriage
    SELECT * INTO v_old_marriage FROM marriages
    WHERE id = p_marriage_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found or deleted';
    END IF;

    -- Permission check: Can the actor edit either the husband or wife?
    -- Check husband permission
    SELECT check_family_permission_v4(v_actor_profile_id, v_old_marriage.husband_id)
    INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        -- If not authorized for husband, check wife permission
        SELECT check_family_permission_v4(v_actor_profile_id, v_old_marriage.wife_id)
        INTO v_permission;

        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to edit this marriage';
        END IF;
    END IF;

    -- Validate status value (only 'current' or 'past' allowed)
    IF p_updates ? 'status' THEN
        IF (p_updates->>'status') NOT IN ('current', 'past') THEN
            RAISE EXCEPTION 'Invalid status value: %. Must be ''current'' or ''past''', p_updates->>'status';
        END IF;
    END IF;

    -- Apply updates (whitelist approach for security)
    UPDATE marriages
    SET
        start_date = COALESCE((p_updates->>'start_date')::DATE, start_date),
        end_date = CASE
            WHEN p_updates ? 'end_date' AND (p_updates->>'end_date') IS NULL THEN NULL
            WHEN p_updates ? 'end_date' THEN (p_updates->>'end_date')::DATE
            ELSE end_date
        END,
        status = COALESCE(p_updates->>'status', status),
        updated_at = NOW()
    WHERE id = p_marriage_id
    RETURNING * INTO v_updated_marriage;

    -- Create audit log entry (FIXED: Use action_type instead of action)
    INSERT INTO audit_log_enhanced (
        table_name,
        record_id,
        action_type,  -- FIXED: Changed from 'action' to 'action_type'
        actor_id,
        old_data,
        new_data,
        changed_fields
    ) VALUES (
        'marriages',
        p_marriage_id,
        'UPDATE',
        v_actor_id,
        to_jsonb(v_old_marriage),
        to_jsonb(v_updated_marriage),
        ARRAY(
            SELECT jsonb_object_keys(p_updates)
        )
    );

    RETURN v_updated_marriage;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        RAISE WARNING 'admin_update_marriage error: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION admin_update_marriage(UUID, JSONB) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_update_marriage IS
    'Updates marriage record with permission checks.
     Only admins, moderators, or users with "inner" permission on either spouse can edit.
     Uses check_family_permission_v4 for access control.
     Creates audit log entry for all changes using action_type column.';

-- ============================================================================
-- Validation and Logging
-- ============================================================================

DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  -- Check if function was updated
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'admin_update_marriage'
  ) INTO v_function_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 083: Audit Log Column Fixed';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ admin_update_marriage function: %',
    CASE WHEN v_function_exists THEN 'DEPLOYED' ELSE 'MISSING' END;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixes applied:';
  RAISE NOTICE '  1. Changed INSERT column: action → action_type';
  RAISE NOTICE '  2. Marriage updates will now log correctly';
  RAISE NOTICE '========================================';

  -- Fail if function wasn't created
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration 083 failed: admin_update_marriage not found';
  END IF;
END $$;

COMMIT;
