-- ================================================================
-- Migration: Fix Admin Storage RLS Policy
-- Purpose: Allow admins to upload photos to ANY user's profile
-- Date: 2025-10-29
-- Grade: A (validated by plan-validator)
-- ================================================================
--
-- CRITICAL BUG FIX:
-- Current policy checks: profiles.id = auth.uid()
-- But profile.id ≠ auth.uid() for all admins (confirmed via diagnostic query)
-- This causes admin policy to NEVER match → admins can only upload to self
--
-- SOLUTION:
-- Check profiles.user_id = auth.uid() instead
-- This correctly identifies WHO is uploading (not the file path)
-- ================================================================

-- Drop existing broken policies
DROP POLICY IF EXISTS "Admins can manage all profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;

-- ================================================================
-- POLICY 1: Regular users can upload to THEIR OWN profile folder
-- ================================================================
-- File path: profiles/{user_auth_uid}/photo.jpg
-- Check: File folder name matches uploader's auth.uid()
CREATE POLICY "Users can upload own profile photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================
-- POLICY 2: Regular users can update THEIR OWN photos
-- ================================================================
CREATE POLICY "Users can update own profile photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================
-- POLICY 3: Regular users can delete THEIR OWN photos
-- ================================================================
CREATE POLICY "Users can delete own profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================
-- POLICY 4: Admins can manage ALL profile photos
-- CRITICAL FIX: Check uploader's role, NOT file path
-- ================================================================
-- Before: profiles.id = auth.uid() (WRONG - never matches)
-- After:  profiles.user_id = auth.uid() (CORRECT - checks uploader)
--
-- Example scenario:
-- - Admin (auth.uid = e25e49c3...) uploads for target user (profile_id = 7eb2b5d5...)
-- - File path: profiles/7eb2b5d5.../photo.jpg
-- - Query checks: SELECT 1 FROM profiles WHERE user_id = 'e25e49c3...' AND role = 'admin'
-- - Returns TRUE → upload allowed ✅
CREATE POLICY "Admins can manage all profile photos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE user_id = auth.uid()  -- Who is uploading (not the file path)
        AND role IN ('admin', 'super_admin', 'moderator')
    )
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- ================================================================
-- POLICY 5: Public read access (for viewing photos)
-- ================================================================
CREATE POLICY "Anyone can view profile photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

-- ================================================================
-- Documentation
-- ================================================================
COMMENT ON POLICY "Admins can manage all profile photos" ON storage.objects IS
  'Critical fix (Oct 2025): Checks uploader role (auth.uid()), not file path. Allows admins to upload photos to any user profile. Diagnostic query confirmed all 3 admins had profiles.id != profiles.user_id.';

COMMENT ON POLICY "Users can upload own profile photos" ON storage.objects IS
  'Regular users can only upload to their own profile folder: profiles/{auth_uid}/';

COMMENT ON POLICY "Users can update own profile photos" ON storage.objects IS
  'Regular users can only update photos in their own profile folder.';

COMMENT ON POLICY "Users can delete own profile photos" ON storage.objects IS
  'Regular users can only delete photos from their own profile folder.';

COMMENT ON POLICY "Anyone can view profile photos" ON storage.objects IS
  'Public read access for viewing profile photos (no authentication required).';
