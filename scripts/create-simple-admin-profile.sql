-- Simplified admin_create_profile that respects the HID we provide

CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT,
    p_father_id UUID DEFAULT NULL,
    p_generation INT DEFAULT 1,
    p_sibling_order INT DEFAULT 0,
    p_status TEXT DEFAULT 'alive',
    p_dob_data JSONB DEFAULT NULL,
    p_dod_data JSONB DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_birth_place TEXT DEFAULT NULL,
    p_current_residence TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL,
    p_education TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_social_media_links JSONB DEFAULT '{}'::JSONB,
    p_achievements TEXT[] DEFAULT NULL,
    p_timeline JSONB DEFAULT NULL,
    p_dob_is_public BOOLEAN DEFAULT true,
    p_profile_visibility TEXT DEFAULT 'public',
    p_hid TEXT DEFAULT NULL  -- Accept HID as parameter
)
RETURNS JSONB AS $$
DECLARE
    new_profile profiles;
    new_id UUID;
    actual_hid TEXT;
BEGIN
    -- Generate new ID
    new_id := gen_random_uuid();
    
    -- Use provided HID or generate one
    IF p_hid IS NOT NULL THEN
        actual_hid := p_hid;
    ELSE
        -- Fall back to auto-generation if not provided
        actual_hid := generate_next_hid((SELECT hid FROM profiles WHERE id = p_father_id));
    END IF;
    
    -- Insert the new profile
    INSERT INTO profiles (
        id, name, gender, father_id, generation, hid, sibling_order,
        status, dob_data, dod_data, photo_url, bio, birth_place,
        current_residence, occupation, education, phone, email,
        social_media_links, achievements, timeline,
        dob_is_public, profile_visibility
    )
    VALUES (
        new_id, TRIM(p_name), p_gender, p_father_id, p_generation, actual_hid, p_sibling_order,
        p_status, p_dob_data, p_dod_data, p_photo_url, p_bio, p_birth_place,
        p_current_residence, p_occupation, p_education, p_phone, p_email,
        p_social_media_links, p_achievements, p_timeline,
        p_dob_is_public, p_profile_visibility
    )
    RETURNING * INTO new_profile;
    
    -- Update parent's descendants count
    IF p_father_id IS NOT NULL THEN
        UPDATE profiles 
        SET descendants_count = descendants_count + 1
        WHERE id = p_father_id;
    END IF;
    
    -- Return the new profile ID and HID
    RETURN jsonb_build_object(
        'id', new_profile.id,
        'hid', new_profile.hid,
        'name', new_profile.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;