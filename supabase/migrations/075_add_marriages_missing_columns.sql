-- Migration 075: Add Missing Columns to Marriages Table
-- Purpose: Align production marriages table with baseline schema (migration 000)
-- Adds: deleted_at, created_by, updated_by, marriage_order

-- Add deleted_at for soft delete support
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add audit columns for tracking who made changes
-- Note: References profiles(id) to align with permission system v4.2
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id);

-- Add marriage_order to track sequence of marriages
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS marriage_order INT DEFAULT 1;

-- Backfill marriage_order based on start_date for existing records
-- This ensures correct chronological ordering for users with multiple marriages
WITH ranked_marriages AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY husband_id
            ORDER BY start_date NULLS LAST, created_at NULLS LAST
        ) as calculated_order
    FROM marriages
)
UPDATE marriages m
SET marriage_order = rm.calculated_order
FROM ranked_marriages rm
WHERE m.id = rm.id AND m.marriage_order = 1;  -- Only update defaults

-- Create index on deleted_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_marriages_deleted_at
ON marriages(deleted_at)
WHERE deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN marriages.deleted_at IS
    'Soft delete timestamp. NULL = active marriage, NOT NULL = deleted';

COMMENT ON COLUMN marriages.created_by IS
    'Profile ID of user who created this marriage record. NULL for historical records created before audit system implementation.';

COMMENT ON COLUMN marriages.updated_by IS
    'Profile ID of user who last updated this marriage record.';

COMMENT ON COLUMN marriages.marriage_order IS
    'Sequence number for multiple marriages (1 = first marriage, 2 = second, etc.). Calculated based on start_date.';

-- Log migration
DO $$
DECLARE
    v_updated_count INT;
BEGIN
    -- Count how many records had their marriage_order updated
    SELECT COUNT(*) INTO v_updated_count
    FROM marriages
    WHERE marriage_order != 1;

    RAISE NOTICE 'Migration 075 complete:';
    RAISE NOTICE '  - Added deleted_at, created_by, updated_by, marriage_order columns';
    RAISE NOTICE '  - Backfilled marriage_order for % existing records', v_updated_count;
    RAISE NOTICE '  - Created partial index on deleted_at';
END $$;
