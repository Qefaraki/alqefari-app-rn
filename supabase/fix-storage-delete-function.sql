-- Fix the cleanup_old_profile_photos function
-- The storage.delete_object function doesn't exist in Supabase
-- We need to remove this trigger-based cleanup

-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS cleanup_profile_photos ON profiles;
DROP FUNCTION IF EXISTS cleanup_old_profile_photos();

-- Note: Photo cleanup should be handled by the application layer
-- using the Supabase Storage API directly (supabase.storage.from().remove())
-- This is already implemented in src/services/storage.js

COMMENT ON COLUMN profiles.photo_url IS 'URL of the profile photo. Cleanup of old photos is handled by the application layer.';