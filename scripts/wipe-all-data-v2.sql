-- WIPE ALL DATA - Start Fresh
-- This is for mock data only!

BEGIN;

-- Delete in correct order to respect foreign keys
DELETE FROM layout_recalc_queue;
DELETE FROM marriages;
DELETE FROM profiles;

-- Reset sequence
SELECT setval('hid_counter', 1, false);

-- Verify it's empty
DO $$
DECLARE
    profile_count INT;
    marriage_count INT;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM profiles;
    SELECT COUNT(*) INTO marriage_count FROM marriages;
    
    RAISE NOTICE 'Data wipe complete:';
    RAISE NOTICE '  Profiles: %', profile_count;
    RAISE NOTICE '  Marriages: %', marriage_count;
    
    IF profile_count > 0 OR marriage_count > 0 THEN
        RAISE EXCEPTION 'Failed to wipe all data!';
    END IF;
END $$;

COMMIT;

-- Show confirmation
SELECT 'All data wiped successfully! Ready for fresh generation.' as status;