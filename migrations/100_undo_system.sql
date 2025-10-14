-- ============================================================================
-- Migration 100: Undo System Infrastructure
-- ============================================================================
-- Purpose: Add undo functionality to existing audit_log_enhanced table
-- Approach: Minimal - reuse existing audit table, add 3 RPC functions
-- Dependencies: audit_log_enhanced table (already exists)
--               admin_update_profile() function (already exists)
--               check_family_permission_v4() function (already exists)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Enhance audit_log_enhanced table with undo tracking
-- ============================================================================

DO $$
BEGIN
  -- Add undo tracking columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_log_enhanced' AND column_name = 'undone_at'
  ) THEN
    ALTER TABLE audit_log_enhanced
    ADD COLUMN undone_at TIMESTAMPTZ,
    ADD COLUMN undone_by UUID REFERENCES profiles(id),
    ADD COLUMN undo_reason TEXT,
    ADD COLUMN is_undoable BOOLEAN DEFAULT true,
    ADD COLUMN undo_blocked_reason TEXT;

    RAISE NOTICE '✅ Added undo tracking columns to audit_log_enhanced';
  ELSE
    RAISE NOTICE 'ℹ️  Undo columns already exist, skipping ALTER TABLE';
  END IF;
END $$;

-- Add index for efficient undo queries
CREATE INDEX IF NOT EXISTS idx_audit_log_undoable
  ON audit_log_enhanced(created_at DESC)
  WHERE undone_at IS NULL AND is_undoable = true;

COMMENT ON COLUMN audit_log_enhanced.undone_at IS
  'Timestamp when this action was undone (NULL if not undone)';

COMMENT ON COLUMN audit_log_enhanced.undone_by IS
  'Profile ID of user who performed the undo';

COMMENT ON COLUMN audit_log_enhanced.is_undoable IS
  'Whether this action can be undone (default true)';

-- ============================================================================
-- PART 2: Helper function to check if undo is allowed
-- ============================================================================

CREATE OR REPLACE FUNCTION check_undo_permission(
  p_audit_log_id UUID,
  p_user_profile_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_audit_entry audit_log_enhanced;
  v_target_profile profiles;
  v_user_role TEXT;
  v_permission TEXT;
  v_can_undo BOOLEAN := false;
  v_reason TEXT;
BEGIN
  -- Fetch audit entry
  SELECT * INTO v_audit_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'لم يتم العثور على الإجراء'
    );
  END IF;

  -- Check if already undone
  IF v_audit_entry.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'تم التراجع عن هذا الإجراء بالفعل',
      'undone_at', v_audit_entry.undone_at
    );
  END IF;

  -- Check if marked as not undoable
  IF v_audit_entry.is_undoable = false THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', COALESCE(v_audit_entry.undo_blocked_reason, 'لا يمكن التراجع عن هذا الإجراء')
    );
  END IF;

  -- Check age (default 30 days for regular users, unlimited for admins)
  IF v_audit_entry.created_at < NOW() - INTERVAL '30 days' THEN
    -- Check if user is admin
    SELECT role INTO v_user_role
    FROM profiles
    WHERE id = p_user_profile_id;

    IF v_user_role NOT IN ('admin', 'super_admin') THEN
      RETURN jsonb_build_object(
        'can_undo', false,
        'reason', 'انتهت صلاحية التراجع (أكثر من 30 يوماً)'
      );
    END IF;
  END IF;

  -- Check if profile still exists (for profile updates/deletes)
  IF v_audit_entry.table_name = 'profiles' THEN
    SELECT * INTO v_target_profile
    FROM profiles
    WHERE id = v_audit_entry.record_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'can_undo', false,
        'reason', 'الملف المستهدف غير موجود (ربما تم حذفه نهائياً)'
      );
    END IF;

    -- Check current permission on target profile
    v_permission := check_family_permission_v4(
      p_user_profile_id,
      v_audit_entry.record_id
    );

    -- User can undo if:
    -- 1. They performed the original action
    -- 2. They have admin/super_admin role
    -- 3. They have inner/moderator permission on target
    IF v_audit_entry.actor_id = p_user_profile_id THEN
      -- User undoing their own action
      IF v_permission IN ('admin', 'moderator', 'inner') THEN
        v_can_undo := true;
        v_reason := 'يمكنك التراجع عن إجراءاتك';
      ELSE
        v_can_undo := false;
        v_reason := 'فقدت الصلاحية للتراجع عن هذا الإجراء';
      END IF;
    ELSIF v_permission IN ('admin', 'moderator') THEN
      -- Admin/moderator undoing others' actions
      v_can_undo := true;
      v_reason := 'لديك صلاحيات المسؤول';
    ELSE
      v_can_undo := false;
      v_reason := 'ليس لديك صلاحية للتراجع عن إجراءات الآخرين';
    END IF;
  ELSE
    -- Non-profile table (marriages, etc) - only admin can undo
    SELECT role INTO v_user_role
    FROM profiles
    WHERE id = p_user_profile_id;

    IF v_user_role IN ('admin', 'super_admin') THEN
      v_can_undo := true;
      v_reason := 'لديك صلاحيات المسؤول';
    ELSE
      v_can_undo := false;
      v_reason := 'يتطلب صلاحية المسؤول';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'can_undo', v_can_undo,
    'reason', v_reason,
    'action_type', v_audit_entry.action_type,
    'created_at', v_audit_entry.created_at,
    'actor_id', v_audit_entry.actor_id
  );
END;
$$;

COMMENT ON FUNCTION check_undo_permission IS
  'Checks if a user has permission to undo a specific audit log entry.
   Returns {can_undo: boolean, reason: string}.';

GRANT EXECUTE ON FUNCTION check_undo_permission(UUID, UUID) TO authenticated;

-- ============================================================================
-- PART 3: Undo profile update function
-- ============================================================================

CREATE OR REPLACE FUNCTION undo_profile_update(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_audit_entry audit_log_enhanced;
  v_current_profile profiles;
  v_user_profile_id UUID;
  v_permission_check JSONB;
  v_restored_profile profiles;
BEGIN
  -- Get current user's profile ID
  SELECT id INTO v_user_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_user_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرح. يجب تسجيل الدخول.',
      'error_code', 'UNAUTHORIZED'
    );
  END IF;

  -- Check permission
  v_permission_check := check_undo_permission(p_audit_log_id, v_user_profile_id);
  IF NOT (v_permission_check->>'can_undo')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_permission_check->>'reason',
      'error_code', 'PERMISSION_DENIED'
    );
  END IF;

  -- Fetch audit entry
  SELECT * INTO v_audit_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id;

  -- Validate it's a profile update
  IF v_audit_entry.action_type NOT LIKE '%update%' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يدعم هذا الدالة فقط تراجع التحديثات',
      'error_code', 'INVALID_ACTION_TYPE',
      'action_type', v_audit_entry.action_type
    );
  END IF;

  -- Get current profile state for version check
  SELECT * INTO v_current_profile
  FROM profiles
  WHERE id = v_audit_entry.record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الملف غير موجود',
      'error_code', 'PROFILE_NOT_FOUND'
    );
  END IF;

  -- Prepare updates from old_data (restore previous state)
  -- Use admin_update_profile for consistency and permission checks
  BEGIN
    -- Call admin_update_profile with old_data as updates
    SELECT * INTO v_restored_profile
    FROM admin_update_profile(
      v_audit_entry.record_id,
      v_current_profile.version,
      v_audit_entry.old_data
    );

    -- Mark audit entry as undone
    UPDATE audit_log_enhanced
    SET
      undone_at = NOW(),
      undone_by = v_user_profile_id,
      undo_reason = COALESCE(p_undo_reason, 'تراجع المستخدم')
    WHERE id = p_audit_log_id;

    -- Log the undo action itself in audit_log_enhanced
    INSERT INTO audit_log_enhanced (
      actor_id,
      action_type,
      table_name,
      record_id,
      old_data,
      new_data,
      changed_fields,
      description,
      severity
    ) VALUES (
      v_user_profile_id,
      'undo_' || v_audit_entry.action_type,
      v_audit_entry.table_name,
      v_audit_entry.record_id,
      v_audit_entry.new_data,  -- What was, is now old
      v_audit_entry.old_data,  -- What was old, is now new
      v_audit_entry.changed_fields,
      format('تراجع عن %s (audit log #%s)', v_audit_entry.action_type, p_audit_log_id),
      'medium'
    );

    RETURN jsonb_build_object(
      'success', true,
      'message', 'تم التراجع عن التغييرات بنجاح',
      'profile_id', v_audit_entry.record_id,
      'undone_action', v_audit_entry.action_type,
      'restored_fields', array_length(v_audit_entry.changed_fields, 1)
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE
      );
  END;
END;
$$;

COMMENT ON FUNCTION undo_profile_update IS
  'Reverts a profile update by restoring old_data from audit log.
   Uses admin_update_profile() for consistency.
   Creates new audit entry tracking the undo operation.';

GRANT EXECUTE ON FUNCTION undo_profile_update(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 4: Undo profile soft delete function
-- ============================================================================

CREATE OR REPLACE FUNCTION undo_profile_delete(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_audit_entry audit_log_enhanced;
  v_current_profile profiles;
  v_user_profile_id UUID;
  v_permission_check JSONB;
BEGIN
  -- Get current user's profile ID
  SELECT id INTO v_user_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_user_profile_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرح. يجب تسجيل الدخول.'
    );
  END IF;

  -- Check permission
  v_permission_check := check_undo_permission(p_audit_log_id, v_user_profile_id);
  IF NOT (v_permission_check->>'can_undo')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_permission_check->>'reason'
    );
  END IF;

  -- Fetch audit entry
  SELECT * INTO v_audit_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id;

  -- Validate it's a delete operation
  IF v_audit_entry.action_type NOT LIKE '%delete%' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'يدعم هذا الدالة فقط تراجع عمليات الحذف'
    );
  END IF;

  -- Get current profile (should be soft-deleted)
  SELECT * INTO v_current_profile
  FROM profiles
  WHERE id = v_audit_entry.record_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الملف غير موجود (ربما تم حذفه نهائياً)'
    );
  END IF;

  IF v_current_profile.deleted_at IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الملف ليس محذوفاً حالياً'
    );
  END IF;

  -- Restore profile by clearing deleted_at
  UPDATE profiles
  SET
    deleted_at = NULL,
    version = version + 1,
    updated_at = NOW()
  WHERE id = v_audit_entry.record_id;

  -- Mark audit entry as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_user_profile_id,
    undo_reason = COALESCE(p_undo_reason, 'تراجع عن الحذف')
  WHERE id = p_audit_log_id;

  -- Log the undo action
  INSERT INTO audit_log_enhanced (
    actor_id,
    action_type,
    table_name,
    record_id,
    old_data,
    new_data,
    description,
    severity
  ) VALUES (
    v_user_profile_id,
    'undo_delete',
    'profiles',
    v_audit_entry.record_id,
    v_audit_entry.new_data,  -- Deleted state
    v_audit_entry.old_data,  -- Restored state
    format('استعادة ملف: %s', v_audit_entry.old_data->>'name'),
    'high'
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم استعادة الملف بنجاح',
    'profile_id', v_audit_entry.record_id,
    'profile_name', v_audit_entry.old_data->>'name'
  );
END;
$$;

COMMENT ON FUNCTION undo_profile_delete IS
  'Restores a soft-deleted profile by clearing deleted_at.
   Works for both single deletes and cascade deletes.';

GRANT EXECUTE ON FUNCTION undo_profile_delete(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 5: Verification queries
-- ============================================================================

DO $$
DECLARE
  v_undo_functions_count INT;
BEGIN
  -- Count undo functions created
  SELECT COUNT(*) INTO v_undo_functions_count
  FROM pg_proc
  WHERE proname IN ('check_undo_permission', 'undo_profile_update', 'undo_profile_delete');

  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Migration 100: Undo System Infrastructure - COMPLETE';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '  - Enhanced audit_log_enhanced with undo tracking columns';
  RAISE NOTICE '  - Created % undo RPC functions', v_undo_functions_count;
  RAISE NOTICE '  - Added index for efficient undo queries';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Functions created:';
  RAISE NOTICE '  1. check_undo_permission(audit_log_id, user_id) → {can_undo, reason}';
  RAISE NOTICE '  2. undo_profile_update(audit_log_id, reason) → {success, message}';
  RAISE NOTICE '  3. undo_profile_delete(audit_log_id, reason) → {success, message}';
  RAISE NOTICE '';
  RAISE NOTICE '⏱️  Undo Time Windows:';
  RAISE NOTICE '  - Regular users: 30 days';
  RAISE NOTICE '  - Admins: Unlimited';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Permission Rules:';
  RAISE NOTICE '  - Users can undo their own actions (if still have permission)';
  RAISE NOTICE '  - Admins/moderators can undo any action in their scope';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '  1. Create React Native services (undoService.js, undoStore.js)';
  RAISE NOTICE '  2. Add undo button to ActivityLogDashboard';
  RAISE NOTICE '  3. Install/create Toast component for feedback';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
END $$;

COMMIT;
