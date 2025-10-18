-- Migration: create_undo_marriage_delete
-- Purpose: Enable undo functionality for marriage deletions
-- Required for: Undo system to recognize 'marriage_soft_delete' action type

-- Create undo_marriage_delete RPC function
CREATE OR REPLACE FUNCTION undo_marriage_delete(
  p_audit_log_id UUID,
  p_undo_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_entry audit_log_enhanced%ROWTYPE;
  v_actor_id UUID;
  v_actor_profile_id UUID;
  v_marriage marriages%ROWTYPE;
  v_permission TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Get current user
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

  -- Fetch the audit log entry with lock
  SELECT * INTO v_log_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Audit log entry not found'
    );
  END IF;

  -- Verify action type
  IF v_log_entry.action_type != 'marriage_soft_delete' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid action type. Expected: marriage_soft_delete, Got: ' || v_log_entry.action_type
    );
  END IF;

  -- Idempotency: Check if already undone
  IF v_log_entry.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This action has already been undone at ' || v_log_entry.undone_at
    );
  END IF;

  -- Get marriage from old_data (before deletion)
  BEGIN
    v_marriage := jsonb_populate_record(NULL::marriages, v_log_entry.old_data);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to parse marriage data from audit log'
      );
  END;

  -- Lock marriage row
  SELECT * INTO v_marriage
  FROM marriages
  WHERE id = v_marriage.id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Marriage record not found'
    );
  END IF;

  -- Check if marriage is actually deleted
  IF v_marriage.deleted_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Marriage is not deleted, cannot undo'
    );
  END IF;

  -- Permission check: Can undo if user has permission to edit either spouse
  SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.husband_id) INTO v_permission;
  IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
    SELECT check_family_permission_v4(v_actor_profile_id, v_marriage.wife_id) INTO v_permission;
    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient permissions to undo this marriage deletion'
      );
    END IF;
  END IF;

  -- Restore marriage by clearing deleted_at
  UPDATE marriages
  SET
    deleted_at = NULL,
    updated_at = v_now
  WHERE id = v_marriage.id;

  -- Mark original audit log entry as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = v_now,
    undone_by = v_actor_profile_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create new audit log entry for the undo action
  INSERT INTO audit_log_enhanced (
    table_name, record_id, action_type, actor_id,
    old_data, new_data, metadata, created_at
  ) VALUES (
    'marriages', v_marriage.id, 'undo', v_actor_id,
    v_log_entry.old_data,  -- Before restore (with deleted_at)
    to_jsonb(v_marriage),  -- After restore (deleted_at = NULL)
    jsonb_build_object(
      'undone_audit_log_id', p_audit_log_id,
      'original_action_type', 'marriage_soft_delete',
      'undo_reason', p_undo_reason
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'marriage_id', v_marriage.id,
    'husband_id', v_marriage.husband_id,
    'wife_id', v_marriage.wife_id,
    'message', 'تم استرجاع الزواج بنجاح'
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'عملية أخرى قيد التنفيذ. يرجى المحاولة مرة أخرى.'
    );
  WHEN OTHERS THEN
    RAISE WARNING 'undo_marriage_delete error: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION undo_marriage_delete(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION undo_marriage_delete IS 'Restores a soft-deleted marriage. Requires permission to edit either spouse. Time limit enforced by undo service (30 days for users, unlimited for admins).';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251018000003: Create undo_marriage_delete RPC';
  RAISE NOTICE '✅ undo_marriage_delete() function created';
  RAISE NOTICE '✅ Permission checks: Requires permission on husband OR wife';
  RAISE NOTICE '✅ Idempotency: Checks undone_at before proceeding';
  RAISE NOTICE '✅ Audit trail: Creates new audit log entry with action_type=undo';
  RAISE NOTICE '✅ Next step: Add to undoService.js ACTION_TYPE_CONFIG registry';
END $$;
