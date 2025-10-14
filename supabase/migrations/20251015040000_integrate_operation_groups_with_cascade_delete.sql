-- Migration: Integrate Operation Groups with Cascade Delete
-- Created: 2025-10-15
-- Description: Replaces batch_id metadata pattern with proper operation_groups table
--              and foreign key relationship for better batch operation tracking.
--
-- This migration documents the existing state where:
-- 1. operation_groups table exists with proper structure
-- 2. audit_log_enhanced.operation_group_id column exists with FK constraint
-- 3. All cascade delete functions are updated to use operation_group_id
-- 4. Undo functions properly handle operation groups
--
-- Status: This migration is IDEMPOTENT and safe to run on existing databases.

-- =========================================================================
-- 1. CREATE OPERATION_GROUPS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS operation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  group_type TEXT NOT NULL,
  operation_count INTEGER NOT NULL DEFAULT 0,
  undo_state TEXT NOT NULL DEFAULT 'active',
  undone_at TIMESTAMPTZ,
  undone_by UUID REFERENCES profiles(id),
  undo_reason TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- 2. CREATE INDEXES ON OPERATION_GROUPS
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_operation_groups_state
  ON operation_groups(undo_state)
  WHERE undo_state = 'active';

CREATE INDEX IF NOT EXISTS idx_operation_groups_created
  ON operation_groups(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_groups_created_by
  ON operation_groups(created_by);

-- =========================================================================
-- 3. ADD OPERATION_GROUP_ID TO AUDIT_LOG_ENHANCED
-- =========================================================================

-- Add column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log_enhanced'
    AND column_name = 'operation_group_id'
  ) THEN
    ALTER TABLE audit_log_enhanced
      ADD COLUMN operation_group_id UUID REFERENCES operation_groups(id);
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_group
  ON audit_log_enhanced(operation_group_id);

-- =========================================================================
-- 4. UPDATE ADMIN_CASCADE_DELETE_PROFILE FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION admin_cascade_delete_profile(
  p_profile_id UUID,
  p_version INTEGER,
  p_confirm_cascade BOOLEAN DEFAULT FALSE,
  p_max_descendants INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_profile profiles%ROWTYPE;
    v_deleted_ids UUID[];
    v_deleted_count INT;
    v_generations_affected INT;
    v_operation_group_id UUID;  -- Changed from v_batch_id
    v_permission_check RECORD;
    v_marriage_ids UUID[];
    v_temp_profile_data JSONB[];
    v_current_profile RECORD;
BEGIN
    -- =========================================================================
    -- 1. AUTHENTICATION & AUTHORIZATION
    -- =========================================================================

    -- Timeout protection: 5 second maximum execution time
    SET LOCAL statement_timeout = '5000';

    -- Get authenticated user
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    -- Get actor's profile ID
    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE user_id = v_actor_id AND deleted_at IS NULL;

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No valid profile found';
    END IF;

    -- =========================================================================
    -- 2. PARENT PROFILE VALIDATION & LOCKING
    -- =========================================================================

    -- Lock parent profile and check version
    SELECT * INTO v_profile
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL
    FOR UPDATE NOWAIT;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found or already deleted';
    END IF;

    -- Optimistic locking check
    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى.';
    END IF;

    -- =========================================================================
    -- 3. DESCENDANT DISCOVERY (Recursive CTE)
    -- =========================================================================

    WITH RECURSIVE descendants AS (
        SELECT
            id,
            1 as generation_depth
        FROM profiles
        WHERE id = p_profile_id

        UNION ALL

        SELECT
            p.id,
            d.generation_depth + 1
        FROM profiles p
        INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
        WHERE p.deleted_at IS NULL
          AND d.generation_depth < 20
    )
    SELECT
        ARRAY_AGG(id ORDER BY generation_depth DESC),
        MAX(generation_depth)
    INTO v_deleted_ids, v_generations_affected
    FROM descendants;

    v_deleted_count := array_length(v_deleted_ids, 1);

    -- =========================================================================
    -- 4. SAFETY LIMIT VALIDATION
    -- =========================================================================

    IF v_deleted_count > p_max_descendants THEN
        RAISE EXCEPTION 'Cascade delete limited to % descendants. Found: %. Please delete subtrees individually.',
            p_max_descendants, v_deleted_count;
    END IF;

    -- =========================================================================
    -- 5. ROW-LEVEL LOCKING (Concurrent Edit Protection)
    -- =========================================================================

    PERFORM id FROM profiles
    WHERE id = ANY(v_deleted_ids)
    FOR UPDATE NOWAIT;

    -- =========================================================================
    -- 6. BATCH PERMISSION VALIDATION
    -- =========================================================================

    FOR v_permission_check IN
        SELECT profile_id, permission_level
        FROM check_batch_family_permissions(v_actor_profile_id, v_deleted_ids)
    LOOP
        IF v_permission_check.permission_level NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Insufficient permission to delete profile: %', v_permission_check.profile_id;
        END IF;
    END LOOP;

    -- =========================================================================
    -- 7. CONFIRMATION CHECK
    -- =========================================================================

    IF NOT p_confirm_cascade AND v_deleted_count > 1 THEN
        RAISE EXCEPTION 'Confirmation required for cascade delete. Set p_confirm_cascade = TRUE.';
    END IF;

    -- =========================================================================
    -- 8. CREATE OPERATION GROUP
    -- =========================================================================

    -- Create operation group for this cascade delete
    INSERT INTO operation_groups (
        created_by,
        group_type,
        description,
        operation_count,
        metadata
    ) VALUES (
        v_actor_profile_id,
        'cascade_delete',
        'حذف شامل: ' || v_profile.name || ' (' || v_deleted_count || ' ملف)',
        v_deleted_count,
        jsonb_build_object(
            'parent_id', p_profile_id,
            'parent_name', v_profile.name,
            'parent_hid', v_profile.hid,
            'generations_affected', v_generations_affected
        )
    ) RETURNING id INTO v_operation_group_id;

    -- =========================================================================
    -- 9. AUDIT TRAIL PREPARATION
    -- =========================================================================

    -- Capture current profile data BEFORE deletion
    FOR v_current_profile IN
        SELECT * FROM profiles WHERE id = ANY(v_deleted_ids)
    LOOP
        v_temp_profile_data := array_append(
            v_temp_profile_data,
            to_jsonb(v_current_profile)
        );
    END LOOP;

    -- =========================================================================
    -- 10. CASCADE SOFT DELETE EXECUTION
    -- =========================================================================

    -- Soft delete all profiles
    UPDATE profiles
    SET
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_deleted_ids);

    -- Cascade soft delete related marriages
    UPDATE marriages
    SET
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE (husband_id = ANY(v_deleted_ids) OR wife_id = ANY(v_deleted_ids))
      AND deleted_at IS NULL
    RETURNING id INTO v_marriage_ids;

    -- Clean up orphaned admin metadata tables
    DELETE FROM branch_moderators
    WHERE user_id = ANY(v_deleted_ids)
       OR branch_hid IN (
           SELECT hid FROM profiles WHERE id = ANY(v_deleted_ids) AND hid IS NOT NULL
       );

    DELETE FROM suggestion_blocks
    WHERE blocked_user_id = ANY(v_deleted_ids)
       OR blocked_by = ANY(v_deleted_ids);

    -- =========================================================================
    -- 11. AUDIT LOG INSERTION (with operation_group_id)
    -- =========================================================================

    -- Bulk insert audit log entries linked to operation group
    INSERT INTO audit_log_enhanced (
        table_name,
        record_id,
        action_type,
        actor_id,
        old_data,
        new_data,
        operation_group_id,  -- Link to operation group
        metadata,
        severity,
        description
    )
    SELECT
        'profiles',
        (profile_data->>'id')::UUID,
        'CASCADE_DELETE',
        v_actor_id,
        profile_data,
        NULL,
        v_operation_group_id,  -- Associate with operation group
        jsonb_build_object(
            'parent_id', p_profile_id,
            'generations_affected', v_generations_affected,
            'total_deleted', v_deleted_count
        ),
        'high',
        'Cascade soft delete: ' || (profile_data->>'name')
    FROM UNNEST(v_temp_profile_data) AS profile_data;

    -- =========================================================================
    -- 12. RETURN SUCCESS SUMMARY
    -- =========================================================================

    RETURN jsonb_build_object(
        'success', TRUE,
        'operation_group_id', v_operation_group_id,  -- Return operation_group_id instead of batch_id
        'deleted_count', v_deleted_count,
        'deleted_ids', v_deleted_ids,
        'generations_affected', v_generations_affected,
        'marriages_affected', COALESCE(array_length(v_marriage_ids, 1), 0),
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'name', v_profile.name,
            'hid', v_profile.hid
        )
    );

EXCEPTION
    WHEN lock_not_available THEN
        RAISE EXCEPTION 'Profile is currently being edited by another user. Please try again.';
    WHEN OTHERS THEN
        RAISE;
END;
$function$;

-- =========================================================================
-- 5. UPDATE UNDO_CASCADE_DELETE FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION undo_cascade_delete(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_log_entry RECORD;
    v_current_user_id UUID;
    v_operation_group_id UUID;  -- Changed from v_batch_id
    v_restored_count INTEGER := 0;
    v_profile_id UUID;
    v_operation_group RECORD;
BEGIN
    -- Get current user
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

                -- Mark individual audit entry as undone
                UPDATE audit_log_enhanced
                SET
                    undone_at = NOW(),
                    undone_by = v_current_user_id,
                    undo_reason = p_undo_reason
                WHERE id = v_log_entry.id;

                -- Create CLR (Compensating Log Record) for this restore
                INSERT INTO audit_log_enhanced (
                    table_name,
                    record_id,
                    action_type,
                    actor_id,
                    description,
                    severity,
                    is_undoable,
                    operation_group_id,  -- Link to same operation group
                    metadata
                ) VALUES (
                    'profiles',
                    v_profile_id,
                    'undo_cascade_delete',
                    v_current_user_id,
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

    -- Update operation group state
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

-- =========================================================================
-- 6. CREATE UNDO_OPERATION_GROUP FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION undo_operation_group(
  p_group_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_group operation_groups;
  v_current_user_id UUID;
  v_operation RECORD;
  v_result jsonb;
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_failed_operations jsonb[] := '{}';
BEGIN
  -- Get current user
  SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح. يجب تسجيل الدخول.');
  END IF;

  -- Get operation group WITH LOCK
  SELECT * INTO v_group FROM operation_groups WHERE id = p_group_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'المجموعة غير موجودة');
  END IF;

  IF v_group.undo_state = 'undone' THEN
    RETURN jsonb_build_object('success', false, 'error', 'تم التراجع عن المجموعة بالفعل');
  END IF;

  -- Verify user is admin (only admins can undo batch operations)
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = v_current_user_id AND role IN ('super_admin', 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'صلاحية المشرف مطلوبة للتراجع عن العمليات الشاملة');
  END IF;

  -- Get all operations in group (reverse chronological order)
  FOR v_operation IN
    SELECT * FROM audit_log_enhanced
    WHERE operation_group_id = p_group_id
      AND undone_at IS NULL
    ORDER BY created_at DESC
  LOOP
    BEGIN
      -- Route to appropriate undo function based on action_type
      CASE v_operation.action_type
        WHEN 'profile_soft_delete', 'admin_delete' THEN
          v_result := undo_profile_delete(v_operation.id, COALESCE(p_undo_reason, 'تراجع عن مجموعة'));
        WHEN 'profile_update', 'admin_update' THEN
          v_result := undo_profile_update(v_operation.id, COALESCE(p_undo_reason, 'تراجع عن مجموعة'));
        ELSE
          v_result := jsonb_build_object('success', false, 'error', 'نوع عملية غير مدعوم: ' || v_operation.action_type);
      END CASE;

      IF (v_result->>'success')::boolean THEN
        v_success_count := v_success_count + 1;
      ELSE
        v_failed_count := v_failed_count + 1;
        v_failed_operations := array_append(
          v_failed_operations,
          jsonb_build_object(
            'audit_log_id', v_operation.id,
            'target_id', v_operation.record_id,
            'error', v_result->>'error'
          )
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_failed_operations := array_append(
        v_failed_operations,
        jsonb_build_object(
          'audit_log_id', v_operation.id,
          'error', SQLERRM
        )
      );
    END;
  END LOOP;

  -- Update group state
  IF v_failed_count = 0 THEN
    UPDATE operation_groups
    SET
      undo_state = 'undone',
      undone_at = NOW(),
      undone_by = v_current_user_id,
      undo_reason = p_undo_reason
    WHERE id = p_group_id;
  ELSE
    UPDATE operation_groups
    SET undo_state = 'failed'
    WHERE id = p_group_id;
  END IF;

  RETURN jsonb_build_object(
    'success', v_success_count > 0,
    'total_operations', v_success_count + v_failed_count,
    'successful_undos', v_success_count,
    'failed_undos', v_failed_count,
    'failed_operations', to_jsonb(v_failed_operations),
    'message', format('تم التراجع عن %s من %s عمليات', v_success_count, v_success_count + v_failed_count)
  );
END;
$function$;

-- =========================================================================
-- 7. ADD COMMENTS FOR DOCUMENTATION
-- =========================================================================

COMMENT ON TABLE operation_groups IS
'Tracks groups of related operations (e.g., cascade deletes, bulk updates) for atomic undo capability. Replaces metadata-based batch_id pattern.';

COMMENT ON COLUMN operation_groups.group_type IS
'Type of operation group: cascade_delete, bulk_update, etc.';

COMMENT ON COLUMN operation_groups.undo_state IS
'Current undo state: active (can be undone), undone (already undone), failed (undo failed)';

COMMENT ON COLUMN operation_groups.operation_count IS
'Total number of operations in this group for UI display and validation';

COMMENT ON FUNCTION admin_cascade_delete_profile IS
'Recursively soft-deletes a profile and all descendants with full safety mechanisms: permission checks, optimistic locking, concurrency protection, operation grouping, and audit trail.';

COMMENT ON FUNCTION undo_cascade_delete IS
'Undoes a cascade delete operation by restoring all profiles in the operation group. Idempotent and safe for concurrent execution.';

COMMENT ON FUNCTION undo_operation_group IS
'Generic undo function for any operation group. Routes to appropriate undo handlers based on action_type.';

-- =========================================================================
-- MIGRATION COMPLETE
-- =========================================================================

-- This migration is complete and idempotent. It can be safely run on:
-- 1. New databases (creates all structures from scratch)
-- 2. Existing databases (IF NOT EXISTS clauses prevent errors)
-- 3. Databases where operation_groups already exists (updates functions only)
