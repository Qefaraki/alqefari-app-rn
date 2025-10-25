-- =============================================================================
-- Migration: Add admin_batch_reorder_children RPC for atomic batch reordering
-- =============================================================================
-- Purpose: Provides atomic reordering of multiple children with version
--          validation, permission checks, and operation group integration
--
-- Features:
-- - Atomic transaction (all-or-nothing)
-- - Optimistic locking via version field validation
-- - Permission checks (single parent-level check, not N+1)
-- - Advisory locks to prevent concurrent reorders
-- - Operation group integration for grouped undo
-- - Comprehensive input validation (5 edge cases)
-- - Audit logging with operation_group_id
--
-- ROLLBACK PROCEDURE (if needed):
-- DROP FUNCTION admin_batch_reorder_children(JSONB, UUID);
-- No schema changes, safe to drop function only
-- No data loss - function is pure logic, no DDL
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_batch_reorder_children(
  p_reorder_operations JSONB,  -- Array of {id, new_sibling_order, version}
  p_parent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID;
  v_actor_profile_id UUID;
  v_actor_role TEXT;
  v_parent_permission TEXT;
  v_parent_record RECORD;
  v_operation_group_id UUID;
  v_op JSONB;
  v_child_id UUID;
  v_child_version INT;
  v_new_order INT;
  v_existing_version INT;
  v_updated_count INT := 0;
  v_start_time TIMESTAMP;
  v_duration_ms NUMERIC;
  v_batch_size INT;
  v_child_count INT;
  v_duplicate_order INT;
  v_duplicate_count INT;
BEGIN
  -- ========================================================================
  -- START PERFORMANCE TIMER
  -- ========================================================================
  v_start_time := clock_timestamp();
  SET LOCAL statement_timeout = '10000';

  -- ========================================================================
  -- 1. AUTHENTICATION & AUTHORIZATION
  -- ========================================================================
  v_auth_user_id := auth.uid();

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لتنفيذ هذه العملية'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, role INTO v_actor_profile_id, v_actor_role
  FROM profiles
  WHERE user_id = v_auth_user_id AND deleted_at IS NULL;

  IF v_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'لا يوجد ملف شخصي مرتبط بهذا الحساب'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 2. PARENT VALIDATION & LOCKING
  -- ========================================================================
  SELECT *
  INTO v_parent_record
  FROM profiles
  WHERE id = p_parent_id AND deleted_at IS NULL
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الملف الشخصي للأب غير موجود أو محذوف'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 3. PERMISSION CHECK (SINGLE CHECK ON PARENT, NOT N+1)
  -- ========================================================================
  SELECT check_family_permission_v4(v_actor_profile_id, p_parent_id)
  INTO v_parent_permission;

  IF v_parent_permission NOT IN ('admin', 'moderator', 'inner') THEN
    RAISE EXCEPTION 'ليس لديك صلاحية إعادة ترتيب أبناء هذا الملف الشخصي'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 4. INPUT VALIDATION (ALL 5 EDGE CASES)
  -- ========================================================================
  v_batch_size := jsonb_array_length(p_reorder_operations);

  -- ✅ FIX #1: Empty array check
  IF v_batch_size = 0 THEN
    RAISE EXCEPTION 'قائمة العمليات فارغة'
      USING ERRCODE = 'P0001';
  END IF;

  -- ✅ FIX #2: Batch size limit (following admin_quick_add_batch_save pattern)
  IF v_batch_size > 50 THEN
    RAISE EXCEPTION 'الحد الأقصى 50 عملية في الدفعة الواحدة. يرجى تقسيم التغييرات إلى دفعات أصغر'
      USING ERRCODE = 'P0001';
  END IF;

  -- ✅ FIX #3: Duplicate sibling_order check
  SELECT (op->>'new_sibling_order')::INT, COUNT(*)
  INTO v_duplicate_order, v_duplicate_count
  FROM jsonb_array_elements(p_reorder_operations) AS op
  GROUP BY (op->>'new_sibling_order')::INT
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'قيمة sibling_order مكررة: %', v_duplicate_order
      USING ERRCODE = 'P0001';
  END IF;

  -- ✅ FIX #4: Negative sibling_order check
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_reorder_operations) AS op
    WHERE (op->>'new_sibling_order')::INT < 0
  ) THEN
    RAISE EXCEPTION 'sibling_order لا يمكن أن تكون سالبة'
      USING ERRCODE = 'P0001';
  END IF;

  -- ✅ FIX #5: Parent-child relationship validation
  SELECT COUNT(*)
  INTO v_child_count
  FROM profiles
  WHERE id IN (
    SELECT (op->>'id')::UUID
    FROM jsonb_array_elements(p_reorder_operations) AS op
  )
  AND father_id = p_parent_id
  AND deleted_at IS NULL;

  IF v_child_count != v_batch_size THEN
    RAISE EXCEPTION 'أحد الأطفال أو أكثر لا ينتمون لهذا الأب أو تم حذفهم'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- 5. ADVISORY LOCK (TRANSACTION-SCOPED)
  -- ========================================================================
  -- Prevents concurrent reorder operations on the same parent
  PERFORM pg_advisory_xact_lock(
    hashtext('reorder_children_' || p_parent_id::text)
  );

  -- ========================================================================
  -- 6. CREATE OPERATION GROUP FOR UNDO
  -- ========================================================================
  INSERT INTO operation_groups (created_by, group_type, operation_count, description)
  VALUES (
    v_actor_profile_id,
    'batch_reorder',
    v_batch_size,
    'إعادة ترتيب الأبناء'
  )
  RETURNING id INTO v_operation_group_id;

  -- Set session variable for trigger to read
  PERFORM set_config('app.operation_group_id', v_operation_group_id::text, true);

  -- ========================================================================
  -- 7. BATCH UPDATE WITH VERSION VALIDATION & INCREMENT
  -- ========================================================================
  FOR v_op IN SELECT * FROM jsonb_array_elements(p_reorder_operations)
  LOOP
    v_child_id := (v_op->>'id')::UUID;
    v_child_version := (v_op->>'version')::INT;
    v_new_order := (v_op->>'new_sibling_order')::INT;

    IF v_child_id IS NULL THEN
      RAISE EXCEPTION 'معرف الملف الشخصي مطلوب للعملية'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_child_version IS NULL THEN
      RAISE EXCEPTION 'رقم الإصدار (version) مطلوب لكل ملف شخصي'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_new_order IS NULL THEN
      RAISE EXCEPTION 'ترتيب الأبناء الجديد مطلوب'
        USING ERRCODE = 'P0001';
    END IF;

    -- ✅ FIX: Version validation AND increment (following admin_update_profile pattern)
    UPDATE profiles
    SET sibling_order = v_new_order,
        version = version + 1,  -- ← CRITICAL: Increment version
        updated_at = NOW()
    WHERE id = v_child_id
      AND version = v_child_version  -- Optimistic lock check
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      -- Check if version mismatch or child not found
      SELECT version INTO v_existing_version
      FROM profiles
      WHERE id = v_child_id AND deleted_at IS NULL;

      IF v_existing_version IS NULL THEN
        RAISE EXCEPTION 'الملف الشخصي غير موجود أو محذوف: %', v_child_id
          USING ERRCODE = 'P0001';
      ELSIF v_existing_version != v_child_version THEN
        RAISE EXCEPTION 'تم تحديث البيانات من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- ========================================================================
  -- 8. CLEANUP & PERFORMANCE METRICS
  -- ========================================================================
  PERFORM set_config('app.operation_group_id', NULL, true);

  v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;

  -- Log performance for monitoring
  RAISE NOTICE 'Batch reorder completed in % ms for % children (operation_group_id: %)',
    v_duration_ms,
    v_updated_count,
    v_operation_group_id;

  -- ========================================================================
  -- 9. RETURN SUCCESS
  -- ========================================================================
  RETURN jsonb_build_object(
    'success', true,
    'operation_group_id', v_operation_group_id,
    'updated_count', v_updated_count,
    'batch_size', v_batch_size,
    'duration_ms', v_duration_ms
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على هذا الملف الشخصي. يرجى المحاولة بعد قليل'
      USING ERRCODE = 'P0001';
  WHEN OTHERS THEN
    -- Clear session variable on error
    PERFORM set_config('app.operation_group_id', NULL, true);
    RAISE EXCEPTION 'فشلت عملية إعادة الترتيب: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_batch_reorder_children(JSONB, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION admin_batch_reorder_children(JSONB, UUID) IS
'Atomically reorder children with version validation and permission checks.
Parameters:
  p_reorder_operations: JSONB array of {id: UUID, new_sibling_order: INT, version: INT}
  p_parent_id: UUID of parent profile

Returns:
  {success: bool, operation_group_id: UUID, updated_count: INT, duration_ms: NUMERIC}

Features:
  - Optimistic locking via version validation
  - Single permission check on parent (not N+1)
  - Advisory lock prevents concurrent reorders
  - Operation group integration for undo
  - Comprehensive input validation (5 edge cases)
  - Version increment after successful update';
