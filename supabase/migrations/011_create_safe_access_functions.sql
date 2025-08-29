-- Safe Frontend Access Functions with Data Virtualization

-- Rename dangerous full tree function and restrict access
ALTER FUNCTION IF EXISTS get_tree_data() RENAME TO internal_get_full_tree_for_layout;

-- Revoke public access to internal function
REVOKE EXECUTE ON FUNCTION internal_get_full_tree_for_layout FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal_get_full_tree_for_layout FROM anon;
REVOKE EXECUTE ON FUNCTION internal_get_full_tree_for_layout FROM authenticated;

-- Grant only to service role (for Edge Functions)
GRANT EXECUTE ON FUNCTION internal_get_full_tree_for_layout TO service_role;

-- Safe function to get branch data with depth limit
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

-- Function to get nodes visible in viewport
CREATE OR REPLACE FUNCTION get_visible_nodes(
    p_viewport JSONB,
    p_zoom_level FLOAT DEFAULT 1.0,
    p_limit INT DEFAULT 200
)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    photo_url TEXT,
    layout_position JSONB,
    node_width INT,
    node_height INT
) AS $$
DECLARE
    viewport_left FLOAT;
    viewport_top FLOAT;
    viewport_right FLOAT;
    viewport_bottom FLOAT;
    node_size_threshold INT;
BEGIN
    -- Extract viewport bounds
    viewport_left := (p_viewport->>'left')::FLOAT;
    viewport_top := (p_viewport->>'top')::FLOAT;
    viewport_right := (p_viewport->>'right')::FLOAT;
    viewport_bottom := (p_viewport->>'bottom')::FLOAT;
    
    -- Determine node detail level based on zoom
    node_size_threshold := CASE
        WHEN p_zoom_level < 0.5 THEN 40  -- Show only large nodes
        WHEN p_zoom_level < 1.0 THEN 20  -- Show medium and large nodes
        ELSE 0  -- Show all nodes
    END;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.hid,
        p.name,
        p.father_id,
        p.generation,
        p.sibling_order,
        p.gender,
        CASE 
            WHEN p_zoom_level < 0.3 THEN NULL  -- Don't load photos at very low zoom
            ELSE p.photo_url
        END as photo_url,
        p.layout_position,
        CASE 
            WHEN p.photo_url IS NOT NULL THEN 85
            ELSE 60
        END as node_width,
        CASE 
            WHEN p.photo_url IS NOT NULL THEN 90
            ELSE 35
        END as node_height
    FROM profiles p
    WHERE p.deleted_at IS NULL
    AND p.layout_position IS NOT NULL
    -- Check if node is within viewport
    AND (p.layout_position->>'x')::FLOAT BETWEEN viewport_left AND viewport_right
    AND (p.layout_position->>'y')::FLOAT BETWEEN viewport_top AND viewport_bottom
    ORDER BY p.generation, p.father_id, p.sibling_order
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe search function with result limits
CREATE OR REPLACE FUNCTION search_profiles_safe(
    p_query TEXT,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    generation INT,
    gender TEXT,
    photo_url TEXT,
    current_residence TEXT,
    occupation TEXT,
    bio TEXT,
    rank REAL,
    total_count BIGINT
) AS $$
DECLARE
    total BIGINT;
BEGIN
    -- Input validation
    IF LENGTH(TRIM(p_query)) < 2 THEN
        RAISE EXCEPTION 'Search query must be at least 2 characters';
    END IF;
    
    IF p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'Limit must be between 1 and 100';
    END IF;
    
    -- Get total count for pagination
    SELECT COUNT(*) INTO total
    FROM profiles p
    WHERE p.deleted_at IS NULL
    AND (
        p.search_vector @@ plainto_tsquery('arabic', p_query)
        OR p.name ILIKE '%' || p_query || '%'
    );
    
    RETURN QUERY
    SELECT 
        p.id,
        p.hid,
        p.name,
        p.father_id,
        p.generation,
        p.gender,
        p.photo_url,
        p.current_residence,
        p.occupation,
        LEFT(p.bio, 200) as bio,  -- Truncate bio for search results
        ts_rank(p.search_vector, plainto_tsquery('arabic', p_query)) as rank,
        total as total_count
    FROM profiles p
    WHERE p.deleted_at IS NULL
    AND (
        p.search_vector @@ plainto_tsquery('arabic', p_query)
        OR p.name ILIKE '%' || p_query || '%'
    )
    ORDER BY rank DESC, p.name
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a person's lineage (ancestors)
CREATE OR REPLACE FUNCTION get_person_lineage(p_id UUID)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    generation INT,
    gender TEXT,
    photo_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: the person
        SELECT p.* FROM profiles p WHERE p.id = p_id AND p.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: parents
        SELECT p.*
        FROM profiles p
        INNER JOIN ancestors a ON p.id = a.father_id
        WHERE p.deleted_at IS NULL
    )
    SELECT 
        a.id,
        a.hid,
        a.name,
        a.generation,
        a.gender,
        a.photo_url
    FROM ancestors a
    ORDER BY a.generation DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get siblings
CREATE OR REPLACE FUNCTION get_siblings(p_id UUID)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    gender TEXT,
    photo_url TEXT,
    sibling_order INT
) AS $$
DECLARE
    person_father_id UUID;
BEGIN
    -- Get the person's father
    SELECT father_id INTO person_father_id
    FROM profiles
    WHERE id = p_id AND deleted_at IS NULL;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.hid,
        p.name,
        p.gender,
        p.photo_url,
        p.sibling_order
    FROM profiles p
    WHERE p.father_id IS NOT DISTINCT FROM person_father_id
    AND p.id != p_id
    AND p.deleted_at IS NULL
    ORDER BY p.sibling_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get person's marriages with spouse info
CREATE OR REPLACE FUNCTION get_person_marriages(p_id UUID)
RETURNS TABLE (
    marriage_id UUID,
    spouse_id UUID,
    spouse_name TEXT,
    spouse_photo TEXT,
    munasib TEXT,
    status TEXT,
    start_date DATE,
    end_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id as marriage_id,
        CASE 
            WHEN m.husband_id = p_id THEN m.wife_id
            ELSE m.husband_id
        END as spouse_id,
        p.name as spouse_name,
        p.photo_url as spouse_photo,
        m.munasib,
        m.status,
        m.start_date,
        m.end_date
    FROM marriages m
    LEFT JOIN profiles p ON p.id = CASE 
        WHEN m.husband_id = p_id THEN m.wife_id
        ELSE m.husband_id
    END
    WHERE (m.husband_id = p_id OR m.wife_id = p_id)
    AND p.deleted_at IS NULL
    ORDER BY m.start_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tree statistics
CREATE OR REPLACE FUNCTION get_tree_stats()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_people', COUNT(*) FILTER (WHERE deleted_at IS NULL),
        'total_males', COUNT(*) FILTER (WHERE gender = 'male' AND deleted_at IS NULL),
        'total_females', COUNT(*) FILTER (WHERE gender = 'female' AND deleted_at IS NULL),
        'total_alive', COUNT(*) FILTER (WHERE status = 'alive' AND deleted_at IS NULL),
        'total_deceased', COUNT(*) FILTER (WHERE status = 'deceased' AND deleted_at IS NULL),
        'total_marriages', (SELECT COUNT(*) FROM marriages),
        'max_generation', MAX(generation) FILTER (WHERE deleted_at IS NULL),
        'people_with_photos', COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND deleted_at IS NULL),
        'last_update', MAX(updated_at) FILTER (WHERE deleted_at IS NULL)
    ) INTO stats
    FROM profiles;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_visible_nodes TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_profiles_safe TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_person_lineage TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_siblings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_person_marriages TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tree_stats TO anon, authenticated;