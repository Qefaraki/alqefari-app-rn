-- Fix the HIDs of root's direct children to be sequential (1.1, 1.2, 1.3, etc.)

BEGIN;

-- Disable trigger temporarily
ALTER TABLE profiles DISABLE TRIGGER validate_profiles_parents;

-- Fix the direct children of root
DO $$
DECLARE
    child RECORD;
    counter INT := 1;
    old_prefix TEXT;
    new_prefix TEXT;
BEGIN
    -- Get all direct children of root ordered by current HID
    FOR child IN 
        SELECT id, hid, name
        FROM profiles 
        WHERE father_id = (SELECT id FROM profiles WHERE hid = '1')
        AND deleted_at IS NULL
        ORDER BY hid
    LOOP
        old_prefix := child.hid;
        new_prefix := '1.' || counter;
        
        -- Skip if already correct
        IF old_prefix = new_prefix THEN
            counter := counter + 1;
            CONTINUE;
        END IF;
        
        -- Update this child
        UPDATE profiles 
        SET hid = new_prefix,
            sibling_order = counter
        WHERE id = child.id;
        
        -- Update all descendants
        UPDATE profiles
        SET hid = REPLACE(hid, old_prefix || '.', new_prefix || '.')
        WHERE hid LIKE old_prefix || '.%'
        AND deleted_at IS NULL;
        
        counter := counter + 1;
    END LOOP;
    
    -- Update sibling order for all other nodes to match their HID
    UPDATE profiles
    SET sibling_order = 
        CASE 
            WHEN position('.' in hid) = 0 THEN 1  -- Root node
            ELSE CAST(
                SUBSTRING(hid FROM position('.' in reverse(hid)) + 1) 
                AS INTEGER
            )
        END
    WHERE deleted_at IS NULL
    AND sibling_order IS DISTINCT FROM 
        CASE 
            WHEN position('.' in hid) = 0 THEN 1
            ELSE CAST(
                SUBSTRING(hid FROM position('.' in reverse(hid)) + 1) 
                AS INTEGER
            )
        END;
END $$;

-- Re-enable trigger
ALTER TABLE profiles ENABLE TRIGGER validate_profiles_parents;

-- Show the fixed structure
SELECT 'Fixed root children:' as info;
SELECT hid, name, generation, sibling_order
FROM profiles 
WHERE generation IN (1, 2)
AND deleted_at IS NULL
ORDER BY generation, hid
LIMIT 20;

COMMIT;