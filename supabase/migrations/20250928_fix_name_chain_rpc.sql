-- Create efficient RPC function for building name chains server-side
-- This avoids loading all profiles client-side

-- Function to get ancestors chain for a profile
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
    IF v_depth = 0 THEN
      v_chain := v_profile.name;
    ELSE
      v_chain := v_chain || ' بن ' || v_profile.name;
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

-- Function to get name chain for current user
CREATE OR REPLACE FUNCTION get_name_chain_for_user(p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_chain TEXT;
BEGIN
  -- Use provided user_id or current auth user
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'No user specified');
  END IF;

  -- Get user's profile
  SELECT * INTO v_profile
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No profile linked');
  END IF;

  -- If profile has full_chain, use it
  IF v_profile.full_chain IS NOT NULL AND v_profile.full_chain != '' THEN
    v_chain := v_profile.full_chain;
  ELSE
    -- Build basic chain from available fields
    v_chain := v_profile.name;

    IF v_profile.father_name IS NOT NULL THEN
      v_chain := v_chain || ' بن ' || v_profile.father_name;

      IF v_profile.grandfather_name IS NOT NULL THEN
        v_chain := v_chain || ' ' || v_profile.grandfather_name;
      END IF;
    END IF;
  END IF;

  -- Ensure القفاري is at the end
  IF v_chain NOT LIKE '%القفاري%' THEN
    v_chain := v_chain || ' القفاري';
  END IF;

  RETURN json_build_object(
    'chain', v_chain,
    'profile_id', v_profile.id,
    'name', v_profile.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_ancestors_chain TO authenticated;
GRANT EXECUTE ON FUNCTION get_name_chain_for_user TO authenticated;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_father_id ON profiles(father_id);
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_user_id ON profile_link_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_status ON profile_link_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_user_status ON profile_link_requests(user_id, status);