-- Test Script: Verify Kunya Field Implementation
-- Run this in Supabase SQL Editor to verify kunya is working

-- ============================================================================
-- TEST 1: Check if kunya column exists
-- ============================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'kunya';
-- Expected: Should return one row with column details

-- ============================================================================
-- TEST 2: Check if any profiles have kunya values
-- ============================================================================
SELECT
  COUNT(*) as total_profiles,
  COUNT(kunya) as profiles_with_kunya,
  COUNT(*) - COUNT(kunya) as profiles_without_kunya
FROM profiles
WHERE deleted_at IS NULL;
-- Expected: profiles_with_kunya > 0 if data is populated

-- ============================================================================
-- TEST 3: Find profiles with kunya values
-- ============================================================================
SELECT id, name, kunya, generation
FROM profiles
WHERE kunya IS NOT NULL
  AND deleted_at IS NULL
ORDER BY generation
LIMIT 10;
-- Expected: Should return profiles with kunya values

-- ============================================================================
-- TEST 4: Check specific test profiles
-- ============================================================================
SELECT id, name, kunya, hid
FROM profiles
WHERE name = 'علي'
  AND deleted_at IS NULL
LIMIT 5;
-- Expected: At least one علي should have kunya = 'أبو صالح'

SELECT id, name, kunya, hid
FROM profiles
WHERE name = 'A'
  AND deleted_at IS NULL
LIMIT 5;
-- Expected: Should have kunya = 'آبو تييب'

-- ============================================================================
-- TEST 5: Verify get_branch_data() returns kunya
-- ============================================================================
SELECT id, name, kunya, generation
FROM get_branch_data('1', 3, 100)
WHERE kunya IS NOT NULL
LIMIT 5;
-- Expected: Should return profiles with kunya field populated

-- ============================================================================
-- TEST 6: Verify search_name_chain() returns kunya
-- ============================================================================
SELECT id, name, kunya, name_chain
FROM search_name_chain(ARRAY['علي'], 10, 0)
WHERE kunya IS NOT NULL
LIMIT 5;
-- Expected: Should return matching profiles with kunya

-- ============================================================================
-- TEST 7: Check if علي profile ID has kunya
-- ============================================================================
SELECT id, name, kunya, hid, phone
FROM profiles
WHERE id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';
-- Expected: Should return علي with kunya = 'أبو صالح' (if populated)

-- ============================================================================
-- SAMPLE DATA: If kunya is NULL, use these to populate test profiles
-- ============================================================================

-- Uncomment to populate kunya for علي (super admin)
-- UPDATE profiles
-- SET kunya = 'أبو صالح', updated_at = NOW()
-- WHERE id = 'ff239ed7-24d5-4298-a135-79dc0f70e5b8';

-- Uncomment to populate kunya for A profile
-- UPDATE profiles
-- SET kunya = 'آبو تييب', updated_at = NOW()
-- WHERE id = '0c9d38ce-2db9-480d-958d-d2f3b78c58c6';

-- ============================================================================
-- RESULTS INTERPRETATION
-- ============================================================================

/*
SCENARIO A: Column exists, but all kunya values are NULL
- Migration 015 was deployed successfully
- But no kunya data has been entered
- FIX: Populate kunya values manually or via admin UI

SCENARIO B: Column doesn't exist
- Migration 015 was NOT deployed
- FIX: Deploy migration 015

SCENARIO C: Column exists, data populated, but app doesn't show it
- Database is correct
- Issue is in frontend (cache, rendering, data flow)
- FIX: Clear app cache, check console logs

SCENARIO D: get_branch_data() doesn't return kunya
- Migration 015 might have been deployed incorrectly
- RPC function signature doesn't include kunya
- FIX: Re-deploy migration 015
*/
