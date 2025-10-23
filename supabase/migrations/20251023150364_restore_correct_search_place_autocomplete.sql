-- Migration: Restore correct search_place_autocomplete function
-- Issue: Function was overwritten with broken version referencing non-existent columns
-- Error 42703: column ps.country does not exist
-- Error 42804: Type mismatches due to wrong return schema
-- Date: 2025-10-23
-- Author: System Recovery

-- ========================================
-- BACKUP: Store current broken function for rollback
-- ========================================
DO $$
BEGIN
  -- Log current function definition for audit trail
  RAISE NOTICE 'Backing up broken function definition to audit log...';

  -- Create backup table if not exists
  CREATE TABLE IF NOT EXISTS function_backups (
    backup_id SERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    function_signature TEXT NOT NULL,
    backed_up_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    definition TEXT
  );

  -- Store current definition (if exists)
  INSERT INTO function_backups (function_name, function_signature, reason, definition)
  SELECT
    'search_place_autocomplete',
    'search_place_autocomplete(TEXT, INTEGER)',
    'Pre-fix backup before restoring correct schema',
    pg_get_functiondef(oid::regprocedure)
  FROM pg_proc
  WHERE proname = 'search_place_autocomplete'
    AND pg_function_is_visible(oid)
  LIMIT 1;

  RAISE NOTICE 'Backup completed. Proceeding with fix...';
END $$;

-- ========================================
-- STEP 1: Validate data integrity
-- ========================================
DO $$
DECLARE
  v_orphaned_cities INT;
  v_cities_without_parent INT;
BEGIN
  -- Check for cities with non-existent parent_id
  SELECT COUNT(*) INTO v_orphaned_cities
  FROM place_standards ps
  WHERE ps.place_type = 'city'
    AND ps.parent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM place_standards parent
      WHERE parent.id = ps.parent_id
    );

  -- Check for cities without parent_id
  SELECT COUNT(*) INTO v_cities_without_parent
  FROM place_standards
  WHERE place_type = 'city' AND parent_id IS NULL;

  IF v_orphaned_cities > 0 THEN
    RAISE WARNING 'Found % cities with non-existent parent_id. Data integrity issue.', v_orphaned_cities;
  END IF;

  IF v_cities_without_parent > 0 THEN
    RAISE WARNING 'Found % cities without parent_id. These will show NULL country_name.', v_cities_without_parent;
  END IF;

  IF v_orphaned_cities = 0 AND v_cities_without_parent = 0 THEN
    RAISE NOTICE 'Data integrity check passed: All cities have valid parent references.';
  END IF;
END $$;

-- ========================================
-- STEP 2: Create required indexes (if missing)
-- ========================================

-- Index 1: Normalized Arabic search (critical for performance)
CREATE INDEX IF NOT EXISTS idx_place_standards_normalized_name
ON place_standards (normalize_arabic_text(place_name));

-- Index 2: Alternate names array search
CREATE INDEX IF NOT EXISTS idx_place_standards_alternate_names
ON place_standards USING GIN (alternate_names);

-- Index 3: Parent join optimization
CREATE INDEX IF NOT EXISTS idx_place_standards_parent_id
ON place_standards (parent_id)
WHERE parent_id IS NOT NULL;

-- Index 4: Composite index for ordering
CREATE INDEX IF NOT EXISTS idx_place_standards_display_order
ON place_standards (display_order, place_type);

RAISE NOTICE 'Indexes created/verified successfully.';

-- ========================================
-- STEP 3: Drop broken function
-- ========================================

-- Wait for any active queries to complete (max 5 seconds)
DO $$
DECLARE
  v_active_queries INT;
  v_wait_count INT := 0;
BEGIN
  LOOP
    SELECT COUNT(*) INTO v_active_queries
    FROM pg_stat_activity
    WHERE query LIKE '%search_place_autocomplete%'
      AND state = 'active'
      AND pid != pg_backend_pid();

    EXIT WHEN v_active_queries = 0 OR v_wait_count > 5;

    PERFORM pg_sleep(1);
    v_wait_count := v_wait_count + 1;
  END LOOP;

  IF v_active_queries > 0 THEN
    RAISE WARNING 'Dropping function with % active queries. May cause temporary errors.', v_active_queries;
  END IF;
END $$;

DROP FUNCTION IF EXISTS search_place_autocomplete(TEXT, INTEGER);

RAISE NOTICE 'Broken function dropped successfully.';

-- ========================================
-- STEP 4: Create corrected function
-- ========================================

CREATE OR REPLACE FUNCTION search_place_autocomplete(
  p_query TEXT,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id BIGINT,
  display_name TEXT,
  display_name_en TEXT,
  place_type TEXT,
  country_name TEXT,
  region TEXT,
  normalized_data JSONB
)
LANGUAGE plpgsql
STABLE  -- Function result doesn't change within transaction (enables caching)
PARALLEL SAFE  -- Can be used in parallel queries
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  -- GUARD 1: Empty/NULL query protection
  IF p_query IS NULL OR TRIM(p_query) = '' THEN
    RETURN;  -- Return empty result set
  END IF;

  -- GUARD 2: Limit bounds validation
  IF p_limit < 1 OR p_limit > 100 THEN
    p_limit := 8;  -- Reset to safe default
  END IF;

  -- Normalize query for Arabic matching
  v_normalized := normalize_arabic_text(p_query);

  -- GUARD 3: Normalization failure protection
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN;  -- Return empty result set
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.place_name AS display_name,
    ps.place_name_en AS display_name_en,
    ps.place_type,
    parent.place_name AS country_name,  -- NULL for countries, populated for cities
    ps.region,

    -- Build structured JSONB reference
    CASE
      WHEN ps.place_type = 'city' THEN
        jsonb_build_object(
          'original', ps.place_name,
          'city', jsonb_build_object(
            'ar', ps.place_name,
            'en', ps.place_name_en,
            'id', ps.id  -- Note: Stored as JSONB numeric, safe for < 2^53
          ),
          'country', jsonb_build_object(
            'ar', parent.place_name,
            'en', parent.place_name_en,
            'code', COALESCE(parent.country_code, 'XX'),  -- Fallback for invalid data
            'id', parent.id
          ),
          'confidence', CASE
            WHEN normalize_arabic_text(ps.place_name) = v_normalized THEN 1.0
            WHEN ps.place_name LIKE p_query || '%' THEN 0.8
            ELSE 0.5
          END
        )
      ELSE  -- Country
        jsonb_build_object(
          'original', ps.place_name,
          'country', jsonb_build_object(
            'ar', ps.place_name,
            'en', ps.place_name_en,
            'code', ps.country_code,
            'id', ps.id
          ),
          'confidence', CASE
            WHEN normalize_arabic_text(ps.place_name) = v_normalized THEN 1.0
            WHEN ps.place_name LIKE p_query || '%' THEN 0.8
            ELSE 0.5
          END
        )
    END AS normalized_data

  FROM place_standards ps
  LEFT JOIN place_standards parent ON ps.parent_id = parent.id
  WHERE
    -- Arabic-first search with normalization
    normalize_arabic_text(ps.place_name) LIKE v_normalized || '%'

    -- Alternate names search (handles NULL/empty arrays safely)
    OR (
      ps.alternate_names IS NOT NULL
      AND v_normalized = ANY(
        SELECT normalize_arabic_text(unnest(ps.alternate_names))
      )
    )
  ORDER BY
    -- 1. Region priority: Saudi (500-999) → Gulf (2000+) → Arab (3000+) → Western (4000+)
    ps.display_order NULLS LAST,

    -- 2. Match quality: exact → prefix → alternate
    CASE
      WHEN normalize_arabic_text(ps.place_name) = v_normalized THEN 1
      WHEN ps.place_name LIKE p_query || '%' THEN 2
      ELSE 3
    END,

    -- 3. Shorter names first (Riyadh before Riyadh Al-Khabra)
    LENGTH(ps.place_name)

  LIMIT p_limit;
END;
$$;

-- ========================================
-- STEP 5: Grant permissions
-- ========================================

GRANT EXECUTE ON FUNCTION search_place_autocomplete(TEXT, INTEGER)
TO authenticated, anon, service_role;

-- ========================================
-- STEP 6: Add documentation
-- ========================================

COMMENT ON FUNCTION search_place_autocomplete IS
'Arabic-first location autocomplete with normalized JSONB references.
Returns cities with parent country, ordered by region priority (Saudi→Gulf→Arab→Western→Other).

Input Guards:
- Rejects NULL/empty queries
- Clamps limit to [1, 100]
- Handles normalization failures gracefully

Performance:
- Uses normalized_name index for fast Arabic search
- Uses GIN index for alternate_names array
- STABLE + PARALLEL SAFE for query optimization

Returns:
- id: Profile reference ID (BIGINT)
- display_name: Arabic name
- display_name_en: English name
- place_type: "city" or "country"
- country_name: Parent country name (NULL for countries)
- region: Region classification
- normalized_data: Structured JSONB with confidence score

Example:
  SELECT * FROM search_place_autocomplete(''رياض'', 8);
';

-- ========================================
-- STEP 7: Validation tests
-- ========================================

DO $$
DECLARE
  v_test_result RECORD;
  v_test_count INT;
BEGIN
  RAISE NOTICE 'Running validation tests...';

  -- Test 1: Normal Arabic query
  SELECT COUNT(*) INTO v_test_count
  FROM search_place_autocomplete('رياض', 8);

  IF v_test_count > 0 THEN
    RAISE NOTICE '✓ Test 1 PASSED: Arabic query returned % results', v_test_count;
  ELSE
    RAISE WARNING '✗ Test 1 FAILED: Arabic query returned no results';
  END IF;

  -- Test 2: Empty query guard
  SELECT COUNT(*) INTO v_test_count
  FROM search_place_autocomplete('', 8);

  IF v_test_count = 0 THEN
    RAISE NOTICE '✓ Test 2 PASSED: Empty query guard working';
  ELSE
    RAISE WARNING '✗ Test 2 FAILED: Empty query guard not working';
  END IF;

  -- Test 3: NULL query guard
  SELECT COUNT(*) INTO v_test_count
  FROM search_place_autocomplete(NULL, 8);

  IF v_test_count = 0 THEN
    RAISE NOTICE '✓ Test 3 PASSED: NULL query guard working';
  ELSE
    RAISE WARNING '✗ Test 3 FAILED: NULL query guard not working';
  END IF;

  -- Test 4: JSONB structure validation
  SELECT normalized_data INTO v_test_result
  FROM search_place_autocomplete('رياض', 1)
  LIMIT 1;

  IF v_test_result.normalized_data ? 'confidence' THEN
    RAISE NOTICE '✓ Test 4 PASSED: JSONB structure contains confidence score';
  ELSE
    RAISE WARNING '✗ Test 4 FAILED: JSONB structure missing confidence score';
  END IF;

  RAISE NOTICE 'Validation tests completed.';
END $$;

-- ========================================
-- Migration completed successfully
-- ========================================
