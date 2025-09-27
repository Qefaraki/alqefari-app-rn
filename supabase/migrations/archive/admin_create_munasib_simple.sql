-- Simplified admin_create_munasib_profile that gracefully handles audit failures
DROP FUNCTION IF EXISTS admin_create_munasib_profile CASCADE;

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
    v_auth_uid UUID;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get the auth user ID
    v_auth_uid := auth.uid();

    -- Create the Munasib profile
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
        v_auth_uid,
        v_auth_uid
    ) RETURNING * INTO v_new_profile;

    -- Attempt audit logging but don't fail if it doesn't work
    BEGIN
        -- Try to log with auth.uid() as actor_id (matching existing pattern)
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
            v_auth_uid,  -- Use auth.uid() directly
            to_jsonb(v_new_profile),
            jsonb_build_object(
                'source', 'admin_create_munasib_profile',
                'is_munasib', true
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- If audit fails for ANY reason, just log and continue
        RAISE NOTICE 'Audit log skipped: %', SQLERRM;
    END;

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;