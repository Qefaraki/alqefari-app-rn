-- Align admin approval/rejection RPCs with existing schema: reviewed_by references profiles.id
-- and admin privileges are inferred from profiles.role.

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
  v_admin_user_id    UUID;
  v_admin_profile_id UUID;
  v_request          profile_link_requests%ROWTYPE;
BEGIN
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id
  INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = v_admin_user_id
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin profile required';
  END IF;

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

  UPDATE profile_link_requests
  SET
    status       = 'approved',
    reviewed_by  = v_admin_profile_id,
    reviewed_at  = NOW(),
    review_notes = p_admin_notes
  WHERE id = p_request_id;

  UPDATE profiles
  SET
    user_id    = v_request.user_id,
    can_edit   = TRUE,
    updated_at = NOW()
  WHERE id = v_request.profile_id
    AND user_id IS DISTINCT FROM v_request.user_id;

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

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'profile_id', v_request.profile_id,
    'user_id', v_request.user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in admin_approve_request: %', SQLERRM;
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
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
  v_admin_user_id    UUID;
  v_admin_profile_id UUID;
  v_request          profile_link_requests%ROWTYPE;
BEGIN
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id
  INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = v_admin_user_id
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin profile required';
  END IF;

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

  UPDATE profile_link_requests
  SET
    status       = 'rejected',
    reviewed_by  = v_admin_profile_id,
    reviewed_at  = NOW(),
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

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'profile_id', v_request.profile_id,
    'user_id', v_request.user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in admin_reject_request: %', SQLERRM;
    RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- Legacy fallbacks for older clients/tests
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
  v_admin_user_id    UUID := auth.uid();
  v_admin_profile_id UUID;
  v_request          profile_link_requests%ROWTYPE;
BEGIN
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id
  INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = v_admin_user_id
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin profile required';
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
    status       = 'approved',
    reviewed_by  = v_admin_profile_id,
    review_notes = p_admin_notes,
    reviewed_at  = NOW()
  WHERE id = p_request_id;

  UPDATE profiles
  SET
    user_id    = v_request.user_id,
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
  v_admin_user_id    UUID := auth.uid();
  v_admin_profile_id UUID;
  v_user_id          UUID;
BEGIN
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id
  INTO v_admin_profile_id
  FROM profiles
  WHERE user_id = v_admin_user_id
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_admin_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin profile required';
  END IF;

  UPDATE profile_link_requests
  SET
    status       = 'rejected',
    reviewed_by  = v_admin_profile_id,
    review_notes = p_admin_notes,
    reviewed_at  = NOW()
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
