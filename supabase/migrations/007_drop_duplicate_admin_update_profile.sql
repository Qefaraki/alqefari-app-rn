-- Migration 007: Drop duplicate admin_update_profile function
-- Issue: Two versions of admin_update_profile exist, causing version mismatch errors
-- Solution: Keep only the 3-argument version with version checking

-- Drop the old 2-argument version
DROP FUNCTION IF EXISTS admin_update_profile(uuid, jsonb) CASCADE;

-- Verify only one version remains (the 3-argument version)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'admin_update_profile';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 admin_update_profile function, found %', v_count;
  END IF;

  RAISE NOTICE '✅ Successfully cleaned up admin_update_profile - only 3-argument version remains';
END $$;
