-- Migration 008: Add version column to get_branch_data function
-- Issue: get_branch_data doesn't return version, causing frontend to have undefined version
-- This leads to version mismatch errors when saving profiles
-- Solution: Add version to RETURNS TABLE and all SELECT statements

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
    version INT  -- ✅ ADDED: Version column for optimistic locking
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
            p.version,  -- ✅ ADDED
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
            p.version,  -- ✅ ADDED
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
        b.version  -- ✅ ADDED
    FROM branch b
    ORDER BY b.generation, b.sibling_order
    LIMIT p_limit;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- Verify the function returns version column
DO $$
DECLARE
    v_test_result RECORD;
BEGIN
    -- Test that function returns version column
    SELECT * INTO v_test_result FROM get_branch_data(NULL, 1, 1) LIMIT 1;

    IF v_test_result.version IS NULL THEN
        RAISE WARNING 'Version column exists but is NULL - this is normal if profiles have NULL version';
    ELSE
        RAISE NOTICE '✅ Version column successfully added to get_branch_data (value: %)', v_test_result.version;
    END IF;
EXCEPTION
    WHEN undefined_column THEN
        RAISE EXCEPTION '❌ Version column not found in get_branch_data result';
END $$;
