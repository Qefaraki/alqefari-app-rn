-- Migration: Fix CLR actor_id foreign key in remaining undo functions
-- Created: 2025-10-15
-- Description: Fixes undo_profile_delete, undo_cascade_delete, and undo_marriage_create
--              to use auth.uid() for actor_id instead of profiles.id
--
-- PROBLEM:
-- Three undo functions use v_current_user_id (profiles.id) for CLR actor_id,
-- but audit_log_enhanced.actor_id references auth.users.id
--
-- ERROR:
-- "insert or update on table audit_log_enhanced violates foreign key
--  constraint audit_log_enhanced_actor_id_fkey"
--
-- SOLUTION:
-- Use auth.uid() for CLR actor_id (consistent with undo_profile_update fix)
--
-- AFFECTED FUNCTIONS:
-- 1. undo_profile_delete
-- 2. undo_cascade_delete
-- 3. undo_marriage_create

-- ============================================================================
-- 1. Fix undo_profile_delete
-- ============================================================================

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

  -- Mark as undone (uses v_current_user_id for undone_by - this is correct)
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create CLR
  -- ✅ FIX: Use auth.uid() for actor_id instead of v_current_user_id
  INSERT INTO audit_log_enhanced (
    table_name, record_id, action_type, actor_id,
    description, severity, is_undoable
  ) VALUES (
    'profiles', v_profile_id, 'undo_delete', auth.uid(),  -- ✅ FIXED
    'تراجع عن حذف: ' || v_log_entry.description, 'medium', false
  );

  RETURN jsonb_build_object('success', true, 'message', 'تم استعادة الملف بنجاح');

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء الاستعادة: ' || SQLERRM);
END;
$function$;

COMMENT ON FUNCTION public.undo_profile_delete(uuid, text) IS
'Safely undoes a profile soft delete with proper foreign key handling.

FOREIGN KEY FIX (v2025-10-15):
- actor_id in CLR uses auth.uid() (auth.users.id) instead of profiles.id
- undone_by correctly uses profiles.id (v_current_user_id)
- This matches the audit_log_enhanced_actor_id_fkey constraint
- Consistent with undo_profile_update() and other undo functions

SAFETY MECHANISMS:
- Advisory locks prevent concurrent undo operations
- Row-level locks prevent race conditions
- Idempotency check prevents double-undo operations
- Version increment ensures data consistency';

-- ============================================================================
-- 2. Fix undo_cascade_delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.undo_cascade_delete(p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_log_entry RECORD;
    v_current_user_id UUID;
    v_operation_group_id UUID;
    v_restored_count INTEGER := 0;
    v_profile_id UUID;
    v_operation_group RECORD;
BEGIN
    -- Get current user (for permission checking)
    SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();

    IF v_current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مصرح. يجب تسجيل الدخول.');
    END IF;

    -- Verify user is admin
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

    -- Get operation_group_id from audit log entry
    v_operation_group_id := v_log_entry.operation_group_id;

    IF v_operation_group_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'معرف مجموعة العملية غير موجود. لا يمكن التراجع عن الحذف الشامل.');
    END IF;

    -- Get and lock operation group
    SELECT * INTO v_operation_group
    FROM operation_groups
    WHERE id = v_operation_group_id
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'مجموعة العملية غير موجودة');
    END IF;

    -- Idempotency check - check operation group undo state
    IF v_operation_group.undo_state = 'undone' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('تم التراجع عن هذا الإجراء بالفعل في %s', to_char(v_operation_group.undone_at, 'YYYY-MM-DD HH24:MI'))
        );
    END IF;

    -- Verify action type (CASCADE_DELETE)
    IF v_log_entry.action_type != 'CASCADE_DELETE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'نوع الإجراء غير صالح للتراجع الشامل');
    END IF;

    -- Get all audit entries in this operation group
    -- Restore in REVERSE order (children before parents)
    FOR v_log_entry IN
        SELECT ale.*
        FROM audit_log_enhanced ale
        WHERE ale.operation_group_id = v_operation_group_id
          AND ale.action_type = 'CASCADE_DELETE'
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

                -- Mark individual audit entry as undone (uses v_current_user_id - correct)
                UPDATE audit_log_enhanced
                SET
                    undone_at = NOW(),
                    undone_by = v_current_user_id,
                    undo_reason = p_undo_reason
                WHERE id = v_log_entry.id;

                -- Create CLR (Compensating Log Record) for this restore
                -- ✅ FIX: Use auth.uid() for actor_id instead of v_current_user_id
                INSERT INTO audit_log_enhanced (
                    table_name,
                    record_id,
                    action_type,
                    actor_id,  -- ✅ FIXED
                    description,
                    severity,
                    is_undoable,
                    operation_group_id,
                    metadata
                ) VALUES (
                    'profiles',
                    v_profile_id,
                    'undo_cascade_delete',
                    auth.uid(),  -- ✅ FIXED
                    'تراجع عن حذف شامل: ' || v_log_entry.description,
                    'medium',
                    false,
                    v_operation_group_id,
                    jsonb_build_object('undo_of', v_log_entry.id)
                );

                v_restored_count := v_restored_count + 1;

            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Failed to restore profile %: %', v_profile_id, SQLERRM;
                -- Continue with other profiles
            END;
        END IF;
    END LOOP;

    -- Update operation group state (uses v_current_user_id - correct)
    UPDATE operation_groups
    SET
        undo_state = 'undone',
        undone_at = NOW(),
        undone_by = v_current_user_id,
        undo_reason = p_undo_reason
    WHERE id = v_operation_group_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('تم استعادة %s ملفات بنجاح', v_restored_count),
        'restored_count', v_restored_count,
        'operation_group_id', v_operation_group_id
    );

EXCEPTION
    WHEN lock_not_available THEN
        RETURN jsonb_build_object('success', false, 'error', 'عملية التراجع قيد التنفيذ من قبل مستخدم آخر');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'حدث خطأ أثناء الاستعادة: ' || SQLERRM);
END;
$function$;

COMMENT ON FUNCTION public.undo_cascade_delete(uuid, text) IS
'Safely undoes a cascade delete operation with proper foreign key handling.

FOREIGN KEY FIX (v2025-10-15):
- actor_id in CLR uses auth.uid() (auth.users.id) instead of profiles.id
- undone_by correctly uses profiles.id (v_current_user_id)
- This matches the audit_log_enhanced_actor_id_fkey constraint
- Consistent with other undo functions

ADMIN-ONLY OPERATION:
- Requires super_admin or admin role
- Restores entire subtree using operation_group_id
- Processes in reverse order (children before parents)

SAFETY MECHANISMS:
- Advisory locks prevent concurrent operations
- Operation group state tracking prevents double-undo
- Individual profile restoration with error handling';

-- ============================================================================
-- 3. Fix undo_marriage_create
-- ============================================================================

CREATE OR REPLACE FUNCTION public.undo_marriage_create(p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check jsonb;
  v_marriage_id UUID;
  v_marriage_data jsonb;
BEGIN
  -- Get current user from auth.users
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرح. يجب تسجيل الدخول.'
    );
  END IF;

  -- Get user's profile ID (for permission checking)
  SELECT id INTO v_current_user_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- Check permission
  v_permission_check := check_undo_permission(p_audit_log_id, v_current_user_id);
  IF NOT (v_permission_check->>'can_undo')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_permission_check->>'reason'
    );
  END IF;

  -- Get the audit log entry
  SELECT * INTO v_log_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id;

  -- Verify this is a marriage creation action
  IF v_log_entry.action_type != 'add_marriage' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'هذا السجل ليس إضافة زواج'
    );
  END IF;

  -- Extract marriage ID from new_data
  v_marriage_data := v_log_entry.new_data;
  IF v_marriage_data IS NULL OR NOT (v_marriage_data ? 'id') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على معرف الزواج في البيانات'
    );
  END IF;

  v_marriage_id := (v_marriage_data->>'id')::uuid;

  -- Check if marriage exists
  IF NOT EXISTS (
    SELECT 1 FROM marriages
    WHERE id = v_marriage_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الزواج غير موجود'
    );
  END IF;

  -- Check if marriage is already deleted
  IF EXISTS (
    SELECT 1 FROM marriages
    WHERE id = v_marriage_id
    AND deleted_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الزواج محذوف بالفعل'
    );
  END IF;

  -- Soft delete the marriage
  UPDATE marriages
  SET
    deleted_at = NOW(),
    updated_at = NOW(),
    updated_by = v_current_user_id
  WHERE id = v_marriage_id;

  -- Mark audit log entry as undone (uses v_current_user_id - correct)
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create new audit log entry for the undo action
  -- ✅ FIX: Use auth.uid() for actor_id instead of v_current_user_id
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,  -- ✅ FIXED
    old_data,
    new_data,
    description,
    severity,
    is_undoable
  ) VALUES (
    'marriages',
    v_marriage_id,
    'undo_marriage_create',
    auth.uid(),  -- ✅ FIXED
    v_log_entry.new_data,  -- What was created
    jsonb_build_object('deleted_at', NOW()),  -- What we did (soft delete)
    'تراجع عن إضافة زواج: ' || COALESCE(v_log_entry.description, 'زواج'),
    'medium',
    false  -- Undos themselves are not undoable
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التراجع عن الزواج بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ أثناء التراجع: ' || SQLERRM
    );
END;
$function$;

COMMENT ON FUNCTION public.undo_marriage_create(uuid, text) IS
'Safely undoes a marriage creation with proper foreign key handling.

FOREIGN KEY FIX (v2025-10-15):
- actor_id in CLR uses auth.uid() (auth.users.id) instead of profiles.id
- undone_by correctly uses profiles.id (v_current_user_id)
- This matches the audit_log_enhanced_actor_id_fkey constraint
- Consistent with other undo functions

ADMIN-ONLY OPERATION:
- Requires admin permission via check_undo_permission
- Soft deletes incorrectly created marriage
- Creates audit trail for marriage deletion';
