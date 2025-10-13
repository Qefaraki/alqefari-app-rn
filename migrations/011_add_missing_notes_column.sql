-- Migration 011: Add Missing notes Column to branch_moderators
--
-- ISSUE: get_user_permissions_summary fails with "column bm.notes does not exist"
-- ROOT CAUSE: Migration 008 was supposed to include notes column but it's missing from production
--
-- This column was designed to store optional notes about why a user was assigned
-- as a branch moderator (e.g., "Assigned for genealogy expertise", etc.)

BEGIN;

-- Add notes column if it doesn't exist
ALTER TABLE branch_moderators
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify the column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'branch_moderators'
    AND column_name = 'notes'
  ) THEN
    RAISE EXCEPTION '❌ Failed to add notes column to branch_moderators';
  END IF;

  RAISE NOTICE '✅ notes column successfully added to branch_moderators';
END $$;

COMMIT;

-- Verification query
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'branch_moderators'
ORDER BY ordinal_position;

SELECT '✅ Migration 011 completed successfully' as status;
