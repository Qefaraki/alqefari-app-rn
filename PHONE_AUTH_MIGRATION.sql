-- Phase 1: Core Authentication System
-- This migration adds phone-based authentication and profile linking

-- Add auth linking fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  auth_user_id UUID REFERENCES auth.users(id),
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  claim_status TEXT CHECK (claim_status IN ('unclaimed', 'pending', 'verified', 'rejected')),
  claim_requested_at TIMESTAMPTZ,
  claim_verified_by UUID REFERENCES profiles(id),
  push_token TEXT;

-- Create profile link requests table
CREATE TABLE IF NOT EXISTS profile_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  name_chain TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  review_notes TEXT,
  whatsapp_contacted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, profile_id) -- Prevent duplicate requests
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('link_request', 'link_approved', 'link_rejected', 'edit_suggestion', 'approval', 'rejection', 'mention')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Create activity log for tracking
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create WhatsApp templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  template_text TEXT NOT NULL,
  variables TEXT[], -- {name}, {profile_name}, etc
  is_active BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default WhatsApp templates
INSERT INTO whatsapp_templates (template_key, template_text, variables, is_active) VALUES
  ('link_request', 'مرحباً،

تم استلام طلبك لربط ملفك الشخصي في شجرة عائلة القفاري.

الاسم: {name_chain}
الملف المطلوب: {profile_name}

للتحقق من هويتك، يرجى الرد بمعلومات إضافية تؤكد هويتك.

شكراً لك', ARRAY['name_chain', 'profile_name'], true),
  
  ('link_approved', 'مرحباً {name}،

تم الموافقة على طلبك لربط ملفك الشخصي.

يمكنك الآن الدخول للتطبيق وتعديل معلوماتك الشخصية.

أهلاً بك في شجرة عائلة القفاري!', ARRAY['name'], true),
  
  ('link_rejected', 'مرحباً،

نأسف لإبلاغك أن طلبك لربط الملف الشخصي لم تتم الموافقة عليه.

السبب: {reason}

يرجى التواصل معنا لمزيد من المعلومات.', ARRAY['reason'], true),
  
  ('general_contact', 'مرحباً،

نود التواصل معك بخصوص شجرة عائلة القفاري.

{message}

شكراً لك', ARRAY['message'], true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_claim_status ON profiles(claim_status) WHERE claim_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_link_requests_status ON profile_link_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_requests_user ON profile_link_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);

-- Function to search profiles by name chain
CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(
  p_name_chain TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  father_name TEXT,
  grandfather_name TEXT,
  hid TEXT,
  generation INT,
  has_auth BOOLEAN,
  match_score INT
) AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces
  v_names := string_to_array(trim(p_name_chain), ' ');
  v_first_name := v_names[1];
  v_father_name := v_names[2];
  v_grandfather_name := v_names[3];
  
  RETURN QUERY
  WITH matches AS (
    SELECT 
      p.id,
      p.name,
      f.name as father_name,
      gf.name as grandfather_name,
      p.hid,
      p.generation,
      p.auth_user_id IS NOT NULL as has_auth,
      -- Calculate match score
      CASE WHEN lower(p.name) = lower(v_first_name) THEN 40 ELSE 0 END +
      CASE WHEN f.name IS NOT NULL AND lower(f.name) = lower(v_father_name) THEN 30 ELSE 0 END +
      CASE WHEN gf.name IS NOT NULL AND lower(gf.name) = lower(v_grandfather_name) THEN 20 ELSE 0 END +
      CASE WHEN p.auth_user_id IS NULL THEN 10 ELSE 0 END as match_score
    FROM profiles p
    LEFT JOIN profiles f ON p.father_id = f.id
    LEFT JOIN profiles gf ON f.father_id = gf.id
    WHERE 
      p.deleted_at IS NULL
      AND (
        lower(p.name) LIKE lower(v_first_name) || '%'
        OR (v_father_name IS NOT NULL AND lower(f.name) LIKE lower(v_father_name) || '%')
        OR (v_grandfather_name IS NOT NULL AND lower(gf.name) LIKE lower(v_grandfather_name) || '%')
      )
  )
  SELECT * FROM matches
  WHERE match_score > 0
  ORDER BY match_score DESC, generation ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get profile tree context for matching
CREATE OR REPLACE FUNCTION get_profile_tree_context(
  p_profile_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH RECURSIVE ancestors AS (
    -- Start with the profile
    SELECT id, name, father_id, mother_id, generation, hid, gender, status, 0 as level
    FROM profiles
    WHERE id = p_profile_id
    
    UNION ALL
    
    -- Get all ancestors up to root
    SELECT p.id, p.name, p.father_id, p.mother_id, p.generation, p.hid, p.gender, p.status, a.level + 1
    FROM profiles p
    INNER JOIN ancestors a ON p.id = a.father_id
    WHERE a.level < 10 -- Prevent infinite recursion
  )
  SELECT json_build_object(
    'profile', (
      SELECT json_build_object(
        'id', id,
        'name', name,
        'hid', hid,
        'generation', generation,
        'gender', gender,
        'status', status
      )
      FROM profiles WHERE id = p_profile_id
    ),
    'lineage', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'generation', generation,
          'level', level
        ) ORDER BY level
      )
      FROM ancestors WHERE id != p_profile_id
    ),
    'siblings', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'gender', gender,
          'sibling_order', sibling_order
        ) ORDER BY sibling_order
      )
      FROM profiles 
      WHERE father_id = (SELECT father_id FROM profiles WHERE id = p_profile_id)
      AND id != p_profile_id
      AND deleted_at IS NULL
    ),
    'father_siblings', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'gender', gender,
          'sibling_order', sibling_order
        ) ORDER BY sibling_order
      )
      FROM profiles 
      WHERE father_id = (
        SELECT father_id 
        FROM profiles 
        WHERE id = (SELECT father_id FROM profiles WHERE id = p_profile_id)
      )
      AND deleted_at IS NULL
    ),
    'grandfather_siblings', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'gender', gender,
          'sibling_order', sibling_order
        ) ORDER BY sibling_order
      )
      FROM profiles 
      WHERE father_id = (
        SELECT father_id 
        FROM profiles 
        WHERE id = (
          SELECT father_id 
          FROM profiles 
          WHERE id = (SELECT father_id FROM profiles WHERE id = p_profile_id)
        )
      )
      AND deleted_at IS NULL
    ),
    'children_count', (
      SELECT COUNT(*)
      FROM profiles 
      WHERE (father_id = p_profile_id OR mother_id = p_profile_id)
      AND deleted_at IS NULL
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit profile link request
CREATE OR REPLACE FUNCTION submit_profile_link_request(
  p_profile_id UUID,
  p_name_chain TEXT
)
RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
  v_user_id UUID;
  v_user_phone TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Get user's phone
  SELECT phone INTO v_user_phone
  FROM auth.users
  WHERE id = v_user_id;
  
  -- Check if profile is already linked
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_profile_id AND auth_user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'هذا الملف مرتبط بمستخدم آخر';
  END IF;
  
  -- Check if user already has a linked profile
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE auth_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'لديك ملف شخصي مرتبط بالفعل';
  END IF;
  
  -- Create or update link request
  INSERT INTO profile_link_requests (
    user_id,
    profile_id,
    name_chain,
    phone,
    status
  ) VALUES (
    v_user_id,
    p_profile_id,
    p_name_chain,
    v_user_phone,
    'pending'
  )
  ON CONFLICT (user_id, profile_id) DO UPDATE
  SET 
    name_chain = EXCLUDED.name_chain,
    phone = EXCLUDED.phone,
    status = 'pending',
    created_at = NOW()
  RETURNING id INTO v_request_id;
  
  -- Update profile claim status
  UPDATE profiles
  SET 
    claim_status = 'pending',
    claim_requested_at = NOW()
  WHERE id = p_profile_id;
  
  -- Notify admins
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT 
    p.id,
    'link_request',
    'طلب ربط ملف جديد',
    'طلب ربط للملف: ' || (SELECT name FROM profiles WHERE id = p_profile_id),
    jsonb_build_object(
      'request_id', v_request_id,
      'profile_id', p_profile_id,
      'name_chain', p_name_chain
    )
  FROM profiles p
  WHERE p.role = 'admin' AND p.auth_user_id IS NOT NULL;
  
  -- Log the action
  INSERT INTO activity_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_user_id,
    'SUBMIT_LINK_REQUEST',
    'profile',
    p_profile_id,
    jsonb_build_object('name_chain', p_name_chain)
  );
  
  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to approve link request
CREATE OR REPLACE FUNCTION admin_approve_link_request(
  p_request_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE auth_user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  -- Get request details
  SELECT user_id, profile_id INTO v_user_id, v_profile_id
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;
  
  -- Update request
  UPDATE profile_link_requests
  SET 
    status = 'approved',
    reviewed_by = (SELECT id FROM profiles WHERE auth_user_id = v_admin_id),
    review_notes = p_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id;
  
  -- Link profile to user
  UPDATE profiles
  SET 
    auth_user_id = v_user_id,
    phone_verified = TRUE,
    phone_verified_at = NOW(),
    claim_status = 'verified',
    claim_verified_by = (SELECT id FROM profiles WHERE auth_user_id = v_admin_id)
  WHERE id = v_profile_id;
  
  -- Notify user
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'link_approved',
    'تمت الموافقة على طلبك',
    'تم ربط ملفك الشخصي بنجاح',
    jsonb_build_object('profile_id', v_profile_id)
  );
  
  -- Log the action
  INSERT INTO activity_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_admin_id,
    'APPROVE_LINK_REQUEST',
    'link_request',
    p_request_id,
    jsonb_build_object(
      'profile_id', v_profile_id,
      'user_id', v_user_id,
      'notes', p_notes
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to reject link request
CREATE OR REPLACE FUNCTION admin_reject_link_request(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE auth_user_id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;
  
  -- Get request details
  SELECT user_id, profile_id INTO v_user_id, v_profile_id
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;
  
  -- Update request
  UPDATE profile_link_requests
  SET 
    status = 'rejected',
    reviewed_by = (SELECT id FROM profiles WHERE auth_user_id = v_admin_id),
    review_notes = p_reason,
    reviewed_at = NOW()
  WHERE id = p_request_id;
  
  -- Update profile status
  UPDATE profiles
  SET 
    claim_status = 'rejected',
    claim_verified_by = (SELECT id FROM profiles WHERE auth_user_id = v_admin_id)
  WHERE id = v_profile_id;
  
  -- Notify user
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'link_rejected',
    'طلبك مرفوض',
    'لم تتم الموافقة على طلب ربط ملفك. السبب: ' || p_reason,
    jsonb_build_object(
      'profile_id', v_profile_id,
      'reason', p_reason
    )
  );
  
  -- Log the action
  INSERT INTO activity_log (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_admin_id,
    'REJECT_LINK_REQUEST',
    'link_request',
    p_request_id,
    jsonb_build_object(
      'profile_id', v_profile_id,
      'user_id', v_user_id,
      'reason', p_reason
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE profile_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own link requests
CREATE POLICY profile_link_requests_own ON profile_link_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can see all link requests
CREATE POLICY profile_link_requests_admin ON profile_link_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Users can only see their own notifications
CREATE POLICY notifications_own ON notifications
  FOR ALL
  USING (user_id = auth.uid());

-- Activity log visible to admins only
CREATE POLICY activity_log_admin ON activity_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_profiles_by_name_chain TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_profile_tree_context TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_profile_link_request TO authenticated;
GRANT EXECUTE ON FUNCTION admin_approve_link_request TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_link_request TO authenticated;