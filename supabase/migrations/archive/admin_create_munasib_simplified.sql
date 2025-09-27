-- Simplified admin_create_munasib_profile function
-- This version has minimal parameters to match what the components are calling

-- Drop existing function if exists
DROP FUNCTION IF EXISTS admin_create_munasib_profile CASCADE;

-- Create simplified function
CREATE OR REPLACE FUNCTION admin_create_munasib_profile(
    p_name TEXT,
    p_gender TEXT,
    p_generation INT,
    p_family_origin TEXT,
    p_sibling_order INT,
    p_status TEXT,
    p_phone TEXT DEFAULT NULL
) RETURNS profiles AS $$
DECLARE
    v_new_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor for audit
    v_actor_id := auth.uid();

    -- Create the Munasib profile with NULL HID
    INSERT INTO profiles (
        hid,
        name,
        gender,
        generation,
        family_origin,
        sibling_order,
        status,
        phone,
        created_by,
        updated_by
    ) VALUES (
        NULL,  -- NULL HID for Munasib
        p_name,
        p_gender,
        p_generation,
        p_family_origin,
        p_sibling_order,
        p_status,
        p_phone,
        v_actor_id,
        v_actor_id
    ) RETURNING * INTO v_new_profile;

    -- Log to audit
    INSERT INTO audit_log (
        action,
        table_name,
        target_profile_id,
        actor_id,
        new_data,
        details
    ) VALUES (
        'INSERT',
        'profiles',
        v_new_profile.id,
        v_actor_id,
        to_jsonb(v_new_profile),
        jsonb_build_object(
            'source', 'admin_create_munasib_profile',
            'is_munasib', true
        )
    );

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;