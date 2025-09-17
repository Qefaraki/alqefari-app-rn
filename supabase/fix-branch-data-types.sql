-- FIX: Correct data types for get_branch_data function
-- This fixes the type mismatch error while maintaining exact behavior

-- Drop all versions
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc 
        WHERE proname = 'get_branch_data'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- Create with CORRECT data types
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
DECLARE
    root_depth INT;
BEGIN
    -- Input validation
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
    END IF;
    
    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;

    -- Handle NULL p_hid for root nodes
    IF p_hid IS NULL THEN
        root_depth := 1;
    ELSE
        SELECT p.generation INTO root_depth
        FROM profiles p
        WHERE p.hid = p_hid;
        
        IF root_depth IS NULL THEN
            RAISE EXCEPTION 'Profile with hid % not found', p_hid;
        END IF;
    END IF;

    RETURN QUERY
    WITH RECURSIVE descendant_tree AS (
        -- Base case: starting node(s)
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
            0 as relative_depth,
            COUNT(c.id) OVER (PARTITION BY p.id) as child_count
        FROM profiles p
        LEFT JOIN profiles c ON c.father_id = p.id OR c.mother_id = p.id
        WHERE (p_hid IS NULL AND p.generation = 1 AND p.hid NOT LIKE 'R%' AND p.hid NOT LIKE 'TEST%')  -- Exclude test profiles
           OR (p_hid IS NOT NULL AND p.hid = p_hid)
        
        UNION ALL
        
        -- Recursive case: get descendants
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
            dt.relative_depth + 1,
            COUNT(c.id) OVER (PARTITION BY p.id) as child_count
        FROM profiles p
        INNER JOIN descendant_tree dt ON (p.father_id = dt.id OR p.mother_id = dt.id)
        LEFT JOIN profiles c ON c.father_id = p.id OR c.mother_id = p.id
        WHERE dt.relative_depth < p_max_depth - 1
    ),
    descendants_summary AS (
        SELECT 
            dt.id,
            COUNT(DISTINCT p.id) as total_descendants
        FROM descendant_tree dt
        LEFT JOIN profiles p ON (p.father_id = dt.id OR p.mother_id = dt.id)
        GROUP BY dt.id
    )
    SELECT 
        dt.id,
        dt.hid,
        dt.name,
        dt.father_id,
        dt.mother_id,
        dt.generation,
        dt.sibling_order,
        dt.gender,
        dt.photo_url,
        dt.status,
        dt.current_residence,
        dt.occupation,
        dt.layout_position,
        COALESCE(ds.total_descendants, 0)::INT as descendants_count,
        CASE 
            WHEN dt.relative_depth >= p_max_depth - 1 AND dt.child_count > 0 THEN true
            ELSE false
        END as has_more_descendants,
        dt.dob_data,
        dt.dod_data
    FROM descendant_tree dt
    LEFT JOIN descendants_summary ds ON ds.id = dt.id
    WHERE dt.hid NOT LIKE 'R%' AND dt.hid NOT LIKE 'TEST%'  -- Filter out test profiles from results
    ORDER BY dt.generation, dt.sibling_order
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Test the function
DO $$
DECLARE
    test_result RECORD;
    node_count INT;
BEGIN
    -- Test with NULL (should return roots)
    SELECT COUNT(*) INTO node_count
    FROM get_branch_data(NULL, 3, 100);
    
    RAISE NOTICE 'Root query returns % nodes', node_count;
    
    -- Test with specific HID
    SELECT COUNT(*) INTO node_count
    FROM get_branch_data('1', 3, 100);
    
    RAISE NOTICE 'HID 1 query returns % nodes', node_count;
END $$;

SELECT 'Function fixed with correct types!' as status;