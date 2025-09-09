-- RESTORE SIMPLE FAST get_branch_data with date fields
-- This combines the original simple/fast version with NULL handling and date fields

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

-- Create SIMPLE version like original but with dates
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
    -- Input validation
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
    END IF;
    
    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;
    
    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: root node(s)
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
            p.deleted_at,
            0 as relative_depth
        FROM profiles p
        WHERE 
            CASE
                WHEN p_hid IS NULL THEN 
                    p.generation = 1 
                    AND p.deleted_at IS NULL
                    AND p.name != 'Test Admin'  -- Exclude test profiles
                ELSE 
                    p.hid = p_hid 
                    AND p.deleted_at IS NULL
            END
        
        UNION ALL
        
        -- Recursive case: get children (SIMPLE - only father_id for speed)
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
            p.deleted_at,
            b.relative_depth + 1
        FROM profiles p
        INNER JOIN branch b ON p.father_id = b.id OR p.mother_id = b.id
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
        COALESCE(b.descendants_count, 0)::INT,
        -- Simple check for children (FAST)
        CASE 
            WHEN b.relative_depth = p_max_depth - 1 THEN
                EXISTS(
                    SELECT 1 FROM profiles c 
                    WHERE (c.father_id = b.id OR c.mother_id = b.id)
                    AND c.deleted_at IS NULL
                    LIMIT 1
                )
            ELSE FALSE
        END as has_more_descendants,
        b.dob_data,
        b.dod_data
    FROM branch b
    ORDER BY b.generation, b.sibling_order
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_generation ON profiles(generation) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_father_id ON profiles(father_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_mother_id ON profiles(mother_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_hid ON profiles(hid) WHERE deleted_at IS NULL;

SELECT 'Simple fast function restored with date fields!' as status;