-- Revert sibling_order changes from Oct 18 bulk fix
-- This restores user's original ordering choices before the automated HID-based fix

-- Background:
-- On Oct 18, 2025, a migration was executed (but not committed to repo) that updated
-- all sibling_order values to match HID suffix. This didn't respect user's manual ordering
-- preferences. This migration reverts those changes using audit_log as source of truth.

UPDATE profiles p
SET
  sibling_order = (al.old_data->>'sibling_order')::integer,
  version = version + 1,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (profile_id)
    profile_id,
    old_data
  FROM audit_log
  WHERE
    action_type IN ('admin_update', 'profile_update')
    AND created_at >= '2025-10-18 00:00:00'
    AND created_at < '2025-10-19 00:00:00'
    AND old_data->>'sibling_order' IS NOT NULL
    AND new_data->>'sibling_order' IS NOT NULL
    AND old_data->>'sibling_order' != new_data->>'sibling_order'
  ORDER BY profile_id, created_at DESC  -- Latest change per profile
) al
WHERE p.id = al.profile_id
  AND p.deleted_at IS NULL;

-- Update column comment to reflect new approach
COMMENT ON COLUMN profiles.sibling_order IS
'Display order among siblings. Duplicates are auto-fixed in QuickAddOverlay when user opens the modal. No longer has unique constraint to allow flexible user ordering.';

-- Log the number of profiles reverted for verification
DO $$
DECLARE
  reverted_count integer;
BEGIN
  GET DIAGNOSTICS reverted_count = ROW_COUNT;
  RAISE NOTICE 'Reverted sibling_order for % profiles', reverted_count;
END $$;
