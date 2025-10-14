-- Combined migration to fix audit logging system completely
-- This creates the enhanced audit table and updates the trigger to use it

-- Step 1: Create the enhanced audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_log_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Actor Information (references auth.users, not profiles!)
    actor_id UUID REFERENCES auth.users(id),
    actor_type TEXT DEFAULT 'user',

    -- Action Details
    action_type TEXT NOT NULL,
    action_category TEXT,

    -- Target Information
    table_name TEXT,
    record_id UUID,
    target_type TEXT,

    -- Data Changes
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],

    -- Context
    description TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Metadata
    severity TEXT DEFAULT 'low',
    status TEXT DEFAULT 'completed',
    error_message TEXT,

    -- Tracking
    session_id UUID,
    request_id UUID,
    metadata JSONB,

    -- Permissions
    can_revert BOOLEAN DEFAULT false,
    reverted_at TIMESTAMP,
    reverted_by UUID
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_audit_enhanced_created_at ON audit_log_enhanced(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_enhanced_actor_id ON audit_log_enhanced(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_enhanced_action_type ON audit_log_enhanced(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_enhanced_table_record ON audit_log_enhanced(table_name, record_id);

-- Grant permissions
GRANT SELECT, INSERT ON audit_log_enhanced TO authenticated;

-- Step 2: Drop and recreate the trigger function to use the new table
DROP TRIGGER IF EXISTS trigger_log_profile_changes ON profiles;

CREATE OR REPLACE FUNCTION log_profile_changes() RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
    v_action_type TEXT;
    v_action_category TEXT;
    v_severity TEXT;
    v_description TEXT;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        v_action := 'INSERT';
        v_action_type := 'create_node';
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        v_severity := 'low';
        v_description := 'إضافة شخص جديد';
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_action_type := 'update_node';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_severity := 'low';
        v_description := 'تحديث بيانات';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_action_type := 'delete_node';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_severity := 'high';
        v_description := 'حذف شخص';
    END IF;

    -- Insert into audit_log_enhanced (which references auth.users)
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
        auth.uid(),  -- This is an auth user ID - works for admins!
        'user',
        v_action_type,
        'tree',
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        'profile',
        v_old_data,
        v_new_data,
        v_description,
        v_severity,
        'completed',
        jsonb_build_object(
            'trigger_op', TG_OP,
            'is_munasib', COALESCE(NEW.hid, OLD.hid) IS NULL
        ),
        NOW()
    );

    -- Try to maintain backward compatibility with legacy audit_log
    -- Only if the user has a profile (to avoid foreign key issues)
    BEGIN
        IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
            INSERT INTO audit_log (
                action,
                table_name,
                target_profile_id,
                actor_id,
                old_data,
                new_data,
                created_at
            ) VALUES (
                v_action,
                TG_TABLE_NAME,
                COALESCE(NEW.id, OLD.id),
                auth.uid(),
                v_old_data,
                v_new_data,
                NOW()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Silently skip legacy logging if it fails
        NULL;
    END;

    -- Return appropriate value
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_log_profile_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_profile_changes();

-- Step 3: Simplify admin_create_munasib_profile to just create the profile
-- The trigger will handle all logging automatically
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
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Create the Munasib profile
    -- The trigger will handle all audit logging automatically
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
        auth.uid(),
        auth.uid()
    ) RETURNING * INTO v_new_profile;

    RETURN v_new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_create_munasib_profile TO authenticated;