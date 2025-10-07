-- Migration 015: Add professional title search (e.g., "د." matching Dr. Ali)
-- Issue: search_name_chain only searches name field, ignoring title_abbreviation and professional_title
-- Root cause: WHERE clause in matches CTE only checks m.name_array, never m.title_abbreviation
-- Solution: Add title matching for single-name searches
-- Example: "د." → Shows "د. علي بن باسل القفاري"

-- ============================================================================
-- PART 1: Add trigram indexes for title fields
-- ============================================================================

-- Add trigram index on profiles.title_abbreviation for partial text matching
-- This speeds up ILIKE queries on titles (e.g., "د." → "د.")
CREATE INDEX IF NOT EXISTS idx_profiles_title_abbreviation_trgm
  ON profiles USING gin(title_abbreviation gin_trgm_ops);

-- Add trigram index on profiles.professional_title for partial text matching
-- This speeds up ILIKE queries on professional titles (e.g., "doctor" → "doctor")
CREATE INDEX IF NOT EXISTS idx_profiles_professional_title_trgm
  ON profiles USING gin(professional_title gin_trgm_ops);

-- ============================================================================
-- PART 2: Update search_name_chain with title matching support
-- ============================================================================

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
  grandfather_name TEXT,
  professional_title TEXT,
  title_abbreviation TEXT
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
      ARRAY[p.id] as visited_ids,
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      -- Extract year from JSONB dob_data
      CASE
        WHEN p.dob_data->>'hijri' IS NOT NULL
        THEN (p.dob_data->'hijri'->>'year')::INT
        ELSE NULL
      END as birth_year_hijri,
      -- Extract year from JSONB dod_data
      CASE
        WHEN p.dod_data->>'hijri' IS NOT NULL
        THEN (p.dod_data->'hijri'->>'year')::INT
        ELSE NULL
      END as death_year_hijri,
      p.professional_title,
      p.title_abbreviation
    FROM profiles p
    WHERE p.deleted_at IS NULL

    UNION ALL

    -- Recursive case: build complete chains up to root
    SELECT
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' بن ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      a.professional_title,
      a.title_abbreviation
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))
      AND a.depth < 20
  ),
  matches AS (
    -- Find matches and calculate scores
    SELECT DISTINCT ON (m.id)
      m.id,
      m.hid,
      m.name,
      -- Build display chain
      CASE
        WHEN array_length(m.display_names, 1) > 1 THEN
          array_to_string(m.display_names[1:least(array_length(m.display_names, 1), 5)], ' بن ')
        ELSE m.name
      END as name_chain,
      m.generation,
      m.photo_url,
      m.birth_year_hijri,
      m.death_year_hijri,
      -- Calculate match score
      (CASE
        -- Title matches get highest priority (4.0)
        WHEN m.title_abbreviation IS NOT NULL
          AND m.title_abbreviation ILIKE v_normalized_names[1] || '%' THEN 4.0
        WHEN m.professional_title IS NOT NULL
          AND m.professional_title ILIKE v_normalized_names[1] || '%' THEN 4.0
        -- Name matches
        WHEN m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names THEN 3.0
        WHEN m.name_array[1:array_length(v_normalized_names, 1)] @> v_normalized_names THEN 2.5
        WHEN m.name_array @> v_normalized_names THEN 2.0
        ELSE 1.0
      END)::DOUBLE PRECISION as match_score,
      -- Match depth
      CASE
        WHEN m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names
        THEN array_length(v_normalized_names, 1)
        ELSE (
          SELECT COUNT(*)::INT
          FROM unnest(m.name_array) AS elem
          WHERE elem = ANY(v_normalized_names)
        )
      END as match_depth,
      -- Father and grandfather names
      CASE WHEN array_length(m.display_names, 1) > 1
        THEN m.display_names[2]
        ELSE NULL
      END as father_name,
      CASE WHEN array_length(m.display_names, 1) > 2
        THEN m.display_names[3]
        ELSE NULL
      END as grandfather_name,
      m.professional_title,
      m.title_abbreviation
    FROM ancestry m
    WHERE
      v_normalized_names[1] != ''  -- ✅ GUARD: Prevent empty string from matching everything
      AND (
        -- 1. Exact prefix match (existing)
        m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names

        OR

        -- 2. Contains all elements (existing)
        m.name_array @> v_normalized_names

        OR

        -- 3. Single-name partial match (Migration 014)
        --    Allows "عل" to match "علي" using prefix matching
        (
          array_length(v_normalized_names, 1) = 1
          AND m.name_array[1] ILIKE v_normalized_names[1] || '%'
        )

        OR

        -- 4. Title abbreviation match (NEW - Migration 015)
        --    Allows "د." to match profiles with title_abbreviation = "د."
        --    Only for single-name searches
        (
          array_length(v_normalized_names, 1) = 1
          AND m.title_abbreviation IS NOT NULL
          AND m.title_abbreviation ILIKE v_normalized_names[1] || '%'
        )

        OR

        -- 5. Professional title match (NEW - Migration 015)
        --    Allows "doctor" to match profiles with professional_title = "doctor"
        --    Only for single-name searches
        (
          array_length(v_normalized_names, 1) = 1
          AND m.professional_title IS NOT NULL
          AND m.professional_title ILIKE v_normalized_names[1] || '%'
        )
      )
    ORDER BY m.id, m.depth DESC
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
    m.grandfather_name,
    m.professional_title,
    m.title_abbreviation
  FROM matches m
  ORDER BY
    m.match_score DESC,
    m.match_depth DESC,
    m.generation ASC,
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION search_name_chain IS 'Search profiles by Arabic name chains with partial matching and title support (Migration 015)';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 015 complete:';
  RAISE NOTICE '   - Added trigram indexes on title_abbreviation and professional_title';
  RAISE NOTICE '   - Updated search_name_chain with title matching:';
  RAISE NOTICE '     • Title abbreviation match (e.g., "د." matches "د.")';
  RAISE NOTICE '     • Professional title match (e.g., "doctor" matches "doctor")';
  RAISE NOTICE '     • Title matches get highest priority (score 4.0)';
  RAISE NOTICE '   - Search should now work for both names AND titles';
END $$;
