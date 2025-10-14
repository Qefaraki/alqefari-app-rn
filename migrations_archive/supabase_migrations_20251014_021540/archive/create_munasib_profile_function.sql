-- Create a secure function for creating Munasib (spouse) profiles
-- These are profiles married into the family with NULL HID and family_origin

CREATE OR REPLACE FUNCTION admin_create_munasib_profile(
    p_name TEXT,
    p_gender TEXT,
    p_generation INT DEFAULT 1,
    p_family_origin TEXT DEFAULT NULL,
    p_sibling_order INT DEFAULT 0,
    p_status TEXT DEFAULT 'alive',
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_current_residence TEXT DEFAULT NULL,
    p_occupation TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL
) RETURNS profiles AS $$
DECLARE
    v_new_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Set search path for security
    SET search_path = public;

    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor for audit
    v_actor_id := auth.uid();

    -- Validate required fields
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
        RAISE EXCEPTION 'Name is required';
    END IF;

    IF p_gender NOT IN ('male', 'female') THEN
        RAISE EXCEPTION 'Gender must be male or female';
    END IF;

    IF p_generation < 1 THEN
        RAISE EXCEPTION 'Generation must be at least 1';
    END IF;

    -- Create the Munasib profile with NULL HID
    INSERT INTO profiles (
        hid,  -- Explicitly NULL for Munasib
        name,
        gender,
        generation,
        family_origin,  -- Store original family name
        sibling_order,
        status,
        phone,
        email,
        photo_url,
        current_residence,
        occupation,
        bio,
        created_by,
        updated_by,
        version
    ) VALUES (
        NULL,  -- NULL HID identifies this as Munasib
        p_name,
        p_gender,
        p_generation,
        p_family_origin,
        p_sibling_order,
        p_status,
        p_phone,
        p_email,
        p_photo_url,
        p_current_residence,
        p_occupation,
        p_bio,
        v_actor_id,
        v_actor_id,
        1
    ) RETURNING * INTO v_new_profile;

    -- Log to audit
    INSERT INTO audit_log (
        action,
        table_name,
        target_profile_id,
        actor_id,
        old_data,
        new_data,
        details
    ) VALUES (
        'INSERT',
        'profiles',
        v_new_profile.id,
        v_actor_id,
        NULL,
        to_jsonb(v_new_profile),
        jsonb_build_object(
            'source', 'admin_create_munasib_profile',
            'is_munasib', true,
            'family_origin', p_family_origin
        )
    );

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
-- The function itself checks for admin role
GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION admin_create_munasib_profile IS
'Creates a Munasib (spouse from another family) profile with NULL HID and family_origin tracking.
Requires admin role. Used for spouses married into the Al-Qefari family.';