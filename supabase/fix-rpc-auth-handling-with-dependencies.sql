-- Fix get_current_user_role to handle unauthenticated users gracefully
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/editor

-- Drop dependent policies first
DROP POLICY IF EXISTS "Admin users can view background jobs" ON background_jobs;
DROP POLICY IF EXISTS "Admin users can insert background jobs" ON background_jobs;
DROP POLICY IF EXISTS "Admin users can update background jobs" ON background_jobs;

-- Drop any other dependent policies
DROP POLICY IF EXISTS "Admin users can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can soft delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admin users can view audit log" ON audit_log;

-- Now drop the existing function
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

-- Recreate the policies with the updated function
-- For profiles table
CREATE POLICY "Admin users can insert profiles" 
ON profiles FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can update profiles" 
ON profiles FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can soft delete profiles" 
ON profiles FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

-- For background_jobs table
CREATE POLICY "Admin users can view background jobs" 
ON background_jobs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can insert background jobs" 
ON background_jobs FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

CREATE POLICY "Admin users can update background jobs" 
ON background_jobs FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

-- For audit_log table
CREATE POLICY "Admin users can view audit log" 
ON audit_log FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM get_current_user_role() 
        WHERE is_admin = true
    )
);

-- Test the function
SELECT * FROM get_current_user_role();