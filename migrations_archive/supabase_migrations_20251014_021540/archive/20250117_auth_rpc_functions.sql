-- Authentication RPC Functions for Profile Linking
-- This migration creates all necessary functions for the auth flow

-- 1. Drop existing functions if they exist
DROP FUNCTION IF EXISTS search_profiles_by_name_chain(TEXT);
DROP FUNCTION IF EXISTS get_profile_tree_context(UUID);
DROP FUNCTION IF EXISTS submit_profile_link_request(UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_link_requests();
DROP FUNCTION IF EXISTS approve_profile_link(UUID, TEXT);
DROP FUNCTION IF EXISTS reject_profile_link(UUID, TEXT);

-- 2. Create profile_link_requests table if not exists
CREATE TABLE IF NOT EXISTS profile_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  name_chain TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, profile_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_link_requests_user ON profile_link_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_link_requests_status ON profile_link_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_requests_profile ON profile_link_requests(profile_id);

-- 3. Search profiles by Arabic name chain
CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(p_name_chain TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  hid TEXT,
  generation INT,
  status TEXT,
  father_id UUID,
  mother_id UUID,
  gender TEXT,
  birth_date_hijri TEXT,
  death_date_hijri TEXT,
  is_claimed BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces
  v_names := string_to_array(trim(p_name_chain), ' ');
  
  -- Extract name components
  v_first_name := COALESCE(v_names[1], '');
  v_father_name := COALESCE(v_names[2], '');
  v_grandfather_name := COALESCE(v_names[3], '');
  
  -- If no first name provided, return empty
  IF v_first_name = '' THEN
    RETURN;
  END IF;
  
  -- Search for profiles matching the name chain
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.hid,
    p.generation,
    p.status,
    p.father_id,
    p.mother_id,
    p.gender,
    p.dob_data->>'hijri' as birth_date_hijri,
    p.dod_data->>'hijri' as death_date_hijri,
    (p.user_id IS NOT NULL) as is_claimed
  FROM profiles p
  WHERE 
    -- Match first name (handle various Arabic name variations)
    (
      p.name = v_first_name OR
      p.name ILIKE v_first_name || ' %' OR
      p.name ILIKE '% ' || v_first_name || ' %' OR
      p.name ILIKE '% ' || v_first_name
    )
    -- Don't show already claimed profiles
    AND p.user_id IS NULL
  ORDER BY 
    -- Prioritize exact matches
    CASE WHEN p.name = v_first_name THEN 0 ELSE 1 END,
    p.generation DESC, 
    p.name
  LIMIT 50;
END;
$$;

-- 4. Get profile tree context for verification
CREATE OR REPLACE FUNCTION get_profile_tree_context(p_profile_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH profile_data AS (
    SELECT 
      p.id,
      p.name,
      p.hid,
      p.generation,
      p.status,
      p.gender,
      p.dob_data->>'hijri' as birth_date_hijri,
      p.dod_data->>'hijri' as death_date_hijri,
      p.father_id,
      p.mother_id
    FROM profiles p
    WHERE p.id = p_profile_id
  ),
  lineage AS (
    -- Get ancestors up the tree
    WITH RECURSIVE ancestors AS (
      SELECT 
        p.id,
        p.name,
        p.generation,
        p.father_id,
        0 as level
      FROM profiles p
      WHERE p.id = p_profile_id
      
      UNION ALL
      
      SELECT 
        parent.id,
        parent.name,
        parent.generation,
        parent.father_id,
        a.level + 1
      FROM ancestors a
      JOIN profiles parent ON parent.id = a.father_id
      WHERE a.level < 5 -- Limit to 5 generations
    )
    SELECT json_agg(
      json_build_object(
        'id', id,
        'name', name,
        'generation', generation,
        'level', level
      ) ORDER BY level
    ) as ancestors
    FROM ancestors
    WHERE id != p_profile_id
  ),
  siblings_data AS (
    -- Get siblings
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'gender', p.gender,
        'birth_order', p.sibling_order,
        'status', p.status
      ) ORDER BY p.sibling_order
    ) as siblings
    FROM profiles p
    WHERE p.father_id = (SELECT father_id FROM profile_data WHERE father_id IS NOT NULL)
      AND p.id != p_profile_id
  ),
  father_siblings_data AS (
    -- Get father's siblings (uncles/aunts)
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'gender', p.gender,
        'birth_order', p.sibling_order
      ) ORDER BY p.sibling_order
    ) as father_siblings
    FROM profiles p
    WHERE p.father_id = (
      SELECT father_id 
      FROM profiles 
      WHERE id = (SELECT father_id FROM profile_data)
    )
  ),
  grandfather_siblings_data AS (
    -- Get grandfather's siblings
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'gender', p.gender
      ) ORDER BY p.sibling_order
    ) as grandfather_siblings
    FROM profiles p
    WHERE p.father_id = (
      SELECT father_id 
      FROM profiles 
      WHERE id = (
        SELECT father_id 
        FROM profiles 
        WHERE id = (SELECT father_id FROM profile_data)
      )
    )
  ),
  children_data AS (
    -- Get children count
    SELECT 
      COUNT(*) as children_count,
      json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'gender', p.gender
        ) ORDER BY p.sibling_order
      ) as children
    FROM profiles p
    WHERE p.father_id = p_profile_id OR p.mother_id = p_profile_id
  )
  SELECT json_build_object(
    'profile', (
      SELECT json_build_object(
        'id', pd.id,
        'name', pd.name,
        'hid', pd.hid,
        'generation', pd.generation,
        'status', pd.status,
        'gender', pd.gender,
        'birth_date_hijri', pd.birth_date_hijri,
        'death_date_hijri', pd.death_date_hijri
      )
      FROM profile_data pd
    ),
    'lineage', COALESCE((SELECT ancestors FROM lineage), '[]'::json),
    'siblings', COALESCE((SELECT siblings FROM siblings_data), '[]'::json),
    'father_siblings', COALESCE((SELECT father_siblings FROM father_siblings_data), '[]'::json),
    'grandfather_siblings', COALESCE((SELECT grandfather_siblings FROM grandfather_siblings_data), '[]'::json),
    'children_count', COALESCE((SELECT children_count FROM children_data), 0),
    'children', COALESCE((SELECT children FROM children_data), '[]'::json)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 5. Submit profile link request
CREATE OR REPLACE FUNCTION submit_profile_link_request(
  p_profile_id UUID,
  p_name_chain TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_phone TEXT;
  v_request_id UUID;
  v_existing_request UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'يجب تسجيل الدخول أولاً'
    );
  END IF;
  
  -- Get user's phone number
  SELECT phone INTO v_phone
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Check if request already exists
  SELECT id INTO v_existing_request
  FROM profile_link_requests
  WHERE user_id = v_user_id AND profile_id = p_profile_id;
  
  IF v_existing_request IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'لديك طلب سابق لهذا الملف',
      'request_id', v_existing_request
    );
  END IF;
  
  -- Check if profile is already claimed
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_profile_id AND user_id IS NOT NULL
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'هذا الملف مرتبط بمستخدم آخر'
    );
  END IF;
  
  -- Create the link request
  INSERT INTO profile_link_requests (
    user_id,
    profile_id,
    name_chain,
    phone,
    status,
    created_at
  ) VALUES (
    v_user_id,
    p_profile_id,
    p_name_chain,
    COALESCE(v_phone, ''),
    'pending',
    NOW()
  ) RETURNING id INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'تم إرسال طلب الربط بنجاح'
  );
END;
$$;

-- 6. Get user's link requests
CREATE OR REPLACE FUNCTION get_user_link_requests()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', COALESCE(json_agg(
      json_build_object(
        'id', plr.id,
        'profile_id', plr.profile_id,
        'profile_name', p.name,
        'status', plr.status,
        'created_at', plr.created_at,
        'reviewed_at', plr.reviewed_at,
        'review_notes', plr.review_notes
      ) ORDER BY plr.created_at DESC
    ), '[]'::json)
  ) INTO v_result
  FROM profile_link_requests plr
  JOIN profiles p ON p.id = plr.profile_id
  WHERE plr.user_id = v_user_id;
  
  RETURN v_result;
END;
$$;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION search_profiles_by_name_chain(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_profile_tree_context(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_profile_link_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_link_requests() TO authenticated;

-- 8. Add RLS policies for profile_link_requests
ALTER TABLE profile_link_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own link requests" ON profile_link_requests;
DROP POLICY IF EXISTS "Users can create link requests" ON profile_link_requests;
DROP POLICY IF EXISTS "Admins can view all link requests" ON profile_link_requests;

-- Recreate policies
CREATE POLICY "Users can view own link requests" ON profile_link_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create link requests" ON profile_link_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all link requests" ON profile_link_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 9. Add comment documentation
COMMENT ON FUNCTION search_profiles_by_name_chain IS 'Search for profiles by Arabic name chain, returns unclaimed profiles only';
COMMENT ON FUNCTION get_profile_tree_context IS 'Get family tree context for a profile including ancestors, siblings, and relatives';
COMMENT ON FUNCTION submit_profile_link_request IS 'Submit a request to link an authenticated user to a profile';
COMMENT ON FUNCTION get_user_link_requests IS 'Get all link requests for the authenticated user';