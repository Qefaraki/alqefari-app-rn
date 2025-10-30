-- Migration: Add 'crop_update' to operation_groups.group_type CHECK constraint
-- Author: Claude Code
-- Date: 2025-01-30
-- Purpose: Allow crop operations to create operation_group records
-- Issue: CHECK constraint rejects 'crop_update' (only allows 4 existing types)
-- Solution: Drop and recreate CHECK constraint with 'crop_update' added

-- ============================================================================
-- ALTER CHECK CONSTRAINT: Add 'crop_update' to Allowed group_type Values
-- ============================================================================

-- Drop existing constraint
ALTER TABLE operation_groups
  DROP CONSTRAINT IF EXISTS operation_groups_group_type_check;

-- Recreate with 'crop_update' added
ALTER TABLE operation_groups
  ADD CONSTRAINT operation_groups_group_type_check
  CHECK (group_type = ANY (ARRAY[
    'cascade_delete'::text,
    'batch_update'::text,
    'merge_profiles'::text,
    'relationship_change'::text,
    'crop_update'::text  -- NEW: Allow photo crop operations
  ]));

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON CONSTRAINT operation_groups_group_type_check ON operation_groups IS
  'Allowed group_type values:
  - cascade_delete: Cascade delete operations
  - batch_update: Batch profile updates
  - merge_profiles: Profile merge operations
  - relationship_change: Relationship modifications
  - crop_update: Photo crop operations (added 2025-01-30)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify constraint was updated:
-- SELECT
--   conname AS constraint_name,
--   pg_get_constraintdef(c.oid) AS constraint_definition
-- FROM pg_constraint c
-- JOIN pg_class t ON c.conrelid = t.oid
-- WHERE t.relname = 'operation_groups'
--   AND contype = 'c'
--   AND conname = 'operation_groups_group_type_check';
--
-- Expected: Should include 'crop_update' in ARRAY
