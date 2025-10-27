-- Migration: Fix search_name_chain - Restore recursive CTE + add crop fields
-- Author: Claude Code
-- Date: 2025-10-28
-- Purpose: Fix critical regression from 20251027140400 (stub deployment)
-- Issues Fixed:
--   1. Munasib (NULL HID) appearing in search results
--   2. Name chains broken (only showing first name)
-- Solution: Restore working recursive CTE from 20251025120000 + add crop fields

-- ============================================================================
-- INCIDENT REPORT
-- ============================================================================
-- On October 27, 2025 (commit 1ebc9fbcc), migration 20251027140400 deployed
-- a PLACEHOLDER stub that explicitly warned:
--   "NOTE: The implementations above are SIMPLIFIED PLACEHOLDERS."
--
-- This broke production search with:
--   - Missing: AND p.hid IS NOT NULL (Munasib filter)
--   - Missing: Recursive CTE for full name chain building
--   - Result: Users saw Munasib in search + only first names
--
-- This migration restores the FULL working implementation from 20251025120000
-- and adds the 4 crop fields that 20251027140400 attempted to add.
-- ============================================================================

DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT, TEXT);
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);
DROP FUNCTION IF EXISTS search_name_chain(TEXT, INT);

CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_gender TEXT DEFAULT NULL
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
  version INT,
  gender TEXT,
  currently_married BOOLEAN,

  -- NEW: Crop fields (from 20251027140400 original intent)
  crop_top NUMERIC(4,3),
  crop_bottom NUMERIC(4,3),
  crop_left NUMERIC(4,3),
  crop_right NUMERIC(4,3)
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
    p_limit := 50;
  ELSIF p_limit > 500 THEN
    RAISE EXCEPTION 'Maximum limit is 500 results (requested: %)', p_limit;
  END IF;

  -- Validate p_offset
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- ========================================================================
  -- NORMALIZE SEARCH TERMS
  -- ========================================================================

  v_search_terms := ARRAY[]::TEXT[];
  FOREACH v_search_term IN ARRAY p_names
  LOOP
    IF LENGTH(TRIM(v_search_term)) >= 2 THEN
      v_search_terms := array_append(v_search_terms, normalize_arabic(TRIM(v_search_term)));
    END IF;
  END LOOP;

  IF array_length(v_search_terms, 1) IS NULL THEN
    RETURN;
  END IF;

  -- ========================================================================
  -- MAIN QUERY (Restored recursive CTE with crop fields added)
  -- ========================================================================

  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case: Start with profile
    SELECT
      p.id,
      p.hid,
      p.name,
      p.father_id,
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
      p.title_abbreviation,
      p.version,
      p.gender,
      -- NEW: Crop fields
      p.crop_top,
      p.crop_bottom,
      p.crop_left,
      p.crop_right
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.hid IS NOT NULL  -- ✅ CRITICAL: Filters out Munasib (external spouses)
      AND (p_gender IS NULL OR p.gender = p_gender)  -- NEW: Gender filter from broken stub

    UNION ALL

    -- Recursive case: Build full name chain by following fathers
    SELECT
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' ' || parent.name,  -- ✅ CRITICAL: Builds full ancestry chain
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      a.professional_title,
      a.title_abbreviation,
      a.version,
      a.gender,
      -- NEW: Carry crop fields through recursion
      a.crop_top,
      a.crop_bottom,
      a.crop_left,
      a.crop_right
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))
      AND a.depth < 20
  ),
  matches AS (
    SELECT DISTINCT ON (a.id)
      a.id,
      a.hid,
      a.name,
      a.current_chain as name_chain,  -- ✅ CRITICAL: Full chain, not just first name
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,

      -- Position-aware scoring (5 tiers)
      CASE
        -- Tier 1: Exact match at start (e.g., "محمد أحمد" matches "محمد أحمد علي")
        WHEN (
          array_length(v_search_terms, 1) <= array_length(a.name_array, 1)
          AND (
            SELECT bool_and(
              a.name_array[idx] = v_search_terms[idx]
              OR a.name_array[idx] LIKE v_search_terms[idx] || '%'
            )
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
          )
        ) THEN 10.0::FLOAT

        -- Tier 2: Match offset by 1 (skips first name)
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

        -- Tier 3: Match offset by 2 (skips first 2 names)
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

        -- Tier 4: Match anywhere in ancestry chain (offset >= 3)
        WHEN (
          array_length(v_search_terms, 1) + 3 <= array_length(a.name_array, 1)
          AND (
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

        -- Tier 5: All terms present but non-sequential
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

        ELSE 0.0::FLOAT
      END as match_score,

      array_length(a.name_array, 1)::INT as match_depth,

      -- Extract father and grandfather names
      CASE WHEN array_length(a.display_names, 1) >= 2
        THEN a.display_names[2]
        ELSE NULL
      END as father_name,
      CASE WHEN array_length(a.display_names, 1) >= 3
        THEN a.display_names[3]
        ELSE NULL
      END as grandfather_name,

      a.professional_title,
      a.title_abbreviation,
      a.version,
      a.gender,

      -- NEW: Crop fields
      a.crop_top,
      a.crop_bottom,
      a.crop_left,
      a.crop_right
    FROM ancestry a
    WHERE
      -- Only include profiles that match first search term
      EXISTS (
        SELECT 1 FROM unnest(a.name_array) n
        WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%'
      )
    ORDER BY a.id, a.depth DESC  -- Take longest chain per profile
  ),
  marriage_check AS (
    -- NEW: Check marriage status (from broken stub, but implemented correctly)
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
      m.version,
      m.gender,

      -- Check if profile has current marriages (status = 'current')
      EXISTS (
        SELECT 1 FROM marriages mar
        WHERE (mar.husband_id = m.id OR mar.wife_id = m.id)
          AND mar.status = 'current'
          AND mar.deleted_at IS NULL
      ) as currently_married,

      m.crop_top,
      m.crop_bottom,
      m.crop_left,
      m.crop_right
    FROM matches m
  )

  SELECT
    mc.id,
    mc.hid,
    mc.name,
    mc.name_chain,  -- ✅ Full chain: "محمد أحمد علي" not just "محمد"
    mc.generation,
    mc.photo_url,
    mc.birth_year_hijri,
    mc.death_year_hijri,
    mc.match_score,
    mc.match_depth,
    mc.father_name,
    mc.grandfather_name,
    mc.professional_title,
    mc.title_abbreviation,
    mc.version,
    mc.gender,
    mc.currently_married,
    mc.crop_top,
    mc.crop_bottom,
    mc.crop_left,
    mc.crop_right
  FROM marriage_check mc
  WHERE mc.match_score > 0
  ORDER BY
    mc.match_score DESC,
    mc.generation ASC,
    mc.match_depth ASC,
    mc.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT, TEXT) TO authenticated;

-- ============================================================================
-- VALIDATION QUERIES (Run after applying migration)
-- ============================================================================

-- Test 1: Verify Munasib are NOT in results (should return 0 rows)
-- SELECT * FROM search_name_chain(ARRAY['محمد'], 50, 0) WHERE hid IS NULL;

-- Test 2: Verify name chains are full (should show "محمد أحمد علي" format)
-- SELECT name, name_chain FROM search_name_chain(ARRAY['محمد'], 5, 0);

-- Test 3: Verify crop fields are present (should have numeric values or NULL)
-- SELECT name, crop_top, crop_bottom FROM search_name_chain(ARRAY['محمد'], 5, 0);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION search_name_chain IS
  'Search profiles by name with full recursive ancestry chain building.
   Filters out Munasib (hid IS NULL). Position-aware 5-tier scoring.
   Includes crop fields added 2025-10-28. Fixed regression from 20251027140400.';
