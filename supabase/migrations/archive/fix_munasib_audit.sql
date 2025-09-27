-- Fix admin_create_munasib_profile to handle audit log properly
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
    v_actor_id UUID;
    v_actor_profile_id UUID;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get the auth user ID
    v_actor_id := auth.uid();

    -- Try to find the actor's profile ID (actor_id in audit_log references profiles table)
    -- If the user doesn't have a profile, we'll use NULL for audit
    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE auth_user_id = v_actor_id
    LIMIT 1;

    -- If no profile found for this user, we can still proceed but audit will have NULL actor
    -- This is better than failing the entire operation

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
        v_actor_id,  -- This is auth.uid() for created_by
        v_actor_id   -- This is auth.uid() for updated_by
    ) RETURNING * INTO v_new_profile;

    -- Only insert audit log if we have a valid actor profile
    -- Or if audit_log allows NULL actor_id
    BEGIN
        INSERT INTO audit_log (
            action,
            table_name,
            target_profile_id,
            actor_id,  -- This needs to be a profile ID, not auth user ID
            new_data,
            details
        ) VALUES (
            'INSERT',
            'profiles',
            v_new_profile.id,
            v_actor_profile_id,  -- Use the profile ID, which might be NULL
            to_jsonb(v_new_profile),
            jsonb_build_object(
                'source', 'admin_create_munasib_profile',
                'is_munasib', true,
                'auth_user_id', v_actor_id  -- Store auth ID in details for reference
            )
        );
    EXCEPTION WHEN foreign_key_violation THEN
        -- If audit fails due to foreign key, log to console but don't fail the operation
        RAISE NOTICE 'Audit log skipped - actor profile not found for auth user %', v_actor_id;
    END;

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;

-- Also, let's check if we need to make audit_log.actor_id nullable
-- This would be a better long-term solution
-- First check current constraint
DO $$
BEGIN
    -- Check if the foreign key constraint exists with NOT NULL
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_log'
        AND column_name = 'actor_id'
        AND is_nullable = 'NO'
    ) THEN
        -- Make actor_id nullable to handle cases where admin users don't have profiles
        ALTER TABLE audit_log ALTER COLUMN actor_id DROP NOT NULL;
        RAISE NOTICE 'Made audit_log.actor_id nullable to handle admin users without profiles';
    END IF;
END $$;