-- Migration 086: Admin Soft Delete Marriage
-- Purpose: Soft delete marriage records with permission checks and audit trail
-- Date: 2025-01-13
-- Follows pattern from: Migration 084b (cascade soft delete)

BEGIN;

-- ============================================================================
-- Create admin_soft_delete_marriage Function
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_soft_delete_marriage(
    p_marriage_id UUID
)
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
    -- Set search path for security
    SET search_path = public;

    -- Get auth user
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

    -- Lock and fetch marriage before soft delete
    SELECT * INTO v_marriage
    FROM marriages
    WHERE id = p_marriage_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Marriage not found or already deleted'
        );
    END IF;

    -- Permission check: Can edit EITHER husband OR wife
    SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.husband_id)
    INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        -- Not authorized for husband, check wife
        SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.wife_id)
        INTO v_permission;

        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to delete this marriage';
        END IF;
    END IF;

    -- Soft delete the marriage
    UPDATE marriages
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_marriage_id;

    -- Audit log (CRITICAL: Use 'action_type' not 'action')
    INSERT INTO audit_log_enhanced (
        table_name,
        record_id,
        action_type,
        actor_id,
        old_data,
        new_data,
        created_at
    ) VALUES (
        'marriages',
        p_marriage_id,
        'SOFT_DELETE',
        v_actor_id,
        to_jsonb(v_marriage),
        jsonb_build_object('deleted_at', NOW()),
        NOW()
    );

    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'marriage_id', p_marriage_id,
        'husband_id', v_marriage.husband_id,
        'wife_id', v_marriage.wife_id
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        RAISE WARNING 'admin_soft_delete_marriage error: %', SQLERRM;
        RAISE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_soft_delete_marriage(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_soft_delete_marriage IS
    'Soft deletes a marriage record with permission checks and audit logging.
     Permission: admin, moderator, or "inner" permission on EITHER spouse.
     Uses same permission model as admin_update_marriage.
     Children mother_id relationships are preserved.
     Marriage will disappear from get_profile_family_data queries (filtered by deleted_at IS NULL).';

-- ============================================================================
-- Validation and Logging
-- ============================================================================

DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  -- Check if function was created
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'admin_soft_delete_marriage'
  ) INTO v_function_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 086: Soft Delete Marriage';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ admin_soft_delete_marriage function: %',
    CASE WHEN v_function_exists THEN 'DEPLOYED' ELSE 'MISSING' END;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  1. Soft delete (sets deleted_at timestamp)';
  RAISE NOTICE '  2. Permission check (admin/moderator/inner on either spouse)';
  RAISE NOTICE '  3. Row-level lock (FOR UPDATE)';
  RAISE NOTICE '  4. Audit trail (action_type=SOFT_DELETE)';
  RAISE NOTICE '  5. Children mother_id preserved';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixes:';
  RAISE NOTICE '  - Silent delete button failure (no RLS DELETE policy)';
  RAISE NOTICE '  - Marriage disappears from UI immediately';
  RAISE NOTICE '========================================';

  -- Fail if function wasn't created
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration 086 failed: admin_soft_delete_marriage not found';
  END IF;
END $$;

COMMIT;
