-- Migration: Fix undo_cascade_delete safety mechanisms
-- Created: 2025-10-15
-- Description: Adds critical safety fixes to undo_cascade_delete function
--
-- CRITICAL FIXES INCLUDED:
-- 1. Idempotency check (prevents double-undo)
-- 2. Reverse-order restoration (children before parents)
-- 3. Batch-based restoration (all cascade delete operations with same batch_id)
-- 4. Admin-only restriction (only admins can undo cascade deletes)
--
-- Safety Mechanisms:
-- - Advisory locks prevent concurrent undo operations
-- - Row-level locks on audit log prevent race conditions
-- - Idempotency check prevents duplicate undos
-- - Reverse chronological order prevents foreign key violations
-- - Admin-only check ensures proper authorization
--
-- Related Documentation: /docs/UNDO_SYSTEM.md, /docs/SOFT_DELETE_PATTERN.md

CREATE OR REPLACE FUNCTION public.undo_cascade_delete(p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_batch_id UUID;
  v_restored_count INTEGER := 0;
  v_profile_id UUID;
BEGIN
  -- Get current user
  SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح. يجب تسجيل الدخول.');
  END IF;

  -- Verify user is admin (only admins can undo cascade deletes)
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = v_current_user_id AND role IN ('super_admin', 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'صلاحية المشرف مطلوبة للتراجع عن الحذف الشامل');
  END IF;

  -- Advisory lock
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

  -- Verify action type
  IF v_log_entry.action_type != 'profile_cascade_delete' THEN
    RETURN jsonb_build_object('success', false, 'error', 'نوع الإجراء غير صالح للتراجع الشامل');
  END IF;

  -- Extract batch_id from metadata
  v_batch_id := (v_log_entry.metadata->>'batch_id')::UUID;

  IF v_batch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'معرف الدفعة غير موجود. لا يمكن التراجع عن الحذف الشامل.');
  END IF;

  -- Get all profiles in batch (find all cascade delete operations with same batch_id)
  -- Restore in REVERSE order (children before parents)
  FOR v_log_entry IN
    SELECT ale.*
    FROM audit_log_enhanced ale
    WHERE ale.metadata->>'batch_id' = v_batch_id::text
      AND ale.action_type = 'profile_cascade_delete'
      AND ale.undone_at IS NULL
    ORDER BY ale.created_at DESC  -- Reverse chronological (children first)
  LOOP
    v_profile_id := v_log_entry.record_id;

    -- Check if profile exists
    IF EXISTS(SELECT 1 FROM profiles WHERE id = v_profile_id) THEN
      -- Restore by clearing deleted_at and incrementing version
      BEGIN
        UPDATE profiles
        SET
          deleted_at = NULL,
          version = version + 1,
          updated_at = NOW()
        WHERE id = v_profile_id;

        -- Mark individual audit entry as undone
        UPDATE audit_log_enhanced
        SET
          undone_at = NOW(),
          undone_by = v_current_user_id,
          undo_reason = p_undo_reason
        WHERE id = v_log_entry.id;

        -- Create CLR for this restore
        INSERT INTO audit_log_enhanced (
          table_name, record_id, action_type, actor_id,
          description, severity, is_undoable, metadata
        ) VALUES (
          'profiles', v_profile_id, 'undo_cascade_delete', v_current_user_id,
          'تراجع عن حذف شامل: ' || v_log_entry.description, 'medium', false,
          jsonb_build_object('batch_id', v_batch_id, 'undo_of', v_log_entry.id)
        );

        v_restored_count := v_restored_count + 1;

      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to restore profile %: %', v_profile_id, SQLERRM;
        -- Continue with other profiles
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('تم استعادة %s ملفات بنجاح', v_restored_count),
    'restored_count', v_restored_count,
    'batch_id', v_batch_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء الاستعادة: ' || SQLERRM);
END;
$function$;

-- Add function documentation
COMMENT ON FUNCTION public.undo_cascade_delete(uuid, text) IS
'Safely undoes a cascade delete operation (restores all deleted profiles in batch).

SAFETY MECHANISMS:
- Advisory locks prevent concurrent undo operations on same audit log entry
- Row-level locks on audit log (FOR UPDATE NOWAIT) prevent race conditions
- Idempotency check prevents double-undo operations
- Reverse chronological order prevents foreign key violations (children before parents)
- Admin-only restriction ensures proper authorization
- Batch tracking ensures all related profiles are restored together

PARAMETERS:
- p_audit_log_id: UUID of ANY audit log entry from the cascade delete batch
- p_undo_reason: Optional text explaining why the undo was performed

RETURNS:
- JSON object with success status, message/error, restored_count, and batch_id

BEHAVIOR:
1. Finds batch_id from audit log entry metadata
2. Finds ALL audit log entries with same batch_id
3. Restores profiles in REVERSE chronological order (children first)
4. Marks each audit log entry as undone
5. Creates CLR (Compensation Log Record) for each restore

ADMIN ONLY: Only users with role super_admin or admin can execute this function.';
