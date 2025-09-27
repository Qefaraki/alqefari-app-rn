-- Critical functions for profile link management
-- This migration adds the essential functions that were missing

-- 1. Simple approve function (without complex dependencies)
CREATE OR REPLACE FUNCTION approve_link_request_simple(
  request_id UUID,
  admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- Get request details
  SELECT user_id, profile_id
  INTO v_user_id, v_profile_id
  FROM profile_link_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update request
  UPDATE profile_link_requests
  SET
    status = 'approved',
    review_notes = admin_notes,
    reviewed_at = NOW()
  WHERE id = request_id;

  -- Link profile to user
  UPDATE profiles
  SET
    user_id = v_user_id,
    updated_at = NOW()
  WHERE id = v_profile_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Simple reject function
CREATE OR REPLACE FUNCTION reject_link_request_simple(
  request_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update request
  UPDATE profile_link_requests
  SET
    status = 'rejected',
    review_notes = reason,
    reviewed_at = NOW()
  WHERE id = request_id AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Force unlink function (for admins)
CREATE OR REPLACE FUNCTION force_unlink_profile(
  profile_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Unlink the profile
  UPDATE profiles
  SET
    user_id = NULL,
    updated_at = NOW()
  WHERE id = profile_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_link_request_simple TO authenticated;
GRANT EXECUTE ON FUNCTION reject_link_request_simple TO authenticated;
GRANT EXECUTE ON FUNCTION force_unlink_profile TO authenticated;