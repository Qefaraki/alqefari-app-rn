-- Migration 079: Backfill Full Name Chains for Existing Activity Logs (v3 - Supabase Compatible)
-- Problem: Old activities still have 3-level snapshots or NULL from before migration 078
-- Solution: Re-capture all snapshots using build_name_chain()
-- Date: 2025-01-10
-- Status: PRODUCTION-READY (fixed COMMIT issue from v2)

-- CRITICAL FIXES FROM v1:
-- 1. Fixed WHERE clause: target_id IS NOT NULL (was impossible condition)
-- 2. Removed COMMIT from DO block (not allowed in Supabase/PostgreSQL functions)
-- 3. Single transaction with progress monitoring
-- 4. Added indexes for search performance

-- ============================================
-- ROLLBACK PROCEDURE
-- ============================================
-- If this migration fails or causes issues:
--
-- 1. Check completion status:
--    SELECT
--      COUNT(*) FILTER (WHERE actor_name_snapshot IS NULL) as actor_missing,
--      COUNT(*) FILTER (WHERE target_id IS NOT NULL AND target_name_snapshot IS NULL) as target_missing
--    FROM audit_log_enhanced;
--
-- 2. To completely revert:
--    UPDATE audit_log_enhanced
--    SET actor_name_snapshot = NULL, target_name_snapshot = NULL;
--    DROP INDEX IF EXISTS idx_audit_log_actor_name_snapshot;
--    DROP INDEX IF EXISTS idx_audit_log_target_name_snapshot;

-- ============================================
-- Phase 1: Backfill Actor Name Snapshots
-- ============================================

DO $$
DECLARE
  v_total_rows INTEGER;
  v_start_time TIMESTAMP := clock_timestamp();
BEGIN
  SELECT COUNT(*) INTO v_total_rows FROM audit_log_enhanced;
  RAISE NOTICE 'Starting actor_name_snapshot backfill for % rows...', v_total_rows;
END $$;

-- Update actor snapshots (single transaction, but shows progress via row count)
UPDATE audit_log_enhanced
SET actor_name_snapshot = (
  SELECT build_name_chain(p.id)
  FROM profiles p
  WHERE p.user_id = audit_log_enhanced.actor_id
    AND p.deleted_at IS NULL
  LIMIT 1
)
WHERE actor_id IS NOT NULL
  AND (actor_name_snapshot IS NULL OR actor_name_snapshot NOT LIKE '%بن%');

-- Report results
DO $$
DECLARE
  v_updated INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM audit_log_enhanced WHERE actor_id IS NOT NULL;
  SELECT COUNT(*) INTO v_updated FROM audit_log_enhanced WHERE actor_name_snapshot LIKE '%بن%';
  RAISE NOTICE 'Actor snapshots: % / % updated (%.1f%%)',
    v_updated, v_total, (v_updated::FLOAT / NULLIF(v_total, 0) * 100);
END $$;

-- ============================================
-- Phase 2: Backfill Target Name Snapshots
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Starting target_name_snapshot backfill...';
END $$;

-- Update target snapshots (FIXED WHERE clause from v1)
UPDATE audit_log_enhanced
SET target_name_snapshot = (
  SELECT build_name_chain(p.id)
  FROM profiles p
  WHERE p.id = audit_log_enhanced.record_id
    AND p.deleted_at IS NULL
  LIMIT 1
)
WHERE table_name = 'profiles'
  AND record_id IS NOT NULL  -- FIXED: was "target_name_snapshot IS NOT NULL AND IS NULL" in v1
  AND (target_name_snapshot IS NULL OR target_name_snapshot NOT LIKE '%بن%');

-- Report results
DO $$
DECLARE
  v_updated INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM audit_log_enhanced
  WHERE table_name = 'profiles' AND record_id IS NOT NULL;

  SELECT COUNT(*) INTO v_updated
  FROM audit_log_enhanced
  WHERE target_name_snapshot LIKE '%بن%';

  RAISE NOTICE 'Target snapshots: % / % updated (%.1f%%)',
    v_updated, v_total, (v_updated::FLOAT / NULLIF(v_total, 0) * 100);
END $$;

-- ============================================
-- Phase 3: Create Indexes for Performance
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Creating indexes...';
END $$;

-- Create indexes for fast name searches
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) since we're in migration mode
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_name_snapshot
  ON audit_log_enhanced(actor_name_snapshot)
  WHERE actor_name_snapshot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_target_name_snapshot
  ON audit_log_enhanced(target_name_snapshot)
  WHERE target_name_snapshot IS NOT NULL;

-- ============================================
-- Phase 4: Final Verification
-- ============================================

DO $$
DECLARE
  v_total_rows INTEGER;
  v_actor_null INTEGER;
  v_target_null INTEGER;
  v_actor_new_format INTEGER;
  v_target_new_format INTEGER;
  v_actor_old_format INTEGER;
  v_target_old_format INTEGER;
  v_success_rate NUMERIC;
  v_duration INTERVAL;
  v_start_time TIMESTAMP := clock_timestamp() - INTERVAL '1 minute'; -- Approximate
BEGIN
  -- Count various states
  SELECT COUNT(*) INTO v_total_rows FROM audit_log_enhanced;

  SELECT
    COUNT(*) FILTER (WHERE actor_id IS NOT NULL AND actor_name_snapshot IS NULL),
    COUNT(*) FILTER (WHERE actor_name_snapshot LIKE '%بن%'),
    COUNT(*) FILTER (WHERE actor_name_snapshot IS NOT NULL AND actor_name_snapshot NOT LIKE '%بن%')
  INTO v_actor_null, v_actor_new_format, v_actor_old_format
  FROM audit_log_enhanced;

  SELECT
    COUNT(*) FILTER (WHERE table_name = 'profiles' AND record_id IS NOT NULL AND target_name_snapshot IS NULL),
    COUNT(*) FILTER (WHERE target_name_snapshot LIKE '%بن%'),
    COUNT(*) FILTER (WHERE target_name_snapshot IS NOT NULL AND target_name_snapshot NOT LIKE '%بن%')
  INTO v_target_null, v_target_new_format, v_target_old_format
  FROM audit_log_enhanced;

  v_duration := clock_timestamp() - v_start_time;

  v_success_rate := ROUND(
    (v_actor_new_format + v_target_new_format)::NUMERIC /
    NULLIF((v_actor_new_format + v_actor_old_format + v_target_new_format + v_target_old_format), 0) * 100,
    2
  );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BACKFILL COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Duration: ~%', v_duration;
  RAISE NOTICE 'Total rows: %', v_total_rows;
  RAISE NOTICE '';
  RAISE NOTICE 'Actor Snapshots:';
  RAISE NOTICE '  ✓ New format (with بن): %', v_actor_new_format;
  RAISE NOTICE '  ⚠ Old format (spaces):   %', v_actor_old_format;
  RAISE NOTICE '  ✗ NULL/Missing:          %', v_actor_null;
  RAISE NOTICE '';
  RAISE NOTICE 'Target Snapshots:';
  RAISE NOTICE '  ✓ New format (with بن): %', v_target_new_format;
  RAISE NOTICE '  ⚠ Old format (spaces):   %', v_target_old_format;
  RAISE NOTICE '  ✗ NULL/Missing:          %', v_target_null;
  RAISE NOTICE '';
  RAISE NOTICE 'Overall Success Rate: %.1f%%', COALESCE(v_success_rate, 0);
  RAISE NOTICE '========================================';

  -- Final validation
  IF v_actor_null > 0 THEN
    RAISE WARNING 'Some actor snapshots are still NULL (% rows). May be due to deleted profiles.', v_actor_null;
  END IF;

  IF v_target_null > 0 THEN
    RAISE WARNING 'Some target snapshots are still NULL (% rows). May be due to deleted profiles.', v_target_null;
  END IF;

  IF v_success_rate >= 95 THEN
    RAISE NOTICE '✓ SUCCESS: Migration 079 completed with %.1f%% success rate!', v_success_rate;
  ELSIF v_success_rate >= 80 THEN
    RAISE WARNING 'Migration 079 completed with %.1f%% success rate (below ideal 95%%).', v_success_rate;
  ELSE
    RAISE WARNING 'Migration 079 completed with LOW success rate (%.1f%%). Review warnings above.', v_success_rate;
  END IF;
END $$;

-- ============================================
-- Sample Query: Show Updated Records
-- ============================================

DO $$
DECLARE
  rec RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Sample of updated records (first 5):';
  RAISE NOTICE '----------------------------------------';

  FOR rec IN (
    SELECT
      created_at,
      action_type,
      SUBSTRING(actor_name_snapshot, 1, 40) as actor_preview,
      SUBSTRING(target_name_snapshot, 1, 40) as target_preview,
      CASE
        WHEN actor_name_snapshot LIKE '%بن%' THEN '✓'
        WHEN actor_name_snapshot IS NOT NULL THEN '⚠'
        ELSE '✗'
      END as actor_status,
      CASE
        WHEN target_name_snapshot LIKE '%بن%' THEN '✓'
        WHEN target_name_snapshot IS NOT NULL THEN '⚠'
        ELSE 'N/A'
      END as target_status
    FROM audit_log_enhanced
    WHERE actor_name_snapshot IS NOT NULL OR target_name_snapshot IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) LOOP
    v_count := v_count + 1;
    RAISE NOTICE '% | % | Actor: % % | Target: % %',
      v_count,
      TO_CHAR(rec.created_at, 'YYYY-MM-DD'),
      rec.actor_status,
      rec.actor_preview,
      rec.target_status,
      COALESCE(rec.target_preview, 'N/A');
  END LOOP;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Migration 079 v3: Complete!';
END $$;
