-- Update apply_profile_edit_v4 to include professional title fields
-- This allows the suggestion system to accept professional_title and title_abbreviation

CREATE OR REPLACE FUNCTION apply_profile_edit_v4(
  p_suggestion_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_suggestion RECORD;
  v_column_allowed BOOLEAN;
BEGIN
  -- Fetch the suggestion
  SELECT * INTO v_suggestion
  FROM profile_suggestions
  WHERE id = p_suggestion_id;

  -- Check if suggestion exists
  IF v_suggestion IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  -- Validate field name against whitelist
  v_column_allowed := v_suggestion.field_name IN (
    'display_name', 'phone', 'email', 'date_of_birth',
    'place_of_birth', 'current_location', 'occupation',
    'bio', 'instagram', 'twitter', 'linkedin', 'notes',
    'professional_title', 'title_abbreviation'  -- NEW FIELDS ADDED
  );

  IF NOT v_column_allowed THEN
    RAISE EXCEPTION 'Field % is not allowed for suggestions', v_suggestion.field_name;
  END IF;

  -- Apply the change to the profiles table
  EXECUTE format(
    'UPDATE profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
    v_suggestion.field_name
  ) USING v_suggestion.new_value, v_suggestion.profile_id;

  -- Mark suggestion as approved
  UPDATE profile_suggestions
  SET status = 'approved', reviewed_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Updated apply_profile_edit_v4 function to accept professional_title and title_abbreviation';
END $$;
