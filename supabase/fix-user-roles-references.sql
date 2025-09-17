-- Fix user_roles references by using profile.role instead
-- Since we're using a simplified RBAC with role column on profiles table

-- Drop and recreate admin_create_profile function
CREATE OR REPLACE FUNCTION admin_create_profile(
    p_name TEXT,
    p_gender TEXT DEFAULT 'male',
    p_father_id UUID DEFAULT NULL,
    p_mother_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    new_profile_id UUID;
    parent_hid TEXT;
    new_hid TEXT;
    new_generation INT;
    result JSONB;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Get parent HID and generation if father exists
    IF p_father_id IS NOT NULL THEN
        SELECT hid, generation + 1
        INTO parent_hid, new_generation
        FROM profiles
        WHERE id = p_father_id
        AND deleted_at IS NULL;
        
        IF parent_hid IS NULL THEN
            RAISE EXCEPTION 'Father not found or deleted';
        END IF;
    ELSE
        new_generation := 1;
    END IF;

    -- Generate new HID
    new_hid := generate_next_hid(parent_hid);

    -- Insert new profile
    INSERT INTO profiles (
        id, name, gender, father_id, mother_id, 
        hid, generation, metadata
    ) VALUES (
        gen_random_uuid(), p_name, p_gender, p_father_id, p_mother_id,
        new_hid, new_generation, p_metadata
    ) RETURNING id INTO new_profile_id;

    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(new_profile_id);

    -- Return result
    result := jsonb_build_object(
        'success', true,
        'profile_id', new_profile_id,
        'hid', new_hid,
        'generation', new_generation
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate admin_update_profile function
CREATE OR REPLACE FUNCTION admin_update_profile(
    p_profile_id UUID,
    p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
    update_sql TEXT;
    allowed_fields TEXT[] := ARRAY[
        'name', 'gender', 'birth_date', 'death_date', 'status',
        'bio', 'occupation', 'education', 'phone', 'email',
        'photo_url', 'birth_place', 'current_residence',
        'social_media_links', 'achievements', 'timeline',
        'metadata', 'kunya', 'nickname', 'profile_visibility',
        'dob_is_public', 'father_id', 'mother_id', 'sibling_order',
        'dob_data', 'dod_data', 'role'
    ];
    field TEXT;
    result JSONB;
    updated_count INT;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Build dynamic UPDATE query
    update_sql := 'UPDATE profiles SET ';
    
    FOR field IN SELECT jsonb_object_keys(p_updates)
    LOOP
        IF field = ANY(allowed_fields) THEN
            update_sql := update_sql || quote_ident(field) || ' = ' ||
                         quote_literal(p_updates->>field) || '::' || 
                         CASE 
                             WHEN field IN ('birth_date', 'death_date') THEN 'DATE'
                             WHEN field IN ('social_media_links', 'achievements', 'timeline', 'metadata', 'dob_data', 'dod_data') THEN 'JSONB'
                             WHEN field IN ('father_id', 'mother_id') THEN 'UUID'
                             WHEN field IN ('sibling_order') THEN 'INTEGER'
                             WHEN field IN ('dob_is_public') THEN 'BOOLEAN'
                             ELSE 'TEXT'
                         END || ', ';
        END IF;
    END LOOP;
    
    -- Remove trailing comma and add WHERE clause
    update_sql := rtrim(update_sql, ', ') || 
                 ' WHERE id = ' || quote_literal(p_profile_id) ||
                 ' AND deleted_at IS NULL';
    
    -- Execute update
    EXECUTE update_sql;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Trigger layout recalculation
    PERFORM trigger_layout_recalc_async(p_profile_id);
    
    -- Return result
    result := jsonb_build_object(
        'success', updated_count > 0,
        'profile_id', p_profile_id,
        'updated', updated_count > 0
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate admin_delete_profile function  
CREATE OR REPLACE FUNCTION admin_delete_profile(
    p_profile_id UUID,
    p_cascade BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    deleted_count INT := 0;
    result JSONB;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Soft delete the profile
    UPDATE profiles 
    SET deleted_at = NOW()
    WHERE id = p_profile_id
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Cascade delete children if requested
    IF p_cascade THEN
        UPDATE profiles
        SET deleted_at = NOW()
        WHERE father_id = p_profile_id
        AND deleted_at IS NULL;
    END IF;
    
    -- Return result
    result := jsonb_build_object(
        'success', deleted_count > 0,
        'profile_id', p_profile_id,
        'deleted', deleted_count > 0,
        'cascade', p_cascade
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate admin_get_statistics function
CREATE OR REPLACE FUNCTION admin_get_statistics()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Gather statistics
    SELECT jsonb_build_object(
        'total_profiles', COUNT(*) FILTER (WHERE deleted_at IS NULL),
        'deleted_profiles', COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
        'male_count', COUNT(*) FILTER (WHERE gender = 'male' AND deleted_at IS NULL),
        'female_count', COUNT(*) FILTER (WHERE gender = 'female' AND deleted_at IS NULL),
        'alive_count', COUNT(*) FILTER (WHERE status = 'alive' AND deleted_at IS NULL),
        'deceased_count', COUNT(*) FILTER (WHERE status = 'deceased' AND deleted_at IS NULL),
        'max_generation', MAX(generation) FILTER (WHERE deleted_at IS NULL),
        'avg_children', (
            SELECT AVG(child_count)::NUMERIC(10,2)
            FROM (
                SELECT father_id, COUNT(*) as child_count
                FROM profiles
                WHERE father_id IS NOT NULL
                AND deleted_at IS NULL
                GROUP BY father_id
            ) AS child_counts
        ),
        'profiles_with_photos', COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND deleted_at IS NULL),
        'profiles_with_bio', COUNT(*) FILTER (WHERE bio IS NOT NULL AND deleted_at IS NULL),
        'last_update', MAX(updated_at)
    ) INTO stats
    FROM profiles;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate admin_execute_sql function
CREATE OR REPLACE FUNCTION admin_execute_sql(p_sql TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    row_count INT;
    error_msg TEXT;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Validate SQL (basic safety checks)
    IF p_sql IS NULL OR trim(p_sql) = '' THEN
        RAISE EXCEPTION 'SQL query cannot be empty';
    END IF;
    
    -- Block certain dangerous operations
    IF p_sql ~* '(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)' THEN
        RAISE EXCEPTION 'Dangerous operation not allowed';
    END IF;
    
    BEGIN
        -- Execute the SQL
        EXECUTE p_sql;
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        result := jsonb_build_object(
            'success', true,
            'rows_affected', row_count,
            'message', 'Query executed successfully'
        );
    EXCEPTION
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS error_msg = MESSAGE_TEXT;
            result := jsonb_build_object(
                'success', false,
                'error', error_msg
            );
    END;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update bulk operations
CREATE OR REPLACE FUNCTION admin_bulk_create_profiles(p_profiles JSONB)
RETURNS JSONB AS $$
DECLARE
    profile JSONB;
    created_count INT := 0;
    error_count INT := 0;
    errors JSONB[] := '{}';
    result JSONB;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Process each profile
    FOR profile IN SELECT * FROM jsonb_array_elements(p_profiles)
    LOOP
        BEGIN
            -- Call admin_create_profile for each one
            PERFORM admin_create_profile(
                p_name := profile->>'name',
                p_gender := COALESCE(profile->>'gender', 'male'),
                p_father_id := (profile->>'father_id')::UUID,
                p_mother_id := (profile->>'mother_id')::UUID,
                p_metadata := COALESCE(profile->'metadata', '{}'::jsonb)
            );
            created_count := created_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                errors := array_append(errors, jsonb_build_object(
                    'profile', profile,
                    'error', SQLERRM
                ));
        END;
    END LOOP;

    -- Return summary
    result := jsonb_build_object(
        'success', error_count = 0,
        'created', created_count,
        'errors', error_count,
        'error_details', to_jsonb(errors)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_bulk_update_profiles(p_updates JSONB)
RETURNS JSONB AS $$
DECLARE
    update_item JSONB;
    updated_count INT := 0;
    error_count INT := 0;
    errors JSONB[] := '{}';
    result JSONB;
BEGIN
    -- Check admin permission using profile.role
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Process each update
    FOR update_item IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        BEGIN
            -- Call admin_update_profile for each one
            PERFORM admin_update_profile(
                p_profile_id := (update_item->>'profile_id')::UUID,
                p_updates := update_item->'updates'
            );
            updated_count := updated_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                error_count := error_count + 1;
                errors := array_append(errors, jsonb_build_object(
                    'profile_id', update_item->>'profile_id',
                    'error', SQLERRM
                ));
        END;
    END LOOP;

    -- Return summary
    result := jsonb_build_object(
        'success', error_count = 0,
        'updated', updated_count,
        'errors', error_count,
        'error_details', to_jsonb(errors)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;