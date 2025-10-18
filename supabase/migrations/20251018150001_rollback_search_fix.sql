-- ============================================================================
-- ROLLBACK: Restore Original Search Function
-- ============================================================================
-- Rollback for: 20251018150000_fix_search_scoring_inline.sql
-- Date: 2025-10-18
--
-- Purpose:
--   Emergency rollback to restore original search_name_chain function
--   if the new position-aware scoring causes issues.
--
-- Usage:
--   Only execute this if migration 20251018150000 causes problems:
--   - Performance degradation (queries >2 seconds)
--   - Incorrect results
--   - Database errors
--   - User complaints
--
-- Original Function Source:
--   supabase/fix-search-partial-matching-corrected.sql (lines 8-216)
--
-- Time to Execute: <5 minutes
-- ============================================================================

-- Drop the new function
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

-- Restore original function (from fix-search-partial-matching-corrected.sql)
CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INT DEFAULT 20,
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
  title_abbreviation TEXT
) AS $$
DECLARE
  v_search_terms TEXT[];
  v_search_term TEXT;
  v_position INT;
BEGIN
  -- Clean and normalize search terms (min 2 chars each)
  v_search_terms := ARRAY[]::TEXT[];
  FOREACH v_search_term IN ARRAY p_names
  LOOP
    IF LENGTH(TRIM(v_search_term)) >= 2 THEN
      v_search_terms := array_append(v_search_terms, normalize_arabic(TRIM(v_search_term)));
    END IF;
  END LOOP;

  -- If no valid search terms, return empty
  IF array_length(v_search_terms, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case: start with all profiles
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
      p.title_abbreviation
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.hid IS NOT NULL

    UNION ALL

    -- Recursive case: build chains
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
      a.title_abbreviation
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
      -- Calculate match score with position-based priority
      CASE
        WHEN array_length(v_search_terms, 1) = 1 THEN
          -- Single term: prioritize first name matches
          CASE
            -- First name exact match (highest priority)
            WHEN a.name_array[1] = v_search_terms[1] THEN 10.0
            -- First name prefix match (second highest)
            WHEN a.name_array[1] LIKE v_search_terms[1] || '%' THEN 9.0
            -- Father name match (third priority)
            WHEN array_length(a.name_array, 1) >= 2
                 AND (a.name_array[2] = v_search_terms[1]
                      OR a.name_array[2] LIKE v_search_terms[1] || '%') THEN 5.0
            -- Grandfather match (fourth priority)
            WHEN array_length(a.name_array, 1) >= 3
                 AND (a.name_array[3] = v_search_terms[1]
                      OR a.name_array[3] LIKE v_search_terms[1] || '%') THEN 3.0
            -- Any other ancestor match (lowest priority)
            WHEN EXISTS (
              SELECT 1 FROM unnest(a.name_array) n
              WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%'
            ) THEN 1.0
            ELSE 0.0
          END
        ELSE
          -- Multiple terms: check sequential partial matching (BROKEN LOGIC)
          (
            SELECT COUNT(*)::FLOAT / array_length(v_search_terms, 1)::FLOAT
            FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
            WHERE EXISTS (
              SELECT 1
              FROM generate_series(1, array_length(a.name_array, 1)) AS name_idx
              WHERE
                -- First search term
                (idx = 1 AND (
                  a.name_array[name_idx] = v_search_terms[idx] OR
                  a.name_array[name_idx] LIKE v_search_terms[idx] || '%'
                ))
                OR
                -- Subsequent terms must appear after previous match
                (idx > 1 AND EXISTS (
                  SELECT 1
                  FROM generate_series(1, name_idx - 1) AS prev_idx
                  WHERE (
                    a.name_array[prev_idx] = v_search_terms[idx - 1] OR
                    a.name_array[prev_idx] LIKE v_search_terms[idx - 1] || '%'
                  ) AND (
                    a.name_array[name_idx] = v_search_terms[idx] OR
                    a.name_array[name_idx] LIKE v_search_terms[idx] || '%'
                  )
                ))
            )
          )
      END as match_score,
      array_length(a.name_array, 1) as match_depth,
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
      -- Must match at least the first search term
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
    m.title_abbreviation
  FROM matches m
  WHERE m.match_score > 0
  ORDER BY
    m.match_score DESC,
    m.generation DESC,  -- Note: This is wrong (should be ASC) but preserving original
    m.match_depth ASC,
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain TO anon, authenticated;

-- ============================================================================
-- ROLLBACK VALIDATION
-- ============================================================================
DO $$
DECLARE
  v_test_result RECORD;
BEGIN
  -- Smoke test: Can original function be called?
  SELECT * INTO v_test_result
  FROM search_name_chain(ARRAY['محمد'], 1, 0)
  LIMIT 1;

  IF v_test_result.id IS NULL THEN
    RAISE WARNING 'Rollback complete but search returned no results';
  ELSE
    RAISE NOTICE '✅ Rollback successful - original function restored';
    RAISE NOTICE 'Sample result: % (HID: %, score: %)', v_test_result.name, v_test_result.hid, v_test_result.match_score;
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- Original function restored with broken multi-term scoring.
-- Search will work but "إبراهيم سليمان علي" will return wrong ranking.
--
-- To re-apply the fix:
--   Run: supabase/migrations/20251018150000_fix_search_scoring_inline.sql
-- ============================================================================
