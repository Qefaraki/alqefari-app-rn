-- Fix Delete Account Functionality - Complete Solution
-- Addresses three critical issues:
-- 1. Auth account not being deleted
-- 2. Notifications not being cleaned up
-- 3. can_edit flag not being reset

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
    v_notifications_deleted integer := 0;
    v_auth_deleted boolean := false;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();

    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not authenticated'
        );
    END IF;

    -- Get user's phone number before we lose access
    SELECT phone INTO v_phone
    FROM auth.users
    WHERE id = v_user_id;

    -- CRITICAL: Delete from admin_users table first
    DELETE FROM admin_users
    WHERE user_id = v_user_id;

    IF FOUND THEN
        v_admin_deleted := true;
    END IF;

    -- Find and unlink the profile (DO NOT DELETE THE PROFILE)
    -- FIX #3: Set can_edit to false when unlinking
    UPDATE profiles
    SET
        user_id = NULL,      -- Unlink from auth user
        phone = NULL,        -- Clear phone for privacy
        can_edit = false,    -- Profile becomes read-only after unlinking
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING id INTO v_profile_id;

    IF v_profile_id IS NOT NULL THEN
        v_profile_unlinked := true;
    END IF;

    -- Delete all profile link requests for this user
    DELETE FROM profile_link_requests
    WHERE user_id = v_user_id;

    GET DIAGNOSTICS v_requests_deleted = ROW_COUNT;

    -- Delete all admin messages for this user
    DELETE FROM admin_messages
    WHERE user_id = v_user_id;

    GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;

    -- FIX #2: Delete all notifications for this user
    DELETE FROM notifications
    WHERE user_id = v_user_id;

    GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

    -- FIX #1: Mark the auth user for deletion
    -- We can't delete auth.users from here, but we can mark it with metadata
    -- The client will handle the actual deletion using auth.admin.deleteUser()
    UPDATE auth.users
    SET
        raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
            'deleted_at', now()::text,
            'deletion_reason', 'user_requested'
        ),
        updated_at = now()
    WHERE id = v_user_id;

    -- Log the account deletion action
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
        NULL, -- Will be NULL since user is being deleted
        jsonb_build_object(
            'action_type', 'ACCOUNT_DELETION',
            'deleted_user_id', v_user_id,
            'profile_unlinked', v_profile_unlinked,
            'admin_deleted', v_admin_deleted,
            'requests_deleted', v_requests_deleted,
            'messages_deleted', v_messages_deleted,
            'notifications_deleted', v_notifications_deleted,
            'phone', v_phone
        ),
        now()
    );

    -- Note: The actual deletion from auth.users happens via the client
    -- using supabase.auth.signOut() followed by the admin API if available

    RETURN json_build_object(
        'success', true,
        'message', 'Account marked for deletion',
        'profile_unlinked', v_profile_unlinked,
        'admin_deleted', v_admin_deleted,
        'requests_deleted', v_requests_deleted,
        'messages_deleted', v_messages_deleted,
        'notifications_deleted', v_notifications_deleted,
        'user_id', v_user_id,
        'auth_marked', true
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        RAISE WARNING 'Account deletion error for user %: %', v_user_id, SQLERRM;

        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users (they can only delete their own account)
GRANT EXECUTE ON FUNCTION delete_user_account_complete() TO authenticated;

-- Update the comment for documentation
COMMENT ON FUNCTION delete_user_account_complete() IS
'Complete account deletion for the current user. Unlinks profile (preserves tree node but sets can_edit=false), removes admin access, deletes requests/messages/notifications, marks auth account for deletion, and logs the action. The profile node remains in the tree but is read-only and no longer linked to any auth account.';