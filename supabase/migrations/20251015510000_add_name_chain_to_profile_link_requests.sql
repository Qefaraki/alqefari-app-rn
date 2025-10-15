-- Add missing name_chain column to profile_link_requests
-- This column stores the exact search query the user typed when finding their profile
-- Used for admin verification, notifications, and audit trail
--
-- Root cause: Original migration (20251015500000) accidentally omitted this column
-- which was present in the original design (archived migration 038_phone_auth_system.sql)

ALTER TABLE profile_link_requests
ADD COLUMN IF NOT EXISTS name_chain TEXT;

-- Backfill existing records (if any) with placeholder
UPDATE profile_link_requests
SET name_chain = 'غير محدد'
WHERE name_chain IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE profile_link_requests
ALTER COLUMN name_chain SET NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN profile_link_requests.name_chain IS
  'The exact name chain the user searched for (e.g., "محمد عبدالله إبراهيم"). Used for admin verification and as fallback in notifications when profile is deleted.';
