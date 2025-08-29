-- WIPE ALL DATA - Start Fresh
-- This is for mock data only!

BEGIN;

-- Disable triggers temporarily
ALTER TABLE profiles DISABLE TRIGGER ALL;
ALTER TABLE marriages DISABLE TRIGGER ALL;

-- Delete everything
TRUNCATE TABLE marriages CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE layout_recalc_queue CASCADE;

-- Reset any sequences
ALTER SEQUENCE hid_counter RESTART WITH 1;

-- Re-enable triggers
ALTER TABLE profiles ENABLE TRIGGER ALL;
ALTER TABLE marriages ENABLE TRIGGER ALL;

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