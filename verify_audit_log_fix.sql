-- Verification Script: Check for audit_log references
-- Run this AFTER deploying 20251015160000_fix_audit_log_references.sql

-- =====================================================
-- 1. Check that critical functions now use correct table
-- =====================================================
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%audit_log_enhanced%' THEN '✅ Uses audit_log_enhanced'
    WHEN prosrc LIKE '%INSERT INTO audit_log%' THEN '❌ Still uses audit_log'
    ELSE '⚠️ No audit logging'
  END as status
FROM pg_proc
WHERE proname IN (
  'admin_cascade_delete_profile',
  'admin_update_marriage',
  'admin_create_marriage',
  'admin_soft_delete_marriage',
  'approve_edit_suggestion',
  'reject_edit_suggestion'
)
ORDER BY proname;

-- =====================================================
-- 2. Find ANY remaining references to old table
-- =====================================================
SELECT 
  proname as function_name,
  'INSERT INTO audit_log' as issue_type
FROM pg_proc
WHERE (prosrc LIKE '%INSERT INTO audit_log %' 
   OR prosrc LIKE '%INSERT INTO audit_log(%')
  AND prosrc NOT LIKE '%audit_log_enhanced%'
ORDER BY proname;

-- =====================================================
-- 3. Verify audit_log_enhanced table exists and is active
-- =====================================================
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN pg_total_relation_size(schemaname||'.'||tablename) > 0 
    THEN '✅ Table exists and has data'
    ELSE '⚠️ Table exists but empty'
  END as status
FROM pg_tables
WHERE tablename = 'audit_log_enhanced';

-- =====================================================
-- 4. Verify old audit_log table is truly gone
-- =====================================================
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Old audit_log table successfully dropped'
    ELSE '❌ Old audit_log table still exists!'
  END as verification
FROM pg_tables
WHERE tablename = 'audit_log';

-- =====================================================
-- 5. Test audit logging by checking recent entries
-- =====================================================
SELECT 
  COUNT(*) as total_entries,
  MAX(created_at) as last_entry,
  COUNT(DISTINCT action_type) as action_types,
  CASE 
    WHEN MAX(created_at) > NOW() - INTERVAL '1 hour' 
    THEN '✅ Recent activity logged'
    ELSE '⚠️ No recent entries'
  END as health_check
FROM audit_log_enhanced;

-- =====================================================
-- Expected Results:
-- =====================================================
-- Query 1: All 6 functions should show ✅
-- Query 2: Should return 0 rows (no old references)
-- Query 3: Should show ✅ Table exists
-- Query 4: Should show ✅ Old table dropped
-- Query 5: Should show ✅ Recent activity
