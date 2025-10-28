-- Migration: Create photo change approval RPC functions
-- Purpose: Complete business logic for photo approval workflow
-- Dependencies: Requires migrations 20251029000000 and 20251029000001

-- ============================================================================
-- FUNCTION 1: submit_photo_change_request
-- ============================================================================
-- User submits a photo change request for their own profile
-- Features: Rate limiting, URL validation, old photo capture

CREATE OR REPLACE FUNCTION submit_photo_change_request(
  p_profile_id UUID,
  p_new_photo_url TEXT,
  p_new_photo_blurhash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_old_photo_url TEXT;
  v_request_id UUID;
  v_can_submit BOOLEAN;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لتقديم طلب تغيير الصورة'
    );
  END IF;

  -- Check rate limit (5 requests per 24 hours)
  v_can_submit := check_photo_request_rate_limit(v_user_id);

  IF NOT v_can_submit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'RATE_LIMIT_EXCEEDED',
      'message', 'لقد تجاوزت الحد الأقصى لطلبات تغيير الصورة (5 طلبات كل 24 ساعة)'
    );
  END IF;

  -- Validate URL
  IF NOT is_valid_supabase_storage_url(p_new_photo_url) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_URL',
      'message', 'رابط الصورة غير صالح أو من مصدر غير موثوق'
    );
  END IF;

  -- Capture old photo URL for comparison view
  SELECT photo_url INTO v_old_photo_url
  FROM profiles
  WHERE id = p_profile_id;

  -- Insert request (unique index will prevent duplicate pending requests)
  INSERT INTO photo_change_requests (
    profile_id,
    submitter_user_id,
    old_photo_url,
    new_photo_url,
    new_photo_blurhash
  )
  VALUES (
    p_profile_id,
    v_user_id,
    v_old_photo_url,
    p_new_photo_url,
    p_new_photo_blurhash
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'تم إرسال طلب تغيير الصورة بنجاح. سيتم مراجعته قريباً'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_REQUEST',
      'message', 'لديك طلب تغيير صورة قيد المراجعة بالفعل'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء إرسال الطلب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 2: approve_photo_change
-- ============================================================================
-- Admin approves a photo change request
-- Features: Profile-level locking, audit logging, notification

CREATE OR REPLACE FUNCTION approve_photo_change(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request photo_change_requests%ROWTYPE;
  v_user_id UUID;
  v_permission TEXT;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لمراجعة الطلبات'
    );
  END IF;

  -- Get request details (initial read without lock)
  SELECT * INTO v_request
  FROM photo_change_requests
  WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUEST_NOT_FOUND',
      'message', 'الطلب غير موجود'
    );
  END IF;

  -- FIX #4: Lock on profile_id to prevent concurrent approvals of different requests
  -- This ensures two admins can't approve different photos for same profile simultaneously
  PERFORM pg_advisory_xact_lock(hashtext('photo_approval_' || v_request.profile_id::text));

  -- Re-select with row-level lock after acquiring advisory lock
  SELECT * INTO v_request
  FROM photo_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Verify status is still pending (may have changed while waiting for lock)
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'هذا الطلب تمت مراجعته بالفعل'
    );
  END IF;

  -- Re-validate URL (defense in depth)
  IF NOT is_valid_supabase_storage_url(v_request.new_photo_url) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_URL',
      'message', 'رابط الصورة غير صالح'
    );
  END IF;

  -- Check admin permission
  SELECT check_family_permission_v4(
    (SELECT id FROM profiles WHERE user_id = v_user_id LIMIT 1),
    v_request.profile_id
  ) INTO v_permission;

  IF v_permission NOT IN ('admin', 'moderator') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'ليس لديك صلاحية لمراجعة هذا الطلب'
    );
  END IF;

  -- Update profile with new photo
  UPDATE profiles
  SET photo_url = v_request.new_photo_url,
      photo_blurhash = v_request.new_photo_blurhash,
      updated_at = NOW(),
      version = version + 1
  WHERE id = v_request.profile_id;

  -- Update request status
  UPDATE photo_change_requests
  SET status = 'approved',
      reviewer_user_id = v_user_id,
      reviewed_at = NOW(),
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_request_id;

  -- Audit log
  INSERT INTO audit_log_enhanced (
    user_id,
    action,
    target_type,
    target_id,
    changes
  )
  VALUES (
    v_user_id,
    'photo_change_approved',
    'profile',
    v_request.profile_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'old_photo_url', v_request.old_photo_url,
      'new_photo_url', v_request.new_photo_url
    )
  );

  -- FIX #1: Use existing notifications table (NOT new queue)
  -- Edge Function trigger will handle actual push notification delivery
  IF v_request.submitter_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data, priority, push_sent)
    VALUES (
      v_request.submitter_user_id,
      'photo_approved',
      'تم قبول صورتك',
      'تم قبول طلب تغيير الصورة الشخصية',
      jsonb_build_object(
        'type', 'photo_approved',
        'profile_id', v_request.profile_id,
        'request_id', p_request_id
      ),
      'high',
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم قبول الصورة بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء الموافقة على الطلب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 3: reject_photo_change
-- ============================================================================
-- Admin rejects a photo change request with optional reason
-- Features: Template support, gentle language, notification

CREATE OR REPLACE FUNCTION reject_photo_change(
  p_request_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request photo_change_requests%ROWTYPE;
  v_user_id UUID;
  v_permission TEXT;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لمراجعة الطلبات'
    );
  END IF;

  -- Get request details
  SELECT * INTO v_request
  FROM photo_change_requests
  WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUEST_NOT_FOUND',
      'message', 'الطلب غير موجود'
    );
  END IF;

  -- Lock on profile_id (same as approve)
  PERFORM pg_advisory_xact_lock(hashtext('photo_approval_' || v_request.profile_id::text));

  -- Re-select with row lock
  SELECT * INTO v_request
  FROM photo_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  -- Verify status
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'هذا الطلب تمت مراجعته بالفعل'
    );
  END IF;

  -- Check admin permission
  SELECT check_family_permission_v4(
    (SELECT id FROM profiles WHERE user_id = v_user_id LIMIT 1),
    v_request.profile_id
  ) INTO v_permission;

  IF v_permission NOT IN ('admin', 'moderator') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'ليس لديك صلاحية لمراجعة هذا الطلب'
    );
  END IF;

  -- Update request status
  UPDATE photo_change_requests
  SET status = 'rejected',
      reviewer_user_id = v_user_id,
      rejection_reason = p_rejection_reason,
      reviewed_at = NOW(),
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_request_id;

  -- Audit log
  INSERT INTO audit_log_enhanced (
    user_id,
    action,
    target_type,
    target_id,
    changes
  )
  VALUES (
    v_user_id,
    'photo_change_rejected',
    'profile',
    v_request.profile_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'rejection_reason', p_rejection_reason
    )
  );

  -- FIX #1: Use existing notifications table
  IF v_request.submitter_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data, priority, push_sent)
    VALUES (
      v_request.submitter_user_id,
      'photo_rejected',
      'نعتذر، الصورة تحتاج بعض التحسينات',
      p_rejection_reason,
      jsonb_build_object(
        'type', 'photo_rejected',
        'profile_id', v_request.profile_id,
        'request_id', p_request_id,
        'rejection_reason', p_rejection_reason
      ),
      'normal',
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم رفض الصورة وإرسال إشعار للمستخدم'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء رفض الطلب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 4: list_photo_change_requests
-- ============================================================================
-- Admin views pending photo change requests with profile info
-- Features: Pagination, sorting, admin-only access

CREATE OR REPLACE FUNCTION list_photo_change_requests(
  p_status TEXT DEFAULT 'pending',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  profile_hid TEXT,
  profile_name TEXT,
  profile_generation INTEGER,
  submitter_user_id UUID,
  old_photo_url TEXT,
  new_photo_url TEXT,
  new_photo_blurhash TEXT,
  status TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING HINT = 'يجب تسجيل الدخول لعرض الطلبات';
  END IF;

  -- Check if user is admin/moderator
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED'
      USING HINT = 'يجب أن تكون مشرفاً لعرض طلبات تغيير الصور';
  END IF;

  -- Return requests with profile info
  RETURN QUERY
  SELECT
    pcr.id,
    pcr.profile_id,
    p.hid,
    p.name,
    p.generation,
    pcr.submitter_user_id,
    pcr.old_photo_url,
    pcr.new_photo_url,
    pcr.new_photo_blurhash,
    pcr.status,
    pcr.rejection_reason,
    pcr.created_at,
    pcr.reviewed_at,
    pcr.expires_at
  FROM photo_change_requests pcr
  JOIN profiles p ON p.id = pcr.profile_id
  WHERE pcr.status = p_status
    AND p.deleted_at IS NULL
  ORDER BY pcr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- FUNCTION 5: get_my_photo_requests
-- ============================================================================
-- User views their own photo change request history (30 days)

CREATE OR REPLACE FUNCTION get_my_photo_requests(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  old_photo_url TEXT,
  new_photo_url TEXT,
  status TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING HINT = 'يجب تسجيل الدخول لعرض طلباتك';
  END IF;

  -- Return user's own requests from last 30 days
  RETURN QUERY
  SELECT
    pcr.id,
    pcr.profile_id,
    pcr.old_photo_url,
    pcr.new_photo_url,
    pcr.status,
    pcr.rejection_reason,
    pcr.created_at,
    pcr.reviewed_at,
    pcr.expires_at
  FROM photo_change_requests pcr
  WHERE pcr.submitter_user_id = v_user_id
    AND pcr.created_at > NOW() - INTERVAL '30 days'
  ORDER BY pcr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- FUNCTION 6: cancel_photo_change_request
-- ============================================================================
-- User cancels their own pending photo change request

CREATE OR REPLACE FUNCTION cancel_photo_change_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_request photo_change_requests%ROWTYPE;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لإلغاء الطلب'
    );
  END IF;

  -- Get request and verify ownership
  SELECT * INTO v_request
  FROM photo_change_requests
  WHERE id = p_request_id
    AND submitter_user_id = v_user_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REQUEST_NOT_FOUND',
      'message', 'الطلب غير موجود أو لا تملك صلاحية إلغائه'
    );
  END IF;

  -- Verify status is pending
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_STATUS',
      'message', 'لا يمكن إلغاء طلب تمت مراجعته بالفعل'
    );
  END IF;

  -- Update status to cancelled
  UPDATE photo_change_requests
  SET status = 'cancelled',
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إلغاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء إلغاء الطلب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 7: get_photo_request_status
-- ============================================================================
-- Check if profile has a pending photo change request
-- Used to show "waiting for approval" state in UI

CREATE OR REPLACE FUNCTION get_photo_request_status(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request photo_change_requests%ROWTYPE;
BEGIN
  -- Get pending request for this profile
  SELECT * INTO v_request
  FROM photo_change_requests
  WHERE profile_id = p_profile_id
    AND status = 'pending'
  LIMIT 1;

  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object(
      'has_pending', false
    );
  END IF;

  RETURN jsonb_build_object(
    'has_pending', true,
    'request_id', v_request.id,
    'new_photo_url', v_request.new_photo_url,
    'created_at', v_request.created_at,
    'expires_at', v_request.expires_at
  );
END;
$$;

-- ============================================================================
-- FUNCTION 8a: create_photo_rejection_template
-- ============================================================================
-- Admin creates a new rejection reason template

CREATE OR REPLACE FUNCTION create_photo_rejection_template(
  p_title TEXT,
  p_message TEXT,
  p_display_order INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_template_id UUID;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لإنشاء قالب'
    );
  END IF;

  -- Check admin permission
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'يجب أن تكون مشرفاً لإنشاء القوالب'
    );
  END IF;

  -- Insert template
  INSERT INTO photo_rejection_templates (
    title,
    message,
    display_order,
    created_by_user_id
  )
  VALUES (
    p_title,
    p_message,
    p_display_order,
    v_user_id
  )
  RETURNING id INTO v_template_id;

  RETURN jsonb_build_object(
    'success', true,
    'template_id', v_template_id,
    'message', 'تم إنشاء القالب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء إنشاء القالب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 8b: update_photo_rejection_template
-- ============================================================================
-- Admin updates an existing rejection template

CREATE OR REPLACE FUNCTION update_photo_rejection_template(
  p_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_display_order INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لتحديث القالب'
    );
  END IF;

  -- Check admin permission
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'يجب أن تكون مشرفاً لتحديث القوالب'
    );
  END IF;

  -- Update template
  UPDATE photo_rejection_templates
  SET title = p_title,
      message = p_message,
      display_order = p_display_order,
      updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TEMPLATE_NOT_FOUND',
      'message', 'القالب غير موجود'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تحديث القالب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء تحديث القالب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 8c: delete_photo_rejection_template
-- ============================================================================
-- Admin soft deletes a rejection template

CREATE OR REPLACE FUNCTION delete_photo_rejection_template(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'يجب تسجيل الدخول لحذف القالب'
    );
  END IF;

  -- Check admin permission
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_user_role NOT IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'يجب أن تكون مشرفاً لحذف القوالب'
    );
  END IF;

  -- Soft delete (set is_active = false)
  UPDATE photo_rejection_templates
  SET is_active = false,
      updated_at = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TEMPLATE_NOT_FOUND',
      'message', 'القالب غير موجود'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم حذف القالب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'حدث خطأ أثناء حذف القالب'
    );
END;
$$;

-- ============================================================================
-- FUNCTION 8d: list_photo_rejection_templates
-- ============================================================================
-- Returns active rejection templates for template picker

CREATE OR REPLACE FUNCTION list_photo_rejection_templates()
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  display_order INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    prt.id,
    prt.title,
    prt.message,
    prt.display_order,
    prt.created_at
  FROM photo_rejection_templates prt
  WHERE prt.is_active = true
  ORDER BY prt.display_order ASC, prt.created_at ASC;
END;
$$;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON FUNCTION submit_photo_change_request(UUID, TEXT, TEXT) IS
  'User submits photo change request. Features: Rate limiting (5/24h), URL validation, old photo capture. Returns request_id on success.';

COMMENT ON FUNCTION approve_photo_change(UUID) IS
  'Admin approves photo change. Features: Profile-level locking (prevents concurrent approvals), permission check, audit log, notification via existing table.';

COMMENT ON FUNCTION reject_photo_change(UUID, TEXT) IS
  'Admin rejects photo change with optional reason. Features: Template support, gentle language, notification. Reason can be from template or custom text.';

COMMENT ON FUNCTION list_photo_change_requests(TEXT, INTEGER, INTEGER) IS
  'Admin views pending/approved/rejected requests with profile info. Supports pagination and sorting.';

COMMENT ON FUNCTION get_my_photo_requests(INTEGER, INTEGER) IS
  'User views their own photo change history from last 30 days. Supports pagination.';

COMMENT ON FUNCTION cancel_photo_change_request(UUID) IS
  'User cancels their own pending photo change request. Only works if status is pending.';

COMMENT ON FUNCTION get_photo_request_status(UUID) IS
  'Check if profile has pending photo change request. Used to show "waiting for approval" state in UI.';

COMMENT ON FUNCTION create_photo_rejection_template(TEXT, TEXT, INTEGER) IS
  'Admin creates new rejection reason template. Supports custom messages and display order.';

COMMENT ON FUNCTION update_photo_rejection_template(UUID, TEXT, TEXT, INTEGER) IS
  'Admin updates existing rejection template.';

COMMENT ON FUNCTION delete_photo_rejection_template(UUID) IS
  'Admin soft deletes rejection template (sets is_active = false).';

COMMENT ON FUNCTION list_photo_rejection_templates() IS
  'Returns active rejection templates ordered by display_order for template picker UI.';
