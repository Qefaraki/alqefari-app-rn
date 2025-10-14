-- Migration: Fix Parent Validation TOCTOU Vulnerability
-- Created: 2025-10-15
-- Description: Eliminates Time-of-Check to Time-of-Use race condition in parent
--              validation by locking parent rows during validation instead of just
--              checking existence. Prevents parent from being deleted between check
--              and restore.
--
-- SECURITY IMPACT: CRITICAL
-- - Before: Parent could be deleted in ~10-100 microsecond window
-- - After: Parent locked until transaction commits (TOCTOU eliminated)
--
-- FIXES APPLIED:
-- 1. Version checking with row-level lock (FOR UPDATE NOWAIT)
-- 2. Advisory lock to prevent concurrent undo operations
-- 3. Idempotency check (prevent double-undo)
-- 4. Parent validation WITH ROW-LEVEL LOCKING (TOCTOU fix)
--
-- ATTACK SCENARIO PREVENTED:
-- Thread 1: Validates father exists (SELECT ... WHERE deleted_at IS NULL)
-- Thread 2: Soft-deletes father (UPDATE profiles SET deleted_at = NOW())
-- Thread 1: Restores profile with father_id pointing to deleted parent
-- Result: Orphaned profile with invalid parent reference
--
-- SOLUTION:
-- Thread 1: Locks father row (SELECT ... FOR UPDATE NOWAIT)
-- Thread 2: Blocks on father lock (must wait for Thread 1)
-- Thread 1: Completes restore, commits, releases lock
-- Thread 2: Proceeds with deletion

CREATE OR REPLACE FUNCTION undo_profile_update(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check jsonb;
  v_profile_id UUID;
  v_old_data jsonb;
  v_current_version INTEGER;
  v_expected_version INTEGER;
  v_father_id UUID;
  v_mother_id UUID;
BEGIN
  -- Get current user's profile ID
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

  -- CRITICAL FIX #3: Idempotency check
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

  -- CRITICAL FIX #1: Version checking with lock
  BEGIN
    SELECT version INTO v_current_version FROM profiles WHERE id = v_profile_id FOR UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف قيد التعديل. يرجى المحاولة بعد قليل.');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود');
  END IF;

  IF v_current_version != v_expected_version AND v_expected_version IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('تم تحديث الملف من مستخدم آخر (الإصدار الحالي: %s، المتوقع: %s). لا يمكن التراجع.', v_current_version, v_expected_version)
    );
  END IF;

  -- CRITICAL FIX #4: Parent validation WITH ROW-LEVEL LOCKING (TOCTOU fix)
  -- Lock parents to prevent deletion between validation and restore
  IF (v_old_data->>'father_id') IS NOT NULL THEN
    BEGIN
      SELECT id INTO v_father_id
      FROM profiles
      WHERE id = (v_old_data->>'father_id')::UUID
        AND deleted_at IS NULL
      FOR UPDATE NOWAIT;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأب محذوف. يجب استعادة الأب أولاً.');
      END IF;
    EXCEPTION WHEN lock_not_available THEN
      RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأب قيد التعديل. يرجى المحاولة لاحقاً.');
    END;
  END IF;

  IF (v_old_data->>'mother_id') IS NOT NULL THEN
    BEGIN
      SELECT id INTO v_mother_id
      FROM profiles
      WHERE id = (v_old_data->>'mother_id')::UUID
        AND deleted_at IS NULL
      FOR UPDATE NOWAIT;

      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأم محذوف. يجب استعادة الأم أولاً.');
      END IF;
    EXCEPTION WHEN lock_not_available THEN
      RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأم قيد التعديل. يرجى المحاولة لاحقاً.');
    END;
  END IF;

  -- Restore old data
  UPDATE profiles
  SET
    name = COALESCE((v_old_data->>'name')::text, name),
    given_name = COALESCE((v_old_data->>'given_name')::text, given_name),
    father_name = COALESCE((v_old_data->>'father_name')::text, father_name),
    grandfather_name = COALESCE((v_old_data->>'grandfather_name')::text, grandfather_name),
    phone = COALESCE((v_old_data->>'phone')::text, phone),
    birth_date = CASE WHEN v_old_data ? 'birth_date' THEN (v_old_data->>'birth_date')::date ELSE birth_date END,
    birth_year_hijri = CASE WHEN v_old_data ? 'birth_year_hijri' THEN (v_old_data->>'birth_year_hijri')::integer ELSE birth_year_hijri END,
    is_alive = CASE WHEN v_old_data ? 'is_alive' THEN (v_old_data->>'is_alive')::boolean ELSE is_alive END,
    death_date = CASE WHEN v_old_data ? 'death_date' THEN (v_old_data->>'death_date')::date ELSE death_date END,
    death_year_hijri = CASE WHEN v_old_data ? 'death_year_hijri' THEN (v_old_data->>'death_year_hijri')::integer ELSE death_year_hijri END,
    notes = CASE WHEN v_old_data ? 'notes' THEN (v_old_data->>'notes')::text ELSE notes END,
    version = version + 1,  -- CRITICAL FIX #1: Increment version
    updated_at = NOW()
  WHERE id = v_profile_id;

  -- Mark as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create CLR (Compensation Log Record)
  INSERT INTO audit_log_enhanced (
    table_name, record_id, action_type, actor_id,
    old_data, new_data, changed_fields, description, severity, is_undoable
  ) VALUES (
    'profiles', v_profile_id, 'undo_profile_update', v_current_user_id,
    v_log_entry.new_data, v_log_entry.old_data, v_log_entry.changed_fields,
    'تراجع عن: ' || v_log_entry.description, 'medium', false
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم التراجع بنجاح');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء التراجع: ' || SQLERRM);
END;
$function$;

COMMENT ON FUNCTION undo_profile_update IS 'Undoes profile update with version checking, parent locking (TOCTOU fix), idempotency, and row-level locking. CRITICAL FIX #4: Parents locked with FOR UPDATE NOWAIT to prevent deletion during restore.';
