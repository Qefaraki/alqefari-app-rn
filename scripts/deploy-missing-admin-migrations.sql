-- Deploy missing admin migrations (005 and 006)
-- This combines both migrations to create all admin functions

-- ============================================
-- MIGRATION 005: Family Edit Permissions System
-- ============================================

-- Add suggestion tracking columns if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS moderated_branch TEXT;

-- Create suggestions table
CREATE TABLE IF NOT EXISTS profile_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  submitter_id UUID REFERENCES profiles(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create link requests table
CREATE TABLE IF NOT EXISTS profile_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES profiles(id),
  target_phone TEXT NOT NULL,
  target_name TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Function to get pending suggestions for admins
CREATE OR REPLACE FUNCTION get_pending_suggestions()
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  profile_name TEXT,
  submitter_name TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.profile_id,
    p.name as profile_name,
    sub.name as submitter_name,
    s.field_name,
    s.old_value,
    s.new_value,
    s.created_at
  FROM profile_suggestions s
  JOIN profiles p ON p.id = s.profile_id
  LEFT JOIN profiles sub ON sub.id = s.submitter_id
  WHERE s.status = 'pending'
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to approve suggestion
CREATE OR REPLACE FUNCTION approve_suggestion(p_suggestion_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_suggestion RECORD;
  v_admin_id UUID;
BEGIN
  -- Get admin ID
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin');

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get suggestion details
  SELECT * INTO v_suggestion
  FROM profile_suggestions
  WHERE id = p_suggestion_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Apply the change dynamically
  EXECUTE format(
    'UPDATE profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
    v_suggestion.field_name
  ) USING v_suggestion.new_value, v_suggestion.profile_id;

  -- Mark as approved
  UPDATE profile_suggestions
  SET status = 'approved',
      reviewed_by = v_admin_id,
      reviewed_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reject suggestion
CREATE OR REPLACE FUNCTION reject_suggestion(p_suggestion_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get admin ID
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin');

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Mark as rejected
  UPDATE profile_suggestions
  SET status = 'rejected',
      reviewed_by = v_admin_id,
      reviewed_at = NOW(),
      notes = p_notes
  WHERE id = p_suggestion_id AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending link requests
CREATE OR REPLACE FUNCTION get_pending_link_requests()
RETURNS TABLE (
  id UUID,
  requester_name TEXT,
  target_phone TEXT,
  target_name TEXT,
  relationship_type TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    lr.id,
    p.name as requester_name,
    lr.target_phone,
    lr.target_name,
    lr.relationship_type,
    lr.created_at
  FROM profile_link_requests lr
  LEFT JOIN profiles p ON p.id = lr.requester_id
  WHERE lr.status = 'pending'
  ORDER BY lr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to approve link request
CREATE OR REPLACE FUNCTION approve_link_request(p_request_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get admin ID
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin');

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Mark as approved (actual linking handled by app)
  UPDATE profile_link_requests
  SET status = 'approved',
      reviewed_by = v_admin_id,
      reviewed_at = NOW()
  WHERE id = p_request_id AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to reject link request
CREATE OR REPLACE FUNCTION reject_link_request(p_request_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Get admin ID
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid()
  AND role IN ('admin', 'super_admin');

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Mark as rejected
  UPDATE profile_link_requests
  SET status = 'rejected',
      reviewed_by = v_admin_id,
      reviewed_at = NOW(),
      notes = p_notes
  WHERE id = p_request_id AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION 006: Super Admin Permissions
-- ============================================

-- Function to grant admin role (super_admin only)
CREATE OR REPLACE FUNCTION grant_admin_role(p_profile_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if current user is super_admin
  SELECT role = 'super_admin' INTO v_is_super_admin
  FROM profiles
  WHERE user_id = auth.uid();

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  -- Update role to admin
  UPDATE profiles
  SET role = 'admin',
      updated_at = NOW()
  WHERE id = p_profile_id
  AND role != 'super_admin'; -- Prevent accidental downgrade

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke admin role (super_admin only)
CREATE OR REPLACE FUNCTION revoke_admin_role(p_profile_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if current user is super_admin
  SELECT role = 'super_admin' INTO v_is_super_admin
  FROM profiles
  WHERE user_id = auth.uid();

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  -- Update role to user
  UPDATE profiles
  SET role = 'user',
      updated_at = NOW()
  WHERE id = p_profile_id
  AND role = 'admin';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to grant moderator role
CREATE OR REPLACE FUNCTION grant_moderator_role(p_profile_id UUID, p_branch_hid TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if current user is super_admin
  SELECT role = 'super_admin' INTO v_is_super_admin
  FROM profiles
  WHERE user_id = auth.uid();

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  -- Update moderator status
  UPDATE profiles
  SET role = 'moderator',
      is_moderator = true,
      moderated_branch = p_branch_hid,
      updated_at = NOW()
  WHERE id = p_profile_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke moderator role
CREATE OR REPLACE FUNCTION revoke_moderator_role(p_profile_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if current user is super_admin
  SELECT role = 'super_admin' INTO v_is_super_admin
  FROM profiles
  WHERE user_id = auth.uid();

  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Unauthorized: Super admin access required';
  END IF;

  -- Update moderator status
  UPDATE profiles
  SET role = 'user',
      is_moderator = false,
      moderated_branch = NULL,
      updated_at = NOW()
  WHERE id = p_profile_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Verify deployment
SELECT 'Functions created:' as status,
  COUNT(*) as total_functions
FROM pg_proc
WHERE proname IN (
  'get_pending_suggestions',
  'approve_suggestion',
  'reject_suggestion',
  'get_pending_link_requests',
  'approve_link_request',
  'reject_link_request',
  'grant_admin_role',
  'revoke_admin_role',
  'grant_moderator_role',
  'revoke_moderator_role'
);