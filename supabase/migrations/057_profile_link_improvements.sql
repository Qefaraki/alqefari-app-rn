-- Migration: Profile Link Improvements
-- Purpose: Improve profile linking flow with better request management

-- 1. Create admin_messages table for simple communication
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name_chain TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'no_profile_found' CHECK (type IN ('no_profile_found', 'unlink_request', 'general')),
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
  admin_notes TEXT,
  profile_id UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add withdrawal tracking to profile_link_requests
ALTER TABLE profile_link_requests ADD COLUMN IF NOT EXISTS
  withdrawn_at TIMESTAMPTZ,
  can_resubmit BOOLEAN DEFAULT TRUE;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_messages_status ON admin_messages(status) WHERE status = 'unread';
CREATE INDEX IF NOT EXISTS idx_admin_messages_user ON admin_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_messages(created_at DESC);

-- 4. Enable RLS on admin_messages
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for admin_messages

-- Users can view their own messages
CREATE POLICY "Users can view own messages" ON admin_messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create messages
CREATE POLICY "Users can create messages" ON admin_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages" ON admin_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
  );

-- Admins can update messages
CREATE POLICY "Admins can update messages" ON admin_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
  );

-- 6. Function to approve profile link request
CREATE OR REPLACE FUNCTION approve_profile_link_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
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
    SELECT 1 FROM admins WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Get request details
  SELECT user_id, profile_id
  INTO v_user_id, v_profile_id
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;

  -- Update request
  UPDATE profile_link_requests
  SET
    status = 'approved',
    reviewed_by = v_admin_id,
    review_notes = p_admin_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id;

  -- Link profile to user
  UPDATE profiles
  SET
    user_id = v_user_id,
    updated_at = NOW()
  WHERE id = v_profile_id;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'link_approved',
    'تمت الموافقة على طلبك',
    'تم ربط ملفك الشخصي بنجاح',
    jsonb_build_object('profile_id', v_profile_id)
  );

  -- Log the action
  INSERT INTO audit_log (
    action_type,
    actor_id,
    details
  ) VALUES (
    'APPROVE_LINK_REQUEST',
    v_admin_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'profile_id', v_profile_id,
      'user_id', v_user_id,
      'notes', p_admin_notes
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to reject profile link request
CREATE OR REPLACE FUNCTION reject_profile_link_request(
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
    SELECT 1 FROM admins WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Get request details
  SELECT user_id, profile_id
  INTO v_user_id, v_profile_id
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;

  -- Update request
  UPDATE profile_link_requests
  SET
    status = 'rejected',
    reviewed_by = v_admin_id,
    review_notes = p_reason,
    reviewed_at = NOW(),
    can_resubmit = TRUE
  WHERE id = p_request_id;

  -- Create notification
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'link_rejected',
    'تم رفض طلبك',
    'لم تتم الموافقة على طلب ربط ملفك. السبب: ' || p_reason,
    jsonb_build_object(
      'profile_id', v_profile_id,
      'reason', p_reason
    )
  );

  -- Log the action
  INSERT INTO audit_log (
    action_type,
    actor_id,
    details
  ) VALUES (
    'REJECT_LINK_REQUEST',
    v_admin_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'profile_id', v_profile_id,
      'user_id', v_user_id,
      'reason', p_reason
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function for admin to force unlink a profile
CREATE OR REPLACE FUNCTION admin_force_unlink_profile(
  p_profile_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_user_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT EXISTS (
    SELECT 1 FROM admins WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Get current user_id from profile
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = p_profile_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'الملف غير مرتبط بمستخدم';
  END IF;

  -- Unlink the profile
  UPDATE profiles
  SET
    user_id = NULL,
    updated_at = NOW()
  WHERE id = p_profile_id;

  -- Create notification for the user
  IF v_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_user_id,
      'profile_unlinked',
      'تم إلغاء ربط ملفك',
      COALESCE(p_reason, 'تم إلغاء ربط ملفك الشخصي من قبل المشرف'),
      jsonb_build_object('profile_id', p_profile_id, 'reason', p_reason)
    );
  END IF;

  -- Log the action
  INSERT INTO audit_log (
    action_type,
    actor_id,
    details
  ) VALUES (
    'FORCE_UNLINK_PROFILE',
    v_admin_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'user_id', v_user_id,
      'reason', p_reason
    )
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to delete user account completely
CREATE OR REPLACE FUNCTION admin_delete_user_account(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_profile_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT EXISTS (
    SELECT 1 FROM admins WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Get linked profile if exists
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id;

  -- Unlink profile if exists
  IF v_profile_id IS NOT NULL THEN
    UPDATE profiles
    SET user_id = NULL
    WHERE id = v_profile_id;
  END IF;

  -- Delete all link requests
  DELETE FROM profile_link_requests
  WHERE user_id = p_user_id;

  -- Delete all admin messages
  DELETE FROM admin_messages
  WHERE user_id = p_user_id;

  -- Delete from admins table if exists
  DELETE FROM admins
  WHERE user_id = p_user_id;

  -- Log the action before deleting the user
  INSERT INTO audit_log (
    action_type,
    actor_id,
    details
  ) VALUES (
    'DELETE_USER_ACCOUNT',
    v_admin_id,
    jsonb_build_object(
      'deleted_user_id', p_user_id,
      'profile_id', v_profile_id,
      'reason', p_reason
    )
  );

  -- Note: The actual user deletion from auth.users must be done through Supabase Admin API
  -- This function only cleans up related data

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. View to get link request statistics for admins
CREATE OR REPLACE VIEW admin_link_request_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'approved' AND reviewed_at > NOW() - INTERVAL '24 hours') as approved_today,
  COUNT(*) FILTER (WHERE status = 'rejected' AND reviewed_at > NOW() - INTERVAL '24 hours') as rejected_today,
  COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '48 hours') as overdue_count
FROM profile_link_requests;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION approve_profile_link_request TO authenticated;
GRANT EXECUTE ON FUNCTION reject_profile_link_request TO authenticated;
GRANT EXECUTE ON FUNCTION admin_force_unlink_profile TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user_account TO authenticated;
GRANT SELECT ON admin_link_request_stats TO authenticated;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_admin_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_messages_updated_at
  BEFORE UPDATE ON admin_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_messages_updated_at();

-- Add comment for documentation
COMMENT ON TABLE admin_messages IS 'Simple messaging system for users to contact admins when they cannot find their profile or need assistance';
COMMENT ON COLUMN admin_messages.type IS 'Type of message: no_profile_found for users who cannot find themselves, unlink_request for requesting profile unlink, general for other messages';
COMMENT ON FUNCTION admin_force_unlink_profile IS 'Allows admins to forcefully unlink a user from their profile';
COMMENT ON FUNCTION admin_delete_user_account IS 'Allows admins to delete a user account and clean up all related data';