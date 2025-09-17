-- Fix profile matching to build name chains exactly like the frontend
DROP FUNCTION IF EXISTS search_profiles_by_name_chain(TEXT);

CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(p_name_chain TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  full_chain TEXT,
  generation INT,
  has_auth BOOLEAN,
  match_quality TEXT,
  match_score INT,
  father_name TEXT,
  grandfather_name TEXT,
  siblings_count INT,
  children_count INT
) AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces and clean
  v_names := string_to_array(trim(p_name_chain), ' ');
  
  -- Filter out empty strings and family names
  v_names := ARRAY(
    SELECT unnest(v_names) 
    WHERE unnest(v_names) != '' 
    AND unnest(v_names) NOT IN ('القفاري', 'الدوسري', 'العتيبي', 'الشمري')
  );
  
  v_first_name := COALESCE(v_names[1], '');
  v_father_name := COALESCE(v_names[2], '');
  v_grandfather_name := COALESCE(v_names[3], '');
  
  -- Return empty if no name provided
  IF v_first_name = '' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Build the full chain by walking up father_id relationships
    -- This matches exactly how ProfileSheet.js does it
    SELECT 
      p.id,
      p.name,
      p.father_id,
      p.generation,
      p.auth_user_id,
      ARRAY[p.name]::TEXT[] as name_array,
      0 as depth
    FROM profiles p
    WHERE p.deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
      a.id,
      a.name,
      parent.father_id,
      a.generation,
      a.auth_user_id,
      a.name_array || parent.name,
      a.depth + 1
    FROM ancestry a
    INNER JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL 
      AND a.depth < 30  -- Prevent infinite recursion but allow deep trees
  ),
  -- Get the complete chain for each profile (maximum depth reached)
  full_chains AS (
    SELECT DISTINCT ON (id)
      id,
      -- Join names with space and add القفاري at the end, just like frontend
      array_to_string(name_array, ' ') || ' القفاري' as full_chain,
      generation,
      auth_user_id
    FROM ancestry
    ORDER BY id, depth DESC  -- Get the longest chain for each profile
  ),
  family_stats AS (
    -- Pre-calculate family statistics
    SELECT 
      p.id,
      COUNT(DISTINCT s.id) as siblings_count,
      COUNT(DISTINCT c.id) as children_count
    FROM profiles p
    LEFT JOIN profiles s ON s.father_id = p.father_id AND s.id != p.id AND s.deleted_at IS NULL
    LEFT JOIN profiles c ON c.father_id = p.id AND c.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    GROUP BY p.id
  )
  SELECT 
    p.id,
    p.name,
    -- Use the full chain built recursively
    COALESCE(fc.full_chain, p.name || ' القفاري') as full_chain,
    p.generation,
    p.auth_user_id IS NOT NULL as has_auth,
    
    -- Calculate match quality
    CASE 
      -- Perfect match: all three names match exactly
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
        AND gf.name IS NOT NULL AND LOWER(TRIM(gf.name)) = LOWER(TRIM(v_grandfather_name))
      THEN 'perfect'
      
      -- Excellent match: first two names match exactly
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
      THEN 'excellent'
      
      -- Good match: first name exact, father partial
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        AND f.name IS NOT NULL AND f.name ILIKE '%' || v_father_name || '%'
      THEN 'good'
      
      -- Fair match: only first name matches exactly
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
      THEN 'fair'
      
      ELSE 'weak'
    END as match_quality,
    
    -- Calculate accurate match score
    CASE 
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
        AND gf.name IS NOT NULL AND LOWER(TRIM(gf.name)) = LOWER(TRIM(v_grandfather_name))
      THEN 100
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
      THEN 80
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        AND f.name IS NOT NULL AND f.name ILIKE '%' || v_father_name || '%'
      THEN 60
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
      THEN 40
      
      WHEN p.name ILIKE '%' || v_first_name || '%'
      THEN 20
      
      ELSE 0
    END as match_score,
    
    -- Get immediate ancestors for display
    f.name as father_name,
    gf.name as grandfather_name,
    
    -- Family stats
    COALESCE(fs.siblings_count, 0) as siblings_count,
    COALESCE(fs.children_count, 0) as children_count
    
  FROM profiles p
  LEFT JOIN profiles f ON p.father_id = f.id
  LEFT JOIN profiles gf ON f.father_id = gf.id  
  LEFT JOIN full_chains fc ON fc.id = p.id
  LEFT JOIN family_stats fs ON fs.id = p.id
  WHERE 
    p.deleted_at IS NULL
    AND (
      -- Exact first name match
      LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
      -- OR partial match (less preferred)
      OR (v_first_name != '' AND p.name ILIKE '%' || v_first_name || '%')
    )
    -- Only return profiles with a match score > 0
    AND CASE 
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
        AND gf.name IS NOT NULL AND LOWER(TRIM(gf.name)) = LOWER(TRIM(v_grandfather_name))
      THEN 100
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
      THEN 80
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        AND f.name IS NOT NULL AND f.name ILIKE '%' || v_father_name || '%'
      THEN 60
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
      THEN 40
      
      WHEN p.name ILIKE '%' || v_first_name || '%'
      THEN 20
      
      ELSE 0
    END > 0
  ORDER BY 
    -- Order by match score first
    CASE 
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
        AND gf.name IS NOT NULL AND LOWER(TRIM(gf.name)) = LOWER(TRIM(v_grandfather_name))
      THEN 100
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
        AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
      THEN 80
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        AND f.name IS NOT NULL AND f.name ILIKE '%' || v_father_name || '%'
      THEN 60
      
      WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
      THEN 40
      
      WHEN p.name ILIKE '%' || v_first_name || '%'
      THEN 20
      
      ELSE 0
    END DESC,
    p.auth_user_id IS NULL DESC,  -- Unclaimed profiles first within same score
    p.generation DESC,             -- Older generations first
    p.name ASC                     -- Alphabetical as last resort
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_profiles_by_name_chain TO anon, authenticated;