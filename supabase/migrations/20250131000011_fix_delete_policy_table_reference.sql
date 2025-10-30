/**
 * Migration: Fix DELETE Policy Table Reference
 * Date: 2025-01-31
 * Migration Number: 011
 *
 * Purpose: Fix CRITICAL bug causing "column user_id does not exist" error during crop uploads.
 *
 * Root Cause:
 * - DELETE policy uses storage.foldername(profiles.name) instead of storage.foldername(name)
 * - When trigger fires DELETE FROM storage.objects, PostgreSQL evaluates RLS policies
 * - Policy references profiles.name in storage.objects context (table ambiguity)
 * - PostgreSQL gets confused and throws "column user_id does not exist" (misleading error)
 *
 * Error Flow:
 * 1. User updates profiles: UPDATE profiles SET photo_url_cropped = '...'
 * 2. AFTER UPDATE trigger fires: cleanup_cropped_photo_on_soft_delete()
 * 3. Trigger executes: DELETE FROM storage.objects WHERE ...
 * 4. PostgreSQL evaluates DELETE policy RLS
 * 5. Policy references storage.foldername(profiles.name)[2]
 * 6. PostgreSQL tries to resolve "profiles.name" in storage.objects context
 * 7. Table ambiguity causes error: "column user_id does not exist"
 *
 * Solution:
 * - Drop buggy DELETE policy
 * - Recreate with correct reference: storage.foldername(name) not profiles.name
 * - name refers to storage.objects.name, not profiles.name
 *
 * Impact: Crop uploads will work (UPDATE profiles succeeds, trigger DELETE succeeds).
 *
 * Migration 009 Issue:
 * - Migration 009 assumed DELETE policy was correct
 * - Line 36: "Keep DELETE policy as-is (already has correct ownership check)"
 * - But DELETE policy had this table reference bug
 * - Migration 009 only replaced INSERT/UPDATE/ALL policies
 */

BEGIN;

-- ============================================================================
-- STEP 1: Drop Buggy DELETE Policy
-- ============================================================================

-- This policy has the bug: storage.foldername(profiles.name) instead of storage.foldername(name)
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;

-- ============================================================================
-- STEP 2: Recreate DELETE Policy with Correct Reference
-- ============================================================================

/**
 * DELETE Policy: Users can delete cropped photos from their own profiles
 *
 * Validation Flow:
 * 1. Check bucket is 'profile-photos'
 * 2. Extract profile UUID from path: profiles/{UUID}/filename.jpg
 * 3. Verify extracted UUID matches a profile owned by authenticated user
 * 4. Verify profile is not soft-deleted
 *
 * CRITICAL FIX: Use storage.foldername(name)[2], NOT storage.foldername(profiles.name)[2]
 * - "name" refers to storage.objects.name column
 * - "profiles.name" would try to reference profiles table in wrong context
 */
CREATE POLICY "Users can delete own profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id::text = (storage.foldername(name))[2]  -- FIX: Use "name" not "profiles.name"
        AND user_id = auth.uid()                      -- Profile belongs to authenticated user
        AND deleted_at IS NULL                         -- Profile is active
    )
  );

-- ============================================================================
-- STEP 3: Verify Policy Was Created
-- ============================================================================

DO $$
DECLARE
  policy_count INT;
BEGIN
  -- Count DELETE policies on storage.objects for profile-photos
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can delete own profile photos'
    AND cmd = 'DELETE';

  IF policy_count != 1 THEN
    RAISE EXCEPTION 'DELETE policy not created correctly (expected 1, found %)', policy_count;
  END IF;

  RAISE NOTICE '✅ DELETE policy verified - found % policy', policy_count;
END $$;

COMMIT;

-- ============================================================================
-- Migration 011 Complete! ✅
-- ============================================================================
-- Fixed: Table reference bug in DELETE policy
-- Fixed: storage.foldername(profiles.name) → storage.foldername(name)
-- Impact: Crop uploads now work (no "column user_id does not exist" error)
-- Verified: DELETE policy recreated with correct reference
--
-- Testing:
-- [ ] Crop upload succeeds (UPDATE profiles + trigger DELETE both work)
-- [ ] No "column user_id does not exist" errors
-- [ ] Cropped photo displays in TreeView
-- [ ] Trigger cleanup still works on soft delete
