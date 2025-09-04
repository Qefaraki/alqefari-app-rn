-- Create storage buckets for profile photos
-- This migration sets up the storage infrastructure for photo uploads

-- Create the public bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true, -- Public bucket for read access
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- Create RLS policies for the bucket

-- Allow anyone to view profile photos (public read)
CREATE POLICY "Public can view profile photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-photos');

-- Allow authenticated users to upload their own profile photos
CREATE POLICY "Users can upload profile photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' AND
  auth.role() = 'authenticated'
);

-- Allow users to update their own profile photos
CREATE POLICY "Users can update their own profile photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own profile photos
CREATE POLICY "Users can delete their own profile photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to manage all profile photos
CREATE POLICY "Admins can manage all profile photos"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'profile-photos' AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Create function to generate storage path for profile photos
CREATE OR REPLACE FUNCTION get_profile_photo_path(profile_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Returns path like: profiles/123e4567-e89b-12d3-a456-426614174000/photo.jpg
  RETURN 'profiles/' || profile_id::text || '/';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to clean up old photos when uploading new ones
CREATE OR REPLACE FUNCTION cleanup_old_profile_photos()
RETURNS TRIGGER AS $$
DECLARE
  old_photo_path TEXT;
BEGIN
  -- If photo_url is being updated and there was an old one
  IF TG_OP = 'UPDATE' AND OLD.photo_url IS DISTINCT FROM NEW.photo_url AND OLD.photo_url IS NOT NULL THEN
    -- Extract the path from the old URL if it's a Supabase storage URL
    IF OLD.photo_url LIKE '%/storage/v1/object/public/profile-photos/%' THEN
      old_photo_path := substring(OLD.photo_url from '.*profile-photos/(.*)');
      
      -- Delete the old photo from storage
      PERFORM storage.delete_object('profile-photos', old_photo_path);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to cleanup old photos
CREATE TRIGGER cleanup_profile_photos
  BEFORE UPDATE OF photo_url ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_old_profile_photos();

-- Add comment explaining the bucket structure
COMMENT ON FUNCTION get_profile_photo_path IS 'Generates the storage path for a profile photo. Photos are organized by profile ID to ensure uniqueness and easy management.';