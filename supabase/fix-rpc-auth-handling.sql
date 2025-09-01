-- Fix get_current_user_role to handle unauthenticated users gracefully
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- Drop the existing function
DROP FUNCTION IF EXISTS get_current_user_role();

-- Create improved version that handles null auth.uid()
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE (
    user_id UUID,
    user_role TEXT,
    is_admin BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        -- Return empty result for unauthenticated users
        RETURN;
    END IF;
    
    -- Return user role information
    RETURN QUERY
    SELECT 
        auth.uid() as user_id,
        COALESCE(p.role, 'user') as user_role,
        COALESCE(p.role = 'admin', FALSE) as is_admin
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_current_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role TO anon;

-- Test the function
SELECT * FROM get_current_user_role();