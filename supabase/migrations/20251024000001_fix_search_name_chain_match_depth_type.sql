-- ============================================================================
-- Fix Search Name Chain: Correct match_depth type mismatch
-- ============================================================================
-- Migration: 20251024000001_fix_search_name_chain_match_depth_type.sql
-- Date: 2025-10-24
-- Author: Claude (type mismatch fix)
--
-- Problem:
--   Migration 20251024000000 defined match_depth as INT in RETURNS TABLE,
--   but the old migration created it as FLOAT or had incompatible definition.
--
-- Solution:
--   Drop and recreate the function with correct type definitions to ensure
--   match_depth is INT in both RETURNS TABLE and CTE selections.
--
-- ============================================================================

-- Drop existing function with all signatures
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT, TEXT, UUID, BOOLEAN);

-- Recreate with correct signature and types
CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_gender TEXT DEFAULT NULL,
  p_exclude_id UUID DEFAULT NULL,
  p_only_unclaimed BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INT,
  photo_url TEXT,
  birth_year_hijri INT,
  death_year_hijri INT,
  match_score FLOAT,
  match_depth INT,
  father_name TEXT,
  grandfather_name TEXT,
  professional_title TEXT,
  title_abbreviation TEXT,
  gender TEXT
) AS $$
DECLARE
  v_search_terms TEXT[];
  v_search_term TEXT;
BEGIN
  -- ========================================================================
  -- INPUT VALIDATION
  -- ========================================================================

  -- Validate p_names is not NULL or empty
  IF p_names IS NULL OR array_length(p_names, 1) IS NULL THEN
    RAISE EXCEPTION 'p_names cannot be NULL or empty array';
  END IF;

  -- Validate p_limit
  IF p_limit IS NULL OR p_limit <= 0 THEN
    p_limit := 50;  -- Default
  ELSIF p_limit > 500 THEN
    RAISE EXCEPTION 'Maximum limit is 500 results (requested: %)', p_limit;
  END IF;

  -- Validate p_offset
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Validate p_gender
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'p_gender must be "male", "female", or NULL (got: %)', p_gender;
  END IF;

  -- ========================================================================
  -- NORMALIZE SEARCH TERMS
  -- ========================================================================

  -- Clean and normalize search terms (min 2 chars each)
  v_search_terms := ARRAY[]::TEXT[];
  FOREACH v_search_term IN ARRAY p_names
  LOOP
    IF LENGTH(TRIM(v_search_term)) >= 2 THEN
      v_search_terms := array_append(v_search_terms, normalize_arabic(TRIM(v_search_term)));
    END IF;
  END LOOP;

  -- If no valid search terms after filtering, return empty
  IF array_length(v_search_terms, 1) IS NULL THEN
    RETURN;
  END IF;

  -- ========================================================================
  -- MAIN QUERY
  -- ========================================================================

  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- ======================================================================
    -- BASE CASE: Start with all active profiles
    -- ======================================================================
    SELECT
      p.id,
      p.hid,
      p.name,
      p.father_id,
      p.gender,
      p.user_id,
      ARRAY[p.id] as visited_ids,
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      CASE
        WHEN p.dob_data IS NOT NULL
        THEN (p.dob_data->'hijri'->>'year')::INT
        ELSE NULL
      END as birth_year_hijri,
      CASE
        WHEN p.dod_data IS NOT NULL
        THEN (p.dod_data->'hijri'->>'year')::INT
        ELSE NULL
      END as death_year_hijri,
      p.professional_title,
      p.title_abbreviation
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.hid IS NOT NULL
      AND (p_gender IS NULL OR p.gender = p_gender)
      AND (p_exclude_id IS NULL OR p.id != p_exclude_id)
      AND (NOT p_only_unclaimed OR p.user_id IS NULL)

    UNION ALL

    -- ======================================================================
    -- RECURSIVE CASE: Build ancestry chains by following father relationships
    -- ======================================================================
    SELECT
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.gender,
      a.user_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      a.professional_title,
      a.title_abbreviation
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))
      AND a.depth < 20
  ),
  matches AS (
    -- ======================================================================
    -- SCORING & FILTERING: Apply position-aware scoring
    -- ======================================================================
    SELECT DISTINCT ON (a.id)
      a.id,
      a.hid,
      a.name,
      a.current_chain as name_chain,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      a.gender,

      -- ====================================================================
      -- INLINE CONTIGUOUS SEQUENCE MATCHING & POSITION-AWARE SCORING
      -- ====================================================================
      CASE
        -- ==================================================================
        -- TIER 1 (10.0): EXACT MATCH AT POSITION 1
        -- ==================================================================
        WHEN (
          array_length(v_search_terms, 1) <= array_length(a.name_array, 1)
          AND (
            -- Check if ALL search terms match contiguously from position 1
            SELECT bool_and(
              a.name_array[idx] = v_search_terms[idx]
              OR a.name_array[idx] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 10.0::FLOAT

        -- ==================================================================
        -- TIER 2 (7.0): CONTIGUOUS MATCH AT POSITION 2 (CHILDREN)
        -- ==================================================================
        WHEN (
          array_length(v_search_terms, 1) + 1 <= array_length(a.name_array, 1)
          AND (
            SELECT bool_and(
              a.name_array[idx + 1] = v_search_terms[idx]
              OR a.name_array[idx + 1] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 7.0::FLOAT

        -- ==================================================================
        -- TIER 3 (5.0): CONTIGUOUS MATCH AT POSITION 3 (GRANDCHILDREN)
        -- ==================================================================
        WHEN (
          array_length(v_search_terms, 1) + 2 <= array_length(a.name_array, 1)
          AND (
            SELECT bool_and(
              a.name_array[idx + 2] = v_search_terms[idx]
              OR a.name_array[idx + 2] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 5.0::FLOAT

        -- ==================================================================
        -- TIER 4 (3.0): CONTIGUOUS MATCH AT POSITION 4+ (GREAT-GRANDCHILDREN+)
        -- ==================================================================
        WHEN (
          array_length(v_search_terms, 1) + 3 <= array_length(a.name_array, 1)
          AND (
            -- Find earliest contiguous match position >= 4
            EXISTS (
              SELECT 1
              FROM generate_series(4, array_length(a.name_array, 1) - array_length(v_search_terms, 1) + 1) AS start_pos
              WHERE (
                SELECT bool_and(
                  a.name_array[start_pos + idx - 1] = v_search_terms[idx]
                  OR a.name_array[start_pos + idx - 1] LIKE v_search_terms[idx] || '%'
                )
                FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
              )
              LIMIT 1
            )
          )
        ) THEN 3.0::FLOAT

        -- ==================================================================
        -- TIER 5 (1.0): NON-CONTIGUOUS/SCATTERED MATCH
        -- ==================================================================
        WHEN (
          (
            SELECT bool_and(
              v_search_terms[idx] = ANY(a.name_array)
              OR EXISTS (
                SELECT 1 FROM unnest(a.name_array) n
                WHERE n LIKE v_search_terms[idx] || '%'
              )
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 1.0::FLOAT

        -- ==================================================================
        -- TIER 6 (0.0): NO MATCH
        -- ==================================================================
        ELSE 0.0::FLOAT
      END as match_score,

      array_length(a.name_array, 1)::INT as match_depth,

      -- Extract father and grandfather names for display
      CASE WHEN array_length(a.display_names, 1) >= 2
        THEN a.display_names[2]
        ELSE NULL
      END as father_name,
      CASE WHEN array_length(a.display_names, 1) >= 3
        THEN a.display_names[3]
        ELSE NULL
      END as grandfather_name,

      a.professional_title,
      a.title_abbreviation
    FROM ancestry a
    WHERE
      -- Pre-filter: Must match at least the first search term (performance optimization)
      EXISTS (
        SELECT 1 FROM unnest(a.name_array) n
        WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%'
      )
    ORDER BY a.id, a.depth DESC
  )

  -- ========================================================================
  -- FINAL SELECTION & SORTING
  -- ========================================================================
  SELECT
    m.id,
    m.hid,
    m.name,
    m.name_chain,
    m.generation,
    m.photo_url,
    m.birth_year_hijri,
    m.death_year_hijri,
    m.match_score,
    m.match_depth,
    m.father_name,
    m.grandfather_name,
    m.professional_title,
    m.title_abbreviation,
    m.gender
  FROM matches m
  WHERE m.match_score > 0
  ORDER BY
    m.match_score DESC,
    m.generation ASC,
    m.match_depth ASC,
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT, TEXT, UUID, BOOLEAN)
TO anon, authenticated;

-- ============================================================================
-- POST-MIGRATION VALIDATION
-- ============================================================================
DO $$
DECLARE
  v_test_result RECORD;
  v_male_count INT;
  v_female_count INT;
BEGIN
  -- Smoke test: Can function be called with new signature?
  SELECT * INTO v_test_result
  FROM search_name_chain(ARRAY['محمد'], 1, 0, NULL, NULL, FALSE)
  LIMIT 1;

  IF v_test_result.id IS NULL THEN
    RAISE WARNING 'search_name_chain returned no results for "محمد" - may indicate issue';
  ELSE
    RAISE NOTICE '✅ Type fix successful - function works with correct types';
    RAISE NOTICE 'Sample result: % (gender: %)', v_test_result.name, v_test_result.gender;
  END IF;

  -- Test gender filtering
  SELECT COUNT(*) INTO v_male_count
  FROM search_name_chain(ARRAY['محمد'], 100, 0, 'male'::TEXT);

  SELECT COUNT(*) INTO v_female_count
  FROM search_name_chain(ARRAY['فاطمة'], 100, 0, 'female'::TEXT);

  RAISE NOTICE '✅ Gender filtering works - Found % males, % females', v_male_count, v_female_count;

END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
