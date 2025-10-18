-- ⚠️⚠️⚠️ HISTORICAL RECORD ONLY - THIS MIGRATION WAS ALREADY APPLIED ON OCT 18, 2025 ⚠️⚠️⚠️
-- ⚠️⚠️⚠️ This file documents what SQL was executed but NEVER committed to the repository ⚠️⚠️⚠️
-- ⚠️⚠️⚠️ The changes were REVERTED by migration 20251018200000 ⚠️⚠️⚠️

-- DO NOT RUN THIS MIGRATION AGAIN - IT IS FOR DOCUMENTATION PURPOSES ONLY

/*
 * INCIDENT REPORT
 *
 * Date: October 18, 2025, 18:49:38
 * What Happened:
 *   - A migration was executed via MCP (apply_migration or execute_sql) to fix duplicate
 *     sibling_order values across 44+ children in 11 families
 *   - The migration SQL was NEVER saved as a .sql file in the repository
 *   - Only the commit message documented the migration, but the actual SQL file was missing
 *   - This violated the critical workflow: "ALWAYS WRITE THE FILE FIRST"
 *
 * Impact:
 *   - Database was modified with 44+ profiles having sibling_order changed to match HID suffix
 *   - Unique indexes were added to enforce sibling_order uniqueness
 *   - Users reported incorrect ordering in the tree (HID suffix != intended order)
 *   - Changes could not be reproduced on other environments
 *   - No way to rollback until audit_log was used to revert
 *
 * Root Cause:
 *   - MCP tool executes SQL directly on database but doesn't create filesystem files
 *   - Developer (Claude) forgot to use Write tool before running MCP command
 *   - Insufficient warnings in CLAUDE.md about this workflow violation
 *
 * Resolution:
 *   - Created migration 20251018200000 to revert all sibling_order changes using audit_log
 *   - Removed unique constraint (migration 20251018200001) to allow lazy auto-fix
 *   - Implemented frontend auto-fix in QuickAddOverlay (detects and fixes on modal open)
 *   - Added stronger warnings to CLAUDE.md
 *   - Added pre-commit git hook to prevent future violations
 *
 * Lesson Learned:
 *   NEVER apply migrations without creating the .sql file FIRST in the repository!
 */

-- ============================================================================
-- APPROXIMATE SQL THAT WAS EXECUTED (reconstructed from commit message)
-- ============================================================================

-- Step 1: Fix all duplicate sibling_order values using HID suffix as source of truth
-- UPDATE profiles
-- SET
--   sibling_order = (regexp_match(hid, '\.(\d+)$'))[1]::integer - 1,
--   version = version + 1,
--   updated_at = NOW()
-- WHERE
--   hid ~ '\.\d+$'
--   AND deleted_at IS NULL;

-- Step 2: Add unique indexes to prevent future duplicates
-- CREATE UNIQUE INDEX idx_unique_sibling_order_per_father
-- ON profiles (father_id, sibling_order)
-- WHERE father_id IS NOT NULL AND deleted_at IS NULL;

-- CREATE UNIQUE INDEX idx_unique_sibling_order_per_mother
-- ON profiles (mother_id, sibling_order)
-- WHERE mother_id IS NOT NULL AND father_id IS NULL AND deleted_at IS NULL;

-- Step 3: Gender fix (mentioned in commit message)
-- UPDATE profiles
-- SET gender = 'female', version = version + 1, updated_at = NOW()
-- WHERE name = 'شيهانة' AND gender = 'male';

-- ============================================================================
-- AFFECTED FAMILIES (mentioned in commit: 11 families, 44+ children)
-- ============================================================================
-- Exact list unknown - not documented in commit or migration file

-- ============================================================================
-- STATUS: REVERTED
-- ============================================================================
-- See migration 20251018200000_revert_sibling_order_bulk_fix.sql for the revert
-- See migration 20251018200001_remove_sibling_order_unique_constraint.sql for constraint removal
--
-- New approach: Lazy auto-fix in QuickAddOverlay frontend component
--   - Detects duplicates when modal opens
--   - Auto-renumbers sequentially using applyOrdering()
--   - Shows warning banner to user
--   - No database constraint blocking saves
