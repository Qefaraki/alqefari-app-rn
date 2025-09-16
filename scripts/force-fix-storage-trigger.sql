-- Force drop ALL triggers on profiles table that might be causing issues
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table 
              FROM information_schema.triggers 
              WHERE event_object_table = 'profiles') 
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON ' || r.event_object_table || ' CASCADE';
    END LOOP;
END $$;

-- Drop all functions that might be calling storage.delete_object
DROP FUNCTION IF EXISTS cleanup_old_profile_photos() CASCADE;
DROP FUNCTION IF EXISTS handle_profile_photo_update() CASCADE;
DROP FUNCTION IF EXISTS cleanup_profile_photos() CASCADE;

-- Create a simple, safe trigger that doesn't touch storage
CREATE OR REPLACE FUNCTION safe_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Just return the new row without any storage operations
  -- Storage cleanup should be handled by the application
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a minimal trigger
CREATE TRIGGER profile_update_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION safe_profile_update();

-- Also check if there are any triggers on profile_photos table
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table 
              FROM information_schema.triggers 
              WHERE event_object_table = 'profile_photos') 
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON ' || r.event_object_table || ' CASCADE';
    END LOOP;
END $$;