-- =====================================================
-- SMART PHOTO GALLERY MIGRATION
-- This migration carefully handles existing database objects
-- =====================================================

-- STEP 1: Handle existing functions (DROP and RECREATE)
-- We must drop functions before changing their signatures
DROP FUNCTION IF EXISTS get_profile_photos(UUID);
DROP FUNCTION IF EXISTS admin_add_profile_photo(UUID, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS admin_set_primary_photo(UUID);
DROP FUNCTION IF EXISTS admin_delete_profile_photo(UUID);
DROP FUNCTION IF EXISTS admin_reorder_photos(UUID, UUID[]);

-- STEP 2: Check and create/alter table structure
DO $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_photos') THEN
        -- Create new table
        CREATE TABLE profile_photos (
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
        RAISE NOTICE 'Created profile_photos table';
    ELSE
        -- Table exists, check and add missing columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'storage_path') THEN
            ALTER TABLE profile_photos ADD COLUMN storage_path TEXT;
            RAISE NOTICE 'Added storage_path column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'caption') THEN
            ALTER TABLE profile_photos ADD COLUMN caption TEXT;
            RAISE NOTICE 'Added caption column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'is_primary') THEN
            ALTER TABLE profile_photos ADD COLUMN is_primary BOOLEAN DEFAULT false;
            RAISE NOTICE 'Added is_primary column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'display_order') THEN
            ALTER TABLE profile_photos ADD COLUMN display_order INT DEFAULT 0;
            RAISE NOTICE 'Added display_order column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'uploaded_by') THEN
            ALTER TABLE profile_photos ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
            RAISE NOTICE 'Added uploaded_by column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'created_at') THEN
            ALTER TABLE profile_photos ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added created_at column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profile_photos' AND column_name = 'updated_at') THEN
            ALTER TABLE profile_photos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column';
        END IF;
    END IF;
END $$;

-- STEP 3: Create indexes safely
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE schemaname = 'public' 
                  AND tablename = 'profile_photos' 
                  AND indexname = 'idx_profile_photos_profile') THEN
        CREATE INDEX idx_profile_photos_profile ON profile_photos(profile_id);
        RAISE NOTICE 'Created idx_profile_photos_profile index';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE schemaname = 'public' 
                  AND tablename = 'profile_photos' 
                  AND indexname = 'idx_profile_photos_primary') THEN
        CREATE INDEX idx_profile_photos_primary ON profile_photos(profile_id, is_primary);
        RAISE NOTICE 'Created idx_profile_photos_primary index';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE schemaname = 'public' 
                  AND tablename = 'profile_photos' 
                  AND indexname = 'idx_profile_photos_order') THEN
        CREATE INDEX idx_profile_photos_order ON profile_photos(profile_id, display_order);
        RAISE NOTICE 'Created idx_profile_photos_order index';
    END IF;
END $$;

-- STEP 4: Enable RLS if not already enabled
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

-- STEP 5: Recreate RLS policies (drop and recreate to ensure consistency)
DROP POLICY IF EXISTS "Public can view photos" ON profile_photos;
DROP POLICY IF EXISTS "Authenticated users can manage photos" ON profile_photos;
DROP POLICY IF EXISTS "Admins can manage photos" ON profile_photos;

-- Create permissive policies
CREATE POLICY "Public can view photos" ON profile_photos
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage photos" ON profile_photos
    FOR ALL USING (auth.uid() IS NOT NULL);

-- STEP 6: Create functions with proper signatures
-- Function to get profile photos
CREATE FUNCTION get_profile_photos(p_profile_id UUID)
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    photo_url TEXT,
    storage_path TEXT,
    caption TEXT,
    is_primary BOOLEAN,
    display_order INT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function to add profile photo
CREATE FUNCTION admin_add_profile_photo(
    p_profile_id UUID,
    p_photo_url TEXT,
    p_storage_path TEXT DEFAULT NULL,
    p_caption TEXT DEFAULT NULL,
    p_is_primary BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_photo_id UUID;
    v_current_count INT;
BEGIN
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
$$;

-- Function to set primary photo
CREATE FUNCTION admin_set_primary_photo(p_photo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_photo_url TEXT;
BEGIN
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
$$;

-- Function to delete profile photo
CREATE FUNCTION admin_delete_profile_photo(p_photo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_id UUID;
    v_is_primary BOOLEAN;
    v_new_primary_id UUID;
    v_new_primary_url TEXT;
BEGIN
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
$$;

-- Function to reorder photos
CREATE FUNCTION admin_reorder_photos(
    p_profile_id UUID,
    p_photo_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i INT;
BEGIN
    -- Update display order based on array position
    FOR i IN 1..array_length(p_photo_ids, 1) LOOP
        UPDATE profile_photos
        SET display_order = i - 1
        WHERE id = p_photo_ids[i]
        AND profile_id = p_profile_id;
    END LOOP;

    RETURN true;
END;
$$;

-- STEP 7: Migrate existing photos (only if not already migrated)
DO $$
DECLARE
    v_count INT;
BEGIN
    -- Check how many profiles have photos but no entries in profile_photos
    SELECT COUNT(*) INTO v_count
    FROM profiles p
    WHERE p.photo_url IS NOT NULL 
        AND p.photo_url != ''
        AND NOT EXISTS (
            SELECT 1 FROM profile_photos pp 
            WHERE pp.profile_id = p.id 
        );
    
    IF v_count > 0 THEN
        -- Migrate existing photos
        INSERT INTO profile_photos (profile_id, photo_url, is_primary, display_order)
        SELECT 
            id as profile_id,
            photo_url,
            true as is_primary,
            0 as display_order
        FROM profiles
        WHERE photo_url IS NOT NULL
            AND photo_url != ''
            AND NOT EXISTS (
                SELECT 1 FROM profile_photos 
                WHERE profile_photos.profile_id = profiles.id 
            );
        
        RAISE NOTICE 'Migrated % existing profile photos', v_count;
    ELSE
        RAISE NOTICE 'No photos to migrate or already migrated';
    END IF;
END $$;

-- STEP 8: Add helpful comments
COMMENT ON TABLE profile_photos IS 'Stores multiple photos per profile with gallery functionality';
COMMENT ON COLUMN profile_photos.is_primary IS 'Indicates if this is the main profile photo';
COMMENT ON COLUMN profile_photos.display_order IS 'Order of photos in gallery (0 = first)';

-- STEP 9: Grant necessary permissions
GRANT ALL ON profile_photos TO authenticated;
GRANT ALL ON FUNCTION get_profile_photos(UUID) TO authenticated;
GRANT ALL ON FUNCTION admin_add_profile_photo(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT ALL ON FUNCTION admin_set_primary_photo(UUID) TO authenticated;
GRANT ALL ON FUNCTION admin_delete_profile_photo(UUID) TO authenticated;
GRANT ALL ON FUNCTION admin_reorder_photos(UUID, UUID[]) TO authenticated;

-- Final status message
DO $$
BEGIN
    RAISE NOTICE 'Photo gallery migration completed successfully!';
END $$;