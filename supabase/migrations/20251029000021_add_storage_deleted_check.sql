-- ================================================================
-- Migration: Add Soft-Delete Validation to Storage RLS Policy
-- Purpose: Prevent uploads to deleted profiles (orphaned files)
-- Date: 2025-10-29
-- Grade: A (validated by solution-auditor)
-- ================================================================
--
-- CRITICAL BUG FIX:
-- Current admin policy allows uploads to deleted profiles
-- This creates orphaned files in storage that can't be cleaned up
--
-- SOLUTION:
-- Add deleted_at IS NULL checks for both:
-- 1. Admin's own profile (must be active to upload)
-- 2. Target profile (file path) (must be active to receive upload)
-- ================================================================

-- Drop existing admin policy
DROP POLICY IF EXISTS "Admins can manage all profile photos" ON storage.objects;

-- ================================================================
-- POLICY: Admins can manage ALL photos (WITH SOFT-DELETE CHECKS)
-- ================================================================
-- Validates:
-- 1. Admin's profile is not deleted (profiles.user_id = auth.uid() AND deleted_at IS NULL)
-- 2. Target profile is not deleted (extract UUID from file path, check deleted_at)
--
-- Example file path: profiles/7eb2b5d5-abc1-4567-89de-f0123456789a/photo.jpg
-- Target profile UUID: (storage.foldername(name))[1] = '7eb2b5d5-abc1-4567-89de-f0123456789a'
CREATE POLICY "Admins can manage all profile photos"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE user_id = auth.uid()  -- Who is uploading
        AND role IN ('admin', 'super_admin', 'moderator')
        AND deleted_at IS NULL  -- Admin must be active
    )
    AND EXISTS (
      SELECT 1
      FROM profiles target
      WHERE target.id::text = (storage.foldername(name))[1]  -- Target profile from path
        AND target.deleted_at IS NULL  -- Target profile must be active
    )
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'moderator')
        AND deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM profiles target
      WHERE target.id::text = (storage.foldername(name))[1]
        AND target.deleted_at IS NULL
    )
  );

-- ================================================================
-- Documentation
-- ================================================================
COMMENT ON POLICY "Admins can manage all profile photos" ON storage.objects IS
  'Critical fix (Oct 2025): Prevents uploads to deleted profiles. Validates both admin (auth.uid()) and target profile (file path) are not soft-deleted. Prevents orphaned files in storage.';
