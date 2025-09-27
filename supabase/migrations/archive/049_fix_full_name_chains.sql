-- Fix profile matching to show FULL ancestral chains to root
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
  great_grandfather_name TEXT,
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
  
  -- Filter out empty strings
  v_names := ARRAY(SELECT unnest(v_names) WHERE unnest(v_names) != '');
  
  v_first_name := COALESCE(v_names[1], '');
  v_father_name := COALESCE(v_names[2], '');
  v_grandfather_name := COALESCE(v_names[3], '');
  
  -- Return empty if no name provided
  IF v_first_name = '' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Start with each profile
    SELECT 
      p.id,
      p.name,
      p.father_id,
      p.generation,
      p.auth_user_id,
      p.name::TEXT as name_chain,
      0 as depth
    FROM profiles p
    WHERE p.deleted_at IS NULL
    
    UNION ALL
    
    -- Recursively get all ancestors up to root
    SELECT 
      a.id,
      a.name,
      parent.father_id,
      a.generation,
      a.auth_user_id,
      a.name_chain || ' ' || parent.name as name_chain,
      a.depth + 1
    FROM ancestry a
    INNER JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL 
      AND a.depth < 20  -- Prevent infinite recursion
      AND parent.father_id IS NOT NULL  -- Continue until no more parents
  ),
  -- Get the COMPLETE chain for each profile (maximum depth)
  complete_chains AS (
    SELECT DISTINCT ON (id) 
      id,
      name_chain || ' القفاري' as full_chain,  -- Add family name at end
      generation,
      auth_user_id
    FROM ancestry
    WHERE father_id IS NULL  -- This is the complete chain (no more parents)
    ORDER BY id
  ),
  -- If a profile doesn't reach root, get its longest chain
  longest_chains AS (
    SELECT DISTINCT ON (id)
      id,
      name_chain || ' القفاري' as full_chain,
      generation,
      auth_user_id
    FROM ancestry
    ORDER BY id, depth DESC
  ),
  -- Combine complete and longest chains
  all_chains AS (
    SELECT * FROM complete_chains
    UNION ALL
    SELECT l.* FROM longest_chains l
    WHERE NOT EXISTS (SELECT 1 FROM complete_chains c WHERE c.id = l.id)
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
  ),
  matches AS (
    SELECT 
      p.id,
      p.name,
      -- Use the full chain from ancestry
      COALESCE(ac.full_chain, p.name || ' القفاري') as full_chain,
      p.generation,
      p.auth_user_id IS NOT NULL as has_auth,
      
      -- Get ancestor names for matching
      f.name as father_name,
      gf.name as grandfather_name,
      ggf.name as great_grandfather_name,
      
      -- Family stats
      COALESCE(fs.siblings_count, 0) as siblings_count,
      COALESCE(fs.children_count, 0) as children_count,
      
      -- Calculate accurate match score
      CASE 
        -- Perfect match: all three names match exactly
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
          AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
          AND gf.name IS NOT NULL AND LOWER(TRIM(gf.name)) = LOWER(TRIM(v_grandfather_name))
        THEN 100
        
        -- Excellent match: first two names match exactly
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
          AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
        THEN 80
        
        -- Good match: first name exact, father partial
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
          AND f.name IS NOT NULL AND f.name ILIKE '%' || v_father_name || '%'
        THEN 60
        
        -- Fair match: only first name matches exactly
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        THEN 40
        
        -- Weak match: partial first name match
        WHEN p.name ILIKE '%' || v_first_name || '%'
        THEN 20
        
        ELSE 0
      END as match_score,
      
      -- Match quality category
      CASE 
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
          AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
          AND gf.name IS NOT NULL AND LOWER(TRIM(gf.name)) = LOWER(TRIM(v_grandfather_name))
        THEN 'perfect'
        
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name)) 
          AND f.name IS NOT NULL AND LOWER(TRIM(f.name)) = LOWER(TRIM(v_father_name))
        THEN 'excellent'
        
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
          AND f.name IS NOT NULL AND f.name ILIKE '%' || v_father_name || '%'
        THEN 'good'
        
        WHEN LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        THEN 'fair'
        
        ELSE 'weak'
      END as match_quality
      
    FROM profiles p
    LEFT JOIN profiles f ON p.father_id = f.id
    LEFT JOIN profiles gf ON f.father_id = gf.id  
    LEFT JOIN profiles ggf ON gf.father_id = ggf.id
    LEFT JOIN all_chains ac ON ac.id = p.id
    LEFT JOIN family_stats fs ON fs.id = p.id
    WHERE 
      p.deleted_at IS NULL
      AND (
        -- Exact first name match
        LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        -- OR partial match (less preferred)
        OR (v_first_name != '' AND p.name ILIKE '%' || v_first_name || '%')
      )
  )
  SELECT 
    m.id,
    m.name,
    m.full_chain,
    m.generation,
    m.has_auth,
    m.match_quality,
    m.match_score,
    m.father_name,
    m.grandfather_name,
    m.great_grandfather_name,
    m.siblings_count,
    m.children_count
  FROM matches m
  WHERE m.match_score > 0
  ORDER BY 
    m.match_score DESC,           -- Best matches first
    m.has_auth ASC,               -- Unclaimed profiles first within same score
    m.generation DESC,            -- Older generations first
    m.name ASC                    -- Alphabetical as last resort
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_profiles_by_name_chain TO anon, authenticated;