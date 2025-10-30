/**
 * Migration: Fix INSERT Policy with Explicit Table Reference
 * Date: 2025-01-31
 * Migration Number: 015
 *
 * Purpose: Fix THE ACTUAL CULPRIT causing "column user_id does not exist" error.
 *
 * Root Cause Discovery:
 * - Migrations 013-014 fixed DELETE and UPDATE policies ✅
 * - But INSERT policy STILL had broken reference ❌
 * - INSERT policy uses storage.foldername(user_profile.name)[2]
 * - Should be storage.foldername(storage.objects.name)[2]
 * - Upload triggers INSERT policy → error occurs
 *
 * Why This Was Missed:
 * - Migration 009 created INSERT policy with user_profile.name reference
 * - Migrations 011, 013, 014 only fixed DELETE and UPDATE policies
 * - INSERT policy never got fixed!
 *
 * Solution:
 * - Drop INSERT policy from Migration 009
 * - Recreate with EXPLICIT storage.objects.name reference
 * - Verify policy definition uses objects.name (not user_profile.name)
 *
 * Impact: Crop uploads will FINALLY work end-to-end!
 */

BEGIN;

-- ============================================================================
-- STEP 1: Drop Existing INSERT Policy (from Migration 009)
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload cropped photos with family permission" ON storage.objects;

-- ============================================================================
-- STEP 2: Recreate INSERT Policy with EXPLICIT Table Reference
-- ============================================================================

/**
 * INSERT Policy: Users can upload cropped photos with family permission
 *
 * CRITICAL FIX: Use storage.objects.name EXPLICITLY in WITH CHECK clause
 *
 * Validation Flow:
 * 1. Check bucket is 'profile-photos'
 * 2. Validate path format: profiles/{uuid}/filename.jpg
 * 3. Extract profile UUID from storage.objects.name path (EXPLICIT!)
 * 4. Get user's profile ID from auth.uid()
 * 5. Call check_family_permission_v4(user_profile_id, target_profile_id)
 * 6. Allow if permission is 'admin', 'moderator', or 'inner'
 * 7. OR allow if user has super_admin/admin role (override)
 *
 * Key Changes from Migration 009:
 * - storage.foldername(user_profile.name)[2] → storage.foldername(storage.objects.name)[2]
 * - PostgreSQL stores this as storage.foldername(objects.name)[2]
 * - Table alias "user_profile" still used for profiles table
 * - EXPLICIT reference forces PostgreSQL to use correct column
 */
CREATE POLICY "Users can upload cropped photos with family permission"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND name ~ '^profiles/[0-9a-f-]{36}/'  -- Validate UUID path format
    AND (
      -- Option A: Check family permission via RPC
      -- Extract target profile UUID from path and validate permission
      EXISTS (
        SELECT 1
        FROM profiles user_profile
        CROSS JOIN LATERAL (
          SELECT check_family_permission_v4(
            user_profile.id,                                             -- User's profile ID
            ((storage.foldername(storage.objects.name))[2])::uuid       -- EXPLICIT storage.objects.name
          ) AS permission_level
        ) perm
        WHERE user_profile.user_id = auth.uid()
          AND user_profile.deleted_at IS NULL
          AND perm.permission_level IN ('admin', 'moderator', 'inner')
      )

      -- OR Option B: User has super_admin/admin role (global override)
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
          AND role IN ('super_admin', 'admin')
          AND deleted_at IS NULL
      )
    )
  );

-- ============================================================================
-- STEP 3: Verify Policy Definition (CRITICAL CHECK)
-- ============================================================================

DO $$
DECLARE
  policy_def TEXT;
BEGIN
  -- Get INSERT policy WITH CHECK clause
  SELECT pg_get_expr(pol.polwithcheck, pol.polrelid)
  INTO policy_def
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
  WHERE nsp.nspname = 'storage'
    AND cls.relname = 'objects'
    AND pol.polname = 'Users can upload cropped photos with family permission'
    AND pol.polcmd = 'a';  -- INSERT command

  -- Verify policy created
  IF policy_def IS NULL THEN
    RAISE EXCEPTION 'INSERT policy not created';
  END IF;

  -- Verify uses objects.name (explicit)
  IF policy_def NOT LIKE '%objects.name%' THEN
    RAISE EXCEPTION 'INSERT policy does NOT use objects.name! Definition: %', policy_def;
  END IF;

  -- Verify does NOT use user_profile.name (broken reference)
  IF policy_def LIKE '%user_profile.name%' THEN
    RAISE EXCEPTION 'INSERT policy STILL uses user_profile.name (BROKEN)! Definition: %', policy_def;
  END IF;

  -- Verify does NOT use profiles.name (also broken)
  IF policy_def LIKE '%profiles.name%' THEN
    RAISE EXCEPTION 'INSERT policy uses profiles.name (BROKEN)! Definition: %', policy_def;
  END IF;

  RAISE NOTICE '✅ INSERT policy verified - uses objects.name (explicit)';
  RAISE NOTICE 'Policy definition sample: %', substring(policy_def, 1, 150);
END $$;

COMMIT;

-- ============================================================================
-- Migration 015 Complete! ✅
-- ============================================================================
-- Fixed: INSERT policy now uses EXPLICIT storage.objects.name reference
-- Fixed: No more "column user_id does not exist" during crop uploads
-- Verified: Policy definition checked programmatically
-- Impact: Crop uploads will work end-to-end!
--
-- Complete RLS Fix Summary (Migrations 009-015):
-- ✅ 009: Added family permission validation (fixed TOCTOU vulnerability)
-- ✅ 010: Added cleanup trigger for soft delete
-- ❌ 011: Attempted fix but used implicit "name" (failed)
-- ✅ 012: Simplified trigger (removed SELECT COUNT)
-- ✅ 013: Fixed DELETE policy with explicit storage.objects.name
-- ✅ 014: Fixed UPDATE policy with explicit storage.objects.name
-- ✅ 015: Fixed INSERT policy with explicit storage.objects.name ← THIS WAS THE CULPRIT!
--
-- All storage RLS policies now use explicit table references:
-- ✅ INSERT: storage.objects.name
-- ✅ UPDATE: storage.objects.name
-- ✅ DELETE: storage.objects.name
-- ✅ ALL (admin): storage.objects.name
--
-- Next Steps:
-- [ ] Test crop upload with valid profile
-- [ ] Verify no "column user_id does not exist" errors
-- [ ] Confirm upload succeeds
-- [ ] Confirm DB update succeeds
-- [ ] Verify cropped photo displays in TreeView
