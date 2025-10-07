-- Migration 075: Add Missing Columns to Marriages Table
-- Purpose: Align production marriages table with baseline schema (migration 000)
-- Adds: deleted_at, created_by, updated_by, marriage_order

-- Add deleted_at for soft delete support
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add audit columns for tracking who made changes
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add marriage_order to track sequence of marriages
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS marriage_order INT DEFAULT 1;

-- Create index on deleted_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_marriages_deleted_at
ON marriages(deleted_at)
WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN marriages.deleted_at IS
    'Soft delete timestamp. NULL = active marriage, NOT NULL = deleted';

COMMENT ON COLUMN marriages.marriage_order IS
    'Sequence number for multiple marriages (1 = first marriage, 2 = second, etc.)';

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 075: Added deleted_at, created_by, updated_by, marriage_order to marriages table';
END $$;
