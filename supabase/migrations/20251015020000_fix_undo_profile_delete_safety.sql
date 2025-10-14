-- Migration: Fix undo_profile_delete safety mechanisms
-- Created: 2025-10-15
-- Description: Adds critical safety fixes to undo_profile_delete function
--
-- CRITICAL FIXES INCLUDED:
-- 1. Idempotency check (prevents double-undo)
-- 2. Version increment on restore (maintains optimistic locking)
-- 3. Row-level locking on audit log (prevents concurrent undo)
--
-- Safety Mechanisms:
-- - Advisory locks prevent concurrent undo operations
-- - Idempotency check prevents duplicate undos
-- - Version increment ensures optimistic locking after restore
--
-- Related Documentation: /docs/UNDO_SYSTEM.md

CREATE OR REPLACE FUNCTION public.undo_profile_delete(p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check jsonb;
  v_profile_id UUID;
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

  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_profile_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'الملف غير موجود');
  END IF;

  -- Restore profile by clearing deleted_at WITH LOCK
  BEGIN
    UPDATE profiles
    SET
      deleted_at = NULL,
      version = version + 1,  -- Increment version
      updated_at = NOW()
    WHERE id = v_profile_id;
  END;

  -- Mark as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create CLR
  INSERT INTO audit_log_enhanced (
    table_name, record_id, action_type, actor_id,
    description, severity, is_undoable
  ) VALUES (
    'profiles', v_profile_id, 'undo_delete', v_current_user_id,
    'تراجع عن حذف: ' || v_log_entry.description, 'medium', false
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم استعادة الملف بنجاح');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء الاستعادة: ' || SQLERRM);
END;
$function$;

-- Add function documentation
COMMENT ON FUNCTION public.undo_profile_delete(uuid, text) IS
'Safely undoes a profile delete operation (restores soft-deleted profile).

SAFETY MECHANISMS:
- Advisory locks prevent concurrent undo operations on same audit log entry
- Row-level locks on audit log (FOR UPDATE NOWAIT) prevent race conditions
- Idempotency check prevents double-undo operations
- Version increment maintains optimistic locking after restore

PARAMETERS:
- p_audit_log_id: UUID of the audit log entry to undo
- p_undo_reason: Optional text explaining why the undo was performed

RETURNS:
- JSON object with success status and message/error

NOTE: This only restores the specific deleted profile. Children remain deleted.
For cascade restore, use undo_cascade_delete instead.';
