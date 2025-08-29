-- Fix get_branch_data to handle NULL p_hid (for root nodes)
CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT DEFAULT NULL,
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
    has_more_descendants BOOLEAN
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
    
    -- If p_hid is NULL, return root nodes (generation 1)
    IF p_hid IS NULL THEN
        RETURN QUERY
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
            p.descendants_count > 0 as has_more_descendants
        FROM profiles p
        WHERE p.generation = 1 
        AND p.deleted_at IS NULL
        ORDER BY p.hid
        LIMIT p_limit;
        
        RETURN;
    END IF;
    
    -- Get the root node's depth
    SELECT LENGTH(p_hid) - LENGTH(REPLACE(p_hid, '.', '')) + 1 INTO root_depth;
    
    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: the root node
        SELECT p.*, 0 as relative_depth
        FROM profiles p
        WHERE p.hid = p_hid AND p.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: children up to max depth
        SELECT p.*, b.relative_depth + 1
        FROM profiles p
        INNER JOIN branch b ON p.father_id = b.id
        WHERE p.deleted_at IS NULL
        AND b.relative_depth < p_max_depth - 1
    )
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
        b.descendants_count,
        -- Check if this node has children beyond the depth limit
        CASE 
            WHEN b.relative_depth = p_max_depth - 1 THEN
                EXISTS(
                    SELECT 1 FROM profiles c 
                    WHERE c.father_id = b.id 
                    AND c.deleted_at IS NULL
                )
            ELSE FALSE
        END as has_more_descendants
    FROM branch b
    ORDER BY b.generation, b.father_id, b.sibling_order
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;