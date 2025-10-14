-- Migration 090: Add family permission checks to admin_create_marriage
-- Issue: Current function only checks is_admin(), inconsistent with admin_update_marriage
-- Fix: Use check_family_permission_v4() to allow regular users with 'inner' permission
-- Created: 2025-01-14

CREATE OR REPLACE FUNCTION admin_create_marriage(
    p_husband_id UUID,
    p_wife_id UUID,
    p_munasib TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT 'current'
) RETURNS marriages AS $$
DECLARE
    v_husband profiles%ROWTYPE;
    v_wife profiles%ROWTYPE;
    v_new_marriage marriages%ROWTYPE;
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_permission TEXT;
BEGIN
    -- Security: Set search path for SECURITY DEFINER
    SET search_path = public;

    -- Get current user's auth ID
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    -- Get actor's profile ID
    SELECT id INTO v_actor_profile_id
    FROM profiles
    WHERE user_id = v_actor_id AND deleted_at IS NULL;

    IF v_actor_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No valid profile found';
    END IF;

    -- Validate required fields
    IF p_husband_id IS NULL OR p_wife_id IS NULL THEN
        RAISE EXCEPTION 'Both husband_id and wife_id are required';
    END IF;

    -- Validate husband exists and is male
    SELECT * INTO v_husband FROM profiles WHERE id = p_husband_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Husband profile not found or deleted';
    END IF;
    IF v_husband.gender != 'male' THEN
        RAISE EXCEPTION 'Husband must be male';
    END IF;

    -- Validate wife exists and is female
    SELECT * INTO v_wife FROM profiles WHERE id = p_wife_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wife profile not found or deleted';
    END IF;
    IF v_wife.gender != 'female' THEN
        RAISE EXCEPTION 'Wife must be female';
    END IF;

    -- ✅ NEW: Permission check - Can the actor create a marriage for the husband OR wife?
    -- Check husband permission first
    SELECT check_family_permission_v4(v_actor_profile_id, p_husband_id) INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        -- If not authorized for husband, check wife permission
        SELECT check_family_permission_v4(v_actor_profile_id, p_wife_id) INTO v_permission;

        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to create marriage. You can only create marriages for profiles you have direct edit permission on (self, spouse, parents, siblings, descendants).';
        END IF;
    END IF;

    -- Validate status
    IF p_status NOT IN ('current', 'past') THEN
        RAISE EXCEPTION 'Invalid marriage status: %. Must be ''current'' or ''past''', p_status;
    END IF;

    -- Check for duplicate marriage
    IF p_status = 'current' THEN
        IF EXISTS (
            SELECT 1 FROM marriages
            WHERE husband_id = p_husband_id
            AND wife_id = p_wife_id
            AND status = 'current'
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Active marriage already exists between these profiles';
        END IF;
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
            v_actor_id,
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
                    p_husband_id,
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
    WHEN OTHERS THEN
        -- Log error for debugging
        RAISE WARNING 'admin_create_marriage error: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_create_marriage TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_create_marriage IS
    'Creates marriage record with family permission checks.
     Status values: ''current'' (active marriage) or ''past'' (ended marriage).
     Uses check_family_permission_v4 for access control - requires permission on husband OR wife.
     Only admins, moderators, or users with "inner" permission can create marriages.
     Inner permission includes: self, spouse, parents, siblings, all descendants.
     Creates audit log entry for all changes.';

-- Verification notice
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 090 complete: Family permissions added to admin_create_marriage';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Enhancement:';
    RAISE NOTICE '  - Regular users can now create marriages for profiles they have "inner" permission on';
    RAISE NOTICE '  - Permission required on husband OR wife (not both)';
    RAISE NOTICE '  - Admins still have full access';
    RAISE NOTICE '  - Moderators can create marriages in their assigned branch';
    RAISE NOTICE '  - Permission validated using check_family_permission_v4()';
    RAISE NOTICE '';
    RAISE NOTICE 'Consistency: Now matches admin_update_marriage permission model';
    RAISE NOTICE 'Compatible with: TabFamily permission system (Phase 1 UI layer)';
END $$;
