-- Migration 079: Backfill Full Name Chains for Existing Activity Logs
-- Problem: Old activities still have 3-level snapshots from before migration 078
-- Solution: Re-capture all snapshots using build_name_chain()
-- Date: 2025-01-10

-- ============================================
-- 1. Backfill Actor Name Snapshots
-- ============================================

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting actor_name_snapshot backfill...';

  -- Update all actor snapshots to use full chain
  UPDATE audit_log_enhanced al
  SET actor_name_snapshot = (
    SELECT build_name_chain(p.id)
    FROM profiles p
    WHERE p.user_id = al.actor_id
      AND p.deleted_at IS NULL
    LIMIT 1
  )
  WHERE al.actor_id IS NOT NULL
    AND al.actor_name_snapshot IS NOT NULL; -- Only update existing snapshots

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % actor snapshots', v_updated_count;

  -- Count how many failed (still have old format)
  SELECT COUNT(*) INTO v_failed_count
  FROM audit_log_enhanced
  WHERE actor_name_snapshot IS NOT NULL
    AND actor_name_snapshot NOT LIKE '%بن%';

  RAISE NOTICE 'Remaining old-format snapshots: %', v_failed_count;
END $$;

-- ============================================
-- 2. Backfill Target Name Snapshots
-- ============================================

DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting target_name_snapshot backfill...';

  -- Update all target snapshots to use full chain
  UPDATE audit_log_enhanced al
  SET target_name_snapshot = (
    SELECT build_name_chain(p.id)
    FROM profiles p
    WHERE p.id = al.record_id
      AND p.deleted_at IS NULL
    LIMIT 1
  )
  WHERE al.table_name = 'profiles'
    AND al.record_id IS NOT NULL
    AND al.target_name_snapshot IS NOT NULL; -- Only update existing snapshots

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % target snapshots', v_updated_count;

  -- Count how many failed (still have old format)
  SELECT COUNT(*) INTO v_failed_count
  FROM audit_log_enhanced
  WHERE target_name_snapshot IS NOT NULL
    AND target_name_snapshot NOT LIKE '%بن%';

  RAISE NOTICE 'Remaining old-format snapshots: %', v_failed_count;
END $$;

-- ============================================
-- 3. Verify Backfill Success
-- ============================================

DO $$
DECLARE
  v_total INTEGER;
  v_new_format INTEGER;
  v_old_format INTEGER;
  v_success_rate NUMERIC;
BEGIN
  -- Count total snapshots
  SELECT
    COUNT(*) FILTER (WHERE actor_name_snapshot IS NOT NULL),
    COUNT(*) FILTER (WHERE actor_name_snapshot LIKE '%بن%'),
    COUNT(*) FILTER (WHERE actor_name_snapshot NOT LIKE '%بن%' AND actor_name_snapshot IS NOT NULL)
  INTO v_total, v_new_format, v_old_format
  FROM audit_log_enhanced;

  v_success_rate := ROUND((v_new_format::NUMERIC / NULLIF(v_total, 0)) * 100, 2);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backfill Results:';
  RAISE NOTICE '  Total snapshots: %', v_total;
  RAISE NOTICE '  New format (with بن): %', v_new_format;
  RAISE NOTICE '  Old format (spaces): %', v_old_format;
  RAISE NOTICE '  Success rate: %%', v_success_rate;
  RAISE NOTICE '========================================';

  IF v_success_rate < 95 THEN
    RAISE WARNING 'Backfill success rate is below 95%% - some profiles may be deleted or inaccessible';
  ELSE
    RAISE NOTICE 'Migration 079: Backfill completed successfully!';
  END IF;
END $$;

-- ============================================
-- 4. Sample Check
-- ============================================

-- Show sample of updated records
SELECT
  'Sample of updated records' as info,
  created_at,
  action_type,
  actor_name_snapshot,
  CASE
    WHEN actor_name_snapshot LIKE '%بن%' THEN '✓ Full chain'
    ELSE '✗ Old format'
  END as format_status
FROM audit_log_enhanced
WHERE actor_name_snapshot IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
