-- Migration: Consolidate Sibling Order Changes into Operation Groups
-- Date: 2025-10-18
-- Purpose: Group 340+ individual sibling order audit log entries into batched operation groups
--          to reduce audit log clutter and improve readability

-- Step 1: Create operation groups for sibling order changes based on time windows
-- We'll group changes that occurred within 5-minute windows
WITH time_windows AS (
  SELECT DISTINCT
    DATE_TRUNC('minute', created_at) -
    (EXTRACT(MINUTE FROM created_at)::integer % 5 || ' minutes')::interval AS window_start
  FROM audit_log_enhanced
  WHERE action_type IN ('profile_update', 'admin_update')
    AND changed_fields @> ARRAY['sibling_order']
    AND actor_id IS NULL
    AND operation_group_id IS NULL
),
inserted_groups AS (
  INSERT INTO operation_groups (id, description, group_type, created_by, created_at)
  SELECT
    gen_random_uuid(),
    'تصحيح ترتيب الأشقاء التلقائي - ' || TO_CHAR(window_start, 'HH24:MI'),
    'batch_update',
    (SELECT id FROM profiles WHERE role = 'super_admin' ORDER BY created_at ASC LIMIT 1), -- System/super admin
    window_start
  FROM time_windows
  RETURNING id, created_at
)
-- Step 2: Update audit log entries to link them to the appropriate operation groups
UPDATE audit_log_enhanced
SET operation_group_id = inserted_groups.id
FROM inserted_groups
WHERE audit_log_enhanced.action_type IN ('profile_update', 'admin_update')
  AND audit_log_enhanced.changed_fields @> ARRAY['sibling_order']
  AND audit_log_enhanced.actor_id IS NULL
  AND audit_log_enhanced.operation_group_id IS NULL
  AND DATE_TRUNC('minute', audit_log_enhanced.created_at) -
      (EXTRACT(MINUTE FROM audit_log_enhanced.created_at)::integer % 5 || ' minutes')::interval
      = inserted_groups.created_at;

-- Step 3: Add comment for documentation
COMMENT ON TABLE operation_groups IS 'Groups related operations (cascade deletes, batch sibling order fixes) for cleaner audit log display';
