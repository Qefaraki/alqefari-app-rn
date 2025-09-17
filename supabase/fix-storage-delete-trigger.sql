-- Drop the problematic trigger that uses non-existent storage.delete_object
DROP TRIGGER IF EXISTS cleanup_profile_photos ON profiles;
DROP FUNCTION IF EXISTS cleanup_old_profile_photos();

-- Create a safer version that doesn't try to delete from storage
-- (Storage cleanup should be handled by the application)
CREATE OR REPLACE FUNCTION cleanup_old_profile_photos()
RETURNS TRIGGER AS $$
BEGIN
  -- Just log the change, don't try to delete from storage
  -- Storage cleanup is handled by the application
  IF TG_OP = 'UPDATE' AND OLD.photo_url IS DISTINCT FROM NEW.photo_url AND OLD.photo_url IS NOT NULL THEN
    -- Could log this change if needed
    RAISE NOTICE 'Photo URL changed from % to %', OLD.photo_url, NEW.photo_url;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger without storage deletion
CREATE TRIGGER cleanup_profile_photos
  BEFORE UPDATE OF photo_url ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_profile_photos();