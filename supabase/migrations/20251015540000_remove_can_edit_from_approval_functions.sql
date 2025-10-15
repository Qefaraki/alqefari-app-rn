-- Fix: Remove can_edit column reference (column doesn't exist in profiles table)
-- This migration updates the approval functions to remove the non-existent can_edit column

-- Update admin_approve_request function (remove can_edit)
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
    reviewed_by = v_admin_user_id,
    reviewed_at = NOW(),
    review_notes = p_admin_notes
  WHERE id = p_request_id;

  -- Link the profile to the user (removed can_edit - column doesn't exist)
  UPDATE profiles
  SET
    user_id = v_request.user_id,
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

-- Add comment
COMMENT ON FUNCTION admin_approve_request IS 'Approve a profile link request (admin only). Sets reviewed_by to auth.uid() to match FK constraint.';
