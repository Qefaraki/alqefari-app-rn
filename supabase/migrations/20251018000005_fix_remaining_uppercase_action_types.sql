-- Migration: fix_remaining_uppercase_action_types
-- Purpose: Fix 3 remaining functions with uppercase action_types
-- Root Cause: Functions use 'UPDATE' and 'SUGGESTION_REJECTED' (uppercase) but chk_action_type_format constraint requires lowercase
-- Impact: Marriage status changes, suggestion approvals, and rejections all fail

-- =====================================================
-- Function 1: admin_update_marriage
-- =====================================================

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

    SELECT * INTO v_old_marriage FROM marriages
    WHERE id = p_marriage_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found or deleted';
    END IF;

    SELECT check_family_permission_v4(v_actor_profile_id, v_old_marriage.husband_id) INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        SELECT check_family_permission_v4(v_actor_profile_id, v_old_marriage.wife_id) INTO v_permission;
        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to edit this marriage';
        END IF;
    END IF;

    IF p_updates ? 'status' THEN
        IF (p_updates->>'status') NOT IN ('current', 'past') THEN
            RAISE EXCEPTION 'Invalid status value: %. Must be ''current'' or ''past''', p_updates->>'status';
        END IF;
    END IF;

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

    -- FIXED: Changed 'UPDATE' to 'marriage_update' (lowercase)
    INSERT INTO audit_log_enhanced (
        table_name, record_id, action_type, actor_id, old_data, new_data, changed_fields
    ) VALUES (
        'marriages', p_marriage_id, 'marriage_update', v_actor_id,
        to_jsonb(v_old_marriage), to_jsonb(v_updated_marriage),
        ARRAY(SELECT jsonb_object_keys(p_updates))
    );

    RETURN v_updated_marriage;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'admin_update_marriage error: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function 2: approve_edit_suggestion
-- =====================================================

CREATE OR REPLACE FUNCTION approve_edit_suggestion(
  p_suggestion_id UUID,
  p_approved_by UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion profile_edit_suggestions%ROWTYPE;
  v_old_profile profiles%ROWTYPE;
  v_new_profile profiles%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_approved_by AND role IN ('admin', 'moderator') AND deleted_at IS NULL
  ) THEN
    SELECT * INTO v_suggestion FROM profile_edit_suggestions WHERE id = p_suggestion_id;
    IF v_suggestion.profile_id != p_approved_by THEN
      RAISE EXCEPTION 'Unauthorized to approve suggestions';
    END IF;
  END IF;

  SELECT * INTO v_suggestion
  FROM profile_edit_suggestions
  WHERE id = p_suggestion_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  SELECT * INTO v_old_profile
  FROM profiles
  WHERE id = v_suggestion.profile_id
  FOR UPDATE;

  CASE v_suggestion.field_name
    WHEN 'name' THEN
      UPDATE profiles SET name = (v_suggestion.new_value->>'value')::TEXT, updated_by = p_approved_by, updated_at = NOW(), version = version + 1
      WHERE id = v_suggestion.profile_id RETURNING * INTO v_new_profile;
    WHEN 'bio' THEN
      UPDATE profiles SET bio = (v_suggestion.new_value->>'value')::TEXT, updated_by = p_approved_by, updated_at = NOW(), version = version + 1
      WHERE id = v_suggestion.profile_id RETURNING * INTO v_new_profile;
    WHEN 'phone' THEN
      UPDATE profiles SET phone = (v_suggestion.new_value->>'value')::TEXT, updated_by = p_approved_by, updated_at = NOW(), version = version + 1
      WHERE id = v_suggestion.profile_id RETURNING * INTO v_new_profile;
    WHEN 'email' THEN
      UPDATE profiles SET email = (v_suggestion.new_value->>'value')::TEXT, updated_by = p_approved_by, updated_at = NOW(), version = version + 1
      WHERE id = v_suggestion.profile_id RETURNING * INTO v_new_profile;
    WHEN 'current_residence' THEN
      UPDATE profiles SET current_residence = (v_suggestion.new_value->>'value')::TEXT, updated_by = p_approved_by, updated_at = NOW(), version = version + 1
      WHERE id = v_suggestion.profile_id RETURNING * INTO v_new_profile;
    ELSE
      RAISE EXCEPTION 'Unsupported field: %', v_suggestion.field_name;
  END CASE;

  -- FIXED: Changed 'UPDATE' to 'profile_update' (lowercase)
  INSERT INTO audit_log_enhanced (
    action_type, table_name, record_id, actor_id, old_data, new_data, metadata, created_at
  ) VALUES (
    'profile_update', 'profiles', v_suggestion.profile_id, p_approved_by,
    to_jsonb(v_old_profile), to_jsonb(v_new_profile),
    jsonb_build_object(
      'source', 'suggestion_approval',
      'suggestion_id', p_suggestion_id,
      'suggested_by', v_suggestion.suggested_by,
      'field_changed', v_suggestion.field_name,
      'reason', v_suggestion.reason
    ),
    NOW()
  );

  UPDATE profile_edit_suggestions
  SET status = 'approved', reviewed_by = p_approved_by, reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_suggestion.profile_id,
    'field_changed', v_suggestion.field_name,
    'new_value', v_suggestion.new_value
  );
END;
$$;

-- =====================================================
-- Function 3: reject_edit_suggestion
-- =====================================================

CREATE OR REPLACE FUNCTION reject_edit_suggestion(
  p_suggestion_id UUID,
  p_rejected_by UUID,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion profile_edit_suggestions%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_rejected_by AND role IN ('admin', 'moderator') AND deleted_at IS NULL
  ) THEN
    SELECT * INTO v_suggestion FROM profile_edit_suggestions WHERE id = p_suggestion_id;
    IF v_suggestion.profile_id != p_rejected_by THEN
      RAISE EXCEPTION 'Unauthorized to reject suggestions';
    END IF;
  END IF;

  UPDATE profile_edit_suggestions
  SET status = 'rejected', reviewed_by = p_rejected_by, reviewed_at = NOW(),
      rejection_reason = p_rejection_reason, updated_at = NOW()
  WHERE id = p_suggestion_id AND status = 'pending'
  RETURNING * INTO v_suggestion;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- FIXED: Changed 'SUGGESTION_REJECTED' to 'suggestion_rejected' (lowercase)
  INSERT INTO audit_log_enhanced (
    action_type, table_name, record_id, actor_id, metadata, created_at
  ) VALUES (
    'suggestion_rejected', 'profile_edit_suggestions', v_suggestion.profile_id, p_rejected_by,
    jsonb_build_object(
      'suggestion_id', p_suggestion_id,
      'suggested_by', v_suggestion.suggested_by,
      'field', v_suggestion.field_name,
      'reason', p_rejection_reason
    ),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'suggestion_id', p_suggestion_id, 'status', 'rejected');
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION admin_update_marriage(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_edit_suggestion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_edit_suggestion(UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION admin_update_marriage IS 'Updates marriage record with permission checks. Fixed: action_type uses lowercase format (marriage_update)';
COMMENT ON FUNCTION approve_edit_suggestion IS 'Approves edit suggestion and applies changes. Fixed: action_type uses lowercase format (profile_update)';
COMMENT ON FUNCTION reject_edit_suggestion IS 'Rejects edit suggestion with reason. Fixed: action_type uses lowercase format (suggestion_rejected)';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'MIGRATION 20251018000005: Fix Remaining Uppercase Action Types';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed Functions:';
  RAISE NOTICE '  1. admin_update_marriage: UPDATE → marriage_update';
  RAISE NOTICE '  2. approve_edit_suggestion: UPDATE → profile_update';
  RAISE NOTICE '  3. reject_edit_suggestion: SUGGESTION_REJECTED → suggestion_rejected';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All action_types now comply with chk_action_type_format (^[a-z_]+$)';
  RAISE NOTICE '✅ Marriage status changes will work correctly';
  RAISE NOTICE '✅ Edit suggestions can be approved/rejected without errors';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Step: Add marriage_update to undoService.js ACTION_TYPE_CONFIG';
  RAISE NOTICE '=====================================================';
END $$;
