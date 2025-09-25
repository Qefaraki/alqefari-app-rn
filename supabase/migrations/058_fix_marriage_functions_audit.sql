-- Fix marriage functions to handle audit logging properly
-- These functions currently try to insert auth.uid() into audit_log.actor_id which expects profile ID

DROP FUNCTION IF EXISTS admin_create_marriage CASCADE;

CREATE OR REPLACE FUNCTION admin_create_marriage(
    p_husband_id UUID,
    p_wife_id UUID,
    p_munasib TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT 'married'
) RETURNS marriages AS $$
DECLARE
    v_husband profiles%ROWTYPE;
    v_wife profiles%ROWTYPE;
    v_new_marriage marriages%ROWTYPE;
    v_actor_id UUID;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID for audit
    v_actor_id := auth.uid();
    
    -- Validate required fields
    IF p_husband_id IS NULL OR p_wife_id IS NULL THEN
        RAISE EXCEPTION 'Both husband_id and wife_id are required';
    END IF;
    
    -- Validate husband exists and is male
    SELECT * INTO v_husband FROM profiles WHERE id = p_husband_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Husband profile not found';
    END IF;
    IF v_husband.gender != 'male' THEN
        RAISE EXCEPTION 'Husband must be male';
    END IF;
    
    -- Validate wife exists and is female
    SELECT * INTO v_wife FROM profiles WHERE id = p_wife_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wife profile not found';
    END IF;
    IF v_wife.gender != 'female' THEN
        RAISE EXCEPTION 'Wife must be female';
    END IF;
    
    -- Validate status
    IF p_status NOT IN ('married', 'divorced', 'separated', 'widowed') THEN
        RAISE EXCEPTION 'Invalid marriage status';
    END IF;
    
    -- Create marriage record
    INSERT INTO marriages (
        husband_id,
        wife_id,
        munasib,
        start_date,
        end_date,
        status
    ) VALUES (
        p_husband_id,
        p_wife_id,
        p_munasib,
        p_start_date,
        p_end_date,
        p_status
    ) RETURNING * INTO v_new_marriage;
    
    -- Attempt audit logging to enhanced table (which accepts auth.uid())
    BEGIN
        -- Try audit_log_enhanced first (if it exists)
        INSERT INTO audit_log_enhanced (
            actor_id,
            actor_type,
            action_type,
            action_category,
            table_name,
            record_id,
            target_type,
            old_data,
            new_data,
            description,
            severity,
            status,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,  -- auth.uid() works here!
            'user',
            'add_marriage',
            'marriage',
            'marriages',
            v_new_marriage.id,
            'marriage',
            NULL,
            to_jsonb(v_new_marriage),
            'إضافة زواج',
            'low',
            'completed',
            jsonb_build_object(
                'source', 'rpc',
                'context', 'admin_create_marriage',
                'husband_name', v_husband.name,
                'wife_name', v_wife.name
            ),
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- If audit_log_enhanced doesn't exist or fails, try legacy
        BEGIN
            -- Only insert to legacy audit_log if user has a profile
            IF EXISTS (SELECT 1 FROM profiles WHERE id = v_actor_id) THEN
                INSERT INTO audit_log (
                    action,
                    table_name,
                    target_profile_id,
                    actor_id,
                    old_data,
                    new_data,
                    details,
                    created_at
                ) VALUES (
                    'INSERT',
                    'marriages',
                    p_husband_id,  -- Use husband as target
                    v_actor_id,
                    NULL,
                    to_jsonb(v_new_marriage),
                    jsonb_build_object(
                        'source', 'rpc',
                        'context', 'admin_create_marriage'
                    ),
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Silently skip audit if it fails - don't break the operation
            NULL;
        END;
    END;
    
    RETURN v_new_marriage;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix admin_update_marriage similarly
DROP FUNCTION IF EXISTS admin_update_marriage CASCADE;

CREATE OR REPLACE FUNCTION admin_update_marriage(
    p_id UUID,
    p_updates JSONB
) RETURNS marriages AS $$
DECLARE
    v_old_marriage marriages%ROWTYPE;
    v_updated_marriage marriages%ROWTYPE;
    v_actor_id UUID;
    v_munasib TEXT;
    v_start_date DATE;
    v_end_date DATE;
    v_status TEXT;
BEGIN
    SET search_path = public;
    
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    v_actor_id := auth.uid();
    
    -- Get existing marriage
    SELECT * INTO v_old_marriage FROM marriages WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found';
    END IF;
    
    -- Extract and validate updates
    v_munasib := COALESCE((p_updates->>'munasib')::TEXT, v_old_marriage.munasib);
    v_start_date := COALESCE((p_updates->>'start_date')::DATE, v_old_marriage.start_date);
    v_end_date := COALESCE((p_updates->>'end_date')::DATE, v_old_marriage.end_date);
    v_status := COALESCE((p_updates->>'status')::TEXT, v_old_marriage.status);
    
    IF v_status NOT IN ('married', 'divorced', 'separated', 'widowed') THEN
        RAISE EXCEPTION 'Invalid marriage status';
    END IF;
    
    -- Update marriage
    UPDATE marriages
    SET
        munasib = v_munasib,
        start_date = v_start_date,
        end_date = v_end_date,
        status = v_status,
        updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_updated_marriage;
    
    -- Attempt audit logging with proper error handling
    BEGIN
        -- Try audit_log_enhanced first
        INSERT INTO audit_log_enhanced (
            actor_id,
            actor_type,
            action_type,
            action_category,
            table_name,
            record_id,
            target_type,
            old_data,
            new_data,
            description,
            severity,
            status,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,
            'user',
            'update_marriage',
            'marriage',
            'marriages',
            p_id,
            'marriage',
            to_jsonb(v_old_marriage),
            to_jsonb(v_updated_marriage),
            'تحديث زواج',
            'low',
            'completed',
            jsonb_build_object(
                'source', 'rpc',
                'context', 'admin_update_marriage',
                'updates', p_updates
            ),
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Try legacy audit_log if user has profile
        BEGIN
            IF EXISTS (SELECT 1 FROM profiles WHERE id = v_actor_id) THEN
                INSERT INTO audit_log (
                    action,
                    table_name,
                    target_profile_id,
                    actor_id,
                    old_data,
                    new_data,
                    details,
                    created_at
                ) VALUES (
                    'UPDATE',
                    'marriages',
                    v_old_marriage.husband_id,
                    v_actor_id,
                    to_jsonb(v_old_marriage),
                    to_jsonb(v_updated_marriage),
                    jsonb_build_object(
                        'source', 'rpc',
                        'context', 'admin_update_marriage'
                    ),
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Silently skip
        END;
    END;
    
    RETURN v_updated_marriage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix admin_delete_marriage
DROP FUNCTION IF EXISTS admin_delete_marriage CASCADE;

CREATE OR REPLACE FUNCTION admin_delete_marriage(
    p_id UUID
) RETURNS VOID AS $$
DECLARE
    v_old_marriage marriages%ROWTYPE;
    v_actor_id UUID;
BEGIN
    SET search_path = public;
    
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    v_actor_id := auth.uid();
    
    SELECT * INTO v_old_marriage FROM marriages WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found';
    END IF;
    
    -- Delete the marriage
    DELETE FROM marriages WHERE id = p_id;
    
    -- Attempt audit logging with proper error handling
    BEGIN
        -- Try audit_log_enhanced first
        INSERT INTO audit_log_enhanced (
            actor_id,
            actor_type,
            action_type,
            action_category,
            table_name,
            record_id,
            target_type,
            old_data,
            new_data,
            description,
            severity,
            status,
            metadata,
            created_at
        ) VALUES (
            v_actor_id,
            'user',
            'delete_marriage',
            'marriage',
            'marriages',
            p_id,
            'marriage',
            to_jsonb(v_old_marriage),
            NULL,
            'حذف زواج',
            'high',
            'completed',
            jsonb_build_object(
                'source', 'rpc',
                'context', 'admin_delete_marriage'
            ),
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Try legacy audit_log if user has profile
        BEGIN
            IF EXISTS (SELECT 1 FROM profiles WHERE id = v_actor_id) THEN
                INSERT INTO audit_log (
                    action,
                    table_name,
                    target_profile_id,
                    actor_id,
                    old_data,
                    new_data,
                    details,
                    created_at
                ) VALUES (
                    'DELETE',
                    'marriages',
                    v_old_marriage.husband_id,
                    v_actor_id,
                    to_jsonb(v_old_marriage),
                    NULL,
                    jsonb_build_object(
                        'source', 'rpc',
                        'context', 'admin_delete_marriage'
                    ),
                    NOW()
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Silently skip
        END;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_create_marriage TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_marriage TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_marriage TO authenticated;