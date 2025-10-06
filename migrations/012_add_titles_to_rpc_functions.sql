-- Migration 012: Add professional title fields to RPC functions
-- Issue: Titles save correctly but disappear on app restart and don't show in search
-- Root cause: get_branch_data() and search_name_chain() don't return title columns
-- Solution: Add professional_title and title_abbreviation to both functions

-- ============================================================================
-- PART 1: Update get_branch_data() function
-- ============================================================================

DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 100
)
RETURNS TABLE(
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    photo_url TEXT,
    status TEXT,
    current_residence TEXT,
    occupation TEXT,
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,
    dob_data JSONB,
    dod_data JSONB,
    version INT,
    professional_title TEXT,        -- ✅ ADDED
    title_abbreviation TEXT          -- ✅ ADDED
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Input validation
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
    END IF;

    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;

    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: starting nodes
        SELECT
            p.id,
            p.hid,
            p.name,
            p.father_id,
            p.mother_id,
            p.generation,
            p.sibling_order,
            p.gender,
            p.photo_url,
            p.status,
            p.current_residence,
            p.occupation,
            p.layout_position,
            p.descendants_count,
            p.dob_data,
            p.dod_data,
            p.version,
            p.professional_title,        -- ✅ ADDED
            p.title_abbreviation,        -- ✅ ADDED
            0 as relative_depth
        FROM profiles p
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND (
                (p_hid IS NULL AND p.generation = 1
                 AND p.hid NOT LIKE 'R%'
                 AND p.name != 'Test Admin')
                OR
                (p_hid IS NOT NULL AND p.hid = p_hid)
            )

        UNION ALL

        -- Recursive case: get children
        SELECT
            p.id,
            p.hid,
            p.name,
            p.father_id,
            p.mother_id,
            p.generation,
            p.sibling_order,
            p.gender,
            p.photo_url,
            p.status,
            p.current_residence,
            p.occupation,
            p.layout_position,
            p.descendants_count,
            p.dob_data,
            p.dod_data,
            p.version,
            p.professional_title,        -- ✅ ADDED
            p.title_abbreviation,        -- ✅ ADDED
            b.relative_depth + 1
        FROM profiles p
        INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND b.relative_depth < p_max_depth - 1
    )
    -- Final SELECT
    SELECT
        b.id,
        b.hid,
        b.name,
        b.father_id,
        b.mother_id,
        b.generation,
        b.sibling_order,
        b.gender,
        b.photo_url,
        b.status,
        b.current_residence,
        b.occupation,
        b.layout_position,
        COALESCE(b.descendants_count, 0)::INT as descendants_count,
        CASE
            WHEN b.relative_depth = p_max_depth - 1 THEN
                EXISTS(
                    SELECT 1 FROM profiles c
                    WHERE (c.father_id = b.id OR c.mother_id = b.id)
                    AND c.deleted_at IS NULL
                    AND c.hid IS NOT NULL
                    LIMIT 1
                )
            ELSE FALSE
        END as has_more_descendants,
        b.dob_data,
        b.dod_data,
        b.version,
        b.professional_title,            -- ✅ ADDED
        b.title_abbreviation             -- ✅ ADDED
    FROM branch b
    ORDER BY b.generation, b.sibling_order
    LIMIT p_limit;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- ============================================================================
-- PART 2: Update search_name_chain() function
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
  professional_title TEXT,           -- ✅ ADDED
  title_abbreviation TEXT            -- ✅ ADDED
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
      p.professional_title,              -- ✅ ADDED
      p.title_abbreviation               -- ✅ ADDED
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
      a.professional_title,              -- ✅ ADDED
      a.title_abbreviation               -- ✅ ADDED
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
      m.professional_title,              -- ✅ ADDED
      m.title_abbreviation               -- ✅ ADDED
    FROM ancestry m
    WHERE
      (
        m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names
        OR
        m.name_array @> v_normalized_names
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
    m.professional_title,                -- ✅ ADDED
    m.title_abbreviation                 -- ✅ ADDED
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
COMMENT ON FUNCTION search_name_chain IS 'Search profiles by Arabic name chains with professional titles';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 012 complete:';
  RAISE NOTICE '   - get_branch_data() now returns professional_title and title_abbreviation';
  RAISE NOTICE '   - search_name_chain() now returns professional_title and title_abbreviation';
  RAISE NOTICE '   - Titles will persist across app restarts';
  RAISE NOTICE '   - Search results will show titles';
END $$;
