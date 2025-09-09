-- Make HID nullable to support Munasib profiles
-- Munasib (married-in spouses) don't have HIDs as they're not part of the family tree hierarchy

-- Drop the NOT NULL constraint from HID column
ALTER TABLE profiles 
ALTER COLUMN hid DROP NOT NULL;

-- Update the comment to reflect the new meaning
COMMENT ON COLUMN profiles.hid IS 'Hierarchical ID - NULL for Munasib (married-in spouses), populated for family members';

-- Ensure indexes are optimized for NULL values
DROP INDEX IF EXISTS idx_profiles_hid;
CREATE INDEX idx_profiles_hid ON profiles(hid) WHERE hid IS NOT NULL;

-- Create an index for finding Munasib profiles quickly
CREATE INDEX IF NOT EXISTS idx_profiles_munasib ON profiles(id) WHERE hid IS NULL;