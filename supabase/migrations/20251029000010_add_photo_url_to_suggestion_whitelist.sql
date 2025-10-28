-- Migration: Add photo_url to suggestion system whitelist
-- Date: 2025-10-29
-- Purpose: Allow users with 'suggest' permission to propose photo deletion/changes
--
-- Changes:
-- 1. Update submit_edit_suggestion_v4 RPC to include photo_url in whitelist
--
-- Impact: Users with 'suggest' permission can now create photo change suggestions
-- that will appear in admin suggestion review interface

CREATE OR REPLACE FUNCTION submit_edit_suggestion_v4(
  p_profile_id UUID,
  p_field_name TEXT,
  p_new_value TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion_id UUID;
  v_old_value TEXT;
  v_permission TEXT;
  v_suggestions_today INT;
  v_column_allowed BOOLEAN;
BEGIN
  -- Validate field name against whitelist
  -- ADDED: photo_url to allowed fields
  v_column_allowed := p_field_name IN (
    'display_name', 'phone', 'email', 'date_of_birth',
    'place_of_birth', 'current_location', 'occupation',
    'bio', 'instagram', 'twitter', 'linkedin', 'notes',
    'photo_url'  -- NEW: Allow photo suggestions
  );

  IF NOT v_column_allowed THEN
    RAISE EXCEPTION 'Field % is not allowed for editing', p_field_name;
  END IF;

  -- Check permission
  v_permission := check_family_permission_v4(auth.uid(), p_profile_id);

  IF v_permission = 'blocked' THEN
    RAISE EXCEPTION 'You are blocked from making suggestions';
  END IF;

  IF v_permission = 'none' THEN
    RAISE EXCEPTION 'You do not have permission to suggest edits for this profile';
  END IF;

  -- Check rate limit (10 suggestions per day)
  SELECT COUNT(*) INTO v_suggestions_today
  FROM profile_edit_suggestions
  WHERE submitter_id = auth.uid()
  AND created_at >= CURRENT_DATE;

  IF v_suggestions_today >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum 10 suggestions per day.';
  END IF;

  -- Get current value using safe dynamic SQL
  EXECUTE format(
    'SELECT %I FROM profiles WHERE id = $1',
    p_field_name
  ) INTO v_old_value USING p_profile_id;

  -- If user has inner circle permission, apply immediately
  IF v_permission IN ('inner', 'admin', 'moderator') THEN
    -- Direct update
    EXECUTE format(
      'UPDATE profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
      p_field_name
    ) USING p_new_value, p_profile_id;

    -- Log the direct edit (if audit_log exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
      INSERT INTO audit_log (
        action, entity_type, entity_id,
        changed_by, details, created_at
      ) VALUES (
        'DIRECT_EDIT', 'profiles', p_profile_id,
        auth.uid(),
        jsonb_build_object(
          'field', p_field_name,
          'old_value', v_old_value,
          'new_value', p_new_value,
          'permission_level', v_permission
        ),
        NOW()
      );
    END IF;

    RETURN NULL; -- No suggestion needed
  ELSE
    -- Create suggestion for family/extended circles
    INSERT INTO profile_edit_suggestions (
      profile_id, submitter_id, field_name,
      old_value, new_value, reason, status
    ) VALUES (
      p_profile_id, auth.uid(), p_field_name,
      v_old_value, p_new_value, p_reason, 'pending'
    ) RETURNING id INTO v_suggestion_id;

    -- Notify approvers
    PERFORM notify_approvers_v4(v_suggestion_id, p_profile_id, auth.uid());

    RETURN v_suggestion_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION submit_edit_suggestion_v4(UUID, TEXT, TEXT, TEXT) IS
'Submit profile edit suggestion with manual admin approval. Now includes photo_url field for photo change/deletion suggestions.';
