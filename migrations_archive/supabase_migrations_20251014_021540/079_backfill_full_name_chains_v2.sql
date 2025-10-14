-- Migration 079: Backfill Full Name Chains for Existing Activity Logs (BATCHED VERSION)
-- Problem: Old activities still have 3-level snapshots or NULL from before migration 078
-- Solution: Re-capture all snapshots using build_name_chain() with batched processing
-- Date: 2025-01-10
-- Status: PRODUCTION-READY (fixes critical issues in v1)

-- CRITICAL FIXES FROM v1:
-- 1. Fixed WHERE clause: target_id IS NOT NULL (was impossible condition)
-- 2. Added batched processing to prevent table locks
-- 3. Added progress monitoring and verification
-- 4. Added indexes for search performance
-- 5. Added rollback documentation

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
-- 2. To resume backfill (migration is idempotent):
--    Re-run this migration file
--
-- 3. To completely revert:
--    UPDATE audit_log_enhanced
--    SET actor_name_snapshot = NULL, target_name_snapshot = NULL;
--    DROP INDEX IF EXISTS idx_audit_log_actor_name_snapshot;
--    DROP INDEX IF EXISTS idx_audit_log_target_name_snapshot;

-- ============================================
-- Main Backfill Script
-- ============================================

DO $$
DECLARE
  v_batch_size INTEGER := 500;
  v_updated INTEGER;
  v_total_actor INTEGER := 0;
  v_total_target INTEGER := 0;
  v_start_time TIMESTAMP := clock_timestamp();
  v_end_time TIMESTAMP;
  v_duration INTERVAL;
  v_total_rows INTEGER;
  v_rows_with_targets INTEGER;
BEGIN
  -- Count total rows
  SELECT COUNT(*) INTO v_total_rows FROM audit_log_enhanced;
  SELECT COUNT(*) INTO v_rows_with_targets
  FROM audit_log_enhanced
  WHERE table_name = 'profiles' AND record_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting backfill of activity log name chains';
  RAISE NOTICE 'Total rows: %', v_total_rows;
  RAISE NOTICE 'Rows with profile targets: %', v_rows_with_targets;
  RAISE NOTICE 'Batch size: %', v_batch_size;
  RAISE NOTICE '========================================';

  -- ============================================
  -- Phase 1: Backfill Actor Name Snapshots
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 1: Backfilling actor_name_snapshot...';

  LOOP
    UPDATE audit_log_enhanced
    SET actor_name_snapshot = (
      SELECT build_name_chain(p.id)
      FROM profiles p
      WHERE p.user_id = audit_log_enhanced.actor_id
        AND p.deleted_at IS NULL
      LIMIT 1
    )
    WHERE id IN (
      SELECT id FROM audit_log_enhanced
      WHERE actor_id IS NOT NULL
        AND (actor_name_snapshot IS NULL OR actor_name_snapshot NOT LIKE '%بن%')
      ORDER BY created_at
      LIMIT v_batch_size
    );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    EXIT WHEN v_updated = 0;

    v_total_actor := v_total_actor + v_updated;
    RAISE NOTICE '  Batch: % rows | Total: % / % (%.1f%%)',
      v_updated,
      v_total_actor,
      v_total_rows,
      (v_total_actor::FLOAT / NULLIF(v_total_rows, 0) * 100);

    -- Commit batch and release locks
    COMMIT;

    -- Brief pause to allow other operations
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Phase 1 complete: % actor snapshots updated', v_total_actor;

  -- ============================================
  -- Phase 2: Backfill Target Name Snapshots
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 2: Backfilling target_name_snapshot...';

  LOOP
    UPDATE audit_log_enhanced
    SET target_name_snapshot = (
      SELECT build_name_chain(p.id)
      FROM profiles p
      WHERE p.id = audit_log_enhanced.record_id
        AND p.deleted_at IS NULL
      LIMIT 1
    )
    WHERE id IN (
      SELECT id FROM audit_log_enhanced
      WHERE table_name = 'profiles'
        AND record_id IS NOT NULL  -- FIXED: was impossible condition in v1
        AND (target_name_snapshot IS NULL OR target_name_snapshot NOT LIKE '%بن%')
      ORDER BY created_at
      LIMIT v_batch_size
    );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    EXIT WHEN v_updated = 0;

    v_total_target := v_total_target + v_updated;
    RAISE NOTICE '  Batch: % rows | Total: % / % (%.1f%%)',
      v_updated,
      v_total_target,
      v_rows_with_targets,
      (v_total_target::FLOAT / NULLIF(v_rows_with_targets, 0) * 100);

    COMMIT;
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Phase 2 complete: % target snapshots updated', v_total_target;

  -- ============================================
  -- Phase 3: Create Indexes for Performance
  -- ============================================
  RAISE NOTICE '';
  RAISE NOTICE 'Phase 3: Creating indexes...';

  -- Create indexes CONCURRENTLY to avoid blocking
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_actor_name_snapshot
    ON audit_log_enhanced(actor_name_snapshot)
    WHERE actor_name_snapshot IS NOT NULL;

  RAISE NOTICE '  Created: idx_audit_log_actor_name_snapshot';

  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_target_name_snapshot
    ON audit_log_enhanced(target_name_snapshot)
    WHERE target_name_snapshot IS NOT NULL;

  RAISE NOTICE '  Created: idx_audit_log_target_name_snapshot';

  -- ============================================
  -- Phase 4: Verification and Statistics
  -- ============================================
  DECLARE
    v_actor_null INTEGER;
    v_target_null INTEGER;
    v_actor_old_format INTEGER;
    v_target_old_format INTEGER;
    v_actor_new_format INTEGER;
    v_target_new_format INTEGER;
    v_success_rate NUMERIC;
  BEGIN
    -- Count various states
    SELECT
      COUNT(*) FILTER (WHERE actor_id IS NOT NULL AND actor_name_snapshot IS NULL),
      COUNT(*) FILTER (WHERE actor_name_snapshot IS NOT NULL AND actor_name_snapshot NOT LIKE '%بن%'),
      COUNT(*) FILTER (WHERE actor_name_snapshot LIKE '%بن%')
    INTO v_actor_null, v_actor_old_format, v_actor_new_format
    FROM audit_log_enhanced;

    SELECT
      COUNT(*) FILTER (WHERE table_name = 'profiles' AND record_id IS NOT NULL AND target_name_snapshot IS NULL),
      COUNT(*) FILTER (WHERE target_name_snapshot IS NOT NULL AND target_name_snapshot NOT LIKE '%بن%'),
      COUNT(*) FILTER (WHERE target_name_snapshot LIKE '%بن%')
    INTO v_target_null, v_target_old_format, v_target_new_format
    FROM audit_log_enhanced;

    v_end_time := clock_timestamp();
    v_duration := v_end_time - v_start_time;

    v_success_rate := ROUND(
      (v_actor_new_format + v_target_new_format)::NUMERIC /
      NULLIF((v_actor_new_format + v_actor_old_format + v_actor_null +
              v_target_new_format + v_target_old_format + v_target_null), 0) * 100,
      2
    );

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'BACKFILL COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Duration: %', v_duration;
    RAISE NOTICE 'Total rows processed: %', v_total_rows;
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
    RAISE NOTICE 'Overall Success Rate: %.1f%%', v_success_rate;
    RAISE NOTICE '========================================';

    -- Final validation
    IF v_actor_null > 0 THEN
      RAISE WARNING 'Some actor snapshots are still NULL (% rows). May be due to deleted profiles.', v_actor_null;
    END IF;

    IF v_target_null > 0 THEN
      RAISE WARNING 'Some target snapshots are still NULL (% rows). May be due to deleted profiles.', v_target_null;
    END IF;

    IF v_actor_old_format > 0 OR v_target_old_format > 0 THEN
      RAISE WARNING 'Some snapshots still have old format (% actor, % target). Consider re-running backfill.',
        v_actor_old_format, v_target_old_format;
    END IF;

    IF v_success_rate >= 95 THEN
      RAISE NOTICE 'SUCCESS: Migration 079 completed with %.1f%% success rate!', v_success_rate;
    ELSE
      RAISE WARNING 'Migration 079 completed but success rate is below 95%%. Review warnings above.';
    END IF;
  END;
END $$;

-- ============================================
-- Sample Query: Verify Results
-- ============================================

-- Show sample of updated records
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
      actor_name_snapshot,
      target_name_snapshot,
      CASE
        WHEN actor_name_snapshot LIKE '%بن%' THEN '✓'
        WHEN actor_name_snapshot IS NOT NULL THEN '⚠'
        ELSE '✗'
      END as actor_status,
      CASE
        WHEN target_name_snapshot LIKE '%بن%' THEN '✓'
        WHEN target_name_snapshot IS NOT NULL THEN '⚠'
        ELSE '✗'
      END as target_status
    FROM audit_log_enhanced
    WHERE actor_name_snapshot IS NOT NULL OR target_name_snapshot IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  ) LOOP
    v_count := v_count + 1;
    RAISE NOTICE '% | % | Actor: % % | Target: % %',
      v_count,
      TO_CHAR(rec.created_at, 'YYYY-MM-DD HH24:MI'),
      rec.actor_status,
      SUBSTRING(rec.actor_name_snapshot, 1, 30),
      rec.target_status,
      COALESCE(SUBSTRING(rec.target_name_snapshot, 1, 30), 'N/A');
  END LOOP;

  RAISE NOTICE '----------------------------------------';
END $$;

-- ============================================
-- Migration Complete
-- ============================================
