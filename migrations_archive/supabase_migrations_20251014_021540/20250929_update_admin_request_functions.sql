-- Ensure admin approval/rejection functions write a valid reviewed_by value
-- regardless of whether the foreign key targets auth.users.id or profiles.id.

DROP FUNCTION IF EXISTS admin_approve_request(uuid, text);
DROP FUNCTION IF EXISTS admin_reject_request(uuid, text);
DROP FUNCTION IF EXISTS approve_profile_link_request(uuid, text);
DROP FUNCTION IF EXISTS reject_profile_link_request(uuid, text);

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
  v_admin_profile_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (role IN ('admin', 'super_admin')), id
  INTO v_is_admin, v_admin_profile_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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

  UPDATE profile_link_requests
  SET
    status = 'approved',
    reviewed_by = COALESCE(v_admin_profile_id, v_user_id),
    reviewed_at = NOW(),
    review_notes = p_admin_notes
  WHERE id = p_request_id;

  UPDATE profiles
  SET
    user_id = v_request.user_id,
    can_edit = true,
    updated_at = NOW()
  WHERE id = v_request.profile_id
  AND user_id IS NULL;

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

  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'profile_id', v_request.profile_id,
    'user_id', v_request.user_id
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in admin_approve_request: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

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
  v_admin_profile_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (role IN ('admin', 'super_admin')), id
  INTO v_is_admin, v_admin_profile_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

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

  UPDATE profile_link_requests
  SET
    status = 'rejected',
    reviewed_by = COALESCE(v_admin_profile_id, v_user_id),
    reviewed_at = NOW(),
    review_notes = p_rejection_reason
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_request.user_id,
    'profile_link_rejected',
    'تم رفض طلبك',
    COALESCE(p_rejection_reason, 'نوصي بالتواصل مع الدعم لمراجعة بياناتك'),
    jsonb_build_object(
      'profile_id', v_request.profile_id,
      'request_id', p_request_id
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'profile_id', v_request.profile_id,
    'user_id', v_request.user_id
  );

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in admin_reject_request: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION approve_profile_link_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_admin_id UUID;
  v_admin_profile_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM admins WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  SELECT id INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = v_admin_id;

  SELECT user_id, profile_id
  INTO v_user_id, v_profile_id
  FROM profile_link_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الطلب غير موجود أو تم معالجته';
  END IF;

  UPDATE profile_link_requests
  SET
    status = 'approved',
    reviewed_by = COALESCE(v_admin_profile_id, v_admin_id),
    review_notes = p_admin_notes,
    reviewed_at = NOW()
  WHERE id = p_request_id;

  UPDATE profiles
  SET
    user_id = v_user_id,
    updated_at = NOW()
  WHERE id = v_profile_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'link_approved',
    'تمت الموافقة على طلبك',
    'تم ربط ملفك الشخصي بنجاح',
    jsonb_build_object('profile_id', v_profile_id)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_profile_link_request(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_id UUID;
  v_admin_profile_id UUID;
  v_user_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM admins WHERE user_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  SELECT id INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = v_admin_id;

  UPDATE profile_link_requests
  SET
    status = 'rejected',
    reviewed_by = COALESCE(v_admin_profile_id, v_admin_id),
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
    'link_rejected',
    'تم رفض طلبك',
    COALESCE(p_admin_notes, 'يرجى مراجعة بياناتك وإعادة الطلب'),
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
