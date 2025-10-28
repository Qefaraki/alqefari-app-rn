-- Migration: Add rejection reason length validation
-- Purpose: Prevent DoS via extremely long rejection reasons (>5000 chars)
-- Dependencies: Requires 20251029000002_create_photo_request_rpcs.sql

-- ============================================================================
-- UPDATE: reject_photo_change function
-- ============================================================================
-- Adds max length validation to rejection reason parameter

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

  -- NEW: Validate rejection reason length (max 5000 characters)
  IF p_rejection_reason IS NOT NULL AND length(p_rejection_reason) > 5000 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'REJECTION_REASON_TOO_LONG',
      'message', 'سبب الرفض طويل جداً (الحد الأقصى 5000 حرف)'
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

  -- Use existing notifications table
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
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON FUNCTION reject_photo_change(UUID, TEXT) IS
  'Admin rejects photo change with optional reason. Features: Template support, gentle language, notification, MAX 5000 char reason (DoS prevention). Reason can be from template or custom text.';

-- ============================================================================
-- VALIDATION TESTS (Optional - run manually to verify)
-- ============================================================================

-- Test 1: Valid rejection (should succeed)
-- SELECT reject_photo_change('valid-request-id'::UUID, 'الصورة غير واضحة');

-- Test 2: Too long rejection (should fail with REJECTION_REASON_TOO_LONG)
-- SELECT reject_photo_change('valid-request-id'::UUID, repeat('أ', 5001));

-- Test 3: NULL rejection reason (should succeed - optional reason)
-- SELECT reject_photo_change('valid-request-id'::UUID, NULL);
