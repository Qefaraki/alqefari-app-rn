-- Fix search_name_chain function to use correct column names
-- The function references birth_year_hijri and death_year_hijri which don't exist
-- They should be extracted from dob_data and dod_data JSONB columns

DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

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
    -- Base case: start with all profiles (excluding Munasib without HIDs)
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
      -- Extract year from dob_data JSONB
      CASE 
        WHEN p.dob_data IS NOT NULL 
        THEN (p.dob_data->'hijri'->>'year')::INT
        ELSE NULL 
      END as birth_year_hijri,
      -- Extract year from dod_data JSONB
      CASE 
        WHEN p.dod_data IS NOT NULL 
        THEN (p.dod_data->'hijri'->>'year')::INT
        ELSE NULL 
      END as death_year_hijri
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.hid IS NOT NULL  -- Exclude Munasib profiles without HIDs
    
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
      a.birth_year_hijri,  -- Carry forward from base case
      a.death_year_hijri   -- Carry forward from base case
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain TO anon, authenticated;

-- Test the fix
DO $$
DECLARE
  v_count INT;
  v_test_result RECORD;
BEGIN
  -- Test with a simple search
  SELECT COUNT(*) INTO v_count 
  FROM search_name_chain(ARRAY['عبدالله'], 10, 0);
  
  RAISE NOTICE 'Search test returned % results', v_count;
  
  -- Check if birth_year_hijri is being extracted
  FOR v_test_result IN 
    SELECT id, name, birth_year_hijri 
    FROM search_name_chain(ARRAY['عبدالله'], 5, 0)
    WHERE birth_year_hijri IS NOT NULL
    LIMIT 1
  LOOP
    RAISE NOTICE 'Sample result: % has birth year %', v_test_result.name, v_test_result.birth_year_hijri;
  END LOOP;
  
  RAISE NOTICE '✅ Search function fixed to use dob_data/dod_data columns';
END $$;