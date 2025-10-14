-- Migration: Fix check_undo_permission Actor ID Comparison
-- Created: 2025-10-14
-- Description: Fixes bug where actor_id (auth.users.id) was being compared
--              directly to p_user_profile_id (profiles.id), causing permission
--              checks to always fail for regular users.
--
-- Root Cause: audit_log_enhanced.actor_id stores auth.users.id, but the
--             function was comparing it to profiles.id without mapping.
--
-- Fix: Look up the actor's profile ID before comparing, and add 'UPDATE' to
--      the list of undoable action types.

-- ============================================================================
-- Function: check_undo_permission (FIXED VERSION)
-- Purpose: Check if a user can undo a specific audit log entry
-- Returns: JSON with can_undo boolean and reason text
-- Changes:
--   1. Added v_actor_profile_id variable
--   2. Map actor_id (auth.users.id) to profile ID before comparison
--   3. Added 'UPDATE' to undoable action types list
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
  v_actor_profile_id UUID;  -- NEW: Variable to store actor's profile ID
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

  -- Check if action is undoable (FIXED: Added 'UPDATE' to the list)
  IF v_log_entry.action_type NOT IN ('UPDATE', 'profile_update', 'profile_delete', 'admin_update', 'admin_delete') THEN
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

  -- FIXED: Map actor_id (auth.users.id) to profile ID before comparison
  -- This is the critical fix - actor_id stores auth.users.id, not profiles.id
  SELECT id INTO v_actor_profile_id 
  FROM profiles 
  WHERE user_id = v_log_entry.actor_id;

  -- FIXED: Now comparing profiles.id to profiles.id (apples to apples)
  IF v_actor_profile_id = p_user_profile_id THEN
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

-- Update function comment
COMMENT ON FUNCTION check_undo_permission IS 'FIXED: Now correctly maps actor_id (auth.users.id) to profiles.id before comparison. Admins have unlimited time, regular users have 30 days.';
