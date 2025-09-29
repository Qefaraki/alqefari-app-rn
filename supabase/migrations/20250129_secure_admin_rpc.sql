-- Secure RPC functions for admin operations
-- These functions check permissions before performing actions

-- Function to approve a profile link request (admin only)
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
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_request RECORD;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is admin
  SELECT (role IN ('admin', 'super_admin')) INTO v_is_admin
  FROM profiles
  WHERE user_id = v_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get the request
  SELECT * INTO v_request
  FROM profile_link_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Update the request
  UPDATE profile_link_requests
  SET
    status = 'approved',
    reviewed_by = v_user_id,
    reviewed_at = NOW(),
    review_notes = p_admin_notes
  WHERE id = p_request_id;

  -- Link the profile to the user
  UPDATE profiles
  SET
    user_id = v_request.user_id,
    can_edit = true,
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
  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'profile_id', v_request.profile_id,
    'user_id', v_request.user_id
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Error in admin_approve_request: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Function to reject a profile link request (admin only)
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
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_request RECORD;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is admin
  SELECT (role IN ('admin', 'super_admin')) INTO v_is_admin
  FROM profiles
  WHERE user_id = v_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get the request
  SELECT * INTO v_request
  FROM profile_link_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Update the request
  UPDATE profile_link_requests
  SET
    status = 'rejected',
    reviewed_by = v_user_id,
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
  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'user_id', v_request.user_id
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Error in admin_reject_request: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions to authenticated users
-- The functions will check internally if they're admin
GRANT EXECUTE ON FUNCTION admin_approve_request TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_request TO authenticated;

-- Verify the functions were created
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('admin_approve_request', 'admin_reject_request');