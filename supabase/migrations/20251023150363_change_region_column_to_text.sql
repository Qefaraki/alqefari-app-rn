-- Migration: Change place_standards.region from VARCHAR(20) to TEXT
-- Author: Claude Code
-- Date: 2025-10-23
--
-- Problem: PostgREST requires exact type matching between function return type
-- and actual column type. The search_place_autocomplete() function declares
-- region as TEXT, but place_standards.region was VARCHAR(20), causing:
-- "Returned type character varying(20) does not match expected type text in column 4"
--
-- Solution: Change place_standards.region to TEXT to match function declaration.
-- This is safe because TEXT has no practical storage difference from VARCHAR in PostgreSQL.

-- Step 1: Change column type from VARCHAR(20) to TEXT
ALTER TABLE place_standards
ALTER COLUMN region TYPE TEXT;

-- Step 2: Drop existing function (required because return type structure changed)
DROP FUNCTION IF EXISTS search_place_autocomplete(TEXT, INTEGER);

-- Step 3: Recreate search_place_autocomplete() without unnecessary cast
-- Now that region is TEXT, we don't need ::TEXT cast
CREATE FUNCTION search_place_autocomplete(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  country TEXT,
  region TEXT,
  city TEXT,
  place TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ps.country,
    ps.region,  -- Removed ::TEXT cast - column is now TEXT
    ps.city,
    ps.place
  FROM place_standards ps
  WHERE
    ps.country ILIKE '%' || p_query || '%' OR
    ps.region ILIKE '%' || p_query || '%' OR
    ps.city ILIKE '%' || p_query || '%' OR
    ps.place ILIKE '%' || p_query || '%'
  ORDER BY ps.country, ps.region, ps.city, ps.place
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add helpful comment
COMMENT ON COLUMN place_standards.region IS 'Region/state name - TEXT type for PostgREST compatibility';
COMMENT ON FUNCTION search_place_autocomplete(TEXT, INTEGER) IS 'Autocomplete search for places - returns exact TEXT types matching place_standards schema';
