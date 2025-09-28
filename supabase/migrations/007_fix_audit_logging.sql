-- Migration 007: Fix audit logging to handle both user IDs and profile IDs
-- This fixes the issue where admin_update_profile RPC passes auth.uid() which could be either type

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS log_profile_changes CASCADE;

-- Create improved audit logging function
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    v_action TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
    v_action_type TEXT;
    v_action_category TEXT;
    v_severity TEXT;
    v_description TEXT;
    v_actor_user_id UUID;
    v_actor_profile_id UUID;
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

    -- Get the actor user ID (handle both user ID and profile ID cases)
    v_actor_user_id := auth.uid();

    -- Check if auth.uid() is actually a profile ID (exists in profiles table)
    IF v_actor_user_id IS NOT NULL THEN
        -- Check if this ID exists as a profile ID
        SELECT user_id INTO v_actor_user_id
        FROM profiles
        WHERE id = auth.uid();

        -- If not found, it means auth.uid() is already a user ID
        IF v_actor_user_id IS NULL THEN
            v_actor_user_id := auth.uid();
        END IF;
    END IF;

    -- Insert into audit_log_enhanced (which references auth.users)
    BEGIN
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
            v_actor_user_id,
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
                'is_munasib', COALESCE(NEW.hid, OLD.hid) IS NULL,
                'actor_is_profile', EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
            ),
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log errors but don't fail the operation
        RAISE WARNING 'Failed to log to audit_log_enhanced: %', SQLERRM;
    END;

    -- Try to maintain backward compatibility with legacy audit_log
    -- Get the profile ID for the actor if we have a user ID
    BEGIN
        -- First check if auth.uid() is already a profile ID
        IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
            v_actor_profile_id := auth.uid();
        ELSE
            -- It's a user ID, get the profile ID
            SELECT id INTO v_actor_profile_id
            FROM profiles
            WHERE user_id = auth.uid()
            LIMIT 1;
        END IF;

        -- Only insert if we have a valid profile ID for actor
        IF v_actor_profile_id IS NOT NULL THEN
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
                v_actor_profile_id,
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
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_log_profile_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_profile_changes();

-- Also fix the admin_update_profile function to ensure proper version handling
CREATE OR REPLACE FUNCTION admin_update_profile(
    p_id UUID,
    p_version INTEGER,
    p_updates JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile profiles;
    v_actor_id UUID;
BEGIN
    -- Check admin permission
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required';
    END IF;

    -- Get actor for audit
    v_actor_id := auth.uid();

    -- Lock and validate version
    SELECT * INTO v_profile FROM profiles WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    -- Check version for optimistic locking
    IF v_profile.version != p_version THEN
        RAISE EXCEPTION 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى';
    END IF;

    -- Update the profile with the updates
    UPDATE profiles SET
        name = COALESCE((p_updates->>'name')::TEXT, name),
        kunya = CASE WHEN p_updates ? 'kunya' THEN (p_updates->>'kunya')::TEXT ELSE kunya END,
        nickname = CASE WHEN p_updates ? 'nickname' THEN (p_updates->>'nickname')::TEXT ELSE nickname END,
        gender = COALESCE((p_updates->>'gender')::TEXT, gender),
        status = COALESCE((p_updates->>'status')::TEXT, status),
        bio = CASE WHEN p_updates ? 'bio' THEN (p_updates->>'bio')::TEXT ELSE bio END,
        birth_place = CASE WHEN p_updates ? 'birth_place' THEN (p_updates->>'birth_place')::TEXT ELSE birth_place END,
        current_residence = CASE WHEN p_updates ? 'current_residence' THEN (p_updates->>'current_residence')::TEXT ELSE current_residence END,
        occupation = CASE WHEN p_updates ? 'occupation' THEN (p_updates->>'occupation')::TEXT ELSE occupation END,
        education = CASE WHEN p_updates ? 'education' THEN (p_updates->>'education')::TEXT ELSE education END,
        phone = CASE WHEN p_updates ? 'phone' THEN (p_updates->>'phone')::TEXT ELSE phone END,
        email = CASE WHEN p_updates ? 'email' THEN (p_updates->>'email')::TEXT ELSE email END,
        photo_url = CASE WHEN p_updates ? 'photo_url' THEN (p_updates->>'photo_url')::TEXT ELSE photo_url END,
        dob_data = CASE WHEN p_updates ? 'dob_data' THEN (p_updates->'dob_data')::JSONB ELSE dob_data END,
        dod_data = CASE WHEN p_updates ? 'dod_data' THEN (p_updates->'dod_data')::JSONB ELSE dod_data END,
        social_media_links = CASE WHEN p_updates ? 'social_media_links' THEN (p_updates->'social_media_links')::JSONB ELSE social_media_links END,
        achievements = CASE WHEN p_updates ? 'achievements' THEN ARRAY(SELECT jsonb_array_elements_text(p_updates->'achievements')) ELSE achievements END,
        timeline = CASE WHEN p_updates ? 'timeline' THEN (p_updates->'timeline')::JSONB ELSE timeline END,
        dob_is_public = CASE WHEN p_updates ? 'dob_is_public' THEN (p_updates->>'dob_is_public')::BOOLEAN ELSE dob_is_public END,
        profile_visibility = CASE WHEN p_updates ? 'profile_visibility' THEN (p_updates->>'profile_visibility')::TEXT ELSE profile_visibility END,
        sibling_order = CASE WHEN p_updates ? 'sibling_order' THEN (p_updates->>'sibling_order')::INTEGER ELSE sibling_order END,
        father_id = CASE WHEN p_updates ? 'father_id' THEN (p_updates->>'father_id')::UUID ELSE father_id END,
        mother_id = CASE WHEN p_updates ? 'mother_id' THEN (p_updates->>'mother_id')::UUID ELSE mother_id END,
        role = CASE WHEN p_updates ? 'role' THEN (p_updates->>'role')::TEXT ELSE role END,
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_id
    RETURNING * INTO v_profile;

    -- Return the updated profile
    RETURN to_jsonb(v_profile);
END;
$$ LANGUAGE plpgsql;

-- Add comment to track migration
COMMENT ON FUNCTION log_profile_changes() IS 'Fixed in migration 007: Handles both user IDs and profile IDs for audit logging';
COMMENT ON FUNCTION admin_update_profile(UUID, INTEGER, JSONB) IS 'Fixed in migration 007: Enhanced version handling and update logic';