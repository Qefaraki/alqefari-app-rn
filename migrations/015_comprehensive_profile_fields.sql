-- Migration 015: Comprehensive Profile Fields
-- Issue: Fields like achievements, timeline, bio, etc. save correctly but disappear on reload
-- Root Cause: RPC functions don't return all profile fields
-- Solution: Add ALL missing fields to profile-fetching RPC functions
-- Created: 2025-01-10

-- ============================================================================
-- PART 1: Update get_branch_data() to return ALL profile fields
-- ============================================================================

DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 100
)
RETURNS TABLE(
    -- Core IDs and relationships
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,

    -- Name variants
    kunya TEXT,
    nickname TEXT,

    -- Basic info
    gender TEXT,
    status TEXT,
    photo_url TEXT,

    -- Titles (migration 012)
    professional_title TEXT,
    title_abbreviation TEXT,

    -- Dates
    dob_data JSONB,
    dod_data JSONB,
    dob_is_public BOOLEAN,

    -- Location and work
    birth_place TEXT,
    current_residence TEXT,
    occupation TEXT,
    education TEXT,

    -- Contact
    phone TEXT,
    email TEXT,

    -- Rich content (THE FIX - THESE WERE MISSING!)
    bio TEXT,
    achievements TEXT[],
    timeline JSONB,
    social_media_links JSONB,

    -- Tree metadata
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,

    -- System fields
    version INT,
    profile_visibility TEXT,
    role TEXT,
    user_id UUID,
    family_origin TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
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
            p.kunya,
            p.nickname,
            p.gender,
            p.status,
            p.photo_url,
            p.professional_title,
            p.title_abbreviation,
            p.dob_data,
            p.dod_data,
            p.dob_is_public,
            p.birth_place,
            p.current_residence,
            p.occupation,
            p.education,
            p.phone,
            p.email,
            p.bio,
            p.achievements,
            p.timeline,
            p.social_media_links,
            p.layout_position,
            p.descendants_count,
            p.version,
            p.profile_visibility,
            p.role,
            p.user_id,
            p.family_origin,
            p.created_at,
            p.updated_at,
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
            p.kunya,
            p.nickname,
            p.gender,
            p.status,
            p.photo_url,
            p.professional_title,
            p.title_abbreviation,
            p.dob_data,
            p.dod_data,
            p.dob_is_public,
            p.birth_place,
            p.current_residence,
            p.occupation,
            p.education,
            p.phone,
            p.email,
            p.bio,
            p.achievements,
            p.timeline,
            p.social_media_links,
            p.layout_position,
            p.descendants_count,
            p.version,
            p.profile_visibility,
            p.role,
            p.user_id,
            p.family_origin,
            p.created_at,
            p.updated_at,
            b.relative_depth + 1
        FROM profiles p
        INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND b.relative_depth < p_max_depth - 1
    )
    -- Final SELECT with all fields
    SELECT
        b.id,
        b.hid,
        b.name,
        b.father_id,
        b.mother_id,
        b.generation,
        b.sibling_order,
        b.kunya,
        b.nickname,
        b.gender,
        b.status,
        b.photo_url,
        b.professional_title,
        b.title_abbreviation,
        b.dob_data,
        b.dod_data,
        b.dob_is_public,
        b.birth_place,
        b.current_residence,
        b.occupation,
        b.education,
        b.phone,
        b.email,
        b.bio,
        b.achievements,
        b.timeline,
        b.social_media_links,
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
        b.version,
        b.profile_visibility,
        b.role,
        b.user_id,
        b.family_origin,
        b.created_at,
        b.updated_at
    FROM branch b
    ORDER BY b.generation, b.sibling_order
    LIMIT p_limit;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- ============================================================================
-- PART 2: Update search_name_chain() to include missing fields
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
  title_abbreviation TEXT,
  kunya TEXT,
  bio TEXT,
  phone TEXT,
  email TEXT,
  achievements TEXT[],
  timeline JSONB
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
      CASE
        WHEN p.dob_data->>'hijri' IS NOT NULL
        THEN (p.dob_data->'hijri'->>'year')::INT
        ELSE NULL
      END as birth_year_hijri,
      CASE
        WHEN p.dod_data->>'hijri' IS NOT NULL
        THEN (p.dod_data->'hijri'->>'year')::INT
        ELSE NULL
      END as death_year_hijri,
      p.professional_title,
      p.title_abbreviation,
      p.kunya,
      p.bio,
      p.phone,
      p.email,
      p.achievements,
      p.timeline
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
      a.title_abbreviation,
      a.kunya,
      a.bio,
      a.phone,
      a.email,
      a.achievements,
      a.timeline
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
      m.professional_title,
      m.title_abbreviation,
      m.kunya,
      m.bio,
      m.phone,
      m.email,
      m.achievements,
      m.timeline
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
    m.professional_title,
    m.title_abbreviation,
    m.kunya,
    m.bio,
    m.phone,
    m.email,
    m.achievements,
    m.timeline
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

-- ============================================================================
-- PART 3: Create new get_full_profile_by_id() for complete profile fetching
-- ============================================================================

CREATE OR REPLACE FUNCTION get_full_profile_by_id(p_id UUID)
RETURNS TABLE(
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    kunya TEXT,
    nickname TEXT,
    gender TEXT,
    status TEXT,
    photo_url TEXT,
    professional_title TEXT,
    title_abbreviation TEXT,
    dob_data JSONB,
    dod_data JSONB,
    dob_is_public BOOLEAN,
    birth_place TEXT,
    current_residence TEXT,
    occupation TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    bio TEXT,
    achievements TEXT[],
    timeline JSONB,
    social_media_links JSONB,
    layout_position JSONB,
    descendants_count INT,
    version INT,
    profile_visibility TEXT,
    role TEXT,
    user_id UUID,
    family_origin TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.hid,
        p.name,
        p.father_id,
        p.mother_id,
        p.generation,
        p.sibling_order,
        p.kunya,
        p.nickname,
        p.gender,
        p.status,
        p.photo_url,
        p.professional_title,
        p.title_abbreviation,
        p.dob_data,
        p.dod_data,
        p.dob_is_public,
        p.birth_place,
        p.current_residence,
        p.occupation,
        p.education,
        p.phone,
        p.email,
        p.bio,
        p.achievements,
        p.timeline,
        p.social_media_links,
        p.layout_position,
        p.descendants_count,
        p.version,
        p.profile_visibility,
        p.role,
        p.user_id,
        p.family_origin,
        p.created_at,
        p.updated_at,
        p.deleted_at
    FROM profiles p
    WHERE p.id = p_id;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_full_profile_by_id TO authenticated;

-- ============================================================================
-- Verification and Documentation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 015 complete: Comprehensive Profile Fields';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed Functions:';
  RAISE NOTICE '  1. get_branch_data() - Now returns ALL 36 profile fields';
  RAISE NOTICE '     ✓ Added: kunya, nickname, bio, birth_place, education';
  RAISE NOTICE '     ✓ Added: phone, email, social_media_links';
  RAISE NOTICE '     ✓ Added: achievements, timeline (THE FIX!)';
  RAISE NOTICE '     ✓ Added: dob_is_public, profile_visibility, role, user_id, family_origin';
  RAISE NOTICE '';
  RAISE NOTICE '  2. search_name_chain() - Now returns extended profile data';
  RAISE NOTICE '     ✓ Added: kunya, bio, phone, email, achievements, timeline';
  RAISE NOTICE '';
  RAISE NOTICE '  3. get_full_profile_by_id() - NEW function for complete profiles';
  RAISE NOTICE '     ✓ Returns ALL fields including system timestamps';
  RAISE NOTICE '';
  RAISE NOTICE 'Result: achievements and timeline will now persist across save/reload!';
  RAISE NOTICE 'No more "weird dance" - all fields available everywhere.';
END $$;
