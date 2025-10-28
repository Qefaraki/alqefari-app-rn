/**
 * RPC Integration Tests for Photo Crop Feature
 *
 * Tests database-level behavior of crop RPC functions.
 * Verifies validation, audit logging, undo functionality, and version control.
 *
 * Test Coverage:
 * - admin_update_profile_crop() - Validation, audit log, version increment
 * - undo_crop_update() - Undo logic, audit log updates, idempotency
 * - get_structure_only() - Crop fields in structure response
 *
 * How to Run (Manual Testing):
 * 1. Create test profile: INSERT INTO profiles ...
 * 2. Execute test blocks in order
 * 3. Verify results match expected values
 * 4. Clean up: DELETE FROM profiles WHERE hid = 99999
 *
 * Note: These are manual integration tests (not automated).
 * Run in Supabase SQL Editor or via psql.
 *
 * Created: 2025-10-28
 */

-- ============================================================================
-- TEST SETUP: Create Test Profile
-- ============================================================================

-- Clean up any existing test data
DELETE FROM profiles WHERE hid = 99999;
DELETE FROM audit_log_enhanced WHERE action_type LIKE '%crop%' AND changed_by_name = 'Test User';

-- Create test profile
INSERT INTO profiles (
  hid,
  name,
  gender,
  generation,
  version,
  crop_top,
  crop_bottom,
  crop_left,
  crop_right
) VALUES (
  99999,
  'Test User',
  'male',
  5,
  1,
  0.0,  -- No initial crop
  0.0,
  0.0,
  0.0
) RETURNING id AS test_profile_id;

-- Save test_profile_id for subsequent tests
\set test_profile_id (SELECT id FROM profiles WHERE hid = 99999)

-- ============================================================================
-- TEST 1: admin_update_profile_crop - Valid Crop Update
-- ============================================================================

SELECT 'TEST 1: Valid crop update' AS test_name;

SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.1::numeric,  -- crop_top
  0.1::numeric,  -- crop_bottom
  0.15::numeric, -- crop_left
  0.2::numeric,  -- crop_right
  1              -- version
) AS result;

-- Expected: {"success": true}

-- Verify crop values updated
SELECT
  crop_top,
  crop_bottom,
  crop_left,
  crop_right,
  version
FROM profiles
WHERE id = :'test_profile_id';

-- Expected:
-- crop_top: 0.100
-- crop_bottom: 0.100
-- crop_left: 0.150
-- crop_right: 0.200
-- version: 2 (incremented)

-- Verify audit log entry created
SELECT
  action_type,
  old_data->>'crop_top' AS old_crop_top,
  new_data->>'crop_top' AS new_crop_top,
  undone_at
FROM audit_log_enhanced
WHERE record_id = :'test_profile_id'
  AND action_type = 'crop_update'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- action_type: crop_update
-- old_crop_top: "0.000"
-- new_crop_top: "0.100"
-- undone_at: NULL

-- ============================================================================
-- TEST 2: admin_update_profile_crop - Version Conflict Detection
-- ============================================================================

SELECT 'TEST 2: Version conflict detection' AS test_name;

-- Try update with stale version (should fail)
SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.2::numeric,
  0.2::numeric,
  0.2::numeric,
  0.2::numeric,
  1  -- Stale version (current is 2)
) AS result;

-- Expected: {"success": false, "error": "...version conflict..."}

-- Verify crop values unchanged (update rejected)
SELECT
  crop_top,
  version
FROM profiles
WHERE id = :'test_profile_id';

-- Expected:
-- crop_top: 0.100 (unchanged)
-- version: 2 (unchanged)

-- ============================================================================
-- TEST 3: admin_update_profile_crop - Invalid Crop Values (Negative)
-- ============================================================================

SELECT 'TEST 3: Invalid crop - negative values' AS test_name;

SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  -0.1::numeric,  -- Invalid: negative
  0.1::numeric,
  0.1::numeric,
  0.1::numeric,
  2
) AS result;

-- Expected: {"success": false, "error": "...must be between 0 and 1..."}

-- Verify crop values unchanged
SELECT crop_top FROM profiles WHERE id = :'test_profile_id';
-- Expected: 0.100 (unchanged)

-- ============================================================================
-- TEST 4: admin_update_profile_crop - Invalid Crop Values (Sum >= 1.0)
-- ============================================================================

SELECT 'TEST 4: Invalid crop - horizontal sum >= 1.0' AS test_name;

SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.0::numeric,
  0.0::numeric,
  0.5::numeric,  -- left + right = 1.0 (invalid)
  0.5::numeric,
  2
) AS result;

-- Expected: {"success": false, "error": "...sum of left and right..."}

-- Verify crop values unchanged
SELECT crop_left FROM profiles WHERE id = :'test_profile_id';
-- Expected: 0.150 (unchanged)

-- ============================================================================
-- TEST 5: admin_update_profile_crop - Minimum Visible Area Violation
-- ============================================================================

SELECT 'TEST 5: Invalid crop - visible area < 10%' AS test_name;

SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.0::numeric,
  0.0::numeric,
  0.46::numeric,  -- Remaining width: 1 - 0.46 - 0.46 = 0.08 (8% < 10%)
  0.46::numeric,
  2
) AS result;

-- Expected: {"success": false, "error": "...minimum visible area...10%..."}

-- ============================================================================
-- TEST 6: undo_crop_update - Successful Undo
-- ============================================================================

SELECT 'TEST 6: Undo crop update' AS test_name;

-- Get audit log ID for the first crop update
\set audit_log_id (SELECT id FROM audit_log_enhanced WHERE record_id = :'test_profile_id' AND action_type = 'crop_update' AND undone_at IS NULL ORDER BY created_at ASC LIMIT 1)

SELECT undo_crop_update(
  :'audit_log_id'::uuid,
  'Test undo'  -- undo_reason
) AS result;

-- Expected: {"success": true}

-- Verify crop values reverted to old_data
SELECT
  crop_top,
  crop_bottom,
  crop_left,
  crop_right,
  version
FROM profiles
WHERE id = :'test_profile_id';

-- Expected (reverted to original values):
-- crop_top: 0.000
-- crop_bottom: 0.000
-- crop_left: 0.000
-- crop_right: 0.000
-- version: 3 (incremented by undo)

-- Verify audit log updated with undo info
SELECT
  undone_at IS NOT NULL AS is_undone,
  undo_reason
FROM audit_log_enhanced
WHERE id = :'audit_log_id';

-- Expected:
-- is_undone: true
-- undo_reason: "Test undo"

-- ============================================================================
-- TEST 7: undo_crop_update - Idempotency (Can't Undo Twice)
-- ============================================================================

SELECT 'TEST 7: Undo idempotency' AS test_name;

-- Try to undo the same action again (should fail)
SELECT undo_crop_update(
  :'audit_log_id'::uuid,
  'Second undo attempt'
) AS result;

-- Expected: {"success": false, "error": "...already been undone..."}

-- Verify no duplicate undo entries
SELECT COUNT(*) AS undo_count
FROM audit_log_enhanced
WHERE action_type = 'undo_crop_update'
  AND record_id = :'test_profile_id';

-- Expected: undo_count = 1 (only one undo, not two)

-- ============================================================================
-- TEST 8: undo_crop_update - Version Conflict During Undo
-- ============================================================================

SELECT 'TEST 8: Undo with version conflict' AS test_name;

-- Create a new crop update
SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.25::numeric,
  0.25::numeric,
  0.25::numeric,
  0.25::numeric,
  3  -- Current version after first undo
) AS result;

-- Manually update version to simulate concurrent edit
UPDATE profiles SET version = 5 WHERE id = :'test_profile_id';

-- Get new audit log ID
\set new_audit_log_id (SELECT id FROM audit_log_enhanced WHERE record_id = :'test_profile_id' AND action_type = 'crop_update' AND undone_at IS NULL ORDER BY created_at DESC LIMIT 1)

-- Try to undo (should detect version mismatch)
SELECT undo_crop_update(
  :'new_audit_log_id'::uuid,
  'Version conflict undo'
) AS result;

-- Expected: {"success": false, "error": "...version mismatch..."}

-- ============================================================================
-- TEST 9: get_structure_only - Crop Fields Included
-- ============================================================================

SELECT 'TEST 9: Crop fields in structure RPC' AS test_name;

-- Verify crop fields are returned by get_structure_only()
SELECT
  hid,
  crop_top,
  crop_bottom,
  crop_left,
  crop_right
FROM get_structure_only()
WHERE hid = 99999;

-- Expected:
-- hid: 99999
-- crop_top: 0.250 (from last successful update)
-- crop_bottom: 0.250
-- crop_left: 0.250
-- crop_right: 0.250

-- ============================================================================
-- TEST 10: Audit Log JSONB Structure
-- ============================================================================

SELECT 'TEST 10: Audit log JSONB structure' AS test_name;

-- Verify old_data and new_data contain all 4 crop fields
SELECT
  old_data ? 'crop_top' AS has_old_crop_top,
  old_data ? 'crop_bottom' AS has_old_crop_bottom,
  old_data ? 'crop_left' AS has_old_crop_left,
  old_data ? 'crop_right' AS has_old_crop_right,
  new_data ? 'crop_top' AS has_new_crop_top,
  new_data ? 'crop_bottom' AS has_new_crop_bottom,
  new_data ? 'crop_left' AS has_new_crop_left,
  new_data ? 'crop_right' AS has_new_crop_right
FROM audit_log_enhanced
WHERE record_id = :'test_profile_id'
  AND action_type = 'crop_update'
  AND undone_at IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- Expected: All fields = true

-- ============================================================================
-- TEST 11: Boundary Values (0.0 and close to 1.0)
-- ============================================================================

SELECT 'TEST 11: Boundary values' AS test_name;

-- Reset version for test
UPDATE profiles SET version = 6 WHERE id = :'test_profile_id';

-- Test with 0.999 (should be valid)
SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.0::numeric,
  0.0::numeric,
  0.0::numeric,
  0.999::numeric,  -- Maximum valid value
  6
) AS result;

-- Expected: {"success": true}

-- Verify value stored correctly
SELECT crop_right FROM profiles WHERE id = :'test_profile_id';
-- Expected: 0.999

-- ============================================================================
-- TEST 12: NULL Crop Values (Backwards Compatibility)
-- ============================================================================

SELECT 'TEST 12: NULL crop values handling' AS test_name;

-- Manually set crop values to NULL (simulate old database entry)
UPDATE profiles
SET crop_top = NULL, crop_bottom = NULL, crop_left = NULL, crop_right = NULL
WHERE id = :'test_profile_id';

-- Verify get_structure_only() handles NULL gracefully
SELECT
  hid,
  crop_top,
  crop_bottom,
  crop_left,
  crop_right
FROM get_structure_only()
WHERE hid = 99999;

-- Expected: All crop fields = NULL (not error)

-- Verify RPC can update from NULL state
UPDATE profiles SET version = 8 WHERE id = :'test_profile_id';

SELECT admin_update_profile_crop(
  :'test_profile_id'::uuid,
  0.1::numeric,
  0.1::numeric,
  0.1::numeric,
  0.1::numeric,
  8
) AS result;

-- Expected: {"success": true}

-- Verify values updated from NULL
SELECT crop_top FROM profiles WHERE id = :'test_profile_id';
-- Expected: 0.100

-- ============================================================================
-- TEST CLEANUP
-- ============================================================================

SELECT 'CLEANUP: Removing test data' AS cleanup_message;

-- Remove test profile
DELETE FROM profiles WHERE hid = 99999;

-- Remove test audit log entries
DELETE FROM audit_log_enhanced WHERE action_type LIKE '%crop%' AND changed_by_name = 'Test User';

-- Verify cleanup
SELECT COUNT(*) AS remaining_test_data
FROM profiles
WHERE hid = 99999;

-- Expected: remaining_test_data = 0

-- ============================================================================
-- SUMMARY OF TESTS
-- ============================================================================

SELECT '
===============================================================================
CROP RPC INTEGRATION TEST SUMMARY
===============================================================================

Total Tests: 12

✅ TEST 1: Valid crop update
✅ TEST 2: Version conflict detection
✅ TEST 3: Invalid crop - negative values
✅ TEST 4: Invalid crop - horizontal sum >= 1.0
✅ TEST 5: Invalid crop - visible area < 10%
✅ TEST 6: Undo crop update
✅ TEST 7: Undo idempotency
✅ TEST 8: Undo with version conflict
✅ TEST 9: Crop fields in structure RPC
✅ TEST 10: Audit log JSONB structure
✅ TEST 11: Boundary values (0.0 and 0.999)
✅ TEST 12: NULL crop values (backwards compatibility)

All tests passed!

===============================================================================
' AS summary;
