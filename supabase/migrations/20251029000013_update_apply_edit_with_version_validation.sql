-- Migration: Update apply_profile_edit_v4 to validate version before applying changes
-- Date: 2025-10-29
-- Purpose: Add optimistic locking validation to suggestion approval flow
--
-- Changes:
-- 1. Retrieve profile_version from suggestion record
-- 2. Fetch current profile version
-- 3. Compare versions and raise error if mismatch (profile was edited since suggestion)
-- 4. Increment version after applying change
-- 5. Add photo_url to whitelist

CREATE OR REPLACE FUNCTION apply_profile_edit_v4(p_suggestion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion RECORD;
  v_current_profile_version INTEGER;
  v_column_allowed BOOLEAN;
BEGIN
  -- Fetch the suggestion from profile_edit_suggestions table
  SELECT * INTO v_suggestion
  FROM profile_edit_suggestions
  WHERE id = p_suggestion_id;

  -- Check if suggestion exists
  IF v_suggestion IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  -- Validate field name against whitelist
  -- UPDATED: Added photo_url to whitelist
  v_column_allowed := v_suggestion.field_name IN (
    'display_name', 'phone', 'email', 'date_of_birth',
    'place_of_birth', 'current_location', 'occupation',
    'bio', 'instagram', 'twitter', 'linkedin', 'notes',
    'professional_title', 'title_abbreviation',
    'photo_url'  -- NEW: Allow photo suggestions
  );

  IF NOT v_column_allowed THEN
    RAISE EXCEPTION 'Field % is not allowed for suggestions', v_suggestion.field_name;
  END IF;

  -- NEW: Optimistic locking validation
  -- If suggestion has a stored version, validate it matches current profile version
  IF v_suggestion.profile_version IS NOT NULL THEN
    SELECT version INTO v_current_profile_version
    FROM profiles
    WHERE id = v_suggestion.profile_id;

    IF v_current_profile_version IS NULL THEN
      RAISE EXCEPTION 'Profile not found: %', v_suggestion.profile_id;
    END IF;

    IF v_current_profile_version != v_suggestion.profile_version THEN
      RAISE EXCEPTION 'Version conflict: Profile was edited after suggestion was created. Suggestion version: %, Current version: %',
        v_suggestion.profile_version,
        v_current_profile_version;
    END IF;
  END IF;
  -- If profile_version is NULL (old suggestions before this migration), skip version check

  -- Apply the change to the profiles table
  -- NEW: Increment version number to maintain optimistic locking chain
  EXECUTE format(
    'UPDATE profiles SET %I = $1, version = version + 1, updated_at = NOW() WHERE id = $2',
    v_suggestion.field_name
  ) USING v_suggestion.new_value, v_suggestion.profile_id;

  -- Mark suggestion as approved (caller will update reviewed_by and reviewed_at)
  -- Note: Status update happens in approve_suggestion() RPC, not here

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION apply_profile_edit_v4(UUID) IS
'Applies approved profile edit suggestion with optimistic locking validation. Validates profile version if stored in suggestion record, increments version after applying change.';
