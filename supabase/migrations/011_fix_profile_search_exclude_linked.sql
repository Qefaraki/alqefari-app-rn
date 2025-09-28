-- Fix the search_profiles_by_name_chain function to exclude already linked profiles
CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(p_name_chain TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  full_chain TEXT,
  generation INT,
  has_auth BOOLEAN,
  match_quality TEXT,
  match_score INT,
  father_name TEXT,
  grandfather_name TEXT,
  siblings_count BIGINT,
  children_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_names TEXT[];
  v_first_name TEXT;
  v_father_name TEXT;
  v_grandfather_name TEXT;
BEGIN
  -- Split the name chain by spaces and clean
  v_names := string_to_array(trim(p_name_chain), ' ');

  v_first_name := COALESCE(v_names[1], '');
  v_father_name := COALESCE(v_names[2], '');
  v_grandfather_name := COALESCE(v_names[3], '');

  -- Return empty if no name provided
  IF v_first_name = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE name_chain AS (
    -- Start with each matching profile
    SELECT
      p.id as profile_id,
      p.id as current_id,
      p.name::text as chain,
      p.father_id,
      1 as level
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.user_id IS NULL  -- CRITICAL: Only search unlinked profiles
      AND (
        LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
        OR p.name ILIKE '%' || v_first_name || '%'
      )

    UNION ALL

    -- Recursively build the chain by walking up father_id
    SELECT
      nc.profile_id,
      parent.id as current_id,
      nc.chain || ' ' || parent.name as chain,
      parent.father_id,
      nc.level + 1
    FROM name_chain nc
    INNER JOIN profiles parent ON parent.id = nc.father_id
    WHERE parent.deleted_at IS NULL
      AND nc.level < 50
  ),
  -- Get the longest chain for each profile
  full_chains AS (
    SELECT DISTINCT ON (profile_id)
      profile_id,
      chain || ' القفاري' as full_chain
    FROM name_chain
    ORDER BY profile_id, level DESC
  )
  SELECT
    p.id,
    p.name,
    COALESCE(fc.full_chain, p.name || ' القفاري') as full_chain,
    p.generation,
    false as has_auth,  -- Always false since we're only returning unlinked profiles

    -- Calculate match quality
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
    END as match_quality,

    -- Calculate match score
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
      ELSE 20
    END as match_score,

    f.name as father_name,
    gf.name as grandfather_name,

    -- Get sibling count
    (SELECT COUNT(*) FROM profiles s
     WHERE s.father_id = p.father_id
     AND s.id != p.id
     AND s.deleted_at IS NULL) as siblings_count,

    -- Get children count
    (SELECT COUNT(*) FROM profiles c
     WHERE c.father_id = p.id
     AND c.deleted_at IS NULL) as children_count

  FROM profiles p
  LEFT JOIN profiles f ON p.father_id = f.id
  LEFT JOIN profiles gf ON f.father_id = gf.id
  LEFT JOIN full_chains fc ON fc.profile_id = p.id
  WHERE
    p.deleted_at IS NULL
    AND p.user_id IS NULL  -- CRITICAL: Only return unlinked profiles
    AND (
      LOWER(TRIM(p.name)) = LOWER(TRIM(v_first_name))
      OR p.name ILIKE '%' || v_first_name || '%'
    )
  ORDER BY
    -- Order by match score
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
      ELSE 20
    END DESC,
    p.generation DESC,
    p.name ASC
  LIMIT 20;
END;
$$;