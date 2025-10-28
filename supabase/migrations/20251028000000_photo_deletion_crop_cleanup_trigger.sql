/**
 * Photo Deletion Crop Cleanup Trigger
 *
 * Purpose: Auto-reset crop values when profile photo is deleted
 *
 * Problem:
 * - User deletes photo via ProfileViewer
 * - Crop values remain in database (crop_top, crop_bottom, etc.)
 * - TreeView ImageNode tries to render crop on non-existent photo
 * - Result: Rendering error or blank node
 *
 * Solution:
 * - Trigger detects photo_url change to NULL
 * - Auto-resets all crop fields to 0.0
 * - Prevents orphaned crop data
 *
 * Trigger Behavior:
 * - Fires BEFORE UPDATE on profiles table
 * - Checks if photo_url changed from non-NULL to NULL
 * - If yes: Set crop_top/bottom/left/right to 0.0
 * - Version field NOT incremented (cleanup, not user edit)
 *
 * Edge Cases:
 * - Photo change (old → new): Crop preserved (user might want same crop)
 * - Photo restore (NULL → new): Crop remains 0.0 (user can recrop)
 * - Concurrent updates: Trigger runs in same transaction (atomic)
 *
 * Created: 2025-10-28
 */

-- ============================================================================
-- Create Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_crop_on_photo_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if photo_url changed from non-NULL to NULL (deletion)
  IF OLD.photo_url IS NOT NULL AND NEW.photo_url IS NULL THEN
    -- Reset all crop values to 0.0 (no crop)
    NEW.crop_top := 0.0;
    NEW.crop_bottom := 0.0;
    NEW.crop_left := 0.0;
    NEW.crop_right := 0.0;

    -- Version NOT incremented - this is automatic cleanup, not user edit
    -- Admin can see crop was reset in audit log (if photo deletion was audited)

    RAISE NOTICE 'Crop values reset for profile % due to photo deletion', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION reset_crop_on_photo_deletion() IS
'Auto-resets crop values to 0.0 when profile photo is deleted (photo_url becomes NULL)';

-- ============================================================================
-- Create Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_reset_crop_on_photo_deletion ON profiles;

CREATE TRIGGER trigger_reset_crop_on_photo_deletion
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (
    -- Only fire if photo_url changed from non-NULL to NULL
    OLD.photo_url IS NOT NULL AND NEW.photo_url IS NULL
  )
  EXECUTE FUNCTION reset_crop_on_photo_deletion();

COMMENT ON TRIGGER trigger_reset_crop_on_photo_deletion ON profiles IS
'Auto-cleanup trigger: Resets crop values when photo is deleted';

-- ============================================================================
-- Verification Query
-- ============================================================================

-- Verify trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_reset_crop_on_photo_deletion';

-- Expected: 1 row with trigger details

-- ============================================================================
-- Test Case (Manual Testing)
-- ============================================================================

/*
Manual Test Steps:
1. Create test profile with photo and crop:
   INSERT INTO profiles (hid, name, gender, generation, photo_url, crop_top, version)
   VALUES (88888, 'Test Crop Cleanup', 'male', 5, 'https://example.com/photo.jpg', 0.2, 1);

2. Delete photo (trigger should fire):
   UPDATE profiles
   SET photo_url = NULL
   WHERE hid = 88888;

3. Verify crop values reset:
   SELECT crop_top, crop_bottom, crop_left, crop_right
   FROM profiles
   WHERE hid = 88888;

   Expected: All 0.000

4. Cleanup:
   DELETE FROM profiles WHERE hid = 88888;
*/

-- ============================================================================
-- Edge Case Tests
-- ============================================================================

/*
Edge Case 1: Photo Change (old → new) - Crop Preserved
---------------------------------------------------------
UPDATE profiles
SET photo_url = 'https://example.com/new-photo.jpg'
WHERE hid = 88888;

Expected: Crop values remain unchanged (user might want same crop on new photo)


Edge Case 2: Photo Restore (NULL → new) - Crop Remains 0.0
-----------------------------------------------------------
UPDATE profiles
SET photo_url = 'https://example.com/restored-photo.jpg'
WHERE hid = 88888;

Expected: Crop values remain 0.0 (user can manually recrop if needed)


Edge Case 3: Concurrent Updates - Atomic Cleanup
-------------------------------------------------
BEGIN;
  UPDATE profiles SET photo_url = NULL WHERE hid = 88888;
  UPDATE profiles SET name = 'Updated Name' WHERE hid = 88888;
COMMIT;

Expected: Both updates succeed, crop reset happens in same transaction


Edge Case 4: Soft Delete (deleted_at) - No Trigger
---------------------------------------------------
UPDATE profiles
SET deleted_at = NOW()
WHERE hid = 88888;

Expected: Trigger does NOT fire (photo_url unchanged, only deleted_at changed)
*/

-- ============================================================================
-- Integration with admin_update_profile
-- ============================================================================

/*
When admin deletes photo via admin_update_profile():
1. admin_update_profile() sets photo_url = NULL
2. Trigger fires BEFORE UPDATE
3. Trigger resets crop values to 0.0
4. admin_update_profile() completes
5. Audit log records photo deletion (but not crop reset - cleanup is transparent)

Result: Single RPC call handles both photo deletion and crop cleanup
*/

-- ============================================================================
-- Performance Impact
-- ============================================================================

/*
Trigger Performance:
- Fires only on photo deletion (photo_url: non-NULL → NULL)
- Simple column updates (4 assignments)
- No additional queries or complex logic
- Impact: <0.1ms per photo deletion

Estimated Frequency:
- Photo deletions: ~5-10 per day in production
- Total overhead: ~0.5ms per day (negligible)

Conclusion: No measurable performance impact
*/

-- ============================================================================
-- Rollback Instructions
-- ============================================================================

/*
To remove this trigger:

DROP TRIGGER IF EXISTS trigger_reset_crop_on_photo_deletion ON profiles;
DROP FUNCTION IF EXISTS reset_crop_on_photo_deletion();

Note: Existing crop values on profiles with NULL photo_url will remain.
To clean those up manually:

UPDATE profiles
SET crop_top = 0.0, crop_bottom = 0.0, crop_left = 0.0, crop_right = 0.0
WHERE photo_url IS NULL
  AND (crop_top > 0 OR crop_bottom > 0 OR crop_left > 0 OR crop_right > 0);
*/
