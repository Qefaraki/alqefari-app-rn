-- 027_fix_admin_system.sql
-- Create a proper admin system that doesn't require a profile on the tree

-- ============================================================================
-- 1. Create admin_users table for auth.users who are admins
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view the admin list
CREATE POLICY "admin_users_select" ON admin_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- 2. Fix is_admin() function to use admin_users table
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Check if current user is in admin_users table
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;

-- ============================================================================
-- 3. Create function to grant admin access
-- ============================================================================
CREATE OR REPLACE FUNCTION grant_admin_access(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_existing BOOLEAN;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Only existing admins can grant admin access
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required to grant admin access';
    END IF;
    
    -- Get user_id from auth.users by email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User not found with email: ' || p_email
        );
    END IF;
    
    -- Check if already admin
    SELECT EXISTS(SELECT 1 FROM admin_users WHERE user_id = v_user_id) INTO v_existing;
    
    IF v_existing THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User is already an admin'
        );
    END IF;
    
    -- Grant admin access
    INSERT INTO admin_users (user_id, email, created_by)
    VALUES (v_user_id, p_email, auth.uid());
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Admin access granted to ' || p_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Create function to revoke admin access
-- ============================================================================
CREATE OR REPLACE FUNCTION revoke_admin_access(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_deleted_count INT;
BEGIN
    -- Set search path for security
    SET search_path = public;
    
    -- Only existing admins can revoke admin access
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin role required to revoke admin access';
    END IF;
    
    -- Prevent self-revocation
    IF p_email = (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cannot revoke your own admin access'
        );
    END IF;
    
    -- Get user_id from auth.users by email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User not found with email: ' || p_email
        );
    END IF;
    
    -- Revoke admin access
    DELETE FROM admin_users WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Admin access revoked from ' || p_email
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User was not an admin'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Create view for frontend to check admin status
-- ============================================================================
CREATE OR REPLACE VIEW is_current_user_admin AS
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) 
        THEN true 
        ELSE false 
    END as is_admin,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- Grant access to the view
GRANT SELECT ON is_current_user_admin TO authenticated;

-- ============================================================================
-- 6. Add your user as the first admin (replace with your email)
-- ============================================================================
-- IMPORTANT: Replace 'your-email@example.com' with your actual email
DO $$
DECLARE
    v_admin_email TEXT := 'admin@test.com'; -- Your admin email
    v_user_id UUID;
BEGIN
    -- Get user_id for the email
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE email = v_admin_email;
    
    IF v_user_id IS NOT NULL THEN
        -- Add as admin if not already
        INSERT INTO admin_users (user_id, email)
        VALUES (v_user_id, v_admin_email)
        ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Admin access granted to %', v_admin_email;
    ELSE
        RAISE NOTICE 'User not found: %. Please update the email in the migration.', v_admin_email;
    END IF;
END $$;

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================
GRANT SELECT ON admin_users TO authenticated;
GRANT EXECUTE ON FUNCTION grant_admin_access TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_admin_access TO authenticated;

-- ============================================================================
-- 8. Add helpful comments
-- ============================================================================
COMMENT ON TABLE admin_users IS 'Maps auth.users to admin privileges - separate from profile nodes on tree';
COMMENT ON FUNCTION is_admin IS 'Checks if current user has admin privileges via admin_users table';
COMMENT ON FUNCTION grant_admin_access IS 'Grant admin access to a user by email (admin only)';
COMMENT ON FUNCTION revoke_admin_access IS 'Revoke admin access from a user by email (admin only)';
COMMENT ON VIEW is_current_user_admin IS 'Simple view for frontend to check if current user is admin';