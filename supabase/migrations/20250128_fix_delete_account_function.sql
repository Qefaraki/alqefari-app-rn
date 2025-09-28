-- Fix Delete Account Functionality
-- Creates the missing delete_user_account_complete function that the client expects
-- This function properly unlinks the profile without deleting the tree node

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
    UPDATE profiles
    SET
        user_id = NULL,      -- Unlink from auth user
        phone = NULL,        -- Clear phone for privacy
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
            'phone', v_phone
        ),
        now()
    );

    -- Note: The actual deletion from auth.users happens via Supabase Auth
    -- after this function returns successfully. The client will handle signOut.

    RETURN json_build_object(
        'success', true,
        'message', 'Account marked for deletion',
        'profile_unlinked', v_profile_unlinked,
        'admin_deleted', v_admin_deleted,
        'requests_deleted', v_requests_deleted,
        'messages_deleted', v_messages_deleted,
        'user_id', v_user_id
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

-- Add a comment for documentation
COMMENT ON FUNCTION delete_user_account_complete() IS
'Complete account deletion for the current user. Unlinks profile (preserves tree node), removes admin access, deletes requests/messages, and logs the action. The profile node remains in the tree but is no longer linked to any auth account.';

-- Create an index to improve performance of user_id lookups during deletion
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_deletion ON profiles(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);