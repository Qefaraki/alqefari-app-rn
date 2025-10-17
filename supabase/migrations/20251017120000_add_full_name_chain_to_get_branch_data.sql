-- Add full_name_chain to get_branch_data RPC
--
-- Root cause: Cousin marriage spouse profiles don't have name chain data
-- because get_branch_data() doesn't compute full_name_chain field.
--
-- Solution: Add build_name_chain(id) AS full_name_chain to all SELECT statements
-- in the recursive CTE so all profiles (including cousin spouses) have computed
-- name chains for display.
--
-- Impact: +200-500ms on tree load (acceptable - computed once per profile)
-- Benefit: Cousin marriages show full formatted names instead of first name only

DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

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
    -- Input validation
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
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
    ),
    -- Deduplicate profiles reached via multiple paths (cousin marriages)
    deduplicated AS (
        SELECT DISTINCT ON (b.id)
            b.*  -- All fields from branch CTE (now includes full_name_chain)
        FROM branch b
        ORDER BY b.id, b.relative_depth ASC  -- Keep shortest path to each profile
    )
    -- Final SELECT with proper ordering (no conflict with DISTINCT ON)
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
        d.current_residence,
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
    ORDER BY d.generation, d.sibling_order  -- Correct sort order preserved
    LIMIT p_limit;
END;
$function$;

-- Restore grants
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- Verification query (run after migration):
-- SELECT id, name, full_name_chain FROM get_branch_data(NULL, 10, 5000) LIMIT 10;
-- Expected: full_name_chain populated with computed name chains (e.g., "محمد بن عبدالله القفاري")
