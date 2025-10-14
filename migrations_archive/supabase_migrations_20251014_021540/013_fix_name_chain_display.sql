-- Fix name chain to only show بن once at the beginning
-- Currently: "علي بن محمد بن أحمد بن سعود"
-- Should be: "علي بن محمد أحمد سعود"

-- Update get_ancestors_chain function to only add بن after first name
CREATE OR REPLACE FUNCTION get_ancestors_chain(profile_id UUID)
RETURNS JSON AS $$
DECLARE
  v_chain TEXT;
  v_profile RECORD;
  v_current_id UUID;
  v_depth INT := 0;
  v_max_depth INT := 10;
BEGIN
  -- Start with the given profile
  v_current_id := profile_id;
  v_chain := '';

  -- Build chain by traversing up the tree
  WHILE v_current_id IS NOT NULL AND v_depth < v_max_depth LOOP
    SELECT id, name, father_id, father_name, grandfather_name, full_chain
    INTO v_profile
    FROM profiles
    WHERE id = v_current_id;

    IF NOT FOUND THEN
      EXIT;
    END IF;

    -- If we already have a full_chain, use it
    IF v_profile.full_chain IS NOT NULL AND v_profile.full_chain != '' THEN
      v_chain := v_profile.full_chain;
      EXIT;
    END IF;

    -- Build chain piece by piece
    -- Only add "بن" after the first name (depth 1), then just spaces
    IF v_depth = 0 THEN
      v_chain := v_profile.name;
    ELSIF v_depth = 1 THEN
      v_chain := v_chain || ' بن ' || v_profile.name;
    ELSE
      v_chain := v_chain || ' ' || v_profile.name;
    END IF;

    -- Move to father
    v_current_id := v_profile.father_id;
    v_depth := v_depth + 1;
  END LOOP;

  -- Ensure القفاري is at the end
  IF v_chain NOT LIKE '%القفاري%' THEN
    v_chain := v_chain || ' القفاري';
  END IF;

  RETURN json_build_object('chain', v_chain);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_ancestors_chain TO authenticated;
