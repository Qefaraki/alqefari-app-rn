-- ============================================================================
-- Migration: Add version field to search_name_chain RPC
-- ============================================================================
-- Migration: 20251025120000_add_version_to_search_name_chain.sql
-- Date: 2025-10-25
-- Author: Claude
--
-- Purpose:
--   Add version field to search_name_chain() RPC to support optimistic locking
--   in profile editing. This ensures profiles retrieved via search have the
--   version field required for conflict detection on save.
--
-- Root Cause:
--   get_branch_data() returns version field, but search_name_chain() was missing it.
--   When users search for profiles and edit them, they get version=undefined,
--   causing save failures and requiring cache invalidation workarounds.
--
-- What This Does:
--   1. Recreates search_name_chain() with version field in RETURNS TABLE
--   2. Adds p.version to base case SELECT in ancestry CTE
--   3. Adds a.version to recursive case SELECT in ancestry CTE
--   4. Adds a.version to matches CTE SELECT
--   5. Adds m.version to final SELECT output
--
-- Impact:
--   ✅ All search results now include version field
--   ✅ No code changes needed in frontend (field just appears)
--   ✅ Enables optimistic locking on searched profiles
--   ✅ Eliminates version=undefined errors
--
-- ============================================================================

DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
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
  version INT
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
  -- MAIN QUERY (With version field for optimistic locking)
  -- ========================================================================

  RETURN QUERY
  WITH RECURSIVE ancestry AS (
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
      p.version
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.hid IS NOT NULL

    UNION ALL

    SELECT
      a.id,
      a.hid,
      a.name,
      parent.father_id,
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
      a.title_abbreviation,
      a.version
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
      a.current_chain as name_chain,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,

      CASE
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
      a.version
    FROM ancestry a
    WHERE
      EXISTS (
        SELECT 1 FROM unnest(a.name_array) n
        WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%'
      )
    ORDER BY a.id, a.depth DESC
  )

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
    m.version
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

-- Grant permissions to updated function
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT) TO anon, authenticated;

-- ============================================================================
-- VALIDATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ search_name_chain() updated with version field';
  RAISE NOTICE '✅ All search results will now include optimistic locking version';
  RAISE NOTICE '✅ Version field enables conflict detection on profile edits';
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================
-- Function signature: search_name_chain(TEXT[], INT, INT)
-- New fields: version INT (for optimistic locking)
-- Impact: All search results now support version-based conflict detection
