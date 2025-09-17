-- NUCLEAR OPTION: Drop ALL triggers and functions that might be causing issues

-- 1. Drop ALL triggers on profiles table
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'profiles'::regclass 
        AND tgisinternal = FALSE
    ) 
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON profiles CASCADE', r.tgname);
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- 2. Drop ALL triggers on profile_photos table
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'profile_photos'::regclass 
        AND tgisinternal = FALSE
    ) 
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON profile_photos CASCADE', r.tgname);
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- 3. Find and drop ALL functions that contain 'storage.delete'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT n.nspname, p.proname, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE pg_get_functiondef(p.oid) LIKE '%storage.delete%'
           OR pg_get_functiondef(p.oid) LIKE '%delete_object%'
    )
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I CASCADE', r.nspname, r.proname);
        RAISE NOTICE 'Dropped function: %.%', r.nspname, r.proname;
    END LOOP;
END $$;

-- 4. Drop specific functions we know might be problematic
DROP FUNCTION IF EXISTS cleanup_old_profile_photos() CASCADE;
DROP FUNCTION IF EXISTS handle_profile_photo_update() CASCADE;
DROP FUNCTION IF EXISTS cleanup_profile_photos() CASCADE;
DROP FUNCTION IF EXISTS handle_photo_cleanup() CASCADE;
DROP FUNCTION IF EXISTS before_profile_update() CASCADE;
DROP FUNCTION IF EXISTS after_profile_update() CASCADE;

-- 5. Create a simple, safe profile update trigger
CREATE OR REPLACE FUNCTION safe_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update metadata
  NEW.updated_at = NOW();
  
  -- Don't touch storage at all
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create only essential triggers
CREATE TRIGGER profile_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION safe_profile_update();

-- 7. Also create safe trigger for profile_photos
CREATE OR REPLACE FUNCTION safe_profile_photos_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update timestamp
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profile_photos_updated_at
  BEFORE UPDATE ON profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION safe_profile_photos_update();

-- 8. List remaining triggers to verify
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid IN ('profiles'::regclass, 'profile_photos'::regclass)
  AND tgisinternal = FALSE;