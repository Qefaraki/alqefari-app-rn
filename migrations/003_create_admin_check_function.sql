-- Create a function to check if a user is an admin
-- This bypasses RLS policies that might cause infinite recursion
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = user_id_param
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_is_admin(UUID) TO authenticated;