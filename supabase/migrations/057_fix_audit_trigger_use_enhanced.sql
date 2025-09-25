-- Fix audit trigger to use audit_log_enhanced table which correctly references auth.users
-- This resolves the issue where admin users without profiles can't insert records

-- Drop the old trigger first
DROP TRIGGER IF EXISTS trigger_log_profile_changes ON profiles;

-- Create or replace the function to use audit_log_enhanced
CREATE OR REPLACE FUNCTION log_profile_changes() RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
    v_action_type TEXT;
    v_action_category TEXT;
    v_severity TEXT;
    v_changed_fields TEXT[];
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
        
        -- Calculate changed fields
        SELECT ARRAY(
            SELECT jsonb_object_keys(v_new_data)
            WHERE v_new_data->jsonb_object_keys(v_new_data) IS DISTINCT FROM 
                  v_old_data->jsonb_object_keys(v_new_data)
        ) INTO v_changed_fields;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_action_type := 'delete_node';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_severity := 'high';
        v_description := 'حذف شخص';
    END IF;

    -- Determine category based on table
    v_action_category := CASE TG_TABLE_NAME
        WHEN 'profiles' THEN 'tree'
        WHEN 'marriages' THEN 'marriage'
        WHEN 'photos' THEN 'photo'
        ELSE 'other'
    END;

    -- Insert into audit_log_enhanced which references auth.users(id)
    -- This works for admin users who don't have profiles
    INSERT INTO audit_log_enhanced (
        actor_id,           -- References auth.users(id), not profiles(id)
        actor_type,
        action_type,
        action_category,
        table_name,
        record_id,
        target_type,
        old_data,
        new_data,
        changed_fields,
        description,
        severity,
        status,
        metadata,
        created_at
    ) VALUES (
        auth.uid(),         -- This is an auth user ID, which works!
        CASE 
            WHEN auth.uid() IS NULL THEN 'system'
            ELSE 'user'
        END,
        v_action_type,
        v_action_category,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        'profile',
        v_old_data,
        v_new_data,
        v_changed_fields,
        v_description,
        v_severity,
        'completed',
        jsonb_build_object(
            'trigger_op', TG_OP,
            'trigger_name', TG_NAME,
            'is_munasib', COALESCE(NEW.hid, OLD.hid) IS NULL
        ),
        NOW()
    );

    -- Also maintain backward compatibility by inserting into legacy audit_log
    -- BUT only if the user has a profile (to avoid foreign key violation)
    BEGIN
        IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
            INSERT INTO audit_log (
                action, 
                table_name, 
                target_profile_id,
                actor_id,      -- This expects a profile ID
                old_data,
                new_data,
                created_at
            ) VALUES (
                v_action,
                TG_TABLE_NAME,
                COALESCE(NEW.id, OLD.id),
                auth.uid(),    -- Only works if user has profile with id = auth.uid()
                v_old_data,
                v_new_data,
                NOW()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Silently skip legacy logging if it fails
        -- The important logging to audit_log_enhanced already succeeded
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

-- Grant necessary permissions
GRANT SELECT ON audit_log_enhanced TO authenticated;
GRANT INSERT ON audit_log_enhanced TO authenticated;