-- Migration to create single root structure
-- This updates all nodes to have one ancestral root

BEGIN;

-- Temporarily disable the validation trigger
ALTER TABLE profiles DISABLE TRIGGER validate_profiles_parents;

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
    updated_at,
    dob_data,
    dod_data,
    bio,
    birth_place
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
    0, -- Will be updated later
    NOW(),
    NOW(),
    '{"hijri": {"year": 1250}, "display": "1250هـ"}'::jsonb,
    '{"hijri": {"year": 1320}, "display": "1320هـ"}'::jsonb,
    'جد عائلة القفاري - مؤسس العائلة',
    'نجد'
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
    SELECT id INTO root_id FROM profiles WHERE hid = '1' LIMIT 1;
    
    -- First, increment all generations by 1 (to make room for new root)
    UPDATE profiles 
    SET generation = generation + 1
    WHERE hid != '1'
    AND deleted_at IS NULL;
    
    -- Step 2: Update former root nodes to be children of the true root
    FOR old_root IN 
        SELECT id, hid, name 
        FROM profiles 
        WHERE hid LIKE 'R%'
        AND hid NOT LIKE 'R%.%'
        ORDER BY hid
    LOOP
        -- Calculate new HID based on order
        new_hid_prefix := '1.' || sibling_order_counter;
        
        -- Update the former root node
        UPDATE profiles 
        SET 
            hid = new_hid_prefix,
            father_id = root_id,
            sibling_order = sibling_order_counter
        WHERE id = old_root.id;
        
        -- Update all descendants of this former root
        UPDATE profiles
        SET 
            hid = REPLACE(hid, old_root.hid || '.', new_hid_prefix || '.')
        WHERE 
            hid LIKE old_root.hid || '.%'
            AND deleted_at IS NULL;
        
        -- Also handle exact match (the root itself was already updated)
        UPDATE profiles
        SET 
            hid = REPLACE(hid, old_root.hid, new_hid_prefix)
        WHERE 
            hid = old_root.hid
            AND deleted_at IS NULL
            AND id != old_root.id; -- Don't update the one we just fixed
        
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

-- Re-enable the validation trigger
ALTER TABLE profiles ENABLE TRIGGER validate_profiles_parents;

-- Verify the migration
DO $$
DECLARE
    root_count INT;
    min_gen INT;
    max_gen INT;
    total_nodes INT;
    root_name TEXT;
BEGIN
    -- Check we have exactly one root
    SELECT COUNT(*) INTO root_count 
    FROM profiles 
    WHERE father_id IS NULL 
    AND mother_id IS NULL 
    AND deleted_at IS NULL;
    
    -- Get root name
    SELECT name INTO root_name
    FROM profiles 
    WHERE father_id IS NULL 
    AND mother_id IS NULL 
    AND deleted_at IS NULL
    LIMIT 1;
    
    -- Check generation numbers
    SELECT MIN(generation), MAX(generation), COUNT(*)
    INTO min_gen, max_gen, total_nodes
    FROM profiles
    WHERE deleted_at IS NULL;
    
    -- Report results
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  Root nodes: %', root_count;
    RAISE NOTICE '  Root name: %', root_name;
    RAISE NOTICE '  Generation range: % to %', min_gen, max_gen;
    RAISE NOTICE '  Total nodes: %', total_nodes;
    
    -- Verify we have exactly one root
    IF root_count != 1 THEN
        RAISE EXCEPTION 'Expected 1 root node, found %', root_count;
    END IF;
    
    -- Show sample of new structure
    RAISE NOTICE 'Sample of new structure:';
    DECLARE
        sample_node RECORD;
    BEGIN
        FOR sample_node IN 
            SELECT hid, name, generation, father_id IS NOT NULL as has_father
            FROM profiles 
            WHERE generation <= 2
            ORDER BY generation, hid
            LIMIT 10
        LOOP
            RAISE NOTICE '  HID: %, Name: %, Gen: %, Has Father: %', 
                sample_node.hid, sample_node.name, sample_node.generation, sample_node.has_father;
        END LOOP;
    END;
END $$;

COMMIT;