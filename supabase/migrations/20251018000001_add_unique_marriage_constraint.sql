-- Migration: add_unique_marriage_constraint
-- Purpose: Prevent duplicate marriages with same husband_id and wife_id
-- Protects against race conditions and concurrent requests

-- Create unique index on (husband_id, wife_id) excluding soft-deleted marriages
-- This allows same couple to remarry after divorce (if first marriage is soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_marriages_unique_couple
ON marriages (husband_id, wife_id)
WHERE deleted_at IS NULL;

-- Add helpful comment
COMMENT ON INDEX idx_marriages_unique_couple IS 'Ensures a couple can only have one active (non-deleted) marriage at a time. Allows remarriage after soft delete.';

-- Test the constraint works
DO $$
BEGIN
  RAISE NOTICE 'Unique marriage constraint created successfully';
  RAISE NOTICE 'Same couple can only have one active marriage (deleted_at IS NULL)';
  RAISE NOTICE 'After soft delete, couple can create new marriage record';
END $$;
