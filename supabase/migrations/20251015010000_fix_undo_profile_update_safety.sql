-- Migration: Fix undo_profile_update safety mechanisms
-- Created: 2025-10-15
-- Description: Adds critical safety fixes to undo_profile_update function
--
-- CRITICAL FIXES INCLUDED:
-- 1. Version checking with row-level locking (FOR UPDATE NOWAIT)
-- 2. Parent existence validation (prevents orphaned profiles)
-- 3. Idempotency check (prevents double-undo)
--
-- Safety Mechanisms:
-- - Advisory locks prevent concurrent undo operations
-- - Row-level locks prevent race conditions during version check
-- - Parent validation ensures referential integrity
-- - Idempotency check prevents duplicate undos
--
-- Related Documentation: /docs/UNDO_SYSTEM.md

CREATE OR REPLACE FUNCTION public.undo_profile_update(p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text)
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
  v_father_exists BOOLEAN;
  v_mother_exists BOOLEAN;
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

  -- CRITICAL FIX #2: Parent existence validation
  IF (v_old_data->>'father_id') IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = (v_old_data->>'father_id')::UUID AND deleted_at IS NULL
    ) INTO v_father_exists;

    IF NOT v_father_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأب محذوف. يجب استعادة الأب أولاً.');
    END IF;
  END IF;

  IF (v_old_data->>'mother_id') IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = (v_old_data->>'mother_id')::UUID AND deleted_at IS NULL
    ) INTO v_mother_exists;

    IF NOT v_mother_exists THEN
      RETURN jsonb_build_object('success', false, 'error', 'الملف الشخصي للأم محذوف. يجب استعادة الأم أولاً.');
    END IF;
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

-- Add function documentation
COMMENT ON FUNCTION public.undo_profile_update(uuid, text) IS
'Safely undoes a profile update operation with version checking, parent validation, and idempotency.

SAFETY MECHANISMS:
- Advisory locks prevent concurrent undo operations on same audit log entry
- Row-level locks (FOR UPDATE NOWAIT) prevent race conditions during version check
- Parent existence validation prevents creating orphaned profiles
- Idempotency check prevents double-undo operations

PARAMETERS:
- p_audit_log_id: UUID of the audit log entry to undo
- p_undo_reason: Optional text explaining why the undo was performed

RETURNS:
- JSON object with success status and message/error';
