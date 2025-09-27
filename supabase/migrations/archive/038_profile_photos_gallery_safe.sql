-- Safe migration for profile photos gallery
-- Checks for existing objects before creating

-- Create profile_photos table if it doesn't exist
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  storage_path TEXT,
  caption TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes only if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profile_photos_profile') THEN
    CREATE INDEX idx_profile_photos_profile ON profile_photos(profile_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profile_photos_primary') THEN
    CREATE INDEX idx_profile_photos_primary ON profile_photos(profile_id, is_primary);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profile_photos_order') THEN
    CREATE INDEX idx_profile_photos_order ON profile_photos(profile_id, display_order);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view photos" ON profile_photos;
DROP POLICY IF EXISTS "Admins can manage photos" ON profile_photos;

-- Create RLS policies
CREATE POLICY "Public can view photos" ON profile_photos
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage photos" ON profile_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create or replace function to get profile photos
CREATE OR REPLACE FUNCTION get_profile_photos(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  photo_url TEXT,
  storage_path TEXT,
  caption TEXT,
  is_primary BOOLEAN,
  display_order INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.id,
    pp.profile_id,
    pp.photo_url,
    pp.storage_path,
    pp.caption,
    pp.is_primary,
    pp.display_order,
    pp.created_at
  FROM profile_photos pp
  WHERE pp.profile_id = p_profile_id
  ORDER BY pp.is_primary DESC, pp.display_order ASC, pp.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to add profile photo
CREATE OR REPLACE FUNCTION admin_add_profile_photo(
  p_profile_id UUID,
  p_photo_url TEXT,
  p_storage_path TEXT DEFAULT NULL,
  p_caption TEXT DEFAULT NULL,
  p_is_primary BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_photo_id UUID;
  v_current_count INT;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get current photo count
  SELECT COUNT(*) INTO v_current_count
  FROM profile_photos
  WHERE profile_id = p_profile_id;

  -- If this is the first photo, make it primary
  IF v_current_count = 0 THEN
    p_is_primary := true;
  END IF;

  -- If setting as primary, unset other primary photos
  IF p_is_primary THEN
    UPDATE profile_photos
    SET is_primary = false
    WHERE profile_id = p_profile_id;

    -- Also update the main profile photo
    UPDATE profiles
    SET photo_url = p_photo_url
    WHERE id = p_profile_id;
  END IF;

  -- Insert new photo
  INSERT INTO profile_photos (
    profile_id,
    photo_url,
    storage_path,
    caption,
    is_primary,
    display_order,
    uploaded_by
  ) VALUES (
    p_profile_id,
    p_photo_url,
    p_storage_path,
    p_caption,
    p_is_primary,
    v_current_count,
    auth.uid()
  ) RETURNING id INTO v_photo_id;

  RETURN v_photo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to set primary photo
CREATE OR REPLACE FUNCTION admin_set_primary_photo(
  p_photo_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_photo_url TEXT;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get profile_id and photo_url
  SELECT profile_id, photo_url INTO v_profile_id, v_photo_url
  FROM profile_photos
  WHERE id = p_photo_id;

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Unset all other primary photos for this profile
  UPDATE profile_photos
  SET is_primary = false
  WHERE profile_id = v_profile_id;

  -- Set this photo as primary
  UPDATE profile_photos
  SET is_primary = true
  WHERE id = p_photo_id;

  -- Update main profile photo
  UPDATE profiles
  SET photo_url = v_photo_url
  WHERE id = v_profile_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to delete profile photo
CREATE OR REPLACE FUNCTION admin_delete_profile_photo(
  p_photo_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_is_primary BOOLEAN;
  v_new_primary_id UUID;
  v_new_primary_url TEXT;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get photo details
  SELECT profile_id, is_primary INTO v_profile_id, v_is_primary
  FROM profile_photos
  WHERE id = p_photo_id;

  IF v_profile_id IS NULL THEN
    RETURN false;
  END IF;

  -- Delete the photo
  DELETE FROM profile_photos WHERE id = p_photo_id;

  -- If it was primary, set a new primary
  IF v_is_primary THEN
    SELECT id, photo_url INTO v_new_primary_id, v_new_primary_url
    FROM profile_photos
    WHERE profile_id = v_profile_id
    ORDER BY display_order ASC
    LIMIT 1;

    IF v_new_primary_id IS NOT NULL THEN
      UPDATE profile_photos
      SET is_primary = true
      WHERE id = v_new_primary_id;

      UPDATE profiles
      SET photo_url = v_new_primary_url
      WHERE id = v_profile_id;
    ELSE
      -- No photos left, clear profile photo
      UPDATE profiles
      SET photo_url = NULL
      WHERE id = v_profile_id;
    END IF;
  END IF;

  -- Reorder remaining photos
  WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 as new_order
    FROM profile_photos
    WHERE profile_id = v_profile_id
  )
  UPDATE profile_photos pp
  SET display_order = n.new_order
  FROM numbered n
  WHERE pp.id = n.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to reorder photos
CREATE OR REPLACE FUNCTION admin_reorder_photos(
  p_profile_id UUID,
  p_photo_ids UUID[]
)
RETURNS BOOLEAN AS $$
DECLARE
  i INT;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update display order based on array position
  FOR i IN 1..array_length(p_photo_ids, 1) LOOP
    UPDATE profile_photos
    SET display_order = i - 1
    WHERE id = p_photo_ids[i]
    AND profile_id = p_profile_id;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE profile_photos IS 'Stores multiple photos per profile with gallery functionality';