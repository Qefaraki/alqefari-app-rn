/**
 * Migration: Fix DELETE Policy with Explicit Table Reference
 * Date: 2025-01-31
 * Migration Number: 013
 *
 * Purpose: Fix CRITICAL "column user_id does not exist" error by using EXPLICIT table references.
 *
 * Root Cause:
 * - Migration 011 used implicit "name" reference in EXISTS subquery
 * - PostgreSQL resolved "name" to "profiles.name" instead of "storage.objects.name"
 * - This caused table ambiguity: "column user_id does not exist" (PostgreSQL error 42703)
 * - Migration 011 reported success but policy still showed storage.foldername(profiles.name)
 *
 * Why Implicit Failed:
 * - In EXISTS subquery with JOIN between storage.objects and profiles
 * - "name" is ambiguous - could be profiles.name OR storage.objects.name
 * - PostgreSQL chose wrong table (profiles.name)
 * - profiles.name is TEXT but we need storage.objects.name for path parsing
 *
 * Solution:
 * - Use EXPLICIT table reference: storage.objects.name
 * - PostgreSQL stores this as "objects.name" (using implicit table alias)
 * - Add table alias for profiles table (p) to avoid confusion
 * - Force PostgreSQL to use correct column
 *
 * Impact: Crop uploads will work - no more "column user_id does not exist" errors.
 */

BEGIN;

-- ============================================================================
-- STEP 1: Drop ALL DELETE Policies (Force Clean Slate)
-- ============================================================================

-- Drop user DELETE policy (broken reference)
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;

-- Drop admin DELETE policy if exists (we'll recreate comprehensive version)
DROP POLICY IF EXISTS "Admins can delete all profile photos" ON storage.objects;

-- ============================================================================
-- STEP 2: Recreate DELETE Policy with EXPLICIT Table Reference
-- ============================================================================

/**
 * DELETE Policy: Users can delete cropped photos with family permission
 *
 * CRITICAL FIX: Use storage.objects.name EXPLICITLY, not implicit "name"
 *
 * Validation Flow:
 * 1. Check bucket is 'profile-photos'
 * 2. Extract profile UUID from storage.objects.name path
 * 3. Verify extracted UUID matches a profile owned by authenticated user
 * 4. Verify profile is not soft-deleted
 *
 * Key Changes from Migration 011:
 * - storage.foldername(name)[2] → storage.foldername(storage.objects.name)[2]
 * - PostgreSQL stores this as storage.foldername(objects.name)[2]
 * - Added table alias "p" for profiles to avoid ambiguity
 * - Explicit table.column references throughout
 */
CREATE POLICY "Users can delete own profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[2]  -- EXPLICIT storage.objects.name
        AND p.user_id = auth.uid()                                       -- Profile belongs to authenticated user
        AND p.deleted_at IS NULL                                         -- Profile is active
    )
  );

-- ============================================================================
-- STEP 3: Recreate Admin DELETE Policy with Same Explicit References
-- ============================================================================

/**
 * Admin DELETE Policy: Super admins and admins can delete ALL profile photos
 *
 * Uses same explicit table reference pattern for consistency.
 */
CREATE POLICY "Admins can delete all profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles admin
      WHERE admin.user_id = auth.uid()
        AND admin.role IN ('admin', 'super_admin', 'moderator')
        AND admin.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM profiles target
      WHERE target.id::text = (storage.foldername(storage.objects.name))[2]  -- EXPLICIT
        AND target.deleted_at IS NULL
    )
  );

-- ============================================================================
-- STEP 4: Verify Policy Definitions (CRITICAL CHECK)
-- ============================================================================

DO $$
DECLARE
  user_policy_def TEXT;
  admin_policy_def TEXT;
BEGIN
  -- Get user DELETE policy definition
  SELECT pg_get_expr(pol.polqual, pol.polrelid)
  INTO user_policy_def
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
  WHERE nsp.nspname = 'storage'
    AND cls.relname = 'objects'
    AND pol.polname = 'Users can delete own profile photos'
    AND pol.polcmd = 'd';  -- DELETE command

  -- Get admin DELETE policy definition
  SELECT pg_get_expr(pol.polqual, pol.polrelid)
  INTO admin_policy_def
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
  WHERE nsp.nspname = 'storage'
    AND cls.relname = 'objects'
    AND pol.polname = 'Admins can delete all profile photos'
    AND pol.polcmd = 'd';

  -- Verify user policy uses objects.name (explicit table alias)
  -- Note: PostgreSQL stores storage.objects.name as "objects.name" internally
  IF user_policy_def IS NULL THEN
    RAISE EXCEPTION 'User DELETE policy not created';
  END IF;

  IF user_policy_def NOT LIKE '%objects.name%' THEN
    RAISE EXCEPTION 'User DELETE policy does NOT use objects.name! Definition: %', user_policy_def;
  END IF;

  IF user_policy_def LIKE '%profiles.name%' THEN
    RAISE EXCEPTION 'User DELETE policy STILL uses profiles.name (BROKEN)! Definition: %', user_policy_def;
  END IF;

  -- Verify admin policy
  IF admin_policy_def IS NULL THEN
    RAISE EXCEPTION 'Admin DELETE policy not created';
  END IF;

  IF admin_policy_def NOT LIKE '%objects.name%' THEN
    RAISE EXCEPTION 'Admin DELETE policy does NOT use objects.name! Definition: %', admin_policy_def;
  END IF;

  RAISE NOTICE '✅ User DELETE policy verified - uses objects.name (explicit)';
  RAISE NOTICE '✅ Admin DELETE policy verified - uses objects.name (explicit)';
  RAISE NOTICE 'Policy definition: %', user_policy_def;
END $$;

COMMIT;

-- ============================================================================
-- Migration 013 Complete! ✅
-- ============================================================================
-- Fixed: DELETE policy now uses EXPLICIT storage.objects.name reference
-- Fixed: No more table ambiguity causing "column user_id does not exist"
-- Verified: Policy definition checked programmatically (shows objects.name)
-- Impact: Crop uploads will work without errors
--
-- Note: PostgreSQL stores storage.objects.name as "objects.name" internally
--       This is correct - "objects" is the implicit table alias for storage.objects
--
-- Testing:
-- [ ] Crop upload succeeds without "column user_id does not exist"
-- [ ] DB update succeeds
-- [ ] Cropped photo displays in app
-- [ ] No rollback triggered
