-- Migration 072: Add Short Name Chains to Activity Log
-- Purpose: Activity Log needs compact names without بن to save space
-- Rest of app keeps بن format for proper Arabic naming

-- Drop old view
DROP VIEW IF EXISTS public.activity_log_detailed;

-- Recreate with short name chain columns
CREATE VIEW public.activity_log_detailed AS
SELECT
  -- All original audit log columns
  al.id,
  al.created_at,
  al.actor_id,
  al.actor_type,
  al.action_type,
  al.action_category,
  al.table_name,
  al.record_id,
  al.target_type,
  al.old_data,
  al.new_data,
  al.changed_fields,
  al.description,
  al.ip_address,
  al.user_agent,
  al.severity,
  al.status,
  al.error_message,
  al.session_id,
  al.request_id,
  al.metadata,
  al.can_revert,
  al.reverted_at,
  al.reverted_by,

  -- Actor information (SHORT format: no بن)
  -- Build: "name father_name grandfather_name" (space-separated)
  TRIM(
    CONCAT_WS(' ',
      actor_p.name,
      actor_p.father_name,
      actor_p.grandfather_name
    )
  ) as actor_name,
  actor_p.phone as actor_phone,
  actor_p.hid as actor_hid,
  COALESCE(actor_p.role, 'user') as actor_role,

  -- Target information (SHORT format: no بن)
  TRIM(
    CONCAT_WS(' ',
      target_p.name,
      target_p.father_name,
      target_p.grandfather_name
    )
  ) as target_name,
  target_p.phone as target_phone,
  target_p.hid as target_hid

FROM audit_log_enhanced al

-- JOIN to get actor details
LEFT JOIN profiles actor_p
  ON al.actor_id = actor_p.user_id

-- JOIN to get target profile details
LEFT JOIN profiles target_p
  ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

COMMENT ON VIEW activity_log_detailed IS
  'Enhanced audit log view with SHORT name chains (no بن) for space efficiency.
   Used exclusively by Activity Log Dashboard.
   Rest of app uses standard بن format via nameChainBuilder.js';
