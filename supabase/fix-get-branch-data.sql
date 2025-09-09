-- Fix for multiple get_branch_data functions
-- This will drop ALL versions and create the correct one

-- Drop all existing versions of get_branch_data
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Find and drop all functions named get_branch_data
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc 
        WHERE proname = 'get_branch_data'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
        RAISE NOTICE 'Dropped: %', r.func_signature;
    END LOOP;
END $$;

-- Now create the correct version with date fields
CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
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
    dod_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE family_tree AS (
        -- Base case
        SELECT 
            p.*,
            0 as depth
        FROM profiles p
        WHERE 
            CASE 
                WHEN p_hid IS NULL THEN p.generation = 1
                ELSE p.hid = p_hid
            END
        
        UNION ALL
        
        -- Recursive case
        SELECT 
            p.*,
            ft.depth + 1
        FROM profiles p
        INNER JOIN family_tree ft ON p.father_id = ft.id OR p.mother_id = ft.id
        WHERE ft.depth < p_max_depth - 1
    )
    SELECT 
        ft.id,
        ft.hid,
        ft.name,
        ft.father_id,
        ft.mother_id,
        ft.generation,
        ft.sibling_order,
        ft.gender,
        ft.photo_url,
        ft.status,
        ft.current_residence,
        ft.occupation,
        ft.layout_position,
        COALESCE(
            (SELECT COUNT(*)::INT FROM profiles WHERE father_id = ft.id OR mother_id = ft.id),
            0
        ) as descendants_count,
        CASE 
            WHEN ft.depth >= p_max_depth - 1 THEN
                EXISTS(SELECT 1 FROM profiles WHERE father_id = ft.id OR mother_id = ft.id)
            ELSE 
                false
        END as has_more_descendants,
        ft.dob_data,
        ft.dod_data
    FROM family_tree ft
    ORDER BY ft.generation, ft.sibling_order, ft.hid
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Test that it works
SELECT 'Testing function...' as status;
SELECT COUNT(*) as test_count FROM get_branch_data(NULL, 1, 1);
SELECT 'Function created successfully!' as status;