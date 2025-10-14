-- Enable Row Level Security on marriages table
ALTER TABLE marriages ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "marriages_select_all" ON marriages;

-- Create read-only policy for all authenticated and anonymous users
CREATE POLICY "marriages_select_all" 
    ON marriages 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

-- Note: No INSERT, UPDATE, or DELETE policies are created
-- All write operations must go through the admin RPC functions:
-- - admin_create_marriage
-- - admin_update_marriage  
-- - admin_delete_marriage

-- Add comments for clarity
COMMENT ON POLICY "marriages_select_all" ON marriages IS 
    'Allow all users to read marriages data. Write operations are only allowed through admin RPC functions.';