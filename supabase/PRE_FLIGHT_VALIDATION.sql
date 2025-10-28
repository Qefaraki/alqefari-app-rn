-- Pre-Flight Validation for get_branch_data() Migration
-- Run this in Supabase SQL Editor BEFORE applying migration 20251028000005
-- Date: 2025-10-28

-- ============================================================================
-- CHECK 1: Verify crop fields exist in profiles table
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('original_photo_url', 'crop_metadata', 'crop_top', 'crop_bottom', 'crop_left', 'crop_right')
ORDER BY column_name;

-- EXPECTED: 6 rows
-- IF < 6 rows → STOP (crop fields missing from profiles table)

-- ============================================================================
-- CHECK 2: Verify version field exists
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'version';

-- EXPECTED: 1 row (version INT)
-- IF 0 rows → STOP (version field missing - batch operations will fail)

-- ============================================================================
-- CHECK 3: Check for dependent objects (CASCADE impact)
-- ============================================================================
SELECT COUNT(*) as dependent_count
FROM pg_depend
WHERE refobjid = 'get_branch_data'::regproc;

-- EXPECTED: 0-2 dependencies
-- IF > 5 → WARN (CASCADE will drop multiple objects)

-- ============================================================================
-- CHECK 4: Get current function signature
-- ============================================================================
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as current_arguments
FROM pg_proc p
WHERE p.proname = 'get_branch_data';

-- EXPECTED: Show current signature (likely broken UUID signature)
-- This confirms what we're replacing

-- ============================================================================
-- CHECK 5: Get current function body for rollback
-- ============================================================================
SELECT pg_get_functiondef(oid) as current_function_body
FROM pg_proc
WHERE proname = 'get_branch_data'
LIMIT 1;

-- EXPECTED: Full function definition
-- COPY THIS OUTPUT to migration file's rollback comment

-- ============================================================================
-- VALIDATION RESULTS
-- ============================================================================

-- ✅ GO CONDITIONS:
--   - Check 1: Returns 6 rows (all crop fields exist)
--   - Check 2: Returns 1 row (version field exists)
--   - Check 3: Returns < 5 (minimal CASCADE impact)
--   - Check 4: Returns function signature (any signature)
--   - Check 5: Returns complete function body

-- ❌ NO-GO CONDITIONS:
--   - Check 1: < 6 rows → Crop fields missing
--   - Check 2: 0 rows → Version field missing
--   - Check 3: > 10 → High CASCADE risk

-- After running these checks, report results to Claude Code
