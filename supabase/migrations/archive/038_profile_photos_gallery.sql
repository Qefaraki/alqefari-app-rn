-- Create profile_photos table for multiple photos per profile
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  storage_path TEXT, -- Path in Supabase storage
  caption TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_profile_photos_profile ON profile_photos(profile_id);
CREATE INDEX idx_profile_photos_primary ON profile_photos(profile_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_profile_photos_order ON profile_photos(profile_id, display_order);

-- Enable RLS
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view photos
CREATE POLICY "Photos are viewable by everyone" ON profile_photos
  FOR SELECT USING (true);

-- Only admins can insert photos
CREATE POLICY "Admins can insert photos" ON profile_photos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update photos
CREATE POLICY "Admins can update photos" ON profile_photos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can delete photos
CREATE POLICY "Admins can delete photos" ON profile_photos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to ensure only one primary photo per profile
CREATE OR REPLACE FUNCTION ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = TRUE THEN
    -- Remove primary flag from other photos of the same profile
    UPDATE profile_photos
    SET is_primary = FALSE, updated_at = NOW()
    WHERE profile_id = NEW.profile_id
    AND id != NEW.id
    AND is_primary = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for primary photo management
CREATE TRIGGER ensure_single_primary_photo_trigger
  BEFORE INSERT OR UPDATE ON profile_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_photo();

-- Function to get profile photos with metadata
CREATE OR REPLACE FUNCTION get_profile_photos(p_profile_id UUID)
RETURNS TABLE (
  id UUID,
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
    pp.photo_url,
    pp.storage_path,
    pp.caption,
    pp.is_primary,
    pp.display_order,
    pp.created_at
  FROM profile_photos pp
  WHERE pp.profile_id = p_profile_id
  ORDER BY pp.is_primary DESC, pp.display_order ASC, pp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to add a photo to profile
CREATE OR REPLACE FUNCTION admin_add_profile_photo(
  p_profile_id UUID,
  p_photo_url TEXT,
  p_storage_path TEXT DEFAULT NULL,
  p_caption TEXT DEFAULT NULL,
  p_is_primary BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_photo_id UUID;
  v_max_order INT;
BEGIN
  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Check admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get max display order
  SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_max_order
  FROM profile_photos
  WHERE profile_id = p_profile_id;

  -- Insert the photo
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
    v_max_order,
    auth.uid()
  ) RETURNING id INTO v_photo_id;

  -- If this is the first photo, make it primary
  IF v_max_order = 0 THEN
    UPDATE profile_photos
    SET is_primary = TRUE
    WHERE id = v_photo_id;
  END IF;

  -- If this is set as primary, also update the main profile photo_url
  IF p_is_primary THEN
    UPDATE profiles
    SET photo_url = p_photo_url,
        updated_at = NOW()
    WHERE id = p_profile_id;
  END IF;

  RETURN v_photo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to reorder photos
CREATE OR REPLACE FUNCTION admin_reorder_profile_photos(
  p_profile_id UUID,
  p_photo_ids UUID[]
) RETURNS BOOLEAN AS $$
DECLARE
  i INT;
BEGIN
  -- Check admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Update display order for each photo
  FOR i IN 1..array_length(p_photo_ids, 1) LOOP
    UPDATE profile_photos
    SET display_order = i - 1,
        updated_at = NOW()
    WHERE id = p_photo_ids[i]
    AND profile_id = p_profile_id;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to delete a photo
CREATE OR REPLACE FUNCTION admin_delete_profile_photo(
  p_photo_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_was_primary BOOLEAN;
  v_photo_url TEXT;
BEGIN
  -- Check admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get photo details
  SELECT profile_id, is_primary, photo_url INTO v_profile_id, v_was_primary, v_photo_url
  FROM profile_photos
  WHERE id = p_photo_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Photo not found';
  END IF;

  -- Delete the photo
  DELETE FROM profile_photos WHERE id = p_photo_id;

  -- If it was primary, set the next photo as primary
  IF v_was_primary THEN
    UPDATE profile_photos
    SET is_primary = TRUE
    WHERE profile_id = v_profile_id
    AND id = (
      SELECT id FROM profile_photos
      WHERE profile_id = v_profile_id
      ORDER BY display_order ASC, created_at DESC
      LIMIT 1
    );

    -- Update profile's main photo_url
    UPDATE profiles
    SET photo_url = (
      SELECT photo_url FROM profile_photos
      WHERE profile_id = v_profile_id
      AND is_primary = TRUE
      LIMIT 1
    ),
    updated_at = NOW()
    WHERE id = v_profile_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_profile_photos TO authenticated;
GRANT EXECUTE ON FUNCTION admin_add_profile_photo TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reorder_profile_photos TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_profile_photo TO authenticated;