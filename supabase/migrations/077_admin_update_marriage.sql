-- Migration 077: Admin Update Marriage RPC
-- Purpose: Secure RPC function for updating marriage records with permission checks
-- Replaces: Direct UPDATE on marriages table (blocked by RLS)

-- Drop old function if exists (to avoid parameter name conflict)
DROP FUNCTION IF EXISTS admin_update_marriage(UUID, JSONB);

CREATE OR REPLACE FUNCTION admin_update_marriage(
    p_marriage_id UUID,
    p_updates JSONB
) RETURNS marriages AS $$
DECLARE
    v_old_marriage marriages%ROWTYPE;
    v_updated_marriage marriages%ROWTYPE;
    v_actor_id UUID;
    v_actor_profile_id UUID;
    v_permission TEXT;
BEGIN
    -- Set search path for security
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

    -- Lock and fetch the marriage
    SELECT * INTO v_old_marriage FROM marriages
    WHERE id = p_marriage_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Marriage not found or deleted';
    END IF;

    -- Permission check: Can the actor edit either the husband or wife?
    -- Check husband permission
    SELECT check_family_permission_v4(v_actor_profile_id, v_old_marriage.husband_id)
    INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
        -- If not authorized for husband, check wife permission
        SELECT check_family_permission_v4(v_actor_profile_id, v_old_marriage.wife_id)
        INTO v_permission;

        IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to edit this marriage';
        END IF;
    END IF;

    -- Apply updates (whitelist approach for security)
    UPDATE marriages
    SET
        start_date = COALESCE((p_updates->>'start_date')::DATE, start_date),
        end_date = CASE
            WHEN p_updates ? 'end_date' AND (p_updates->>'end_date') IS NULL THEN NULL
            WHEN p_updates ? 'end_date' THEN (p_updates->>'end_date')::DATE
            ELSE end_date
        END,
        status = COALESCE(p_updates->>'status', status),
        updated_at = NOW()
    WHERE id = p_marriage_id
    RETURNING * INTO v_updated_marriage;

    -- Create audit log entry
    INSERT INTO audit_log_enhanced (
        table_name,
        record_id,
        action,
        actor_id,
        old_data,
        new_data,
        changed_fields
    ) VALUES (
        'marriages',
        p_marriage_id,
        'UPDATE',
        v_actor_id,
        to_jsonb(v_old_marriage),
        to_jsonb(v_updated_marriage),
        ARRAY(
            SELECT jsonb_object_keys(p_updates)
        )
    );

    RETURN v_updated_marriage;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        RAISE WARNING 'admin_update_marriage error: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION admin_update_marriage(UUID, JSONB) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_update_marriage IS
    'Updates marriage record with permission checks.
     Only admins, moderators, or users with "inner" permission on either spouse can edit.
     Uses check_family_permission_v4 for access control.
     Creates audit log entry for all changes.';

-- Validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'admin_update_marriage'
    ) THEN
        RAISE EXCEPTION 'Migration 076 failed: admin_update_marriage function not created';
    END IF;

    RAISE NOTICE 'Migration 076: admin_update_marriage function created successfully';
END $$;
