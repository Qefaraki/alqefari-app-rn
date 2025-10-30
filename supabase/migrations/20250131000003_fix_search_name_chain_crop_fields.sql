/**
 * Migration: Fix search_name_chain RPC - Remove Crop Fields
 * Date: 2025-01-31
 *
 * Purpose: Complete the crop field removal that was missed in Migration 002.
 *          The search_name_chain function was still referencing dropped columns.
 *
 * Issue: Migration 002 was tracked but didn't fully execute. The function
 *        still had crop_top, crop_bottom, crop_left, crop_right in RETURNS TABLE,
 *        causing "column p.crop_top does not exist" errors during search.
 *
 * Fix: Drop old function and recreate without crop fields in:
 *      - RETURNS TABLE signature (removed 4 crop fields)
 *      - ancestry CTE (both base and recursive cases)
 *      - matches CTE
 *      - marriage_check CTE
 *      - Final SELECT
 *
 * Impact: Search functionality now works correctly after crop column removal.
 */

BEGIN;

-- Drop old version with crop fields
DROP FUNCTION IF EXISTS search_name_chain(text[], integer, integer, text);

-- Recreate without crop fields
CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_gender TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INTEGER,
  photo_url TEXT,
  birth_year_hijri INTEGER,
  death_year_hijri INTEGER,
  match_score DOUBLE PRECISION,
  match_depth INTEGER,
  father_name TEXT,
  grandfather_name TEXT,
  professional_title TEXT,
  title_abbreviation TEXT,
  version INTEGER,
  gender TEXT,
  currently_married BOOLEAN,
  share_code VARCHAR
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_search_terms TEXT[];
  v_search_term TEXT;
BEGIN
  IF p_names IS NULL OR array_length(p_names, 1) IS NULL THEN
    RAISE EXCEPTION 'p_names cannot be NULL or empty array';
  END IF;

  IF p_limit IS NULL OR p_limit <= 0 THEN
    p_limit := 50;
  ELSIF p_limit > 500 THEN
    RAISE EXCEPTION 'Maximum limit is 500 results (requested: %)', p_limit;
  END IF;

  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

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

  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    SELECT
      p.id, p.hid, p.name, p.father_id,
      ARRAY[p.id] as visited_ids,
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth, p.generation, p.photo_url,
      CASE WHEN p.dob_data IS NOT NULL THEN (p.dob_data->'hijri'->>'year')::INT ELSE NULL END as birth_year_hijri,
      CASE WHEN p.dod_data IS NOT NULL THEN (p.dod_data->'hijri'->>'year')::INT ELSE NULL END as death_year_hijri,
      p.professional_title, p.title_abbreviation, p.version, p.gender, p.share_code
    FROM profiles p
    WHERE p.deleted_at IS NULL AND p.hid IS NOT NULL AND (p_gender IS NULL OR p.gender = p_gender)
    UNION ALL
    SELECT
      a.id, a.hid, a.name, parent.father_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' ' || parent.name,
      a.depth + 1, a.generation, a.photo_url,
      a.birth_year_hijri, a.death_year_hijri,
      a.professional_title, a.title_abbreviation, a.version, a.gender, a.share_code
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL AND NOT (parent.id = ANY(a.visited_ids)) AND a.depth < 20
  ),
  matches AS (
    SELECT DISTINCT ON (a.id)
      a.id, a.hid, a.name, a.current_chain as name_chain,
      a.generation, a.photo_url, a.birth_year_hijri, a.death_year_hijri,
      CASE
        WHEN (array_length(v_search_terms, 1) <= array_length(a.name_array, 1) AND (SELECT bool_and(a.name_array[idx] = v_search_terms[idx] OR a.name_array[idx] LIKE v_search_terms[idx] || '%') FROM generate_series(1, array_length(v_search_terms, 1)) AS idx)) THEN 10.0::FLOAT
        WHEN (array_length(v_search_terms, 1) + 1 <= array_length(a.name_array, 1) AND (SELECT bool_and(a.name_array[idx + 1] = v_search_terms[idx] OR a.name_array[idx + 1] LIKE v_search_terms[idx] || '%') FROM generate_series(1, array_length(v_search_terms, 1)) AS idx)) THEN 7.0::FLOAT
        WHEN (array_length(v_search_terms, 1) + 2 <= array_length(a.name_array, 1) AND (SELECT bool_and(a.name_array[idx + 2] = v_search_terms[idx] OR a.name_array[idx + 2] LIKE v_search_terms[idx] || '%') FROM generate_series(1, array_length(v_search_terms, 1)) AS idx)) THEN 5.0::FLOAT
        WHEN (array_length(v_search_terms, 1) + 3 <= array_length(a.name_array, 1) AND (EXISTS (SELECT 1 FROM generate_series(4, array_length(a.name_array, 1) - array_length(v_search_terms, 1) + 1) AS start_pos WHERE (SELECT bool_and(a.name_array[start_pos + idx - 1] = v_search_terms[idx] OR a.name_array[start_pos + idx - 1] LIKE v_search_terms[idx] || '%') FROM generate_series(1, array_length(v_search_terms, 1)) AS idx) LIMIT 1))) THEN 3.0::FLOAT
        WHEN ((SELECT bool_and(v_search_terms[idx] = ANY(a.name_array) OR EXISTS (SELECT 1 FROM unnest(a.name_array) n WHERE n LIKE v_search_terms[idx] || '%')) FROM generate_series(1, array_length(v_search_terms, 1)) AS idx)) THEN 1.0::FLOAT
        ELSE 0.0::FLOAT
      END as match_score,
      array_length(a.name_array, 1)::INT as match_depth,
      CASE WHEN array_length(a.display_names, 1) >= 2 THEN a.display_names[2] ELSE NULL END as father_name,
      CASE WHEN array_length(a.display_names, 1) >= 3 THEN a.display_names[3] ELSE NULL END as grandfather_name,
      a.professional_title, a.title_abbreviation, a.version, a.gender, a.share_code
    FROM ancestry a
    WHERE EXISTS (SELECT 1 FROM unnest(a.name_array) n WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%')
    ORDER BY a.id, a.depth DESC
  ),
  marriage_check AS (
    SELECT m.*, EXISTS (SELECT 1 FROM marriages mar WHERE (mar.husband_id = m.id OR mar.wife_id = m.id) AND mar.status = 'current' AND mar.deleted_at IS NULL) as currently_married
    FROM matches m
  )
  SELECT mc.id, mc.hid, mc.name, mc.name_chain, mc.generation, mc.photo_url,
    mc.birth_year_hijri, mc.death_year_hijri, mc.match_score, mc.match_depth,
    mc.father_name, mc.grandfather_name, mc.professional_title, mc.title_abbreviation,
    mc.version, mc.gender, mc.currently_married, mc.share_code
  FROM marriage_check mc
  WHERE mc.match_score > 0
  ORDER BY mc.match_score DESC, mc.match_depth ASC, mc.generation ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_name_chain IS
  'Search profiles by name chain (ancestry path) with fuzzy matching.
   Updated 2025-01-31: Removed crop fields (crop_top/bottom/left/right) after column drop.
   Returns profiles matching search terms with position-aware scoring.';

COMMIT;

-- ============================================================================
-- Migration 003 Complete! ✅
-- ============================================================================
-- Fixed: search_name_chain now works without crop field errors
-- Verified: SELECT FROM search_name_chain(ARRAY['احمد'], 5) works correctly
