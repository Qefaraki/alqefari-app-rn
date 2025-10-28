-- Migration: Create undo_crop_update() RPC for undo system integration
-- Author: Claude Code
-- Date: 2025-10-27
-- Purpose: Allow users to undo crop changes via activity log
-- Pattern: Follows undo_profile_update() with JSONB old_data/new_data

-- ============================================================================
-- FUNCTION: undo_crop_update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.undo_crop_update(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check JSONB;
  v_profile_id UUID;
  v_old_data JSONB;
  v_current_version INTEGER;
  v_expected_version INTEGER;
BEGIN
  -- Get current user's profile ID (for permission checking)
  SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح. يجب تسجيل الدخول.');
  END IF;

  -- Advisory lock (prevent concurrent undo)
  PERFORM pg_advisory_xact_lock(hashtext(p_audit_log_id::text));

  -- Get audit log entry WITH LOCK
  BEGIN
    SELECT * INTO v_log_entry FROM audit_log_enhanced WHERE id = p_audit_log_id FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'عملية التراجع قيد التنفيذ من قبل مستخدم آخر');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'سجل غير موجود');
  END IF;

  -- Validate action type
  IF v_log_entry.action_type != 'crop_update' THEN
    RETURN jsonb_build_object('success', false, 'error', 'نوع العملية غير صحيح (متوقع: crop_update)');
  END IF;

  -- Idempotency check
  IF v_log_entry.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('تم التراجع عن هذا الإجراء بالفعل في %s', to_char(v_log_entry.undone_at, 'YYYY-MM-DD HH24:MI'))
    );
  END IF;

  -- Check permission
  v_permission_check := check_undo_permission(p_audit_log_id, v_current_user_id);
  IF NOT (v_permission_check->>'can_undo')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_permission_check->>'reason');
  END IF;

  v_profile_id := v_log_entry.record_id;
  v_old_data := v_log_entry.old_data;
  v_expected_version := (v_log_entry.new_data->>'version')::integer;

  -- Version checking with lock
  BEGIN
    SELECT version INTO v_current_version FROM profiles WHERE id = v_profile_id FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف قيد التعديل. يرجى المحاولة بعد قليل.');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود');
  END IF;

  -- Version conflict check (only if expected_version is set)
  IF v_current_version != v_expected_version AND v_expected_version IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('تم تحديث الملف من مستخدم آخر (الإصدار الحالي: %s، المتوقع: %s). لا يمكن التراجع.', v_current_version, v_expected_version)
    );
  END IF;

  -- ========================================================================
  -- Restore old crop values
  -- ========================================================================
  UPDATE profiles
  SET
    crop_top = CASE WHEN v_old_data ? 'crop_top' THEN (v_old_data->>'crop_top')::NUMERIC(4,3) ELSE crop_top END,
    crop_bottom = CASE WHEN v_old_data ? 'crop_bottom' THEN (v_old_data->>'crop_bottom')::NUMERIC(4,3) ELSE crop_bottom END,
    crop_left = CASE WHEN v_old_data ? 'crop_left' THEN (v_old_data->>'crop_left')::NUMERIC(4,3) ELSE crop_left END,
    crop_right = CASE WHEN v_old_data ? 'crop_right' THEN (v_old_data->>'crop_right')::NUMERIC(4,3) ELSE crop_right END,
    version = version + 1,
    updated_at = NOW(),
    updated_by = auth.uid()  -- Use auth.uid() for FK constraint compliance
  WHERE id = v_profile_id;

  -- Mark as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create CLR (Compensation Log Record)
  -- Uses auth.uid() for actor_id (FK constraint compliance)
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    old_data,
    new_data,
    changed_fields,
    description,
    severity,
    is_undoable
  ) VALUES (
    'profiles',
    v_profile_id,
    'undo_crop_update',
    auth.uid(),  -- ✅ Use auth.uid() not v_current_user_id
    v_log_entry.new_data,  -- What was changed TO becomes old_data in CLR
    v_log_entry.old_data,  -- What it reverted TO becomes new_data in CLR
    v_log_entry.changed_fields,  -- Same fields affected
    'تراجع عن: تحديث قص الصورة',  -- "Undo: Photo crop update" in Arabic
    'medium',
    false  -- CLR cannot be undone (prevents undo loops)
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم التراجع بنجاح');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء التراجع: ' || SQLERRM);
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.undo_crop_update TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.undo_crop_update IS
  'Safely undoes a crop update with proper version checking and CLR creation.

CREATED: 2025-10-27
PATTERN: Follows undo_profile_update() with JSONB old_data/new_data

FEATURES:
- Version conflict detection (prevents reverting if profile changed)
- Advisory locks (prevents concurrent undo operations)
- Row-level locks (prevents race conditions)
- Idempotency check (prevents double-undo)
- Permission validation (via check_undo_permission)
- CLR creation (audit trail for undo operation)
- FK compliance (actor_id uses auth.uid() for auth.users.id)

VALIDATION:
- Action type must be "crop_update"
- Profile must exist and not be deleted
- Version must match expected version
- User must have undo permission

RETURNS:
- Success: {"success": true, "message": "تم التراجع بنجاح"}
- Error: {"success": false, "error": "error message in Arabic"}';

-- ============================================================================
-- USAGE EXAMPLE
-- ============================================================================

-- Undo a crop update:
-- SELECT * FROM undo_crop_update(
--   p_audit_log_id := 'abc-123'::UUID,
--   p_undo_reason := 'Accidental crop change'
-- );
-- Returns: {"success": true, "message": "تم التراجع بنجاح"}

-- ============================================================================
-- TESTING CHECKLIST
-- ============================================================================

-- 1. Test successful undo:
--    - Apply crop → verify audit log created
--    - Call undo_crop_update → verify crop reverted
--    - Check version incremented
--    - Check CLR created with action_type='undo_crop_update'

-- 2. Test idempotency:
--    - Call undo_crop_update twice with same ID
--    - Second call should return "already undone" error

-- 3. Test version conflict:
--    - Apply crop (version N)
--    - Update profile via different operation (version N+1)
--    - Try to undo crop → should fail with version mismatch

-- 4. Test permission check:
--    - Try to undo as user without permission
--    - Should fail with permission error

-- 5. Test concurrent undo:
--    - Two users try to undo same operation simultaneously
--    - One should succeed, other gets lock error
