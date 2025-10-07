-- Migration 075: Activity Log Name Snapshots
-- Purpose: Preserve historical names while showing current names
-- Allows seeing both who someone WAS when they did an action AND who they ARE now

-- Step 1: Add snapshot columns to store names at time of activity
ALTER TABLE audit_log_enhanced
ADD COLUMN IF NOT EXISTS actor_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS target_name_snapshot TEXT;

-- Step 2: Update activity_log_detailed view to return BOTH historical and current names
DROP VIEW IF EXISTS public.activity_log_detailed;

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

  -- HISTORICAL Actor name (snapshot at time of activity)
  -- Falls back to current name for old entries before migration
  COALESCE(
    al.actor_name_snapshot,
    TRIM(CONCAT_WS(' ', actor_p.name, actor_p.father_name, actor_p.grandfather_name))
  ) as actor_name_historical,

  -- CURRENT Actor name (live JOIN with profiles table)
  TRIM(
    CONCAT_WS(' ',
      actor_p.name,
      actor_p.father_name,
      actor_p.grandfather_name
    )
  ) as actor_name_current,

  actor_p.phone as actor_phone,
  actor_p.hid as actor_hid,
  actor_p.id as actor_profile_id, -- For navigation
  COALESCE(actor_p.role, 'user') as actor_role,

  -- HISTORICAL Target name (snapshot at time of activity)
  COALESCE(
    al.target_name_snapshot,
    TRIM(CONCAT_WS(' ', target_p.name, target_p.father_name, target_p.grandfather_name))
  ) as target_name_historical,

  -- CURRENT Target name (live JOIN with profiles table)
  TRIM(
    CONCAT_WS(' ',
      target_p.name,
      target_p.father_name,
      target_p.grandfather_name
    )
  ) as target_name_current,

  target_p.phone as target_phone,
  target_p.hid as target_hid,
  target_p.id as target_profile_id -- For navigation

FROM audit_log_enhanced al

-- JOIN to get CURRENT actor details
LEFT JOIN profiles actor_p
  ON al.actor_id = actor_p.user_id

-- JOIN to get CURRENT target profile details
LEFT JOIN profiles target_p
  ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

COMMENT ON VIEW activity_log_detailed IS
  'Enhanced audit log view with BOTH historical (snapshot) and current names.
   - actor_name_historical: Who they WERE when they did the action
   - actor_name_current: Who they ARE now (may be same or different)
   - target_name_historical/current: Same for target person
   - UI shows both when different, single name when same
   Used exclusively by Activity Log Dashboard.';

-- Step 3: Create/update trigger function to capture name snapshots
CREATE OR REPLACE FUNCTION capture_name_snapshots()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  target_name TEXT;
BEGIN
  -- Capture actor name at time of activity
  IF NEW.actor_id IS NOT NULL THEN
    SELECT TRIM(CONCAT_WS(' ', p.name, p.father_name, p.grandfather_name))
    INTO actor_name
    FROM profiles p
    WHERE p.user_id = NEW.actor_id;

    NEW.actor_name_snapshot := actor_name;
  END IF;

  -- Capture target name at time of activity (if target is a profile)
  IF NEW.table_name = 'profiles' AND NEW.record_id IS NOT NULL THEN
    SELECT TRIM(CONCAT_WS(' ', p.name, p.father_name, p.grandfather_name))
    INTO target_name
    FROM profiles p
    WHERE p.id = NEW.record_id;

    NEW.target_name_snapshot := target_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Attach trigger to audit_log_enhanced
DROP TRIGGER IF EXISTS trigger_capture_name_snapshots ON audit_log_enhanced;

CREATE TRIGGER trigger_capture_name_snapshots
  BEFORE INSERT ON audit_log_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION capture_name_snapshots();

-- Step 5: Backfill recent activity logs (last 30 days) with historical names
-- This preserves recent history, older logs will gracefully use current names
DO $$
DECLARE
  updated_count INT := 0;
BEGIN
  -- Update actor snapshots for recent logs
  UPDATE audit_log_enhanced al
  SET actor_name_snapshot = TRIM(CONCAT_WS(' ', p.name, p.father_name, p.grandfather_name))
  FROM profiles p
  WHERE al.actor_id = p.user_id
    AND al.actor_name_snapshot IS NULL
    AND al.created_at > NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % actor name snapshots', updated_count;

  -- Update target snapshots for recent logs
  UPDATE audit_log_enhanced al
  SET target_name_snapshot = TRIM(CONCAT_WS(' ', p.name, p.father_name, p.grandfather_name))
  FROM profiles p
  WHERE al.table_name = 'profiles'
    AND al.record_id = p.id
    AND al.target_name_snapshot IS NULL
    AND al.created_at > NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % target name snapshots', updated_count;
END $$;

-- Log completion
RAISE NOTICE 'Migration 075: Name snapshot system deployed successfully';
