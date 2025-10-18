-- Remove unique constraint that blocks saves when duplicates exist
-- Duplicates will be auto-fixed in frontend (QuickAddOverlay) when detected

-- Background:
-- The unique constraint on sibling_order was too strict and blocked legitimate saves.
-- The new approach: lazy auto-fix in QuickAddOverlay detects and resolves duplicates
-- when users open the modal, providing a better user experience.

-- Drop unique constraints
DROP INDEX IF EXISTS idx_unique_sibling_order_per_father;
DROP INDEX IF EXISTS idx_unique_sibling_order_per_mother;

-- Add non-unique indexes for query performance
-- These maintain good query performance without blocking saves
CREATE INDEX IF NOT EXISTS idx_sibling_order_per_father
ON profiles (father_id, sibling_order)
WHERE father_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sibling_order_per_mother
ON profiles (mother_id, sibling_order)
WHERE mother_id IS NOT NULL AND father_id IS NULL AND deleted_at IS NULL;

-- Update column comment
COMMENT ON COLUMN profiles.sibling_order IS
'Display order among siblings (0-based). Duplicates are automatically detected and fixed in QuickAddOverlay. Frontend shows warning banner when duplicates are found and auto-renumbers sequentially.';
