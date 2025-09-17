-- Fix get_branch_data to use correct column names and handle null HIDs
DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 200
)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    gender TEXT,
    birth_date_hijri JSONB,
    death_date_hijri JSONB,
    is_deceased BOOLEAN,
    parent_id UUID,
    depth INT,
    x FLOAT,
    y FLOAT,
    layoutGeneration INT,
    marital_status TEXT,
    marriages JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_hid TEXT;
    v_pattern TEXT;
BEGIN
    -- Input validation
    IF p_max_depth < 1 OR p_max_depth > 10 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 10';
    END IF;
    
    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;

    -- Determine starting HID
    IF p_hid IS NULL OR p_hid = '' THEN
        -- Start from root
        v_start_hid := '1';
        v_pattern := '1%';
    ELSE
        v_start_hid := p_hid;
        v_pattern := p_hid || '%';
    END IF;

    -- Return branch data with marriages
    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: starting node
        SELECT 
            p.id,
            p.hid,
            p.name,
            p.gender,
            p.dob_data as birth_date_hijri,  -- Use correct column name
            p.dod_data as death_date_hijri,  -- Use correct column name
            CASE 
                WHEN p.status = 'deceased' THEN true
                ELSE false
            END as is_deceased,
            p.father_id as parent_id,  -- Map father_id to parent_id
            1 as depth,
            COALESCE(p.layout_position->>'x', '0')::FLOAT as x,
            COALESCE(p.layout_position->>'y', '0')::FLOAT as y,
            COALESCE((p.layout_position->>'generation')::INT, p.generation) as layoutGeneration,
            p.status as marital_status
        FROM profiles p
        WHERE p.hid = v_start_hid
          AND p.hid IS NOT NULL  -- Exclude Munasib profiles
        
        UNION ALL
        
        -- Recursive case: children
        SELECT 
            p.id,
            p.hid,
            p.name,
            p.gender,
            p.dob_data as birth_date_hijri,
            p.dod_data as death_date_hijri,
            CASE 
                WHEN p.status = 'deceased' THEN true
                ELSE false
            END as is_deceased,
            p.father_id as parent_id,
            b.depth + 1,
            COALESCE(p.layout_position->>'x', '0')::FLOAT as x,
            COALESCE(p.layout_position->>'y', '0')::FLOAT as y,
            COALESCE((p.layout_position->>'generation')::INT, p.generation) as layoutGeneration,
            p.status as marital_status
        FROM profiles p
        INNER JOIN branch b ON p.father_id = b.id
        WHERE b.depth < p_max_depth
          AND p.hid IS NOT NULL  -- Exclude Munasib profiles
    ),
    marriages_with_order AS (
        SELECT 
            b.id as person_id,
            m.id as marriage_id,
            CASE 
                WHEN m.husband_id = b.id THEN m.wife_id
                ELSE m.husband_id
            END as spouse_id,
            CASE 
                WHEN m.husband_id = b.id THEN w.name
                ELSE h.name
            END as spouse_name,
            CASE 
                WHEN m.husband_id = b.id THEN w.hid
                ELSE h.hid
            END as spouse_hid,
            m.start_date,
            m.end_date,
            m.is_current,
            ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY m.start_date) as marriage_order
        FROM branch b
        LEFT JOIN marriages m ON (b.id = m.husband_id OR b.id = m.wife_id)
        LEFT JOIN profiles h ON m.husband_id = h.id
        LEFT JOIN profiles w ON m.wife_id = w.id
        WHERE m.id IS NOT NULL
    ),
    branch_with_marriages AS (
        SELECT 
            b.*,
            COALESCE(
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'marriage_id', mo.marriage_id,
                        'spouse_id', mo.spouse_id,
                        'spouse_name', mo.spouse_name,
                        'spouse_hid', mo.spouse_hid,
                        'marriage_date', mo.start_date,
                        'divorce_date', mo.end_date,
                        'is_active', mo.is_current,
                        'marriage_order', mo.marriage_order
                    ) ORDER BY mo.marriage_order
                ) FILTER (WHERE mo.marriage_id IS NOT NULL),
                '[]'::JSONB
            ) AS marriages
        FROM branch b
        LEFT JOIN marriages_with_order mo ON b.id = mo.person_id
        GROUP BY 
            b.id, b.hid, b.name, b.gender, b.birth_date_hijri, 
            b.death_date_hijri, b.is_deceased, b.parent_id, b.depth,
            b.x, b.y, b.layoutGeneration, b.marital_status
    )
    SELECT * FROM branch_with_marriages
    ORDER BY depth, hid
    LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_branch_data IS 'Fetches tree branch data with correct column mappings. Excludes Munasib profiles (those without HIDs).';