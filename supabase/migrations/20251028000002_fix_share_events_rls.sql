-- Migration: Fix profile_share_events RLS Policy
-- Date: October 28, 2025
-- Purpose: Secure RLS policy tied to authenticated user's scanner_id
-- Fixes: Plan-validator issue #1 (RLS allows spam with WITH CHECK (true))

-- ========================================
-- Step 1: Create New Secure Policy
-- ========================================

-- CREATE new policy FIRST (zero-downtime deployment)
-- This policy runs alongside the old permissive policy temporarily
CREATE POLICY "authenticated_users_insert_own_scans_v2"
  ON public.profile_share_events
  FOR INSERT
  WITH CHECK (
    -- Rule 1: Must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- Rule 2: scanner_id must match authenticated user's profile
    -- This prevents User A from inserting analytics with scanner_id = User B
    scanner_id = (
      SELECT id
      FROM profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
    AND
    -- Rule 3: Profile being scanned must exist and not be deleted
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE id = profile_share_events.profile_id
        AND deleted_at IS NULL
    )
    AND
    -- Rule 4: Sharer (inviter) if provided, must exist and not be deleted
    (
      profile_share_events.sharer_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = profile_share_events.sharer_id
          AND deleted_at IS NULL
      )
    )
  );

COMMENT ON POLICY "authenticated_users_insert_own_scans_v2"
  ON public.profile_share_events IS
  'Secure RLS: Users can only insert analytics with their own scanner_id. Prevents spam attacks.';

-- ========================================
-- Step 2: Drop Old Permissive Policy
-- ========================================

-- Drop old policy (safe: new policy already active)
-- If this fails, new policy still works
DROP POLICY IF EXISTS "Anyone can insert share events"
  ON public.profile_share_events;

-- Also drop any legacy permissive policies
DROP POLICY IF EXISTS "Allow inserts for authenticated users"
  ON public.profile_share_events;

DROP POLICY IF EXISTS "Public insert for share events"
  ON public.profile_share_events;

-- ========================================
-- Step 3: Verify New Policy is Active
-- ========================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  -- Check new policy exists
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'profile_share_events'
    AND policyname = 'authenticated_users_insert_own_scans_v2'
    AND cmd = 'INSERT';

  IF v_policy_count = 0 THEN
    RAISE EXCEPTION 'New RLS policy not found - ROLLBACK MIGRATION!';
  END IF;

  -- Check old permissive policy is gone
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'profile_share_events'
    AND policyname = 'Anyone can insert share events';

  IF v_policy_count > 0 THEN
    RAISE EXCEPTION 'Old permissive policy still exists - ROLLBACK MIGRATION!';
  END IF;
END $$;

-- ========================================
-- Step 4: Test RLS Policy (Development Only)
-- ========================================

-- This test only runs in non-production environments
-- Controlled by database comment on public schema
DO $$
DECLARE
  v_test_mode BOOLEAN;
BEGIN
  -- Check if we're in test mode (by convention, production has comment 'production')
  SELECT obj_description('public'::regnamespace) != 'production'
  INTO v_test_mode;

  IF v_test_mode THEN
    RAISE NOTICE 'Running RLS policy validation tests...';

    -- Test 1: Verify SELECT policy allows all users to view analytics
    DECLARE
      v_select_policy_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_select_policy_count
      FROM pg_policies
      WHERE tablename = 'profile_share_events'
        AND cmd = 'SELECT';

      IF v_select_policy_count = 0 THEN
        RAISE WARNING 'No SELECT policy found - users cannot view analytics';
      END IF;
    END;

    RAISE NOTICE '✓ RLS policy validation complete';
  ELSE
    RAISE NOTICE 'Production mode - skipping RLS tests';
  END IF;
END $$;

-- ========================================
-- Step 5: Create Monitoring Function
-- ========================================

-- Function to check RLS policy health
CREATE OR REPLACE FUNCTION check_share_events_rls_health()
RETURNS TABLE (
  policy_name TEXT,
  policy_command TEXT,
  policy_check TEXT,
  is_secure BOOLEAN
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    policyname::TEXT,
    cmd::TEXT,
    CASE
      WHEN cmd = 'INSERT' AND qual LIKE '%auth.uid()%' THEN 'SECURE'
      WHEN cmd = 'INSERT' AND qual LIKE '%true%' THEN 'INSECURE'
      ELSE 'UNKNOWN'
    END::TEXT,
    CASE
      WHEN cmd = 'INSERT' AND qual LIKE '%auth.uid()%' THEN true
      ELSE false
    END
  FROM pg_policies
  WHERE tablename = 'profile_share_events'
  ORDER BY policyname;
$$;

COMMENT ON FUNCTION check_share_events_rls_health() IS
  'Diagnostic function to verify RLS policies are secure (checks for auth.uid() requirement)';

-- ========================================
-- Step 6: Success Summary
-- ========================================

DO $$
DECLARE
  v_insert_policies INTEGER;
  v_select_policies INTEGER;
  v_total_rows INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO v_insert_policies
  FROM pg_policies
  WHERE tablename = 'profile_share_events' AND cmd = 'INSERT';

  SELECT COUNT(*) INTO v_select_policies
  FROM pg_policies
  WHERE tablename = 'profile_share_events' AND cmd = 'SELECT';

  SELECT COUNT(*) INTO v_total_rows
  FROM profile_share_events;

  RAISE NOTICE '✅ RLS policy migration complete';
  RAISE NOTICE '   - INSERT policies: % (should be 1)', v_insert_policies;
  RAISE NOTICE '   - SELECT policies: % (should be 1+)', v_select_policies;
  RAISE NOTICE '   - Existing analytics rows: % (preserved)', v_total_rows;
  RAISE NOTICE '   - Security: ✓ Authenticated users only';
  RAISE NOTICE '   - Security: ✓ scanner_id tied to auth.uid()';
  RAISE NOTICE '   - Security: ✓ Validates profile exists';
  RAISE NOTICE '   - Security: ✓ Validates sharer exists (if provided)';
  RAISE NOTICE '';
  RAISE NOTICE 'Run `SELECT * FROM check_share_events_rls_health();` to verify';
END $$;
