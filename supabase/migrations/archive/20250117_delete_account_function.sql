-- Create RPC function to delete user account and unlink from profile
-- This function will:
-- 1. Unlink the user from their profile
-- 2. Delete all profile link requests
-- 3. Delete the auth user account

CREATE OR REPLACE FUNCTION delete_user_account_and_unlink()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile_id uuid;
    v_phone text;
    v_deleted_count integer := 0;
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
    
    -- Get user's phone number
    SELECT phone INTO v_phone
    FROM auth.users
    WHERE id = v_user_id;
    
    -- Find the linked profile
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- Start the deletion process
    
    -- 1. Unlink the profile from the user
    IF v_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET 
            user_id = NULL,
            phone = NULL,
            updated_at = now()
        WHERE id = v_profile_id;
        
        v_deleted_count := v_deleted_count + 1;
    END IF;
    
    -- 2. Delete all profile link requests for this user
    DELETE FROM profile_link_requests
    WHERE user_id = v_user_id
       OR phone_number = v_phone;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- 3. Delete user from auth.users (this will cascade delete sessions)
    -- Note: We cannot directly delete from auth.users in RPC function
    -- Instead, we'll return success and let the client handle sign out
    
    RETURN json_build_object(
        'success', true,
        'message', 'Account unlinked successfully',
        'profile_unlinked', v_profile_id IS NOT NULL,
        'requests_deleted', v_deleted_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account_and_unlink() TO authenticated;

-- Add a comment for documentation
COMMENT ON FUNCTION delete_user_account_and_unlink() IS 
'Unlinks user account from profile and cleans up all related data. Used for account deletion/testing.';

-- Also create a simplified unlink function for testing (doesn't delete account)
CREATE OR REPLACE FUNCTION unlink_profile_only()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile_id uuid;
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
    
    -- Find and unlink the profile
    UPDATE profiles
    SET 
        user_id = NULL,
        phone = NULL,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING id INTO v_profile_id;
    
    -- Clear link requests but keep them for history
    UPDATE profile_link_requests
    SET status = 'cancelled'
    WHERE user_id = v_user_id
      AND status = 'pending';
    
    IF v_profile_id IS NOT NULL THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Profile unlinked successfully',
            'profile_id', v_profile_id
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'No linked profile found'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION unlink_profile_only() TO authenticated;

-- Add a comment for documentation
COMMENT ON FUNCTION unlink_profile_only() IS 
'Unlinks user profile without deleting the account. Useful for testing.';