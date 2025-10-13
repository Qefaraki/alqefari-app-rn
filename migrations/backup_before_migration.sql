-- =====================================================
-- FULL DATABASE BACKUP BEFORE SCHEMA MIGRATION
-- =====================================================
-- Purpose: Create backup tables of all permission-related data
-- Run this BEFORE executing the schema migration
-- =====================================================

BEGIN;

-- Backup 1: Branch Moderators
CREATE TABLE IF NOT EXISTS branch_moderators_backup_20250113 AS
SELECT * FROM branch_moderators;

SELECT
  '✅ Backed up branch_moderators:' as status,
  COUNT(*) as rows_backed_up
FROM branch_moderators_backup_20250113;

-- Backup 2: Profile Edit Suggestions
CREATE TABLE IF NOT EXISTS profile_edit_suggestions_backup_20250113 AS
SELECT * FROM profile_edit_suggestions;

SELECT
  '✅ Backed up profile_edit_suggestions:' as status,
  COUNT(*) as rows_backed_up
FROM profile_edit_suggestions_backup_20250113;

-- Backup 3: Suggestion Blocks
CREATE TABLE IF NOT EXISTS suggestion_blocks_backup_20250113 AS
SELECT * FROM suggestion_blocks;

SELECT
  '✅ Backed up suggestion_blocks:' as status,
  COUNT(*) as rows_backed_up
FROM suggestion_blocks_backup_20250113;

-- Backup 4: User Rate Limits (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_rate_limits'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS user_rate_limits_backup_20250113 AS SELECT * FROM user_rate_limits';
    RAISE NOTICE '✅ Backed up user_rate_limits';
  ELSE
    RAISE NOTICE 'ℹ️  user_rate_limits table does not exist - skipping';
  END IF;
END $$;

-- Backup 5: Profiles table (roles only)
CREATE TABLE IF NOT EXISTS profiles_roles_backup_20250113 AS
SELECT
  id,
  name,
  role,
  hid,
  father_id,
  mother_id,
  created_at,
  updated_at
FROM profiles
WHERE role IS NOT NULL OR hid IS NOT NULL;

SELECT
  '✅ Backed up profiles (roles & HID):' as status,
  COUNT(*) as rows_backed_up
FROM profiles_roles_backup_20250113;

-- Backup 6: All function definitions
CREATE TABLE IF NOT EXISTS function_definitions_backup_20250113 (
  function_name TEXT PRIMARY KEY,
  function_signature TEXT,
  function_definition TEXT,
  backed_up_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO function_definitions_backup_20250113 (
  function_name,
  function_signature,
  function_definition
)
SELECT
  proname,
  pg_get_function_arguments(oid),
  pg_get_functiondef(oid)
FROM pg_proc
WHERE proname IN (
  'check_family_permission_v4',
  'submit_edit_suggestion_v4',
  'approve_suggestion',
  'reject_suggestion',
  'auto_approve_suggestions_v4',
  'apply_profile_edit_v4',
  'notify_approvers_v4',
  'get_pending_suggestions_count',
  'block_user_suggestions',
  'unblock_user_suggestions',
  'assign_branch_moderator',
  'super_admin_assign_branch_moderator',
  'super_admin_remove_branch_moderator',
  'is_super_admin',
  'can_manage_permissions'
)
ON CONFLICT (function_name) DO UPDATE
SET
  function_signature = EXCLUDED.function_signature,
  function_definition = EXCLUDED.function_definition,
  backed_up_at = NOW();

SELECT
  '✅ Backed up function definitions:' as status,
  COUNT(*) as functions_backed_up
FROM function_definitions_backup_20250113;

-- Create backup metadata table
CREATE TABLE IF NOT EXISTS migration_backup_metadata (
  backup_id TEXT PRIMARY KEY,
  backup_date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  status TEXT DEFAULT 'completed'
);

INSERT INTO migration_backup_metadata (backup_id, description)
VALUES (
  '20250113_permission_system_migration',
  'Full backup before schema migration from UUID to TEXT for branch_moderators'
);

COMMIT;

-- =====================================================
-- BACKUP VERIFICATION
-- =====================================================

SELECT '========================================' as separator;
SELECT '📦 BACKUP SUMMARY' as title;
SELECT '========================================' as separator;

SELECT
  'branch_moderators' as table_name,
  COUNT(*) as original_rows,
  (SELECT COUNT(*) FROM branch_moderators_backup_20250113) as backup_rows,
  CASE
    WHEN COUNT(*) = (SELECT COUNT(*) FROM branch_moderators_backup_20250113)
    THEN '✅ VERIFIED'
    ELSE '❌ MISMATCH'
  END as status
FROM branch_moderators
UNION ALL
SELECT
  'profile_edit_suggestions',
  COUNT(*),
  (SELECT COUNT(*) FROM profile_edit_suggestions_backup_20250113),
  CASE
    WHEN COUNT(*) = (SELECT COUNT(*) FROM profile_edit_suggestions_backup_20250113)
    THEN '✅ VERIFIED'
    ELSE '❌ MISMATCH'
  END
FROM profile_edit_suggestions
UNION ALL
SELECT
  'suggestion_blocks',
  COUNT(*),
  (SELECT COUNT(*) FROM suggestion_blocks_backup_20250113),
  CASE
    WHEN COUNT(*) = (SELECT COUNT(*) FROM suggestion_blocks_backup_20250113)
    THEN '✅ VERIFIED'
    ELSE '❌ MISMATCH'
  END
FROM suggestion_blocks;

SELECT '========================================' as separator;
SELECT '✅ BACKUP COMPLETE' as status;
SELECT 'All data safely backed up to *_backup_20250113 tables' as message;
SELECT '========================================' as separator;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- If migration fails, restore data with:
--
-- BEGIN;
-- TRUNCATE branch_moderators CASCADE;
-- INSERT INTO branch_moderators SELECT * FROM branch_moderators_backup_20250113;
-- TRUNCATE profile_edit_suggestions CASCADE;
-- INSERT INTO profile_edit_suggestions SELECT * FROM profile_edit_suggestions_backup_20250113;
-- TRUNCATE suggestion_blocks CASCADE;
-- INSERT INTO suggestion_blocks SELECT * FROM suggestion_blocks_backup_20250113;
-- COMMIT;
--
-- Then restore function definitions from function_definitions_backup_20250113
-- =====================================================
