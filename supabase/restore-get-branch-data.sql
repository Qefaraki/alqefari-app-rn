-- RESTORE get_branch_data to match original behavior with ambiguity fix
-- This maintains the EXACT behavior from migration 033 but fixes the column ambiguity

-- Drop all broken versions
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

-- Restore the EXACT version from migration 033 with explicit columns to fix ambiguity
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
    -- Date fields
    dob_data JSONB,
    dod_data JSONB,
    -- Additional fields from migration 033
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
    -- Input validation (exact from migration 033)
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
    END IF;
    
    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;

    -- Get the starting depth (exact from migration 033)
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
        -- Base case: starting node(s) - FIX: explicitly list columns instead of p.*
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
            p.created_at,
            p.updated_at,
            p.deleted_at,
            p.version,
            p.search_vector,
            p.created_by,
            p.updated_by,
            p.tree_meta,
            p.role,
            p.user_id,
            0 as relative_depth,
            COUNT(c.id) OVER (PARTITION BY p.id) as child_count
        FROM profiles p
        LEFT JOIN profiles c ON c.father_id = p.id OR c.mother_id = p.id
        WHERE (p_hid IS NULL AND p.generation = 1)
           OR (p_hid IS NOT NULL AND p.hid = p_hid)
        
        UNION ALL
        
        -- Recursive case: get descendants - FIX: explicitly list columns
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
            p.created_at,
            p.updated_at,
            p.deleted_at,
            p.version,
            p.search_vector,
            p.created_by,
            p.updated_by,
            p.tree_meta,
            p.role,
            p.user_id,
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
        -- Include all the date and additional fields (exact from migration 033)
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
    ORDER BY dt.generation, dt.sibling_order
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions (exact from migration 033)
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Add comment (exact from migration 033)
COMMENT ON FUNCTION get_branch_data IS 'Fetches a branch of the tree with all profile fields including dates, starting from a given node (or root) up to a specified depth';

-- Verify it works
SELECT 'Function restored to original behavior with ambiguity fix!' as status;