-- Migration: Undo System for Audit Log
-- Created: 2025-10-14
-- Description: Implements undo functionality for profile updates and deletions
--              Includes permission checking and audit trail

-- ============================================================================
-- Function: check_undo_permission
-- Purpose: Check if a user can undo a specific audit log entry
-- Returns: JSON with can_undo boolean and reason text
-- ============================================================================
CREATE OR REPLACE FUNCTION check_undo_permission(
  p_audit_log_id UUID,
  p_user_profile_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_entry RECORD;
  v_user_role TEXT;
  v_time_diff INTERVAL;
BEGIN
  -- Get the audit log entry
  SELECT * INTO v_log_entry
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id;

  -- Check if log entry exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'سجل غير موجود'
    );
  END IF;

  -- Check if already undone
  IF v_log_entry.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'تم التراجع عن هذا الإجراء بالفعل'
    );
  END IF;

  -- Check if action is undoable
  IF v_log_entry.action_type NOT IN ('profile_update', 'profile_delete', 'admin_update', 'admin_delete') THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'نوع الإجراء غير قابل للتراجع'
    );
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_user_profile_id;

  -- Super admins and admins can undo anything
  IF v_user_role IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object(
      'can_undo', true,
      'reason', 'صلاحية مسؤول'
    );
  END IF;

  -- Check if user is the actor (can undo their own actions)
  IF v_log_entry.actor_id = p_user_profile_id THEN
    -- Regular users have 30-day window
    v_time_diff := NOW() - v_log_entry.created_at;
    IF v_time_diff > INTERVAL '30 days' THEN
      RETURN jsonb_build_object(
        'can_undo', false,
        'reason', 'انتهت صلاحية التراجع (أكثر من 30 يوماً)'
      );
    END IF;

    RETURN jsonb_build_object(
      'can_undo', true,
      'reason', 'ضمن نطاق التراجع'
    );
  END IF;

  -- Default: no permission
  RETURN jsonb_build_object(
    'can_undo', false,
    'reason', 'ليس لديك صلاحية للتراجع عن هذا الإجراء'
  );
END;
$$;

-- ============================================================================
-- Function: undo_profile_update
-- Purpose: Undo a profile update by restoring old_data from audit log
-- Returns: JSON with success boolean and message
-- ============================================================================
CREATE OR REPLACE FUNCTION undo_profile_update(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check jsonb;
  v_profile_id UUID;
  v_old_data jsonb;
BEGIN
  -- Get current user from auth.users
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرح. يجب تسجيل الدخول.'
    );
  END IF;

  -- Get user's profile ID
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

  v_profile_id := v_log_entry.record_id;
  v_old_data := v_log_entry.old_data;

  -- Restore old data (only non-null fields from old_data)
  UPDATE profiles
  SET
    name = COALESCE((v_old_data->>'name')::text, name),
    given_name = COALESCE((v_old_data->>'given_name')::text, given_name),
    father_name = COALESCE((v_old_data->>'father_name')::text, father_name),
    grandfather_name = COALESCE((v_old_data->>'grandfather_name')::text, grandfather_name),
    phone = COALESCE((v_old_data->>'phone')::text, phone),
    birth_date = CASE
      WHEN v_old_data ? 'birth_date' THEN (v_old_data->>'birth_date')::date
      ELSE birth_date
    END,
    birth_year_hijri = CASE
      WHEN v_old_data ? 'birth_year_hijri' THEN (v_old_data->>'birth_year_hijri')::integer
      ELSE birth_year_hijri
    END,
    is_alive = CASE
      WHEN v_old_data ? 'is_alive' THEN (v_old_data->>'is_alive')::boolean
      ELSE is_alive
    END,
    death_date = CASE
      WHEN v_old_data ? 'death_date' THEN (v_old_data->>'death_date')::date
      ELSE death_date
    END,
    death_year_hijri = CASE
      WHEN v_old_data ? 'death_year_hijri' THEN (v_old_data->>'death_year_hijri')::integer
      ELSE death_year_hijri
    END,
    notes = CASE
      WHEN v_old_data ? 'notes' THEN (v_old_data->>'notes')::text
      ELSE notes
    END,
    updated_at = NOW()
  WHERE id = v_profile_id;

  -- Mark audit log entry as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create new audit log entry for the undo action
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
    'undo_profile_update',
    v_current_user_id,
    v_log_entry.new_data,  -- What was changed to
    v_log_entry.old_data,  -- What we restored
    v_log_entry.changed_fields,
    'تراجع عن: ' || v_log_entry.description,
    'medium',
    false  -- Undos themselves are not undoable
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم التراجع بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ أثناء التراجع: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- Function: undo_profile_delete
-- Purpose: Undo a profile soft delete by clearing deleted_at
-- Returns: JSON with success boolean and message
-- ============================================================================
CREATE OR REPLACE FUNCTION undo_profile_delete(
  p_audit_log_id UUID,
  p_undo_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_entry RECORD;
  v_current_user_id UUID;
  v_permission_check jsonb;
  v_profile_id UUID;
BEGIN
  -- Get current user from auth.users
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'غير مصرح. يجب تسجيل الدخول.'
    );
  END IF;

  -- Get user's profile ID
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

  v_profile_id := v_log_entry.record_id;

  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_profile_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الملف غير موجود'
    );
  END IF;

  -- Restore profile by clearing deleted_at
  UPDATE profiles
  SET
    deleted_at = NULL,
    updated_at = NOW()
  WHERE id = v_profile_id;

  -- Mark audit log entry as undone
  UPDATE audit_log_enhanced
  SET
    undone_at = NOW(),
    undone_by = v_current_user_id,
    undo_reason = p_undo_reason
  WHERE id = p_audit_log_id;

  -- Create new audit log entry for the undo action
  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    description,
    severity,
    is_undoable
  ) VALUES (
    'profiles',
    v_profile_id,
    'undo_delete',
    v_current_user_id,
    'تراجع عن حذف: ' || v_log_entry.description,
    'medium',
    false  -- Undos themselves are not undoable
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم استعادة الملف بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ أثناء الاستعادة: ' || SQLERRM
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_undo_permission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION undo_profile_update(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION undo_profile_delete(UUID, TEXT) TO authenticated;

-- Add columns to audit_log_enhanced if they don't exist
ALTER TABLE audit_log_enhanced
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS undone_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS undo_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_undoable BOOLEAN DEFAULT true;

-- Create index for faster undo queries
CREATE INDEX IF NOT EXISTS idx_audit_log_undone ON audit_log_enhanced(undone_at) WHERE undone_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_is_undoable ON audit_log_enhanced(is_undoable) WHERE is_undoable = true;

-- Comment on the functions
COMMENT ON FUNCTION check_undo_permission IS 'Checks if a user has permission to undo a specific audit log entry. Admins have unlimited time, regular users have 30 days.';
COMMENT ON FUNCTION undo_profile_update IS 'Undoes a profile update by restoring old_data from the audit log. Creates a new audit entry for the undo action.';
COMMENT ON FUNCTION undo_profile_delete IS 'Undoes a profile soft delete by clearing the deleted_at timestamp. Creates a new audit entry for the undo action.';
