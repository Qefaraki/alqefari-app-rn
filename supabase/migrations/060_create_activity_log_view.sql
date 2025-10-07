-- Migration 060: Create Activity Log Detailed View
-- Created: 2025-01-10
-- Purpose: JOIN audit_log_enhanced with profiles to get actor/target names, phones, roles
-- Fixes: Actor names showing "مستخدم" fallback in Activity Log Dashboard

-- Step 1: Create performance index for actor JOIN
-- This speeds up the view query significantly
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_for_audit
ON profiles(user_id)
WHERE user_id IS NOT NULL;

-- Step 2: Create the detailed view with correct JOINs
CREATE VIEW public.activity_log_detailed AS
SELECT
  -- All original audit log columns
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.actor_id,
  al.old_data,
  al.new_data,
  al.changed_fields,
  al.description,
  al.severity,
  al.created_at,

  -- Actor information (person who performed the action)
  actor_p.name as actor_name,
  actor_p.phone as actor_phone,
  actor_p.hid as actor_hid,
  COALESCE(actor_p.role, 'user') as actor_role,

  -- Target information (person being edited)
  target_p.name as target_name,
  target_p.phone as target_phone,
  target_p.hid as target_hid
FROM audit_log_enhanced al

-- JOIN to get actor details
-- CRITICAL FIX: actor_id references auth.users.id, so JOIN on user_id
LEFT JOIN profiles actor_p
  ON al.actor_id = actor_p.user_id

-- JOIN to get target profile details (if record_id is a profile)
LEFT JOIN profiles target_p
  ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

-- Add comment for documentation
COMMENT ON VIEW activity_log_detailed IS
  'Enhanced audit log view with actor and target profile information. ' ||
  'Replaces direct queries to audit_log_enhanced table. ' ||
  'Used by Activity Log Dashboard to display comprehensive activity metadata.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 060: activity_log_detailed view created successfully';
  RAISE NOTICE 'View includes: actor_name, actor_phone, actor_role, target_name, target_phone';
  RAISE NOTICE 'Performance index added on profiles.user_id';
END $$;
