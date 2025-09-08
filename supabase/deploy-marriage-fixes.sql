-- Deploy Marriage Backend Fixes
-- This script updates the marriage admin functions to fix bugs and align with audit schema

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS admin_create_marriage CASCADE;
DROP FUNCTION IF EXISTS admin_update_marriage CASCADE;
DROP FUNCTION IF EXISTS admin_delete_marriage CASCADE;

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
    
    -- Log to audit with correct schema
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
        NULL, -- or p_husband_id if desired
        v_actor_id,
        NULL,
        to_jsonb(v_new_marriage),
        jsonb_build_object(
            'source', 'rpc',
            'context', 'admin_create_marriage'
        ),
        NOW()
    );
    
    RETURN v_new_marriage;
EXCEPTION
    WHEN unique_violation THEN
        -- Handle unique constraint violation (mapped to Arabic in frontend)
        -- Using SQLSTATE 23505 for unique_violation
        RAISE EXCEPTION USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_update_marriage: Update existing marriage
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
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID for audit
    v_actor_id := auth.uid();
    
    -- Lock and fetch the marriage
    SELECT * INTO v_old_marriage FROM marriages 
    WHERE id = p_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found: %', p_id;
    END IF;
    
    -- Extract updates with defaults from current values
    v_munasib := COALESCE(p_updates->>'munasib', v_old_marriage.munasib);
    v_start_date := COALESCE((p_updates->>'start_date')::DATE, v_old_marriage.start_date);
    v_end_date := COALESCE((p_updates->>'end_date')::DATE, v_old_marriage.end_date);
    v_status := COALESCE(p_updates->>'status', v_old_marriage.status);
    
    -- Validate dates
    IF v_start_date IS NOT NULL AND v_end_date IS NOT NULL THEN
        IF v_start_date > v_end_date THEN
            RAISE EXCEPTION 'Start date cannot be after end date';
        END IF;
    END IF;
    
    -- Validate status
    IF v_status NOT IN ('married', 'divorced', 'widowed') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be married, divorced, or widowed', v_status;
    END IF;
    
    -- Update the marriage
    UPDATE marriages SET
        munasib = v_munasib,
        start_date = v_start_date,
        end_date = v_end_date,
        status = v_status,
        updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO v_updated_marriage;
    
    -- Log to audit with correct schema
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
        NULL,
        v_actor_id,
        to_jsonb(v_old_marriage),
        to_jsonb(v_updated_marriage),
        jsonb_build_object(
            'updates', p_updates,
            'source', 'rpc'
        ),
        NOW()
    );
    
    RETURN v_updated_marriage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- admin_delete_marriage: Hard delete a marriage
CREATE OR REPLACE FUNCTION admin_delete_marriage(
    p_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_marriage marriages%ROWTYPE;
    v_actor_id UUID;
    v_found BOOLEAN;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;
    
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;
    
    -- Get actor ID for audit
    v_actor_id := auth.uid();
    
    -- Fetch the marriage before deletion
    SELECT * INTO v_marriage FROM marriages WHERE id = p_id;
    v_found := FOUND;
    
    IF NOT v_found THEN
        -- Return success false if not found
        RETURN jsonb_build_object(
            'success', false,
            'affected_count', 0
        );
    END IF;
    
    -- Hard delete the marriage
    DELETE FROM marriages WHERE id = p_id;
    
    -- Log to audit with correct schema
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
        NULL,
        v_actor_id,
        to_jsonb(v_marriage),
        NULL,
        jsonb_build_object(
            'source', 'rpc'
        ),
        NOW()
    );
    
    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'affected_count', 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_create_marriage TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_marriage TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_marriage TO authenticated;

-- Enable Row Level Security on marriages table
ALTER TABLE marriages ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "marriages_select_all" ON marriages;

-- Create read-only policy for all authenticated and anonymous users
CREATE POLICY "marriages_select_all" 
    ON marriages 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

-- Create or replace the generic update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_marriages_updated_at ON marriages;

-- Create trigger to automatically update updated_at on marriages table
CREATE TRIGGER update_marriages_updated_at
    BEFORE UPDATE ON marriages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON FUNCTION admin_create_marriage IS 'Admin function to create a new marriage with full validation and audit logging';
COMMENT ON FUNCTION admin_update_marriage IS 'Admin function to update an existing marriage with validation and audit logging';
COMMENT ON FUNCTION admin_delete_marriage IS 'Admin function to hard delete a marriage with audit logging';
COMMENT ON POLICY "marriages_select_all" ON marriages IS 'Allow all users to read marriages data. Write operations are only allowed through admin RPC functions.';
COMMENT ON TRIGGER update_marriages_updated_at ON marriages IS 'Automatically updates the updated_at timestamp when a marriage record is modified';