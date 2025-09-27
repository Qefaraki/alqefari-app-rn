-- 024_critical_security_fixes.sql
-- Critical security fixes for profiles, audit_log, and is_admin() function

-- ============================================================================
-- 1. Add user_id column to profiles for reliable auth mapping
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id) WHERE user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.user_id IS 'Links profile to auth.users for authentication and authorization';

-- ============================================================================
-- 2. Fix is_admin() function with proper user→profile mapping
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check if the current user has an admin profile
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
        AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- ============================================================================
-- 3. Tighten audit_log security
-- ============================================================================

-- Revoke direct write access from authenticated users
REVOKE INSERT ON audit_log FROM authenticated;
REVOKE UPDATE ON audit_log FROM authenticated;

-- Drop existing permissive INSERT policy if it exists
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_log;

-- Create permissive INSERT policy for SECURITY DEFINER functions
-- Clients can't insert due to revoked grants, but RPCs can
CREATE POLICY "audit_log_insert_permissive" ON audit_log
    FOR INSERT
    WITH CHECK (true);

-- Ensure SELECT policy remains restricted to admins (already exists)
-- Ensure UPDATE policy remains limited to revert operations (already exists)

-- ============================================================================
-- 4. Enable RLS on profiles table with proper policies
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "profiles_select_active" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Read policy: everyone can read non-deleted profiles
CREATE POLICY "profiles_select_active" ON profiles
    FOR SELECT
    TO anon, authenticated
    USING (deleted_at IS NULL);

-- No write policies - all writes must go through admin RPCs
-- This ensures proper validation, versioning, and audit trail

-- Add comment for clarity
COMMENT ON POLICY "profiles_select_active" ON profiles IS 
    'Allow all users to read non-deleted profiles. Write operations are only allowed through admin RPC functions.';

-- ============================================================================
-- 5. Grant necessary permissions for RPC functions
-- ============================================================================

-- Ensure RPC functions have the necessary permissions
GRANT SELECT ON profiles TO anon, authenticated;
GRANT SELECT ON marriages TO anon, authenticated;
GRANT SELECT ON audit_log TO authenticated; -- Restricted by RLS to admins only

-- ============================================================================
-- 6. Add migration metadata
-- ============================================================================
COMMENT ON SCHEMA public IS 'Migration 024: Critical security fixes - Fixed is_admin() function, tightened audit_log security, enabled profiles RLS';