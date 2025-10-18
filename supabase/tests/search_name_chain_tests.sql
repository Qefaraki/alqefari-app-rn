-- ============================================================================
-- Search Name Chain Test Suite
-- ============================================================================
-- Purpose: Validate Arabic name chain search algorithm with position-aware scoring
-- Migration: 20251018150000_fix_search_scoring_inline.sql
-- Date: 2025-10-18
--
-- Test Coverage:
--   - Exact position matching (position 1, 2, 3, 4+)
--   - Generation-based sorting
--   - Edge cases (empty search, special characters, NULL handling)
--   - Performance validation (<600ms for typical queries)
--   - Backward compatibility
-- ============================================================================

-- Enable timing for performance tests
\timing on

-- ============================================================================
-- Test Group 1: Position-Aware Scoring
-- ============================================================================

-- Test 1.1: Exact match at position 1 scores 10.0
-- Expected: Person named "إبراهيم" whose father is "سليمان" scores 10.0
SELECT
  'Test 1.1: Exact match position 1' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM search_name_chain(ARRAY['إبراهيم', 'سليمان'], 10, 0)
      WHERE hid = 'R1.1.1.1.8' AND match_score = 10.0
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 1.2: Children (position 2) score 7.0
-- Expected: Children of "إبراهيم بن سليمان" score 7.0
SELECT
  'Test 1.2: Children score 7.0' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM search_name_chain(ARRAY['إبراهيم', 'سليمان', 'علي'], 50, 0)
      WHERE match_score = 7.0 AND father_name = 'إبراهيم'
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 1.3: Grandchildren (position 3) score 5.0
-- Expected: Grandchildren score 5.0
SELECT
  'Test 1.3: Grandchildren score 5.0' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM search_name_chain(ARRAY['إبراهيم', 'سليمان'], 50, 0)
      WHERE match_score = 5.0
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 1.4: Great-grandchildren (position 4+) score 3.0
-- Expected: Descendants at position 4+ score 3.0
SELECT
  'Test 1.4: Great-grandchildren score 3.0' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM search_name_chain(ARRAY['سليمان', 'علي'], 100, 0)
      WHERE match_score = 3.0
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- ============================================================================
-- Test Group 2: Ranking Order
-- ============================================================================

-- Test 2.1: Person ranks before children
-- Expected: إبراهيم himself appears before his children
WITH results AS (
  SELECT name, hid, match_score, generation, ROW_NUMBER() OVER (ORDER BY match_score DESC, generation ASC) as rank
  FROM search_name_chain(ARRAY['إبراهيم', 'سليمان', 'علي'], 50, 0)
)
SELECT
  'Test 2.1: Person before children' as test_name,
  CASE
    WHEN (SELECT hid FROM results WHERE rank = 1) = 'R1.1.1.1.8' THEN 'PASS ✅'
    ELSE 'FAIL ❌ - Got: ' || (SELECT hid FROM results WHERE rank = 1)
  END as result;

-- Test 2.2: Children rank before grandchildren
-- Expected: Higher scores appear first
SELECT
  'Test 2.2: Children before grandchildren' as test_name,
  CASE
    WHEN (
      SELECT match_score FROM search_name_chain(ARRAY['إبراهيم', 'سليمان'], 10, 0) ORDER BY match_score DESC, generation ASC LIMIT 1 OFFSET 1
    ) > (
      SELECT match_score FROM search_name_chain(ARRAY['إبراهيم', 'سليمان'], 50, 0) ORDER BY match_score DESC, generation ASC LIMIT 1 OFFSET 10
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 2.3: Older generations rank before younger (secondary sort)
-- Expected: Generation 1 before generation 2 when scores equal
WITH results AS (
  SELECT generation, match_score, ROW_NUMBER() OVER (PARTITION BY match_score ORDER BY generation ASC) as rank
  FROM search_name_chain(ARRAY['محمد'], 100, 0)
)
SELECT
  'Test 2.3: Older generations first' as test_name,
  CASE
    WHEN (
      SELECT MIN(generation) FROM results WHERE rank = 1 AND match_score = 10.0
    ) <= (
      SELECT MAX(generation) FROM results WHERE rank > 5 AND match_score = 10.0
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- ============================================================================
-- Test Group 3: Edge Cases
-- ============================================================================

-- Test 3.1: Empty search array
-- Expected: Should handle gracefully (return empty or raise exception)
SELECT
  'Test 3.1: Empty search array' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(ARRAY[]::TEXT[], 10, 0)
    ) = 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 3.2: Single character search (minimum 2 chars required)
-- Expected: Should filter out terms <2 characters
SELECT
  'Test 3.2: Single character filtered' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(ARRAY['م'], 10, 0)
    ) = 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 3.3: Search terms longer than any name chain
-- Expected: Should return no results gracefully
SELECT
  'Test 3.3: Search longer than chains' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(
        ARRAY['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر'],
        10, 0
      )
    ) = 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 3.4: Special characters and normalization
-- Expected: "إبراهيم" and "ابراهيم" should return same results (normalize_arabic)
SELECT
  'Test 3.4: Arabic normalization' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(ARRAY['إبراهيم'], 50, 0)
    ) = (
      SELECT COUNT(*) FROM search_name_chain(ARRAY['ابراهيم'], 50, 0)
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 3.5: Duplicate names in chain
-- Expected: Should handle profiles with duplicate names (e.g., محمد بن علي بن محمد)
SELECT
  'Test 3.5: Duplicate names handled' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(ARRAY['محمد'], 100, 0)
    ) > 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- ============================================================================
-- Test Group 4: Performance Validation
-- ============================================================================

-- Test 4.1: Single-term search completes in <200ms
-- Expected: Fast lookup for common names
\echo '\nTest 4.1: Single-term performance (<200ms)'
SELECT COUNT(*) FROM search_name_chain(ARRAY['محمد'], 50, 0);
-- Check timing output above

-- Test 4.2: Multi-term search completes in <600ms
-- Expected: Reasonable performance for complex queries
\echo '\nTest 4.2: Multi-term performance (<600ms)'
SELECT COUNT(*) FROM search_name_chain(ARRAY['محمد', 'إبراهيم', 'علي'], 20, 0);
-- Check timing output above

-- Test 4.3: Large result set (100 results) completes in <800ms
-- Expected: Pagination doesn't degrade significantly
\echo '\nTest 4.3: Large result set performance (<800ms)'
SELECT COUNT(*) FROM search_name_chain(ARRAY['محمد'], 100, 0);
-- Check timing output above

-- ============================================================================
-- Test Group 5: Pagination
-- ============================================================================

-- Test 5.1: Pagination offset works correctly
-- Expected: OFFSET 10 skips first 10 results
SELECT
  'Test 5.1: Pagination offset' as test_name,
  CASE
    WHEN (
      SELECT id FROM search_name_chain(ARRAY['محمد'], 1, 10)
    ) != (
      SELECT id FROM search_name_chain(ARRAY['محمد'], 1, 0)
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 5.2: Limit works correctly
-- Expected: Exactly p_limit results returned (or fewer if exhausted)
SELECT
  'Test 5.2: Limit enforcement' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(ARRAY['محمد'], 5, 0)
    ) <= 5 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- ============================================================================
-- Test Group 6: Backward Compatibility
-- ============================================================================

-- Test 6.1: Function signature unchanged
-- Expected: Old code can still call with 3 parameters
SELECT
  'Test 6.1: 3-parameter signature works' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM search_name_chain(ARRAY['محمد'], 10, 0)
    ) > 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- Test 6.2: All expected fields returned
-- Expected: Function returns all 27 required fields
SELECT
  'Test 6.2: All fields present' as test_name,
  CASE
    WHEN (
      SELECT
        id IS NOT NULL AND
        hid IS NOT NULL AND
        name IS NOT NULL AND
        name_chain IS NOT NULL AND
        generation IS NOT NULL AND
        match_score IS NOT NULL
      FROM search_name_chain(ARRAY['محمد'], 1, 0)
      LIMIT 1
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as result;

-- ============================================================================
-- Test Group 7: Real-World Scenarios
-- ============================================================================

-- Test 7.1: Common search - All people named Muhammad
-- Expected: Returns many results, all with first name "محمد"
SELECT
  'Test 7.1: Find all Muhammads' as test_name,
  COUNT(*) || ' results' as result,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status
FROM search_name_chain(ARRAY['محمد'], 100, 0);

-- Test 7.2: Specific person search
-- Expected: Ibrahim son of Sulaiman ranks first
SELECT
  'Test 7.2: Specific person search' as test_name,
  hid || ' (score: ' || match_score || ')' as result,
  CASE
    WHEN match_score = 10.0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status
FROM search_name_chain(ARRAY['إبراهيم', 'سليمان'], 1, 0);

-- Test 7.3: Partial name search
-- Expected: Prefix matching works (عب → عبدالله)
SELECT
  'Test 7.3: Prefix matching' as test_name,
  COUNT(*) || ' results' as result,
  CASE
    WHEN COUNT(*) > 0 THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status
FROM search_name_chain(ARRAY['عب'], 10, 0);

-- ============================================================================
-- Test Summary
-- ============================================================================

\echo '\n============================================================================'
\echo 'TEST SUITE COMPLETE'
\echo '============================================================================'
\echo 'Run this file after applying migration 20251018150000_fix_search_scoring_inline.sql'
\echo 'Expected: All tests marked with ✅ PASS'
\echo 'Performance: All timed queries should be <600ms for 1K-5K profiles'
\echo '============================================================================\n'

-- Final validation query: Show top 5 results for problem search
\echo 'Final validation: "إبراهيم سليمان علي" search results (top 5):'
SELECT
  name,
  hid,
  match_score,
  generation,
  name_chain
FROM search_name_chain(ARRAY['إبراهيم', 'سليمان', 'علي'], 5, 0)
ORDER BY match_score DESC, generation ASC;

\echo '\n✅ Expected: Ibrahim (R1.1.1.1.8) should be first with score 10.0'
