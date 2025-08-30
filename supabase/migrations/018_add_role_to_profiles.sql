-- Add role column to profiles table for admin functionality
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT;

-- Add check constraint for valid roles
ALTER TABLE profiles ADD CONSTRAINT check_profile_role 
  CHECK (role IS NULL OR role IN ('admin', 'user'));

-- Create index for efficient role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role IS NOT NULL;

-- Update the is_admin function to check profile role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;