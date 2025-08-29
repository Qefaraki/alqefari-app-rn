-- Migration to create single root structure
-- This updates all nodes to have one ancestral root

BEGIN;

-- Step 1: Create the true root node
INSERT INTO profiles (
    id,
    hid,
    name,
    gender,
    generation,
    sibling_order,
    father_id,
    mother_id,
    status,
    descendants_count,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '1',
    'سليمان',
    'male',
    1,
    1,
    NULL,
    NULL,
    'deceased',
    838, -- All other nodes are descendants
    NOW(),
    NOW()
);

-- Get the ID of the newly created root
DO $$
DECLARE
    root_id UUID;
    old_root RECORD;
    new_hid_prefix TEXT;
    sibling_order_counter INT := 1;
BEGIN
    -- Get the root node ID
    SELECT id INTO root_id FROM profiles WHERE hid = '1';
    
    -- Step 2: Update former root nodes to be children of the true root
    FOR old_root IN 
        SELECT id, hid, name 
        FROM profiles 
        WHERE generation = 1 
        AND hid LIKE 'R%'
        ORDER BY hid
    LOOP
        -- Calculate new HID based on order
        new_hid_prefix := '1.' || sibling_order_counter;
        
        -- Update the former root node
        UPDATE profiles 
        SET 
            hid = new_hid_prefix,
            father_id = root_id,
            generation = 2,
            sibling_order = sibling_order_counter
        WHERE id = old_root.id;
        
        -- Update all descendants of this former root
        UPDATE profiles
        SET 
            hid = REPLACE(hid, old_root.hid || '.', new_hid_prefix || '.'),
            generation = generation + 1
        WHERE 
            hid LIKE old_root.hid || '.%'
            AND deleted_at IS NULL;
        
        sibling_order_counter := sibling_order_counter + 1;
    END LOOP;
    
    -- Step 3: Update descendants count for all nodes
    UPDATE profiles p
    SET descendants_count = (
        SELECT COUNT(*)
        FROM profiles c
        WHERE c.hid LIKE p.hid || '.%'
        AND c.deleted_at IS NULL
    )
    WHERE deleted_at IS NULL;
END $$;

-- Verify the migration
DO $$
DECLARE
    root_count INT;
    min_gen INT;
    max_gen INT;
    total_nodes INT;
BEGIN
    -- Check we have exactly one root
    SELECT COUNT(*) INTO root_count 
    FROM profiles 
    WHERE father_id IS NULL 
    AND mother_id IS NULL 
    AND deleted_at IS NULL;
    
    -- Check generation numbers
    SELECT MIN(generation), MAX(generation), COUNT(*)
    INTO min_gen, max_gen, total_nodes
    FROM profiles
    WHERE deleted_at IS NULL;
    
    -- Report results
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  Root nodes: %', root_count;
    RAISE NOTICE '  Generation range: % to %', min_gen, max_gen;
    RAISE NOTICE '  Total nodes: %', total_nodes;
    
    -- Verify we have exactly one root
    IF root_count != 1 THEN
        RAISE EXCEPTION 'Expected 1 root node, found %', root_count;
    END IF;
END $$;

COMMIT;