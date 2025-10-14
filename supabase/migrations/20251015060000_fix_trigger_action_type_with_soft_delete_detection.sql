-- Migration: Fix Trigger Action Type with Soft Delete Detection
-- Created: 2025-10-15
-- Description: Fixes log_profile_changes() trigger to create audit entries with
--              correct lowercase_underscore action types and properly detect
--              soft deletes vs regular updates.
--
-- PROBLEM FIXED:
-- - Trigger was using TG_OP which creates 'UPDATE', 'INSERT', 'DELETE' (uppercase)
-- - Frontend registry expects 'profile_update', 'profile_insert', 'profile_soft_delete'
-- - No differentiation between soft delete UPDATE and regular UPDATE
--
-- CHANGES:
-- 1. Updated log_profile_changes() trigger with soft delete detection
-- 2. Updated check_undo_permission() whitelist
-- 3. Migrated existing uppercase entries to correct lowercase types
-- 4. Added CHECK constraint to prevent future uppercase entries

-- ============================================================================
-- STEP 1: Update log_profile_changes() trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_actor_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_changed_fields TEXT[];
  v_description TEXT;
  v_action_type TEXT;
BEGIN
  v_actor_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_changed_fields := NULL;
    v_description := 'Profile deleted: ' || OLD.name;
    v_action_type := 'profile_hard_delete';
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);

    -- Calculate which fields changed
    v_changed_fields := ARRAY(
      SELECT key
      FROM jsonb_each(v_new_data)
      WHERE v_old_data->key IS DISTINCT FROM v_new_data->key
    );

    -- Detect soft delete: deleted_at went from NULL to NOT NULL
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action_type := 'profile_soft_delete';
      v_description := 'Profile soft deleted: ' || NEW.name;
    ELSE
      v_action_type := 'profile_update';
      v_description := 'Profile updated: ' || NEW.name || ' (' || array_length(v_changed_fields, 1) || ' fields changed)';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_changed_fields := NULL;
    v_description := 'Profile created: ' || NEW.name;
    v_action_type := 'profile_insert';
  END IF;

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
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action_type,
    v_actor_id,
    v_old_data,
    v_new_data,
    v_changed_fields,
    v_description,
    CASE
      WHEN v_action_type IN ('profile_soft_delete', 'profile_hard_delete') THEN 'high'
      WHEN v_action_type = 'profile_insert' THEN 'medium'
      ELSE 'low'
    END,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ============================================================================
-- STEP 2: Update check_undo_permission() function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_undo_permission(
  p_audit_log_id UUID,
  p_user_profile_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_log RECORD;
  v_user_profile RECORD;
  v_target_profile RECORD;
  v_permission_level TEXT;
  v_time_limit INTERVAL;
  v_can_undo BOOLEAN := FALSE;
  v_reason TEXT;
BEGIN
  -- Get the audit log entry
  SELECT * INTO v_log
  FROM audit_log_enhanced
  WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'Audit log entry not found'
    );
  END IF;

  -- Get user profile with role
  SELECT * INTO v_user_profile
  FROM profiles
  WHERE id = p_user_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'User profile not found'
    );
  END IF;

  -- Check if action is undoable (UPDATED WHITELIST)
  IF v_log.action_type NOT IN (
    'profile_update',
    'profile_soft_delete',
    'profile_insert',
    'add_marriage',
    'update_marriage',
    'admin_update',
    'admin_delete'
  ) THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'Action type "' || v_log.action_type || '" cannot be undone'
    );
  END IF;

  -- Check if already undone
  IF v_log.undone_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'Action already undone'
    );
  END IF;

  -- Determine time limit based on role
  IF v_user_profile.role IN ('admin', 'super_admin') THEN
    v_time_limit := INTERVAL '7 days';
  ELSE
    v_time_limit := INTERVAL '24 hours';
  END IF;

  -- Check time window
  IF v_log.created_at < NOW() - v_time_limit THEN
    RETURN jsonb_build_object(
      'can_undo', false,
      'reason', 'Action is too old to undo (limit: ' || v_time_limit || ')'
    );
  END IF;

  -- Check permissions based on role and relationship
  IF v_user_profile.role IN ('admin', 'super_admin') THEN
    -- Admins can undo anything within time limit
    v_can_undo := TRUE;
    v_reason := 'Admin privilege';
  ELSIF v_log.actor_id = v_user_profile.user_id THEN
    -- Users can undo their own actions within 24 hours
    v_can_undo := TRUE;
    v_reason := 'Own action';
  ELSE
    -- Check family permission for target profile
    IF v_log.record_id IS NOT NULL THEN
      SELECT * INTO v_target_profile
      FROM profiles
      WHERE id = v_log.record_id;

      IF FOUND THEN
        -- Use family permission system
        SELECT permission_level INTO v_permission_level
        FROM check_family_permission_v4(p_user_profile_id, v_target_profile.id);

        IF v_permission_level IN ('inner', 'admin', 'moderator') THEN
          v_can_undo := TRUE;
          v_reason := 'Family permission: ' || v_permission_level;
        ELSE
          v_can_undo := FALSE;
          v_reason := 'Insufficient family permission';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'can_undo', v_can_undo,
    'reason', v_reason,
    'time_limit', v_time_limit,
    'created_at', v_log.created_at,
    'action_type', v_log.action_type
  );
END;
$function$;

-- ============================================================================
-- STEP 3: Migrate existing data with soft delete detection
-- ============================================================================

-- Update existing audit log entries to use correct action types
UPDATE audit_log_enhanced
SET action_type = CASE
  -- Detect soft deletes: deleted_at went from NULL to NOT NULL
  WHEN action_type = 'UPDATE'
       AND (old_data->>'deleted_at') IS NULL
       AND (new_data->>'deleted_at') IS NOT NULL
    THEN 'profile_soft_delete'
  -- Regular updates
  WHEN action_type = 'UPDATE'
    THEN 'profile_update'
  -- Inserts
  WHEN action_type = 'INSERT'
    THEN 'profile_insert'
  -- Hard deletes
  WHEN action_type = 'DELETE'
    THEN 'profile_hard_delete'
  ELSE action_type
END,
-- Update descriptions to match new action types
description = CASE
  WHEN action_type = 'UPDATE'
       AND (old_data->>'deleted_at') IS NULL
       AND (new_data->>'deleted_at') IS NOT NULL
    THEN 'Profile soft deleted: ' || COALESCE(new_data->>'name', old_data->>'name', 'Unknown')
  WHEN action_type = 'UPDATE'
    THEN 'Profile updated: ' || COALESCE(new_data->>'name', old_data->>'name', 'Unknown')
  WHEN action_type = 'INSERT'
    THEN 'Profile created: ' || COALESCE(new_data->>'name', 'Unknown')
  WHEN action_type = 'DELETE'
    THEN 'Profile hard deleted: ' || COALESCE(old_data->>'name', 'Unknown')
  ELSE description
END,
-- Update severity to match new severity levels (high, medium, low)
severity = CASE
  WHEN action_type = 'UPDATE'
       AND (old_data->>'deleted_at') IS NULL
       AND (new_data->>'deleted_at') IS NOT NULL
    THEN 'high'
  WHEN action_type = 'DELETE'
    THEN 'high'
  WHEN action_type = 'INSERT'
    THEN 'medium'
  WHEN action_type = 'UPDATE'
    THEN 'low'
  ELSE severity
END
WHERE action_type IN ('UPDATE', 'INSERT', 'DELETE');

-- ============================================================================
-- STEP 4: Add CHECK constraint to prevent future uppercase entries
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE audit_log_enhanced
DROP CONSTRAINT IF EXISTS chk_action_type_format;

-- Add constraint to ensure action_type follows lowercase_underscore format
ALTER TABLE audit_log_enhanced
ADD CONSTRAINT chk_action_type_format
CHECK (action_type ~ '^[a-z_]+$');

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

/*
-- Verify data migration
SELECT
  action_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE undone_at IS NOT NULL) as undone_count
FROM audit_log_enhanced
GROUP BY action_type
ORDER BY count DESC;

-- Verify soft delete detection
SELECT
  id,
  action_type,
  description,
  severity,
  (old_data->>'deleted_at') as old_deleted_at,
  (new_data->>'deleted_at') as new_deleted_at
FROM audit_log_enhanced
WHERE action_type = 'profile_soft_delete'
LIMIT 10;

-- Test trigger with soft delete
BEGIN;
  UPDATE profiles
  SET deleted_at = NOW()
  WHERE id = (SELECT id FROM profiles WHERE deleted_at IS NULL LIMIT 1);

  SELECT action_type, description, severity
  FROM audit_log_enhanced
  ORDER BY created_at DESC
  LIMIT 1;
ROLLBACK;
*/
