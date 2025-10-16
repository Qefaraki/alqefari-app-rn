-- Add missing profile fields to search_profiles_by_name_chain RPC
-- This fixes the bug where SpouseManager was filtering out all results
-- because the RPC didn't return the 'gender' field needed for filtering.
--
-- Added fields:
-- - gender (required for spouse gender filtering)
-- - photo_url (for avatar display)
-- - hid (for Al-Qefari vs Munasib identification)
-- - status (for profile status display)
-- - father_id (for relationship calculations)

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
  children_count INT,
  -- NEW FIELDS:
  gender TEXT,
  photo_url TEXT,
  hid TEXT,
  status TEXT,
  father_id UUID
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
  v_names := ARRAY(SELECT x FROM unnest(v_names) AS x WHERE x != '');

  v_first_name := COALESCE(v_names[1], '');
  v_father_name := COALESCE(v_names[2], '');
  v_grandfather_name := COALESCE(v_names[3], '');

  -- Return empty if no name provided
  IF v_first_name = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH recursive ancestry AS (
    -- Get the full ancestry chain for each profile
    SELECT
      p.id,
      p.name,
      p.father_id,
      p.generation,
      ARRAY[p.name]::TEXT[] as name_chain,
      1 as depth
    FROM profiles p
    WHERE p.deleted_at IS NULL
      AND p.user_id IS NULL      -- Only search unclaimed profiles
      AND p.hid IS NOT NULL       -- Exclude Munasib (spouse) profiles

    UNION ALL

    SELECT
      a.id,
      a.name,
      p.father_id,
      a.generation,
      a.name_chain || p.name,
      a.depth + 1
    FROM ancestry a
    JOIN profiles p ON p.id = a.father_id
    WHERE p.deleted_at IS NULL AND a.depth < 10
  ),
  max_ancestry AS (
    -- Get the maximum depth chain for each profile
    SELECT DISTINCT ON (ancestry.id)
      ancestry.id,
      ancestry.name_chain
    FROM ancestry
    ORDER BY ancestry.id, ancestry.depth DESC
  ),
  family_stats AS (
    -- Pre-calculate family statistics
    SELECT
      p.id,
      COUNT(DISTINCT s.id)::INT as siblings_count,
      COUNT(DISTINCT c.id)::INT as children_count
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
      -- Build full chain string
      array_to_string(ma.name_chain, ' ') as full_chain,
      p.generation,
      p.user_id IS NOT NULL as has_auth,

      -- Get ancestor names
      f.name as father_name,
      gf.name as grandfather_name,
      ggf.name as great_grandfather_name,

      -- Family stats
      COALESCE(fs.siblings_count, 0) as siblings_count,
      COALESCE(fs.children_count, 0) as children_count,

      -- NEW FIELDS:
      p.gender,
      p.photo_url,
      p.hid,
      p.status,
      p.father_id,

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
    LEFT JOIN max_ancestry ma ON ma.id = p.id
    LEFT JOIN family_stats fs ON fs.id = p.id
    WHERE
      p.deleted_at IS NULL
      AND p.user_id IS NULL      -- Only search unclaimed profiles
      AND p.hid IS NOT NULL       -- Exclude Munasib (spouse) profiles
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
    m.children_count,
    -- NEW FIELDS:
    m.gender,
    m.photo_url,
    m.hid,
    m.status,
    m.father_id
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

COMMENT ON FUNCTION search_profiles_by_name_chain IS
  'Search profiles by name chain with full profile fields for SpouseManager filtering. Returns unclaimed Al-Qefari profiles with match scores, name chains, and all essential profile data including gender for filtering.';
