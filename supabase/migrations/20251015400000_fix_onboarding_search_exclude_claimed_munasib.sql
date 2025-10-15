-- Fix onboarding search to exclude claimed profiles and Munasib (spouses)
-- This migration resolves two critical bugs:
-- 1. NaN% match score - RPC returned all profiles, JS filtered claimed ones, forcing fallback
-- 2. Missing name chains - Fallback query doesn't build full_chain field
--
-- Root cause: Migration 20251015300000 accidentally omitted critical filters that existed in
-- archived migrations 011 and 059. This migration restores the correct behavior.
--
-- Changes from 20251015300000:
-- - Added: p.user_id IS NULL filter (exclude claimed profiles)
-- - Added: p.hid IS NOT NULL filter (exclude Munasib/spouse profiles)
-- - Fixed: array_to_string third parameter (removed incorrect 'القفاري')

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
      AND p.user_id IS NULL      -- CRITICAL FIX: Only search unclaimed profiles
      AND p.hid IS NOT NULL       -- CRITICAL FIX: Exclude Munasib (spouse) profiles

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
      -- Build full chain string (FIXED: removed incorrect third parameter 'القفاري')
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
      AND p.user_id IS NULL      -- CRITICAL FIX: Only search unclaimed profiles
      AND p.hid IS NOT NULL       -- CRITICAL FIX: Exclude Munasib (spouse) profiles
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
