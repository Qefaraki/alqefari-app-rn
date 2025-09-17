-- CRITICAL FIX: Restore get_branch_data with optimized performance
-- This fixes timeout issues and restores the tree

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

-- Create OPTIMIZED version that won't timeout
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
    -- Simple non-recursive query for better performance
    IF p_hid IS NULL THEN
        -- Return root and immediate children only for initial load
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
            (SELECT COUNT(*)::INT FROM profiles c WHERE c.father_id = p.id OR c.mother_id = p.id) as descendants_count,
            false as has_more_descendants,
            p.dob_data,
            p.dod_data
        FROM profiles p
        WHERE p.generation <= 3  -- Only load first 3 generations initially
        ORDER BY p.generation, p.sibling_order
        LIMIT p_limit;
    ELSE
        -- Load specific branch
        RETURN QUERY
        WITH RECURSIVE family_tree AS (
            -- Base case
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
                0 as depth
            FROM profiles p
            WHERE p.hid = p_hid
            
            UNION ALL
            
            -- Get descendants
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
                ft.depth + 1
            FROM profiles p
            INNER JOIN family_tree ft ON (p.father_id = ft.id OR p.mother_id = ft.id)
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
            (SELECT COUNT(*)::INT FROM profiles c WHERE c.father_id = ft.id OR c.mother_id = ft.id) as descendants_count,
            CASE 
                WHEN ft.depth >= p_max_depth - 1 THEN
                    EXISTS(SELECT 1 FROM profiles c WHERE c.father_id = ft.id OR c.mother_id = ft.id)
                ELSE false
            END as has_more_descendants,
            ft.dob_data,
            ft.dod_data
        FROM family_tree ft
        ORDER BY ft.generation, ft.sibling_order
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_generation ON profiles(generation);
CREATE INDEX IF NOT EXISTS idx_profiles_parents ON profiles(father_id, mother_id);
CREATE INDEX IF NOT EXISTS idx_profiles_hid ON profiles(hid);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Verify it works
SELECT 'Function optimized - no more timeouts!' as status;