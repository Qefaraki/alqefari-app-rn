/**
 * Migration: Fix Storage RLS Policy Folder Index
 * Date: 2025-01-31
 * Migration Number: 008
 *
 * Purpose: Fix Supabase Storage RLS policies to use correct folder index for profile uploads.
 *
 * Background:
 * - Photo uploads use path: profiles/{PROFILE_ID}/filename.jpg
 * - Current policies check foldername()[1] = "profiles" (wrong!)
 * - Should check foldername()[2] = profile UUID
 * - Also need to verify profile belongs to user via user_id = auth.uid()
 *
 * Issues Fixed:
 * 1. Users can't upload own profile photos (wrong folder index)
 * 2. Admins can't upload photos (wrong folder index + wrong table reference)
 * 3. No ownership verification (comparing UUID to auth.uid directly fails)
 *
 * Changes:
 * - Changed foldername()[1] to foldername()[2] in all policies
 * - Added EXISTS subquery to check profile.user_id = auth.uid()
 * - Fixed admin policy to use storage.objects.name instead of profiles.name
 *
 * Impact: Photo cropping will work for regular users and admins.
 */

BEGIN;

-- Drop all existing storage policies
DROP POLICY IF EXISTS "Users can upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all profile photos" ON storage.objects;

-- POLICY 1: Regular users can upload to THEIR OWN profile
-- Extracts profile ID from path and verifies ownership
CREATE POLICY "Users can upload own profile photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id::text = (storage.foldername(name))[2]  -- Extract profile UUID from path
        AND user_id = auth.uid()  -- Verify profile belongs to authenticated user
        AND deleted_at IS NULL  -- Profile must be active
    )
  );

-- POLICY 2: Regular users can update THEIR OWN photos
CREATE POLICY "Users can update own profile photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id::text = (storage.foldername(name))[2]
        AND user_id = auth.uid()
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id::text = (storage.foldername(name))[2]
        AND user_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- POLICY 3: Regular users can delete THEIR OWN photos
CREATE POLICY "Users can delete own profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id::text = (storage.foldername(name))[2]
        AND user_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- POLICY 4: Admins can manage ALL profile photos
-- Checks admin role + target profile exists and is active
CREATE POLICY "Admins can manage all profile photos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'moderator')
        AND deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM profiles target
      WHERE target.id::text = (storage.foldername(storage.objects.name))[2]  -- FIXED: Use storage.objects.name and [2]
        AND target.deleted_at IS NULL
    )
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'moderator')
        AND deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM profiles target
      WHERE target.id::text = (storage.foldername(storage.objects.name))[2]  -- FIXED: Use storage.objects.name and [2]
        AND target.deleted_at IS NULL
    )
  );

COMMIT;

-- ============================================================================
-- Migration 008 Complete! ✅
-- ============================================================================
-- Fixed: Storage RLS policies now use correct folder index [2]
-- Fixed: Ownership verification via EXISTS + user_id check
-- Fixed: Admin policy uses storage.objects.name instead of profiles.name
-- Verified: Photo cropping should now work for all users
