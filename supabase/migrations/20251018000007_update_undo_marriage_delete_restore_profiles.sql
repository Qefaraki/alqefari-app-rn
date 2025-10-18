-- Migration: update_undo_marriage_delete_restore_profiles
-- Purpose: Update undo_marriage_delete to restore any profiles that were auto-deleted during marriage deletion
-- Behavior: When undoing marriage deletion, if spouse profile was deleted (orphaned munasib), restore it

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
  v_deleted_profile_ids UUID[];
  v_restored_profile_ids UUID[] := '{}';
  v_profile_record profiles%ROWTYPE;
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

  -- Extract deleted_profile_ids from metadata (if any)
  IF v_log_entry.metadata ? 'auto_cleaned_profiles' THEN
    v_deleted_profile_ids := ARRAY(
      SELECT jsonb_array_elements_text(v_log_entry.metadata->'auto_cleaned_profiles')::UUID
    );
  END IF;

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

  -- STEP 1: Restore any deleted profiles (orphaned munasib)
  IF v_deleted_profile_ids IS NOT NULL AND array_length(v_deleted_profile_ids, 1) > 0 THEN
    -- Restore each deleted profile
    FOREACH v_profile_record.id IN ARRAY v_deleted_profile_ids
    LOOP
      -- Lock profile for update
      SELECT * INTO v_profile_record
      FROM profiles
      WHERE id = v_profile_record.id
      FOR UPDATE;

      IF FOUND AND v_profile_record.deleted_at IS NOT NULL THEN
        -- Restore profile
        UPDATE profiles
        SET deleted_at = NULL, updated_at = v_now
        WHERE id = v_profile_record.id;

        v_restored_profile_ids := array_append(v_restored_profile_ids, v_profile_record.id);

        -- Restore parent references in children (if this profile was father)
        UPDATE profiles
        SET father_id = v_profile_record.id, updated_at = v_now
        WHERE father_id IS NULL
          AND id IN (
            SELECT id FROM profiles
            WHERE (mother_id = v_marriage.husband_id OR mother_id = v_marriage.wife_id)
              AND deleted_at IS NULL
          )
          AND v_profile_record.id = v_marriage.husband_id;

        -- Restore parent references in children (if this profile was mother)
        UPDATE profiles
        SET mother_id = v_profile_record.id, updated_at = v_now
        WHERE mother_id IS NULL
          AND id IN (
            SELECT id FROM profiles
            WHERE (father_id = v_marriage.husband_id OR father_id = v_marriage.wife_id)
              AND deleted_at IS NULL
          )
          AND v_profile_record.id = v_marriage.wife_id;
      END IF;
    END LOOP;
  END IF;

  -- STEP 2: Restore marriage by clearing deleted_at
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
      'undo_reason', p_undo_reason,
      'restored_profile_ids', v_restored_profile_ids
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'marriage_id', v_marriage.id,
    'husband_id', v_marriage.husband_id,
    'wife_id', v_marriage.wife_id,
    'restored_profile_ids', v_restored_profile_ids,
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

-- Update comment
COMMENT ON FUNCTION undo_marriage_delete IS 'Restores a soft-deleted marriage and any auto-deleted orphaned profiles. Requires permission to edit either spouse. Time limit enforced by undo service (30 days for users, unlimited for admins).';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'MIGRATION 20251018000007: Undo Marriage Delete with Profile Restoration';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New Behavior:';
  RAISE NOTICE '  1. Restore marriage (clear deleted_at)';
  RAISE NOTICE '  2. If marriage deletion deleted profiles:';
  RAISE NOTICE '     → Restore deleted profiles';
  RAISE NOTICE '     → Restore parent references in children';
  RAISE NOTICE '  3. Mark audit log as undone';
  RAISE NOTICE '  4. Create undo audit log entry';
  RAISE NOTICE '';
  RAISE NOTICE 'Metadata Tracking:';
  RAISE NOTICE '  ✅ Reads auto_cleaned_profiles from original audit log';
  RAISE NOTICE '  ✅ Returns restored_profile_ids in response';
  RAISE NOTICE '  ✅ Stores restored_profile_ids in undo audit log';
  RAISE NOTICE '';
  RAISE NOTICE 'Safety:';
  RAISE NOTICE '  ✅ Row-level locks prevent race conditions';
  RAISE NOTICE '  ✅ Idempotency check (undone_at)';
  RAISE NOTICE '  ✅ Permission checks on both spouses';
  RAISE NOTICE '  ✅ Atomic transaction (all or nothing)';
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
END $$;
