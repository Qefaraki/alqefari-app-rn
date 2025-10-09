-- Diagnostic Script: Check Name Chain Status
-- Run this to verify migration 078 deployment and test build_name_chain()

-- ============================================
-- 1. Test build_name_chain() function directly
-- ============================================
SELECT 'Testing build_name_chain function...' as status;

-- Get Ali's profile (the super admin)
SELECT
  'Ali Profile Test' as test,
  id,
  name,
  build_name_chain(id) as full_chain,
  LENGTH(build_name_chain(id)) as chain_length,
  ARRAY_LENGTH(STRING_TO_ARRAY(build_name_chain(id), ' بن '), 1) as num_segments
FROM profiles
WHERE user_id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8'
LIMIT 1;

-- ============================================
-- 2. Check capture_name_snapshots() function source
-- ============================================
SELECT 'Checking trigger function...' as status;

SELECT
  'capture_name_snapshots function' as function_name,
  CASE
    WHEN prosrc LIKE '%build_name_chain%' THEN '✓ Uses build_name_chain'
    WHEN prosrc LIKE '%CONCAT_WS%' THEN '✗ Still uses CONCAT_WS (3-level)'
    ELSE '? Unknown format'
  END as status,
  LENGTH(prosrc) as source_length
FROM pg_proc
WHERE proname = 'capture_name_snapshots';

-- ============================================
-- 3. Check activity_log_detailed view definition
-- ============================================
SELECT 'Checking view definition...' as status;

SELECT
  'activity_log_detailed view' as view_name,
  CASE
    WHEN definition LIKE '%build_name_chain%' THEN '✓ Uses build_name_chain'
    WHEN definition LIKE '%CONCAT_WS%' THEN '✗ Still uses CONCAT_WS (3-level)'
    ELSE '? Unknown format'
  END as status,
  LENGTH(definition) as definition_length
FROM pg_views
WHERE viewname = 'activity_log_detailed';

-- ============================================
-- 4. Sample recent activity logs
-- ============================================
SELECT 'Recent activity samples...' as status;

SELECT
  created_at,
  action_type,
  actor_name_historical,
  actor_name_current,
  LENGTH(actor_name_current) as current_length,
  ARRAY_LENGTH(STRING_TO_ARRAY(actor_name_current, ' بن '), 1) as num_segments,
  CASE
    WHEN actor_name_current LIKE '%بن%' THEN '✓ New format (with بن)'
    ELSE '✗ Old format (spaces only)'
  END as format_type
FROM activity_log_detailed
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 5. Snapshot statistics
-- ============================================
SELECT 'Snapshot statistics...' as status;

SELECT
  COUNT(*) as total_activities,
  COUNT(*) FILTER (WHERE actor_name_snapshot LIKE '%بن%') as new_format_count,
  COUNT(*) FILTER (WHERE actor_name_snapshot NOT LIKE '%بن%' AND actor_name_snapshot IS NOT NULL) as old_format_count,
  COUNT(*) FILTER (WHERE actor_name_snapshot IS NULL) as null_snapshot_count,
  ROUND(
    COUNT(*) FILTER (WHERE actor_name_snapshot LIKE '%بن%') * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE actor_name_snapshot IS NOT NULL), 0),
    2
  ) as new_format_percentage
FROM audit_log_enhanced
WHERE created_at > NOW() - INTERVAL '7 days';
