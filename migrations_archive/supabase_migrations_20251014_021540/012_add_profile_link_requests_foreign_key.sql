-- Add foreign key constraint for profile_link_requests.profile_id
-- This constraint is required for PostgREST to properly join tables using the ! syntax
-- The constraint name must be profile_link_requests_profile_id_fkey for the existing queries to work

ALTER TABLE profile_link_requests
ADD CONSTRAINT profile_link_requests_profile_id_fkey
FOREIGN KEY (profile_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profile_link_requests_profile_id
ON profile_link_requests(profile_id);