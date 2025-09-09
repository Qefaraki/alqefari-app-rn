-- Fix ambiguous column references in get_branch_data
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
    -- Add missing date fields
    dob_data JSONB,
    dod_data JSONB,
    -- Add other useful fields
    bio TEXT,
    birth_place TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    social_media_links JSONB,
    achievements JSONB,
    timeline JSONB,
    kunya TEXT,
    nickname TEXT,
    profile_visibility TEXT,
    dob_is_public BOOLEAN
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

    -- Get the starting depth
    IF p_hid IS NULL THEN
        root_depth := 1;
    ELSE
        SELECT profiles.generation INTO root_depth
        FROM profiles
        WHERE profiles.hid = p_hid;
        
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
            p.dob_data,
            p.dod_data,
            p.bio,
            p.birth_place,
            p.education,
            p.phone,
            p.email,
            p.social_media_links,
            p.achievements,
            p.timeline,
            p.kunya,
            p.nickname,
            p.profile_visibility,
            p.dob_is_public,
            0 as relative_depth,
            COUNT(c.id) OVER (PARTITION BY p.id) as child_count
        FROM profiles p
        LEFT JOIN profiles c ON c.father_id = p.id OR c.mother_id = p.id
        WHERE (p_hid IS NULL AND p.generation = 1)
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
            p.dob_data,
            p.dod_data,
            p.bio,
            p.birth_place,
            p.education,
            p.phone,
            p.email,
            p.social_media_links,
            p.achievements,
            p.timeline,
            p.kunya,
            p.nickname,
            p.profile_visibility,
            p.dob_is_public,
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
        (dt.child_count > 0 AND dt.relative_depth >= p_max_depth - 1) as has_more_descendants,
        dt.dob_data,
        dt.dod_data,
        dt.bio,
        dt.birth_place,
        dt.education,
        dt.phone,
        dt.email,
        dt.social_media_links,
        dt.achievements,
        dt.timeline,
        dt.kunya,
        dt.nickname,
        dt.profile_visibility,
        dt.dob_is_public
    FROM descendant_tree dt
    LEFT JOIN descendants_summary ds ON ds.id = dt.id
    ORDER BY dt.generation, dt.sibling_order, dt.hid
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;