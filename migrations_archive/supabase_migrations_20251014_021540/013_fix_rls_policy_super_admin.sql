-- Fix RLS policy to include super_admin role for viewing all profile link requests
-- The existing policy only checks for 'admin' but not 'super_admin'
-- This causes super admins to only see their own requests, not all requests

-- Drop the existing policy that only checks for 'admin'
DROP POLICY IF EXISTS "Admins can view all link requests" ON profile_link_requests;

-- Create new policy that includes both admin and super_admin roles
CREATE POLICY "Admins can view all link requests"
ON profile_link_requests
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Also ensure super_admins can manage all operations on profile_link_requests
-- This ensures consistency across all admin operations

-- Update any other policies that might be limiting super_admin access
-- Check if there are policies for UPDATE/DELETE operations
DROP POLICY IF EXISTS "Admins can update link requests" ON profile_link_requests;
DROP POLICY IF EXISTS "Admins can delete link requests" ON profile_link_requests;

-- Create comprehensive admin policy for all operations
CREATE POLICY "Admins and super_admins can manage all link requests"
ON profile_link_requests
FOR ALL
TO public
USING (
  -- For SELECT, UPDATE, DELETE operations
  auth.uid() = user_id -- Users can manage their own requests
  OR
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  -- For INSERT, UPDATE operations
  auth.uid() = user_id -- Users can only create/update their own requests
  OR
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);