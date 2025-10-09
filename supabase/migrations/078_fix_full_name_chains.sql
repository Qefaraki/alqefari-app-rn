-- Migration 078: Fix Name Chains to Show Full Ancestry
-- Problem: Migrations 075 and 076 only show 3 levels (name + father + grandfather)
-- Solution: Use existing build_name_chain() function for complete ancestry
-- Date: 2025-01-10

-- ============================================
-- 1. Fix Trigger Function to Use Full Chain
-- ============================================

CREATE OR REPLACE FUNCTION capture_name_snapshots()
RETURNS TRIGGER AS $$
DECLARE
  actor_name TEXT;
  target_name TEXT;
BEGIN
  -- Capture actor name at time of activity (FULL CHAIN)
  IF NEW.actor_id IS NOT NULL THEN
    BEGIN
      SELECT build_name_chain(p.id)
      INTO actor_name
      FROM profiles p
      WHERE p.user_id = NEW.actor_id
        AND p.deleted_at IS NULL;

      -- Log warning if snapshot failed
      IF actor_name IS NULL OR TRIM(actor_name) = '' OR actor_name = 'غير معروف' THEN
        RAISE NOTICE 'Failed to capture actor snapshot for actor_id: % (profile may not exist)', NEW.actor_id;
      END IF;

      NEW.actor_name_snapshot := actor_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error capturing actor snapshot: %', SQLERRM;
      NEW.actor_name_snapshot := NULL;
    END;
  END IF;

  -- Capture target name at time of activity (FULL CHAIN)
  IF NEW.table_name = 'profiles' AND NEW.record_id IS NOT NULL THEN
    BEGIN
      SELECT build_name_chain(p.id)
      INTO target_name
      FROM profiles p
      WHERE p.id = NEW.record_id
        AND p.deleted_at IS NULL;

      -- Log warning if snapshot failed
      IF target_name IS NULL OR TRIM(target_name) = '' OR target_name = 'غير معروف' THEN
        RAISE NOTICE 'Failed to capture target snapshot for record_id: % (profile may not exist)', NEW.record_id;
      END IF;

      NEW.target_name_snapshot := target_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error capturing target snapshot: %', SQLERRM;
      NEW.target_name_snapshot := NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Fix View to Use Full Chain
-- ============================================

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

  -- HISTORICAL Actor name (snapshot at time of activity) - FULL CHAIN
  -- Falls back to current name for old entries before migration
  COALESCE(
    al.actor_name_snapshot,
    build_name_chain(actor_p.id),
    actor_p.name,
    'مستخدم محذوف'
  ) as actor_name_historical,

  -- CURRENT Actor name - FULL CHAIN
  COALESCE(
    build_name_chain(actor_p.id),
    actor_p.name,
    'مستخدم محذوف'
  ) as actor_name_current,

  actor_p.id as actor_profile_id,
  actor_p.phone as actor_phone,
  COALESCE(actor_p.role, 'user') as actor_role,

  -- HISTORICAL Target name (snapshot at time of activity) - FULL CHAIN
  -- Falls back to current name for old entries before migration
  COALESCE(
    al.target_name_snapshot,
    build_name_chain(target_p.id),
    target_p.name,
    'ملف محذوف'
  ) as target_name_historical,

  -- CURRENT Target name - FULL CHAIN
  COALESCE(
    build_name_chain(target_p.id),
    target_p.name,
    'ملف محذوف'
  ) as target_name_current,

  target_p.id as target_profile_id,
  target_p.phone as target_phone

FROM audit_log_enhanced al
LEFT JOIN profiles actor_p ON al.actor_id = actor_p.user_id
LEFT JOIN profiles target_p ON al.record_id = target_p.id
  AND al.table_name = 'profiles';

COMMENT ON VIEW activity_log_detailed IS
  'Enhanced audit log view with BOTH historical (snapshot) and current FULL NAME CHAINS.
   - Uses build_name_chain() for complete ancestry (not just 3 levels)
   - actor_name_historical: Full chain at time of action
   - actor_name_current: Full chain now (may be different if names changed)
   - target_name_historical/current: Same for target person
   - UI shows both when different, single name when same
   Used exclusively by Activity Log Dashboard.';

-- ============================================
-- 3. Validation
-- ============================================

DO $$
BEGIN
  -- Check that build_name_chain function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'build_name_chain'
  ) THEN
    RAISE EXCEPTION 'Migration 078 failed: build_name_chain function not found (deploy migration 064 first)';
  END IF;

  -- Check that view was created
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = 'activity_log_detailed'
  ) THEN
    RAISE EXCEPTION 'Migration 078 failed: activity_log_detailed view not created';
  END IF;

  -- Check that trigger function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'capture_name_snapshots'
  ) THEN
    RAISE EXCEPTION 'Migration 078 failed: capture_name_snapshots function not created';
  END IF;

  RAISE NOTICE 'Migration 078: Full name chains implemented successfully';
  RAISE NOTICE '  - Trigger now captures complete ancestry in snapshots';
  RAISE NOTICE '  - View now displays full chains for both historical and current names';
END $$;
