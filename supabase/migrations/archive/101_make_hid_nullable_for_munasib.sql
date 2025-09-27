-- Fix HID nullable for Munasib system
-- This runs after migration 100 which incorrectly sets HID to NOT NULL

-- Drop the NOT NULL constraint that was added in migration 100
ALTER TABLE profiles 
ALTER COLUMN hid DROP NOT NULL;

-- Verify the change worked
DO $$
DECLARE
    v_is_nullable boolean;
BEGIN
    SELECT is_nullable = 'YES' 
    INTO v_is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'hid';
    
    IF v_is_nullable THEN
        RAISE NOTICE 'Success: HID column is now nullable for Munasib profiles';
    ELSE
        RAISE WARNING 'HID column is still NOT NULL - manual intervention may be needed';
    END IF;
END $$;

-- Add comment explaining the nullable HID
COMMENT ON COLUMN profiles.hid IS 'Hierarchical ID - NULL for Munasib (married-in spouses who are not part of the family tree), populated for blood family members';