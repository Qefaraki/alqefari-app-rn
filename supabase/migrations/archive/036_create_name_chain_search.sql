-- Migration: Create Arabic Name Chain Search Function
-- Description: Enables searching by progressive name chains with full ancestry (unlimited depth)
-- Author: Assistant
-- Date: 2025-01-09

-- Create helper function to normalize Arabic text
CREATE OR REPLACE FUNCTION normalize_arabic(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove diacritics, normalize hamza, fix spacing
  RETURN trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            input_text,
            '[\u064B-\u065F\u0670]', '', 'g'  -- Remove diacritics
          ),
          '[أإآ]', 'ا', 'g'  -- Normalize hamza variations
        ),
        '[ىي]', 'ي', 'g'  -- Normalize ya variations
      ),
      '\s+', ' ', 'g'  -- Normalize multiple spaces
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main search function with complete name chains
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
  grandfather_name TEXT
) AS $$
DECLARE
  v_normalized_names TEXT[];
BEGIN
  -- Normalize input names for better matching
  SELECT array_agg(normalize_arabic(unnest))
  INTO v_normalized_names
  FROM unnest(p_names);
  
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case: start with all profiles
    SELECT 
      p.id,
      p.hid,
      p.name,
      p.father_id,
      ARRAY[p.id] as visited_ids,  -- Cycle detection
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      p.birth_year_hijri,
      p.death_year_hijri
    FROM profiles p
    WHERE p.deleted_at IS NULL
    
    UNION ALL
    
    -- Recursive case: build complete chains up to root
    SELECT 
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.visited_ids || parent.id,  -- Track visited to prevent cycles
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' بن ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))  -- Prevent cycles
      AND a.depth < 20  -- Safety limit (but allows deep chains)
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
      -- Calculate match score (percentage of names that match)
      (
        SELECT COUNT(*)::FLOAT / array_length(v_normalized_names, 1)::FLOAT
        FROM unnest(v_normalized_names) AS search_name
        WHERE search_name = ANY(a.name_array)
      ) as match_score,
      -- How deep is the match in the chain
      array_length(a.name_array, 1) as match_depth,
      -- Extract father and grandfather for display
      CASE WHEN array_length(a.display_names, 1) >= 2 
        THEN a.display_names[2] 
        ELSE NULL 
      END as father_name,
      CASE WHEN array_length(a.display_names, 1) >= 3 
        THEN a.display_names[3] 
        ELSE NULL 
      END as grandfather_name,
      -- Check if ALL search names are in the chain (for filtering)
      (v_normalized_names <@ a.name_array) as has_all_names
    FROM ancestry a
    WHERE 
      -- At least one search name must match
      EXISTS (
        SELECT 1 FROM unnest(v_normalized_names) AS search_name
        WHERE search_name = ANY(a.name_array)
      )
    ORDER BY a.id, a.depth DESC  -- Take the deepest chain for each person
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
    m.grandfather_name
  FROM matches m
  WHERE m.has_all_names  -- All search names must be present
  ORDER BY 
    m.match_score DESC,     -- Best matches first
    m.generation DESC,      -- Recent generations first
    m.match_depth ASC,      -- Shorter chains first (closer matches)
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_profiles_father_id 
  ON profiles(father_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_generation 
  ON profiles(generation) 
  WHERE deleted_at IS NULL;

-- Create simpler autocomplete function for single name
CREATE OR REPLACE FUNCTION search_name_autocomplete(
  p_query TEXT,
  p_limit INT DEFAULT 10
) RETURNS TABLE (
  id UUID,
  name TEXT,
  father_name TEXT,
  generation INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    father.name as father_name,
    p.generation
  FROM profiles p
  LEFT JOIN profiles father ON father.id = p.father_id
  WHERE p.deleted_at IS NULL
    AND normalize_arabic(p.name) ILIKE normalize_arabic(p_query) || '%'
  ORDER BY 
    p.generation DESC,
    p.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_name_autocomplete TO anon, authenticated;
GRANT EXECUTE ON FUNCTION normalize_arabic TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION search_name_chain IS 'Search for profiles using Arabic name chains. Builds complete ancestry chains dynamically and matches against provided name array.';
COMMENT ON FUNCTION normalize_arabic IS 'Normalizes Arabic text by removing diacritics and standardizing character variations for better search matching.';