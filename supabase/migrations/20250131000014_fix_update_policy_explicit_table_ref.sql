/**
 * Migration: Fix UPDATE Policy with Explicit Table Reference
 * Date: 2025-01-31
 * Migration Number: 014
 *
 * Purpose: Complete the RLS fix by updating UPDATE policy to use explicit table references.
 *
 * Context:
 * - Migration 013 fixed DELETE policy with explicit storage.objects.name reference
 * - UPDATE policy (from Migration 009) has same implicit reference issue
 * - Uses "name" which could resolve to profiles.name instead of storage.objects.name
 * - Must fix for consistency and to prevent future ambiguity errors
 *
 * Solution:
 * - Drop old UPDATE policy from Migration 009
 * - Recreate with EXPLICIT storage.objects.name reference
 * - Apply to both USING clause (read check) and WITH CHECK clause (write check)
 * - Verify policy definition uses objects.name (not profiles.name)
 *
 * Impact: Consistent RLS policies across INSERT/UPDATE/DELETE operations.
 */

BEGIN;

-- ============================================================================
-- STEP 1: Drop Existing UPDATE Policy (from Migration 009)
-- ============================================================================

DROP POLICY IF EXISTS "Users can update cropped photos with family permission" ON storage.objects;

-- ============================================================================
-- STEP 2: Recreate UPDATE Policy with EXPLICIT Table Reference
-- ============================================================================

/**
 * UPDATE Policy: Users can update cropped photos with family permission
 *
 * CRITICAL FIX: Use storage.objects.name EXPLICITLY in both USING and WITH CHECK
 *
 * USING clause: Controls read access (must pass to see row)
 * WITH CHECK clause: Controls write access (must pass to update row)
 *
 * Validation Flow (both clauses):
 * 1. Check bucket is 'profile-photos'
 * 2. Extract profile UUID from storage.objects.name path
 * 3. Get user's profile ID from auth.uid()
 * 4. Call check_family_permission_v4(user_profile_id, target_profile_id)
 * 5. Allow if permission is 'admin', 'moderator', or 'inner'
 * 6. OR allow if user has super_admin/admin role (override)
 *
 * Key Changes from Migration 009:
 * - (storage.foldername(name))[2] → (storage.foldername(storage.objects.name))[2]
 * - PostgreSQL stores this as (storage.foldername(objects.name))[2]
 * - Table alias "user_profile" for profiles to avoid ambiguity
 * - Explicit table.column references throughout
 */
CREATE POLICY "Users can update cropped photos with family permission"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
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
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND name ~ '^profiles/[0-9a-f-]{36}/'
    AND (
      EXISTS (
        SELECT 1
        FROM profiles user_profile
        CROSS JOIN LATERAL (
          SELECT check_family_permission_v4(
            user_profile.id,
            ((storage.foldername(storage.objects.name))[2])::uuid       -- EXPLICIT storage.objects.name
          ) AS permission_level
        ) perm
        WHERE user_profile.user_id = auth.uid()
          AND user_profile.deleted_at IS NULL
          AND perm.permission_level IN ('admin', 'moderator', 'inner')
      )
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
  policy_using TEXT;
  policy_with_check TEXT;
BEGIN
  -- Get UPDATE policy USING clause
  SELECT pg_get_expr(pol.polqual, pol.polrelid)
  INTO policy_using
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
  WHERE nsp.nspname = 'storage'
    AND cls.relname = 'objects'
    AND pol.polname = 'Users can update cropped photos with family permission'
    AND pol.polcmd = 'w';  -- UPDATE command

  -- Get UPDATE policy WITH CHECK clause
  SELECT pg_get_expr(pol.polwithcheck, pol.polrelid)
  INTO policy_with_check
  FROM pg_policy pol
  JOIN pg_class cls ON pol.polrelid = cls.oid
  JOIN pg_namespace nsp ON cls.relnamespace = nsp.oid
  WHERE nsp.nspname = 'storage'
    AND cls.relname = 'objects'
    AND pol.polname = 'Users can update cropped photos with family permission'
    AND pol.polcmd = 'w';

  -- Verify policy created
  IF policy_using IS NULL THEN
    RAISE EXCEPTION 'UPDATE policy not created';
  END IF;

  -- Verify USING clause uses objects.name (explicit)
  IF policy_using NOT LIKE '%objects.name%' THEN
    RAISE EXCEPTION 'UPDATE policy USING does NOT use objects.name! Definition: %', policy_using;
  END IF;

  IF policy_using LIKE '%profiles.name%' THEN
    RAISE EXCEPTION 'UPDATE policy USING STILL uses profiles.name (BROKEN)! Definition: %', policy_using;
  END IF;

  -- Verify WITH CHECK clause uses objects.name (explicit)
  IF policy_with_check NOT LIKE '%objects.name%' THEN
    RAISE EXCEPTION 'UPDATE policy WITH CHECK does NOT use objects.name! Definition: %', policy_with_check;
  END IF;

  IF policy_with_check LIKE '%profiles.name%' THEN
    RAISE EXCEPTION 'UPDATE policy WITH CHECK STILL uses profiles.name (BROKEN)! Definition: %', policy_with_check;
  END IF;

  RAISE NOTICE '✅ UPDATE policy verified - uses objects.name in both USING and WITH CHECK';
  RAISE NOTICE 'USING clause sample: %', substring(policy_using, 1, 100);
  RAISE NOTICE 'WITH CHECK clause sample: %', substring(policy_with_check, 1, 100);
END $$;

COMMIT;

-- ============================================================================
-- Migration 014 Complete! ✅
-- ============================================================================
-- Fixed: UPDATE policy now uses EXPLICIT storage.objects.name reference
-- Fixed: Both USING and WITH CHECK clauses use objects.name
-- Verified: Policy definition checked programmatically
-- Impact: Consistent RLS policies across all operations (INSERT/UPDATE/DELETE)
--
-- Complete RLS Fix Summary (Migrations 009-014):
-- ✅ 009: Added family permission validation (fixed TOCTOU)
-- ✅ 010: Added cleanup trigger for soft delete
-- ❌ 011: Attempted fix but used implicit "name" (failed)
-- ✅ 012: Simplified trigger (removed SELECT COUNT)
-- ✅ 013: Fixed DELETE policy with explicit storage.objects.name
-- ✅ 014: Fixed UPDATE policy with explicit storage.objects.name
--
-- Next Steps:
-- [ ] Test crop upload with valid profile
-- [ ] Verify no "column user_id does not exist" errors
-- [ ] Confirm cropped photo displays in TreeView
-- [ ] Verify cleanup trigger works on soft delete
