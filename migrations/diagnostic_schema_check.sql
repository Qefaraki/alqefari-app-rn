-- =====================================================
-- PERMISSION SYSTEM SCHEMA DIAGNOSTIC
-- =====================================================
-- Purpose: Determine the current state of branch_moderators table
-- Run this in Supabase SQL Editor to diagnose the schema conflict
-- =====================================================

-- Check 1: Does the table exist and what are its columns?
SELECT
  '=== BRANCH_MODERATORS TABLE STRUCTURE ===' as diagnostic_section;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'branch_moderators'
ORDER BY ordinal_position;

-- Check 2: What migrations have been deployed?
SELECT
  '=== DEPLOYED MIGRATIONS ===' as diagnostic_section;

SELECT
  version,
  name,
  executed_at
FROM migrations
WHERE version IN (5, 6, 7)
ORDER BY version;

-- Check 3: Are there any existing branch moderator assignments?
SELECT
  '=== EXISTING BRANCH MODERATOR DATA ===' as diagnostic_section;

SELECT
  COUNT(*) as total_assignments,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_assignments
FROM branch_moderators;

-- Check 4: Sample data (if any exists)
SELECT
  '=== SAMPLE BRANCH MODERATOR ASSIGNMENTS ===' as diagnostic_section;

SELECT
  bm.id,
  bm.user_id,
  u.name as user_name,
  bm.assigned_at,
  bm.is_active,
  -- Try to get the branch reference (will fail if column doesn't exist)
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'branch_moderators'
      AND column_name = 'branch_root_id'
    ) THEN 'UUID schema (branch_root_id exists)'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'branch_moderators'
      AND column_name = 'branch_hid'
    ) THEN 'TEXT schema (branch_hid exists)'
    ELSE 'Unknown schema'
  END as schema_type
FROM branch_moderators bm
LEFT JOIN profiles u ON bm.user_id = u.id
LIMIT 5;

-- Check 5: Profile Edit Suggestions table structure
SELECT
  '=== PROFILE_EDIT_SUGGESTIONS TABLE ===' as diagnostic_section;

SELECT
  COUNT(*) as total_suggestions,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'auto_approved' THEN 1 END) as auto_approved_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
FROM profile_edit_suggestions;

-- Check 6: Test check_family_permission_v4 function signature
SELECT
  '=== PERMISSION FUNCTION CHECK ===' as diagnostic_section;

SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) LIKE '%branch_hid%' as uses_branch_hid,
  pg_get_functiondef(oid) LIKE '%branch_root_id%' as uses_branch_root_id
FROM pg_proc
WHERE proname IN (
  'check_family_permission_v4',
  'assign_branch_moderator',
  'super_admin_assign_branch_moderator'
);

-- Check 7: Suggestion blocks table
SELECT
  '=== SUGGESTION BLOCKS ===' as diagnostic_section;

SELECT
  COUNT(*) as total_blocks,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_blocks
FROM suggestion_blocks;

-- =====================================================
-- DIAGNOSIS INTERPRETATION GUIDE
-- =====================================================
--
-- SCENARIO A: UUID Schema (Migration 005/006)
-- - branch_moderators.branch_root_id exists (UUID type)
-- - Functions use branch_root_id parameter
-- - ISSUE: Can't use HID pattern matching (e.g., WHERE hid LIKE '12%')
-- - FIX NEEDED: Migrate to TEXT schema
--
-- SCENARIO B: TEXT Schema (Migration 007)
-- - branch_moderators.branch_hid exists (TEXT type)
-- - Functions use HID pattern matching
-- - STATUS: ✅ Correct schema
-- - ACTION: Continue with UI implementation
--
-- SCENARIO C: Mixed/Broken State
-- - Table has UUID but functions expect TEXT (or vice versa)
-- - STATUS: 🚨 Critical - Functions will fail
-- - FIX NEEDED: Emergency schema migration
-- =====================================================
