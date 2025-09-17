-- Complete Authentication Backend Implementation
-- This creates all necessary functions and tables for profile linking

-- 1. Create profile link requests table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_link_requests_user ON profile_link_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_link_requests_status ON profile_link_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_requests_profile ON profile_link_requests(profile_id);

-- 2. Search profiles by Arabic name chain
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
) AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces
  v_names := string_to_array(trim(p_name_chain), ' ');
  
  -- Extract name components
  v_first_name := v_names[1];
  v_father_name := v_names[2];
  v_grandfather_name := v_names[3];
  
  -- Search for profiles matching the name chain
  RETURN QUERY
  WITH RECURSIVE family_chain AS (
    -- Find profiles matching the first name
    SELECT 
      p.id,
      p.name,
      p.hid,
      p.generation,
      p.status,
      p.father_id,
      p.mother_id,
      p.gender,
      p.birth_date_hijri,
      p.death_date_hijri,
      (p.auth_user_id IS NOT NULL) as is_claimed,
      1 as match_level,
      p.father_id as next_check_id
    FROM profiles p
    WHERE 
      -- Match first name (handle various Arabic name variations)
      (
        p.name = v_first_name OR
        p.name LIKE v_first_name || ' %' OR
        p.name LIKE '% ' || v_first_name || ' %' OR
        p.name LIKE '% ' || v_first_name
      )
      -- Don't show already claimed profiles
      AND p.auth_user_id IS NULL
    
    UNION ALL
    
    -- Check if father name matches
    SELECT 
      fc.id,
      fc.name,
      fc.hid,
      fc.generation,
      fc.status,
      fc.father_id,
      fc.mother_id,
      fc.gender,
      fc.birth_date_hijri,
      fc.death_date_hijri,
      fc.is_claimed,
      fc.match_level + 
        CASE 
          WHEN father.name = v_father_name OR
               father.name LIKE v_father_name || ' %' OR
               father.name LIKE '% ' || v_father_name
          THEN 1 
          ELSE 0 
        END,
      father.father_id
    FROM family_chain fc
    JOIN profiles father ON father.id = fc.next_check_id
    WHERE fc.match_level = 1 AND v_father_name IS NOT NULL
  )
  SELECT DISTINCT
    fc.id,
    fc.name,
    fc.hid,
    fc.generation,
    fc.status,
    fc.father_id,
    fc.mother_id,
    fc.gender,
    fc.birth_date_hijri,
    fc.death_date_hijri,
    fc.is_claimed
  FROM family_chain fc
  WHERE 
    -- Return profiles with best matches
    (v_father_name IS NULL AND fc.match_level >= 1) OR
    (v_father_name IS NOT NULL AND fc.match_level >= 2)
  ORDER BY fc.generation DESC, fc.name
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get profile tree context for verification
CREATE OR REPLACE FUNCTION get_profile_tree_context(p_profile_id UUID)
RETURNS JSON AS $$
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
      p.birth_date_hijri,
      p.death_date_hijri,
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
    WHERE p.father_id = (SELECT father_id FROM profile_data)
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
    'lineage', (SELECT ancestors FROM lineage),
    'siblings', (SELECT siblings FROM siblings_data),
    'father_siblings', (SELECT father_siblings FROM father_siblings_data),
    'grandfather_siblings', (SELECT grandfather_siblings FROM grandfather_siblings_data),
    'children_count', (SELECT children_count FROM children_data),
    'children', (SELECT children FROM children_data)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Submit profile link request
CREATE OR REPLACE FUNCTION submit_profile_link_request(
  p_profile_id UUID,
  p_name_chain TEXT
)
RETURNS JSON AS $$
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
    WHERE id = p_profile_id AND auth_user_id IS NOT NULL
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
    v_phone,
    'pending',
    NOW()
  ) RETURNING id INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'تم إرسال طلب الربط بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Check user's pending link requests
CREATE OR REPLACE FUNCTION get_user_link_requests()
RETURNS JSON AS $$
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
    'requests', json_agg(
      json_build_object(
        'id', plr.id,
        'profile_id', plr.profile_id,
        'profile_name', p.name,
        'status', plr.status,
        'created_at', plr.created_at,
        'reviewed_at', plr.reviewed_at,
        'review_notes', plr.review_notes
      ) ORDER BY plr.created_at DESC
    )
  ) INTO v_result
  FROM profile_link_requests plr
  JOIN profiles p ON p.id = plr.profile_id
  WHERE plr.user_id = v_user_id;
  
  RETURN COALESCE(v_result, json_build_object('success', true, 'requests', '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Admin function to approve profile link
CREATE OR REPLACE FUNCTION approve_profile_link(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'غير مصرح لك بهذا الإجراء'
    );
  END IF;
  
  -- Get request details
  SELECT * INTO v_request
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF v_request IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'الطلب غير موجود أو تم معالجته مسبقاً'
    );
  END IF;
  
  -- Link the profile to the user
  UPDATE profiles
  SET 
    auth_user_id = v_request.user_id,
    phone = v_request.phone,
    updated_at = NOW()
  WHERE id = v_request.profile_id;
  
  -- Update the request status
  UPDATE profile_link_requests
  SET 
    status = 'approved',
    reviewed_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()),
    review_notes = p_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم ربط الملف بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Admin function to reject profile link
CREATE OR REPLACE FUNCTION reject_profile_link(
  p_request_id UUID,
  p_notes TEXT
)
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'غير مصرح لك بهذا الإجراء'
    );
  END IF;
  
  -- Update the request status
  UPDATE profile_link_requests
  SET 
    status = 'rejected',
    reviewed_by = (SELECT id FROM profiles WHERE auth_user_id = auth.uid()),
    review_notes = p_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'الطلب غير موجود أو تم معالجته مسبقاً'
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'تم رفض طلب الربط'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Get pending link requests for admins
CREATE OR REPLACE FUNCTION get_pending_link_requests()
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_result JSON;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object(
      'success', false,
      'error', 'غير مصرح لك بهذا الإجراء'
    );
  END IF;
  
  SELECT json_build_object(
    'success', true,
    'requests', json_agg(
      json_build_object(
        'id', plr.id,
        'user_id', plr.user_id,
        'profile_id', plr.profile_id,
        'profile_name', p.name,
        'name_chain', plr.name_chain,
        'phone', plr.phone,
        'created_at', plr.created_at
      ) ORDER BY plr.created_at ASC
    )
  ) INTO v_result
  FROM profile_link_requests plr
  JOIN profiles p ON p.id = plr.profile_id
  WHERE plr.status = 'pending';
  
  RETURN COALESCE(v_result, json_build_object('success', true, 'requests', '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON profile_link_requests TO authenticated;
GRANT INSERT ON profile_link_requests TO authenticated;
GRANT UPDATE ON profile_link_requests TO authenticated;

-- Add RLS policies
ALTER TABLE profile_link_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own link requests" ON profile_link_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create link requests
CREATE POLICY "Users can create link requests" ON profile_link_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can see all requests
CREATE POLICY "Admins can view all link requests" ON profile_link_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );