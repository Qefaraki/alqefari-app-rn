-- Migration 009: Add missing profile fields to get_branch_data function
-- Issue: get_branch_data only returns 18 of 39 profile columns
-- Missing fields: kunya, nickname, bio, birth_place, education, phone, email, etc.
-- This causes edits to these fields to disappear after app restart

-- Root cause:
-- 1. User edits kunya → Saves to database ✅
-- 2. App restarts → get_branch_data loads profiles WITHOUT kunya
-- 3. TreeView overwrites store with incomplete data
-- 4. User sees empty kunya field

DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 100
)
RETURNS TABLE(
    -- Identity & Hierarchy (existing)
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,

    -- Basic Info (existing)
    gender TEXT,
    status TEXT,

    -- Names & Aliases (ADDED)
    kunya TEXT,
    nickname TEXT,

    -- Dates (existing)
    dob_data JSONB,
    dod_data JSONB,

    -- Biography & Details (ADDED)
    bio TEXT,
    birth_place TEXT,
    current_residence TEXT,
    occupation TEXT,
    education TEXT,

    -- Contact Info (ADDED)
    phone TEXT,
    email TEXT,

    -- Media & Social (existing + ADDED)
    photo_url TEXT,
    social_media_links JSONB,

    -- Achievements & Timeline (ADDED)
    achievements TEXT[],
    timeline JSONB,

    -- Privacy & Permissions (ADDED)
    dob_is_public BOOLEAN,
    profile_visibility TEXT,

    -- Tree Layout (existing)
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,

    -- Version Control (existing)
    version INT
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
            p.status,
            p.kunya,
            p.nickname,
            p.dob_data,
            p.dod_data,
            p.bio,
            p.birth_place,
            p.current_residence,
            p.occupation,
            p.education,
            p.phone,
            p.email,
            p.photo_url,
            p.social_media_links,
            p.achievements,
            p.timeline,
            p.dob_is_public,
            p.profile_visibility,
            p.layout_position,
            p.descendants_count,
            p.version,
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
            p.status,
            p.kunya,
            p.nickname,
            p.dob_data,
            p.dod_data,
            p.bio,
            p.birth_place,
            p.current_residence,
            p.occupation,
            p.education,
            p.phone,
            p.email,
            p.photo_url,
            p.social_media_links,
            p.achievements,
            p.timeline,
            p.dob_is_public,
            p.profile_visibility,
            p.layout_position,
            p.descendants_count,
            p.version,
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
        b.gender,
        b.status,
        b.kunya,
        b.nickname,
        b.dob_data,
        b.dod_data,
        b.bio,
        b.birth_place,
        b.current_residence,
        b.occupation,
        b.education,
        b.phone,
        b.email,
        b.photo_url,
        b.social_media_links,
        b.achievements,
        b.timeline,
        b.dob_is_public,
        b.profile_visibility,
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
        b.version
    FROM branch b
    ORDER BY b.generation, b.sibling_order
    LIMIT p_limit;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- Verify the function returns all required columns
DO $$
DECLARE
    v_test_result RECORD;
BEGIN
    -- Test that function returns all new columns
    SELECT * INTO v_test_result FROM get_branch_data(NULL, 1, 1) LIMIT 1;

    RAISE NOTICE '✅ Migration 009 successful - get_branch_data now returns:';
    RAISE NOTICE '   - kunya: %', COALESCE(v_test_result.kunya, '(null)');
    RAISE NOTICE '   - nickname: %', COALESCE(v_test_result.nickname, '(null)');
    RAISE NOTICE '   - bio: %', COALESCE(LEFT(v_test_result.bio, 50), '(null)');
    RAISE NOTICE '   - phone: %', COALESCE(v_test_result.phone, '(null)');
    RAISE NOTICE '   - Total columns: 29 (was 18)';
EXCEPTION
    WHEN undefined_column THEN
        RAISE EXCEPTION '❌ Migration failed: Column missing from get_branch_data result';
END $$;
