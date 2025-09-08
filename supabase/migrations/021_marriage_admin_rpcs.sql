-- Marriage Admin RPCs with full validation and audit logging

-- admin_create_marriage: Create new marriage with validations
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
    
    -- Prevent self-marriage
    IF p_husband_id = p_wife_id THEN
        RAISE EXCEPTION 'Cannot marry person to themselves';
    END IF;
    
    -- Validate husband exists and is male
    SELECT * INTO v_husband FROM profiles WHERE id = p_husband_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Husband profile not found: %', p_husband_id;
    END IF;
    IF v_husband.gender != 'male' THEN
        RAISE EXCEPTION 'Husband must be male, found: %', v_husband.gender;
    END IF;
    IF v_husband.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot create marriage with deleted profile';
    END IF;
    
    -- Validate wife exists and is female
    SELECT * INTO v_wife FROM profiles WHERE id = p_wife_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wife profile not found: %', p_wife_id;
    END IF;
    IF v_wife.gender != 'female' THEN
        RAISE EXCEPTION 'Wife must be female, found: %', v_wife.gender;
    END IF;
    IF v_wife.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot create marriage with deleted profile';
    END IF;
    
    -- Validate dates if provided
    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        IF p_start_date > p_end_date THEN
            RAISE EXCEPTION 'Start date cannot be after end date';
        END IF;
    END IF;
    
    -- Validate status
    IF p_status NOT IN ('married', 'divorced', 'widowed') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be married, divorced, or widowed', p_status;
    END IF;
    
    -- Check for duplicate active marriage (only if status is 'married')
    IF p_status = 'married' THEN
        IF EXISTS (
            SELECT 1 FROM marriages 
            WHERE husband_id = p_husband_id 
            AND wife_id = p_wife_id 
            AND status = 'married'
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Active marriage already exists between these profiles';
        END IF;
    END IF;
    
    -- Create the marriage
    INSERT INTO marriages (
        id,
        husband_id,
        wife_id,
        munasib,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        p_husband_id,
        p_wife_id,
        p_munasib,
        p_start_date,
        p_end_date,
        p_status,
        NOW(),
        NOW()
    ) RETURNING * INTO v_new_marriage;
    
    -- Log to audit
    INSERT INTO audit_log (
        id,
        action,
        table_name,
        record_id,
        actor_id,
        changes,
        created_at
    ) VALUES (
        gen_random_uuid(),
        'create',
        'marriages',
        v_new_marriage.id,
        v_actor_id,
        jsonb_build_object(
            'husband_id', p_husband_id,
            'wife_id', p_wife_id,
            'munasib', p_munasib,
            'start_date', p_start_date,
            'end_date', p_end_date,
            'status', p_status
        ),
        NOW()
    );
    
    RETURN v_new_marriage;
EXCEPTION
    WHEN unique_violation THEN
        -- Handle unique constraint violation with user-friendly message
        RAISE EXCEPTION 'This marriage already exists in the system';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_marriage: Update existing marriage
CREATE OR REPLACE FUNCTION admin_update_marriage(
    p_marriage_id UUID,
    p_updates JSONB
) RETURNS marriages AS $$
DECLARE
    v_marriage marriages%ROWTYPE;
    v_updated_marriage marriages%ROWTYPE;
    v_actor_id UUID;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID for audit
    v_actor_id := auth.uid();
    
    -- Lock and fetch the marriage
    SELECT * INTO v_marriage FROM marriages 
    WHERE id = p_marriage_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found: %', p_marriage_id;
    END IF;
    
    IF v_marriage.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot update deleted marriage';
    END IF;
    
    -- Store old values for audit
    v_old_values := to_jsonb(v_marriage);
    
    -- Validate and apply updates
    -- Handle munasib update
    IF p_updates ? 'munasib' THEN
        v_marriage.munasib := p_updates->>'munasib';
    END IF;
    
    -- Handle start_date update
    IF p_updates ? 'start_date' THEN
        v_marriage.start_date := (p_updates->>'start_date')::DATE;
    END IF;
    
    -- Handle end_date update
    IF p_updates ? 'end_date' THEN
        v_marriage.end_date := (p_updates->>'end_date')::DATE;
    END IF;
    
    -- Validate dates
    IF v_marriage.start_date IS NOT NULL AND v_marriage.end_date IS NOT NULL THEN
        IF v_marriage.start_date > v_marriage.end_date THEN
            RAISE EXCEPTION 'Start date cannot be after end date';
        END IF;
    END IF;
    
    -- Handle status update
    IF p_updates ? 'status' THEN
        IF p_updates->>'status' NOT IN ('married', 'divorced', 'widowed') THEN
            RAISE EXCEPTION 'Invalid status: %', p_updates->>'status';
        END IF;
        v_marriage.status := p_updates->>'status';
    END IF;
    
    -- Update the marriage
    UPDATE marriages SET
        munasib = v_marriage.munasib,
        start_date = v_marriage.start_date,
        end_date = v_marriage.end_date,
        status = v_marriage.status,
        updated_at = NOW()
    WHERE id = p_marriage_id
    RETURNING * INTO v_updated_marriage;
    
    -- Store new values for audit
    v_new_values := to_jsonb(v_updated_marriage);
    
    -- Log to audit
    INSERT INTO audit_log (
        id,
        action,
        table_name,
        record_id,
        actor_id,
        changes,
        created_at
    ) VALUES (
        gen_random_uuid(),
        'update',
        'marriages',
        p_marriage_id,
        v_actor_id,
        jsonb_build_object(
            'old', v_old_values,
            'new', v_new_values,
            'updates', p_updates
        ),
        NOW()
    );
    
    RETURN v_updated_marriage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_delete_marriage: Soft delete a marriage
CREATE OR REPLACE FUNCTION admin_delete_marriage(
    p_marriage_id UUID
) RETURNS marriages AS $$
DECLARE
    v_marriage marriages%ROWTYPE;
    v_deleted_marriage marriages%ROWTYPE;
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
    
    -- Lock and fetch the marriage
    SELECT * INTO v_marriage FROM marriages 
    WHERE id = p_marriage_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found: %', p_marriage_id;
    END IF;
    
    IF v_marriage.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Marriage is already deleted';
    END IF;
    
    -- Soft delete the marriage
    UPDATE marriages SET
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_marriage_id
    RETURNING * INTO v_deleted_marriage;
    
    -- Log to audit
    INSERT INTO audit_log (
        id,
        action,
        table_name,
        record_id,
        actor_id,
        changes,
        created_at
    ) VALUES (
        gen_random_uuid(),
        'delete',
        'marriages',
        p_marriage_id,
        v_actor_id,
        jsonb_build_object(
            'marriage', to_jsonb(v_marriage),
            'deleted_at', NOW()
        ),
        NOW()
    );
    
    RETURN v_deleted_marriage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_create_marriage TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_marriage TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_marriage TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION admin_create_marriage IS 'Admin function to create a new marriage with full validation and audit logging';
COMMENT ON FUNCTION admin_update_marriage IS 'Admin function to update an existing marriage with validation and audit logging';
COMMENT ON FUNCTION admin_delete_marriage IS 'Admin function to soft delete a marriage with audit logging';