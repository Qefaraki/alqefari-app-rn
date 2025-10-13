-- =====================================================
-- DIAGNOSTIC: Check Database State Before Migration 010
-- =====================================================
-- Purpose: Validate current database state and prerequisites
-- Run this BEFORE deploying migration 010
-- =====================================================

-- Check suggestion_blocks schema
SELECT
  '=== SUGGESTION_BLOCKS SCHEMA ===' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'suggestion_blocks'
ORDER BY ordinal_position;

-- Check branch_moderators schema
SELECT
  '=== BRANCH_MODERATORS SCHEMA ===' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'branch_moderators'
ORDER BY ordinal_position;

-- Check which migrations are recorded
SELECT
  '=== DEPLOYED MIGRATIONS ===' as check_type,
  *
FROM migrations
WHERE version IN (5, 6, 7, 8, 9)
ORDER BY version;

-- Check which permission functions exist
SELECT
  '=== EXISTING PERMISSION FUNCTIONS ===' as check_type,
  routine_name,
  STRING_AGG(
    CASE
      WHEN data_type = 'USER-DEFINED' THEN parameter_name || ' ' || udt_name
      ELSE parameter_name || ' ' || data_type
    END,
    ', '
  ) as parameters
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p
  ON r.specific_name = p.specific_name
  AND p.parameter_mode = 'IN'
WHERE r.routine_name IN (
  'is_super_admin',
  'can_manage_permissions',
  'super_admin_search_by_name_chain',
  'super_admin_set_user_role',
  'super_admin_assign_branch_moderator',
  'super_admin_remove_branch_moderator',
  'admin_toggle_suggestion_block',
  'get_user_permissions_summary'
)
GROUP BY r.routine_name, r.specific_name
ORDER BY r.routine_name;

-- Check for conflicts (UUID vs TEXT versions)
SELECT
  '=== FUNCTION SIGNATURE CONFLICTS ===' as check_type,
  routine_name,
  COUNT(*) as version_count,
  STRING_AGG(specific_name, ', ') as versions
FROM information_schema.routines
WHERE routine_name IN (
  'super_admin_assign_branch_moderator',
  'super_admin_remove_branch_moderator'
)
GROUP BY routine_name
HAVING COUNT(*) > 1;

-- Summary report
SELECT
  '=== DEPLOYMENT READINESS ===' as check_type,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'suggestion_blocks'
      AND column_name = 'blocked_user_id'
    ) THEN '✅ suggestion_blocks has blocked_user_id'
    ELSE '❌ suggestion_blocks missing blocked_user_id (migration 007 not deployed)'
  END as suggestion_blocks_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'branch_moderators'
      AND column_name = 'branch_hid'
      AND data_type = 'text'
    ) THEN '✅ branch_moderators has branch_hid TEXT'
    ELSE '❌ branch_moderators missing branch_hid TEXT (migration 008 not deployed)'
  END as branch_moderators_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_name = 'get_user_permissions_summary'
    ) THEN '✅ get_user_permissions_summary exists'
    ELSE '❌ get_user_permissions_summary missing'
  END as permission_summary_status;

-- =====================================================
-- INTERPRETATION GUIDE
-- =====================================================
--
-- ✅ SAFE TO DEPLOY if:
--   - suggestion_blocks has blocked_user_id column
--   - branch_moderators has branch_hid TEXT column
--   - No critical errors shown above
--
-- ⚠️ RISKY if:
--   - Multiple versions of same function exist
--   - Schema columns missing
--
-- ❌ DO NOT DEPLOY if:
--   - suggestion_blocks has user_id (not blocked_user_id)
--   - branch_moderators has branch_root_id UUID (not branch_hid TEXT)
--   - Error messages shown above
-- =====================================================
