-- Update delete_user_account_complete to ensure auth user removal
-- and report precise status flags back to the client.

CREATE OR REPLACE FUNCTION delete_user_account_complete()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile_id uuid;
    v_phone text;
    v_admin_deleted boolean := false;
    v_profile_unlinked boolean := false;
    v_requests_deleted integer := 0;
    v_messages_deleted integer := 0;
    v_user_deleted boolean := false;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not authenticated'
        );
    END IF;

    SELECT phone INTO v_phone
    FROM auth.users
    WHERE id = v_user_id;

    DELETE FROM admin_users
    WHERE user_id = v_user_id;

    IF FOUND THEN
        v_admin_deleted := true;
    END IF;

    UPDATE profiles
    SET
        user_id = NULL,
        phone = NULL,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING id INTO v_profile_id;

    IF v_profile_id IS NOT NULL THEN
        v_profile_unlinked := true;
    END IF;

    DELETE FROM profile_link_requests
    WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_requests_deleted = ROW_COUNT;

    DELETE FROM admin_messages
    WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;

    INSERT INTO audit_log (
        action,
        table_name,
        target_profile_id,
        actor_id,
        details,
        created_at
    ) VALUES (
        'DELETE',
        'auth.users',
        v_profile_id,
        NULL,
        jsonb_build_object(
            'action_type', 'ACCOUNT_DELETION',
            'deleted_user_id', v_user_id,
            'profile_unlinked', v_profile_unlinked,
            'admin_deleted', v_admin_deleted,
            'requests_deleted', v_requests_deleted,
            'messages_deleted', v_messages_deleted,
            'phone', v_phone
        ),
        now()
    );

    BEGIN
        DELETE FROM auth.users
        WHERE id = v_user_id;

        IF FOUND THEN
            v_user_deleted := true;
        END IF;
    EXCEPTION
        WHEN others THEN
            RAISE WARNING 'Failed to delete auth user %: %', v_user_id, SQLERRM;
            RETURN json_build_object(
                'success', false,
                'error', SQLERRM
            );
    END;

    IF NOT v_user_deleted THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Account cleanup succeeded but auth user could not be deleted'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Account deleted successfully',
        'profile_unlinked', v_profile_unlinked,
        'admin_deleted', v_admin_deleted,
        'requests_deleted', v_requests_deleted,
        'messages_deleted', v_messages_deleted,
        'user_deleted', v_user_deleted,
        'user_id', v_user_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Account deletion error for user %: %', v_user_id, SQLERRM;
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION delete_user_account_complete() IS
'Complete account deletion for the current user. Unlinks profile (preserves tree node), removes admin access, deletes requests/messages, deletes the auth user, and logs the action.';
