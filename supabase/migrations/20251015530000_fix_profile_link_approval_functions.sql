-- Fix profile link approval/rejection RPC functions
-- Root cause: Archived functions set reviewed_by to profiles.id, but FK constraint expects auth.users.id
--
-- This migration:
-- 1. Drops any existing buggy functions
-- 2. Creates correct functions that set reviewed_by = auth.uid() (auth.users.id)
-- 3. Uses is_admin() function for permission checks
-- 4. Provides both new and legacy function names for compatibility

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS admin_approve_request(uuid, text);
DROP FUNCTION IF EXISTS admin_reject_request(uuid, text);
DROP FUNCTION IF EXISTS approve_profile_link_request(uuid, text);
DROP FUNCTION IF EXISTS reject_profile_link_request(uuid, text);

-- Create admin_approve_request function
-- Sets reviewed_by to auth.uid() (auth.users.id) to match FK constraint
CREATE OR REPLACE FUNCTION admin_approve_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id UUID;
  v_request profile_link_requests%ROWTYPE;
BEGIN
  -- Get current authenticated user
  v_admin_user_id := auth.uid();

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is admin using the fixed is_admin() function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get the request with row lock
  SELECT *
  INTO v_request
  FROM profile_link_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Update the request (reviewed_by = auth.uid() matches FK constraint)
  UPDATE profile_link_requests
  SET
    status = 'approved',
    reviewed_by = v_admin_user_id,  -- auth.users.id (FK constraint match!)
    reviewed_at = NOW(),
    review_notes = p_admin_notes
  WHERE id = p_request_id;

  -- Link the profile to the user
  UPDATE profiles
  SET
    user_id = v_request.user_id,
    can_edit = TRUE,
    updated_at = NOW()
  WHERE id = v_request.profile_id
    AND user_id IS NULL;

  -- Create notification for the user
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_request.user_id,
    'profile_link_approved',
    'تمت الموافقة على طلبك! 🎉',
    'تم ربط ملفك الشخصي بنجاح. يمكنك الآن تعديل معلوماتك.',
    jsonb_build_object(
      'profile_id', v_request.profile_id,
      'request_id', p_request_id
    )
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'profile_id', v_request.profile_id,
    'user_id', v_request.user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in admin_approve_request: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

-- Create admin_reject_request function
-- Sets reviewed_by to auth.uid() (auth.users.id) to match FK constraint
CREATE OR REPLACE FUNCTION admin_reject_request(
  p_request_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id UUID;
  v_request profile_link_requests%ROWTYPE;
BEGIN
  -- Get current authenticated user
  v_admin_user_id := auth.uid();

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is admin using the fixed is_admin() function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get the request with row lock
  SELECT *
  INTO v_request
  FROM profile_link_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Update the request (reviewed_by = auth.uid() matches FK constraint)
  UPDATE profile_link_requests
  SET
    status = 'rejected',
    reviewed_by = v_admin_user_id,  -- auth.users.id (FK constraint match!)
    reviewed_at = NOW(),
    review_notes = p_rejection_reason
  WHERE id = p_request_id;

  -- Create notification for the user
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_request.user_id,
    'profile_link_rejected',
    'تم رفض طلبك',
    COALESCE(p_rejection_reason, 'تم رفض طلب ربط الملف. يرجى التواصل مع المشرف للمزيد من المعلومات.'),
    jsonb_build_object(
      'profile_id', v_request.profile_id,
      'request_id', p_request_id,
      'reason', p_rejection_reason
    )
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'user_id', v_request.user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in admin_reject_request: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$;

-- Legacy fallback: approve_profile_link_request
-- Returns BOOLEAN for backward compatibility
CREATE OR REPLACE FUNCTION approve_profile_link_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id UUID;
  v_request profile_link_requests%ROWTYPE;
BEGIN
  v_admin_user_id := auth.uid();

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  SELECT *
  INTO v_request
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;

  UPDATE profile_link_requests
  SET
    status = 'approved',
    reviewed_by = v_admin_user_id,  -- auth.users.id (FK constraint match!)
    review_notes = p_admin_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id;

  UPDATE profiles
  SET
    user_id = v_request.user_id,
    updated_at = NOW()
  WHERE id = v_request.profile_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_request.user_id,
    'profile_link_approved',
    'تمت الموافقة على طلبك',
    'تم ربط ملفك الشخصي بنجاح',
    jsonb_build_object('profile_id', v_request.profile_id)
  );

  RETURN TRUE;
END;
$$;

-- Legacy fallback: reject_profile_link_request
-- Returns BOOLEAN for backward compatibility
CREATE OR REPLACE FUNCTION reject_profile_link_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id UUID;
  v_user_id UUID;
BEGIN
  v_admin_user_id := auth.uid();

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE profile_link_requests
  SET
    status = 'rejected',
    reviewed_by = v_admin_user_id,  -- auth.users.id (FK constraint match!)
    review_notes = p_admin_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id AND status = 'pending'
  RETURNING user_id INTO v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'profile_link_rejected',
    'تم رفض طلبك',
    COALESCE(p_admin_notes, 'يرجى مراجعة بياناتك وإعادة الطلب'),
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN TRUE;
END;
$$;

-- Grant execute permissions to authenticated users
-- The functions check admin permissions internally
GRANT EXECUTE ON FUNCTION admin_approve_request TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_request TO authenticated;
GRANT EXECUTE ON FUNCTION approve_profile_link_request TO authenticated;
GRANT EXECUTE ON FUNCTION reject_profile_link_request TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION admin_approve_request IS 'Approve a profile link request (admin only). Sets reviewed_by to auth.uid() to match FK constraint.';
COMMENT ON FUNCTION admin_reject_request IS 'Reject a profile link request (admin only). Sets reviewed_by to auth.uid() to match FK constraint.';
COMMENT ON FUNCTION approve_profile_link_request IS 'Legacy fallback for approve operation. Returns BOOLEAN for backward compatibility.';
COMMENT ON FUNCTION reject_profile_link_request IS 'Legacy fallback for reject operation. Returns BOOLEAN for backward compatibility.';
