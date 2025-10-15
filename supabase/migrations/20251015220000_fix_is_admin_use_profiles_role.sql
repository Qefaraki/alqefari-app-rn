-- Fix is_admin() function to use profiles.role instead of admin_users table
-- This aligns the legacy admin check with the modern Permission System v4.2

-- Problem: is_admin() was checking admin_users table (legacy system)
-- but the app now uses profiles.role field (super_admin, admin, moderator, user)
-- This caused super_admins to fail admin checks in functions like admin_create_munasib_profile

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    SET search_path = public;

    -- Check if user has admin or super_admin role in profiles table
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin')  -- Both super_admin and admin are admins
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test cases (for manual verification):
-- 1. Super admin user should return true
-- 2. Regular admin user should return true
-- 3. Moderator user should return false
-- 4. Regular user should return false
-- 5. User with no profile should return false
