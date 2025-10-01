-- =====================================================
-- REMOVE OLD PERMISSION SYSTEM
-- =====================================================
-- This script safely removes the old permission system
-- before deploying v4.2. Run this BEFORE migration 007.
--
-- IMPORTANT: This will DROP all old permission tables and functions!
-- Make sure you have a backup even though tables are empty.
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: DROP OLD POLICIES FIRST
-- =====================================================

-- Drop policies on profile_edit_suggestions
DROP POLICY IF EXISTS "Users can view their own suggestions" ON profile_edit_suggestions;
DROP POLICY IF EXISTS "Admins can view all suggestions" ON profile_edit_suggestions;
DROP POLICY IF EXISTS "Users can create suggestions" ON profile_edit_suggestions;
DROP POLICY IF EXISTS "Profile owners can view suggestions" ON profile_edit_suggestions;
DROP POLICY IF EXISTS "Submitters can view their suggestions" ON profile_edit_suggestions;

-- Drop policies on profile_link_requests
DROP POLICY IF EXISTS "Users can view their own link requests" ON profile_link_requests;
DROP POLICY IF EXISTS "Admins can view all link requests" ON profile_link_requests;
DROP POLICY IF EXISTS "Users can create link requests" ON profile_link_requests;

-- =====================================================
-- STEP 2: DROP OLD FUNCTIONS
-- =====================================================

-- Drop suggestion management functions
DROP FUNCTION IF EXISTS get_pending_suggestions() CASCADE;
DROP FUNCTION IF EXISTS approve_suggestion(UUID) CASCADE;
DROP FUNCTION IF EXISTS approve_suggestion(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS reject_suggestion(UUID) CASCADE;
DROP FUNCTION IF EXISTS reject_suggestion(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_edit_suggestion(UUID, TEXT, JSONB, TEXT) CASCADE;

-- Drop link request functions
DROP FUNCTION IF EXISTS get_pending_link_requests() CASCADE;
DROP FUNCTION IF EXISTS approve_link_request(UUID) CASCADE;
DROP FUNCTION IF EXISTS reject_link_request(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_link_request(TEXT, TEXT, TEXT) CASCADE;

-- Drop role management functions
DROP FUNCTION IF EXISTS grant_admin_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS revoke_admin_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS grant_moderator_role(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS revoke_moderator_role(UUID) CASCADE;

-- Drop search functions
DROP FUNCTION IF EXISTS super_admin_search_by_name_chain(TEXT) CASCADE;
DROP FUNCTION IF EXISTS search_profiles_by_name_chain(TEXT) CASCADE;

-- Drop any helper functions
DROP FUNCTION IF EXISTS check_admin_permission() CASCADE;
DROP FUNCTION IF EXISTS check_super_admin_permission() CASCADE;
DROP FUNCTION IF EXISTS can_edit_profile(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_profile_permissions(UUID) CASCADE;

-- =====================================================
-- STEP 3: DROP OLD TABLES
-- =====================================================

-- Drop tables (CASCADE will drop any remaining dependencies)
DROP TABLE IF EXISTS profile_edit_suggestions CASCADE;
DROP TABLE IF EXISTS profile_link_requests CASCADE;

-- =====================================================
-- STEP 4: CLEAN UP OLD COLUMNS (if they exist)
-- =====================================================

-- Remove old permission-related columns that v4.2 doesn't need
-- These may have been added but are not part of v4.2 design
ALTER TABLE profiles DROP COLUMN IF EXISTS can_edit;
ALTER TABLE profiles DROP COLUMN IF EXISTS is_moderator;
ALTER TABLE profiles DROP COLUMN IF EXISTS moderated_branch;

-- =====================================================
-- STEP 5: VERIFY CLEANUP
-- =====================================================

-- Check that old tables are gone
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('profile_edit_suggestions', 'profile_link_requests');

  IF table_count > 0 THEN
    RAISE EXCEPTION 'Old tables still exist! Cleanup failed.';
  END IF;

  RAISE NOTICE 'Old permission system successfully removed';
END $$;

-- Check that old functions are gone
DO $$
DECLARE
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN (
    'get_pending_suggestions',
    'approve_suggestion',
    'reject_suggestion',
    'get_pending_link_requests',
    'approve_link_request',
    'reject_link_request'
  );

  IF function_count > 0 THEN
    RAISE EXCEPTION 'Old functions still exist! Cleanup failed.';
  END IF;

  RAISE NOTICE 'Old functions successfully removed';
END $$;

-- =====================================================
-- STEP 6: FINAL STATUS REPORT
-- =====================================================

-- Show what remains in the database
SELECT
  'Cleanup Complete' as status,
  NOW() as completed_at,
  (SELECT COUNT(*) FROM profiles WHERE role IN ('admin', 'super_admin')) as admins_preserved,
  (SELECT COUNT(*) FROM profiles) as total_profiles;

COMMIT;

-- =====================================================
-- CLEANUP SUCCESSFUL
-- =====================================================
-- The old permission system has been removed.
-- You can now safely deploy v4.2 using migration 007.
--
-- Next step:
-- node scripts/execute-sql.js migrations/007_permission_system_v4_deployment.sql
-- =====================================================