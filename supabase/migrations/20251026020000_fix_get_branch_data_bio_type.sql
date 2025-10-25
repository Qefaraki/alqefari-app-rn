-- Fix get_branch_data() - Update bio column type to match table schema
--
-- Root cause: Migration 20251025_increase_bio_field_to_1000.sql changed profiles.bio
-- from TEXT to VARCHAR(1000), but get_branch_data() still declared bio TEXT in RETURNS TABLE
-- Impact: PostgreSQL type mismatch error 42804 when calling get_branch_data()
-- Error: "structure of query does not match function result type"
-- Triggered by: Profile refresh after marriage deletion
--
-- This migration:
-- 1. Updates RETURNS TABLE bio type from TEXT to VARCHAR(1000)
-- 2. Matches the schema change from 20251025_increase_bio_field_to_1000.sql
-- 3. Maintains all other RPC logic unchanged

DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_branch_data(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 200
)
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
    full_name_chain TEXT,
    dob_data JSONB,
    dod_data JSONB,
    dob_is_public BOOLEAN,
    birth_place TEXT,
    birth_place_normalized JSONB,
    current_residence TEXT,
    current_residence_normalized JSONB,
    occupation TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    bio VARCHAR(1000),
    achievements TEXT[],
    timeline JSONB,
    social_media_links JSONB,
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,
    version INT,
    profile_visibility TEXT,
    role TEXT,
    user_id UUID,
    family_origin TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Input validation (max_depth 1-15, limit 1-10000)
    IF p_max_depth < 1 OR p_max_depth > 15 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 15';
    END IF;

    IF p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'limit must be between 1 and 10000';
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
            build_name_chain(p.id) AS full_name_chain,
            p.dob_data,
            p.dod_data,
            p.dob_is_public,
            p.birth_place,
            p.birth_place_normalized,
            p.current_residence,
            p.current_residence_normalized,
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
            AND p.hid NOT LIKE 'TEST%'  -- Only exclude TEST profiles, NOT R% profiles!
            AND (
                (p_hid IS NULL AND p.generation = 1)
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
            build_name_chain(p.id) AS full_name_chain,
            p.dob_data,
            p.dod_data,
            p.dob_is_public,
            p.birth_place,
            p.birth_place_normalized,
            p.current_residence,
            p.current_residence_normalized,
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
            AND p.hid NOT LIKE 'TEST%'
            AND b.relative_depth < p_max_depth - 1
    ),
    -- Deduplicate profiles reached via multiple paths (cousin marriages)
    deduplicated AS (
        SELECT DISTINCT ON (b.id)
            b.*  -- All fields from branch CTE
        FROM branch b
        ORDER BY b.id, b.relative_depth ASC  -- Keep shortest path to each profile
    )
    -- Final SELECT with proper ordering
    SELECT
        d.id,
        d.hid,
        d.name,
        d.father_id,
        d.mother_id,
        d.generation,
        d.sibling_order,
        d.kunya,
        d.nickname,
        d.gender,
        d.status,
        d.photo_url,
        d.professional_title,
        d.title_abbreviation,
        d.full_name_chain,
        d.dob_data,
        d.dod_data,
        d.dob_is_public,
        d.birth_place,
        d.birth_place_normalized,
        d.current_residence,
        d.current_residence_normalized,
        d.occupation,
        d.education,
        d.phone,
        d.email,
        d.bio,
        d.achievements,
        d.timeline,
        d.social_media_links,
        d.layout_position,
        COALESCE(d.descendants_count, 0)::INT as descendants_count,
        CASE
            WHEN d.relative_depth = p_max_depth - 1 THEN
                EXISTS(
                    SELECT 1 FROM profiles c
                    WHERE (c.father_id = d.id OR c.mother_id = d.id)
                    AND c.deleted_at IS NULL
                    AND c.hid IS NOT NULL
                    LIMIT 1
                )
            ELSE FALSE
        END as has_more_descendants,
        d.version,
        d.profile_visibility,
        d.role,
        d.user_id,
        d.family_origin,
        d.created_at,
        d.updated_at
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order
    LIMIT p_limit;
END;
$function$;

-- Restore grants
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- Verification query:
-- SELECT bio FROM get_branch_data(NULL, 1, 1);  -- Should return bio without type mismatch error
