-- Fix: Update children to point to the actual root profile
-- The children (1.1, 1.2, etc) are pointing to a non-existent father

DO $$
DECLARE
    v_root_id UUID;
    v_old_father_id UUID;
    v_children_count INT;
BEGIN
    -- Get the root profile ID (HID = '1')
    SELECT id INTO v_root_id
    FROM profiles
    WHERE hid = '1';
    
    IF v_root_id IS NULL THEN
        RAISE EXCEPTION 'Root profile with HID=1 not found!';
    END IF;
    
    -- Get the old father_id that children are pointing to
    SELECT DISTINCT father_id INTO v_old_father_id
    FROM profiles
    WHERE hid LIKE '1.%'
    AND length(hid) - length(replace(hid, '.', '')) = 1  -- Direct children only
    LIMIT 1;
    
    RAISE NOTICE 'Root ID: %', v_root_id;
    RAISE NOTICE 'Old father ID children are pointing to: %', v_old_father_id;
    
    -- Update all direct children of root to point to the correct root
    UPDATE profiles
    SET father_id = v_root_id
    WHERE hid LIKE '1.%'
    AND length(hid) - length(replace(hid, '.', '')) = 1  -- Only direct children (1.1, 1.2, etc)
    AND father_id = v_old_father_id;
    
    GET DIAGNOSTICS v_children_count = ROW_COUNT;
    RAISE NOTICE 'Updated % children to point to root', v_children_count;
    
    -- Also update descendants_count for the root
    UPDATE profiles
    SET descendants_count = (
        SELECT COUNT(*)
        FROM profiles
        WHERE hid LIKE '1.%'
        AND hid != '1'
    )
    WHERE id = v_root_id;
    
    RAISE NOTICE 'Updated root descendants_count';
END $$;

-- Verify the fix
SELECT 
    p.hid,
    p.name,
    p.father_id,
    CASE 
        WHEN p.father_id = r.id THEN '✅ Correctly linked to root'
        WHEN p.father_id IS NULL AND p.hid = '1' THEN '✅ Is root'
        ELSE '❌ Still broken'
    END as status
FROM profiles p
LEFT JOIN profiles r ON r.hid = '1'
WHERE p.hid IN ('1', '1.1', '1.2', '1.3', '1.4', '1.5')
ORDER BY p.hid;