-- FINAL FIX: Restore get_branch_data to SIMPLE, FAST, WORKING version
-- This fixes ALL issues:
--   1. Removes performance-killing aggregations (COUNT OVER, etc)
--   2. Handles nullable HIDs properly (excludes Munasib profiles)
--   3. Uses pre-calculated descendants_count from profiles table
--   4. Returns to proven simple recursive structure

-- Drop ALL existing versions to start completely clean
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
        RAISE NOTICE 'Dropped: %', r.func_signature;
    END LOOP;
END $$;

-- Create the CORRECT version following documentation best practices
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
    has_more_descendants BOOLEAN,
    dob_data JSONB,
    dod_data JSONB
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
        -- Base case: starting nodes (SIMPLE - no aggregations!)
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
            p.descendants_count,  -- Use pre-calculated value
            p.dob_data,
            p.dod_data,
            0 as relative_depth
        FROM profiles p
        WHERE 
            -- CRITICAL: Only include profiles with HIDs (exclude Munasib)
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND (
                -- If no HID specified, get generation 1 (roots)
                (p_hid IS NULL AND p.generation = 1 
                 -- Exclude test profiles
                 AND p.hid NOT LIKE 'R%' 
                 AND p.name != 'Test Admin')
                OR 
                -- If HID specified, get that specific node
                (p_hid IS NOT NULL AND p.hid = p_hid)
            )
        
        UNION ALL
        
        -- Recursive case: get children (SIMPLE - no JOINs to other tables!)
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
            p.descendants_count,  -- Use pre-calculated value
            p.dob_data,
            p.dod_data,
            b.relative_depth + 1
        FROM profiles p
        INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
        WHERE 
            -- CRITICAL: Only include profiles with HIDs
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND b.relative_depth < p_max_depth - 1
    )
    -- Final SELECT - SIMPLE, no additional CTEs or aggregations!
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
        -- Use the pre-calculated descendants_count from profiles table
        COALESCE(b.descendants_count, 0)::INT as descendants_count,
        -- Simple EXISTS check for more descendants (only at max depth)
        CASE
            WHEN b.relative_depth = p_max_depth - 1 THEN
                EXISTS(
                    SELECT 1 FROM profiles c
                    WHERE (c.father_id = b.id OR c.mother_id = b.id)
                    AND c.deleted_at IS NULL
                    AND c.hid IS NOT NULL  -- Exclude Munasib children
                    LIMIT 1  -- IMPORTANT: LIMIT 1 for performance
                )
            ELSE FALSE
        END as has_more_descendants,
        b.dob_data,
        b.dod_data
    FROM branch b
    ORDER BY b.generation, b.sibling_order
    LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Add helpful comment
COMMENT ON FUNCTION get_branch_data IS 'CRITICAL: Simple recursive tree traversal. NO aggregations during recursion. Uses pre-calculated descendants_count. Excludes Munasib profiles (null HIDs). See docs/get-branch-data-critical-info.md';

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_profiles_generation_not_deleted 
    ON profiles(generation) 
    WHERE deleted_at IS NULL AND hid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_father_id_not_deleted 
    ON profiles(father_id) 
    WHERE deleted_at IS NULL AND hid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_mother_id_not_deleted 
    ON profiles(mother_id) 
    WHERE deleted_at IS NULL AND hid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_hid_not_deleted 
    ON profiles(hid) 
    WHERE deleted_at IS NULL AND hid IS NOT NULL;

-- Test the function
DO $$
DECLARE
    v_count INT;
    v_start TIMESTAMP;
    v_duration INTERVAL;
BEGIN
    -- Test 1: Root query performance
    v_start := clock_timestamp();
    SELECT COUNT(*) INTO v_count FROM get_branch_data(NULL, 3, 100);
    v_duration := clock_timestamp() - v_start;
    RAISE NOTICE 'Root query: % nodes in %', v_count, v_duration;
    
    -- Test 2: Specific HID query performance
    v_start := clock_timestamp();
    SELECT COUNT(*) INTO v_count FROM get_branch_data('1', 3, 100);
    v_duration := clock_timestamp() - v_start;
    RAISE NOTICE 'HID=1 query: % nodes in %', v_count, v_duration;
    
    -- Test 3: Deep recursion
    v_start := clock_timestamp();
    SELECT COUNT(*) INTO v_count FROM get_branch_data('1', 5, 200);
    v_duration := clock_timestamp() - v_start;
    RAISE NOTICE 'Deep query (depth=5): % nodes in %', v_count, v_duration;
    
    IF v_duration > interval '1 second' THEN
        RAISE WARNING 'Performance issue: Query took longer than 1 second!';
    ELSE
        RAISE NOTICE '✅ Function restored successfully with good performance!';
    END IF;
END $$;