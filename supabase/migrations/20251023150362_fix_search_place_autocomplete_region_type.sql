-- Migration: Fix type mismatch in search_place_autocomplete function
-- Issue: region column returned as VARCHAR(20) but RETURNS TABLE expects TEXT
-- Error: Code 42804 - Returned type character varying(20) does not match expected type text

-- Fix by explicitly casting region to TEXT in the SELECT statement
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
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := normalize_arabic_text(p_query);

  RETURN QUERY
  SELECT
    ps.id,
    ps.place_name AS display_name,
    ps.place_name_en AS display_name_en,
    ps.place_type,
    parent.place_name AS country_name,
    ps.region::TEXT,  -- Explicit cast to TEXT
    CASE
      WHEN ps.place_type = 'city' THEN
        jsonb_build_object(
          'original', ps.place_name,
          'city', jsonb_build_object('ar', ps.place_name, 'en', ps.place_name_en, 'id', ps.id),
          'country', jsonb_build_object('ar', parent.place_name, 'en', parent.place_name_en, 'code', parent.country_code, 'id', parent.id),
          'confidence', 1.0
        )
      ELSE
        jsonb_build_object(
          'original', ps.place_name,
          'country', jsonb_build_object('ar', ps.place_name, 'en', ps.place_name_en, 'code', ps.country_code, 'id', ps.id),
          'confidence', 1.0
        )
    END AS normalized_data
  FROM place_standards ps
  LEFT JOIN place_standards parent ON ps.parent_id = parent.id
  WHERE
    -- PRIORITY: ARABIC FIRST
    -- Check normalized Arabic name
    normalize_arabic_text(ps.place_name) LIKE v_normalized || '%'
    -- Check alternate Arabic spellings
    OR v_normalized = ANY(SELECT normalize_arabic_text(unnest(ps.alternate_names)))
  ORDER BY
    -- PRIORITY 1: Display order (saudi cities 500-999, then countries 1000+)
    ps.display_order,

    -- PRIORITY 2: Exact Arabic match beats partial match
    CASE
      WHEN normalize_arabic_text(ps.place_name) = v_normalized THEN 1
      WHEN ps.place_name LIKE p_query || '%' THEN 2
      ELSE 3
    END,

    -- PRIORITY 3: Shorter names (more commonly used abbreviations)
    LENGTH(ps.place_name)

  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_place_autocomplete TO authenticated, anon, service_role;
