-- Migration 076: Improve Name Snapshot System
-- Enhancements based on solution audit:
-- 1. Add error handling to trigger
-- 2. Add indexes for performance
-- 3. Add monitoring capabilities

-- Step 1: Improve trigger function with error handling and FULL NAME CHAINS
CREATE OR REPLACE FUNCTION capture_name_snapshots()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  target_name TEXT;
BEGIN
  -- Capture actor name at time of activity (FULL CHAIN using build_name_chain)
  IF NEW.actor_id IS NOT NULL THEN
    BEGIN
      SELECT build_name_chain(p.id)
      INTO actor_name
      FROM profiles p
      WHERE p.user_id = NEW.actor_id
        AND p.deleted_at IS NULL;

      -- Log if snapshot capture failed
      IF actor_name IS NULL OR TRIM(actor_name) = '' OR actor_name = 'غير معروف' THEN
        RAISE NOTICE 'Failed to capture actor snapshot for actor_id: %, audit_id: %',
                     NEW.actor_id, NEW.id;
      END IF;

      NEW.actor_name_snapshot := actor_name;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error capturing actor snapshot for actor_id: %, error: %',
                    NEW.actor_id, SQLERRM;
      NEW.actor_name_snapshot := NULL;
    END;
  END IF;

  -- Capture target name at time of activity (FULL CHAIN using build_name_chain)
  IF NEW.table_name = 'profiles' AND NEW.record_id IS NOT NULL THEN
    BEGIN
      SELECT build_name_chain(p.id)
      INTO target_name
      FROM profiles p
      WHERE p.id = NEW.record_id
        AND p.deleted_at IS NULL;

      -- Log if snapshot capture failed
      IF target_name IS NULL OR TRIM(target_name) = '' OR target_name = 'غير معروف' THEN
        RAISE NOTICE 'Failed to capture target snapshot for record_id: %, audit_id: %',
                     NEW.record_id, NEW.id;
      END IF;

      NEW.target_name_snapshot := target_name;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error capturing target snapshot for record_id: %, error: %',
                    NEW.record_id, SQLERRM;
      NEW.target_name_snapshot := NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION capture_name_snapshots() IS
  'Captures actor and target FULL name chains at time of activity creation.
   Uses build_name_chain() for complete ancestry (not just 3 levels).
   Includes error handling to prevent INSERT failures if profile lookup fails.
   Logs warnings when snapshot capture fails for monitoring.';

-- Step 2: Add indexes for better query performance
-- Partial indexes (only non-NULL) reduce index size and improve write performance
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_snapshot
  ON audit_log_enhanced(actor_name_snapshot)
  WHERE actor_name_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_target_snapshot
  ON audit_log_enhanced(target_name_snapshot)
  WHERE target_name_snapshot IS NOT NULL;

-- Add index for common query pattern: filter by created_at + actor
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_created
  ON audit_log_enhanced(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

COMMENT ON INDEX idx_audit_log_actor_snapshot IS
  'Partial index on actor_name_snapshot for fast name-based filtering in Activity Log.
   Only indexes non-NULL values to reduce size and improve write performance.';

COMMENT ON INDEX idx_audit_log_target_snapshot IS
  'Partial index on target_name_snapshot for fast name-based filtering.
   Only indexes non-NULL values to reduce size and improve write performance.';

COMMENT ON INDEX idx_audit_log_actor_created IS
  'Composite index for common query: filter by actor and sort by time.
   Supports Activity Log "my edits" filter with fast temporal ordering.';

-- Step 3: Create monitoring view for snapshot capture success rate
CREATE OR REPLACE VIEW audit_snapshot_health AS
SELECT
  -- Overall statistics
  COUNT(*) as total_activities,

  -- Actor snapshot success rate
  COUNT(*) FILTER (WHERE actor_id IS NOT NULL) as activities_with_actor,
  COUNT(*) FILTER (WHERE actor_name_snapshot IS NOT NULL) as actor_snapshots_captured,
  ROUND(
    COUNT(*) FILTER (WHERE actor_name_snapshot IS NOT NULL) * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE actor_id IS NOT NULL), 0),
    2
  ) as actor_snapshot_success_rate_pct,

  -- Target snapshot success rate
  COUNT(*) FILTER (WHERE table_name = 'profiles') as activities_with_target,
  COUNT(*) FILTER (WHERE target_name_snapshot IS NOT NULL) as target_snapshots_captured,
  ROUND(
    COUNT(*) FILTER (WHERE target_name_snapshot IS NOT NULL) * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE table_name = 'profiles'), 0),
    2
  ) as target_snapshot_success_rate_pct,

  -- Recent data (last 7 days)
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7_days_count,
  COUNT(*) FILTER (
    WHERE created_at > NOW() - INTERVAL '7 days'
    AND actor_name_snapshot IS NOT NULL
  ) as last_7_days_actor_snapshots,

  -- Identify potential issues
  COUNT(*) FILTER (
    WHERE actor_id IS NOT NULL
    AND actor_name_snapshot IS NULL
    AND created_at > NOW() - INTERVAL '7 days'
  ) as recent_failed_actor_snapshots,

  COUNT(*) FILTER (
    WHERE table_name = 'profiles'
    AND target_name_snapshot IS NULL
    AND created_at > NOW() - INTERVAL '7 days'
  ) as recent_failed_target_snapshots

FROM audit_log_enhanced;

COMMENT ON VIEW audit_snapshot_health IS
  'Monitoring view for activity log name snapshot system health.
   Tracks success rates and identifies capture failures.
   Expected: >95% success rate for both actor and target snapshots.
   Query weekly to ensure snapshot system is functioning correctly.';

-- Step 4: Grant permissions
GRANT SELECT ON audit_snapshot_health TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 076: Name snapshot improvements deployed successfully';
  RAISE NOTICE 'Added: Error handling, indexes, monitoring view';
  RAISE NOTICE 'Run: SELECT * FROM audit_snapshot_health; to check system health';
END $$;
