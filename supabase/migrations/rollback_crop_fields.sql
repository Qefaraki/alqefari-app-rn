/**
 * ROLLBACK MIGRATION: Remove Crop Fields from Profiles Table
 *
 * ⚠️ EMERGENCY USE ONLY ⚠️
 *
 * Purpose: Rollback migration 20251027140000_add_crop_fields_to_profiles.sql
 *
 * When to Use:
 * - Critical bug discovered in crop feature
 * - Data corruption from crop values
 * - Need to disable crop feature immediately
 *
 * What This Does:
 * - Drops 4 crop columns from profiles table (crop_top, crop_bottom, crop_left, crop_right)
 * - Removes crop fields from get_structure_only() RPC (reverts to 14 fields)
 * - All existing crop data will be PERMANENTLY DELETED
 *
 * Data Loss Impact:
 * - All user crop adjustments lost
 * - Photos will revert to full uncropped display
 * - Audit log entries remain (for historical record)
 *
 * Recovery Steps After Rollback:
 * 1. Restart app to clear AsyncStorage cache
 * 2. Frontend will gracefully handle missing crop fields (defaults to 0.0)
 * 3. PhotoCropEditor will be non-functional until crop fields restored
 *
 * To Apply Rollback:
 * mcp__supabase__apply_migration({ name: "rollback_crop_fields", query: <content> })
 *
 * Created: 2025-10-28
 */

-- ============================================================================
-- STEP 1: Drop Crop Fields from Profiles Table
-- ============================================================================

ALTER TABLE profiles
  DROP COLUMN IF EXISTS crop_top,
  DROP COLUMN IF EXISTS crop_bottom,
  DROP COLUMN IF EXISTS crop_left,
  DROP COLUMN IF EXISTS crop_right;

COMMENT ON TABLE profiles IS 'Family tree profiles (crop fields removed by rollback)';

-- ============================================================================
-- STEP 2: Revert get_structure_only() RPC to 14 Fields (Remove Crop Fields)
-- ============================================================================

DROP FUNCTION IF EXISTS get_structure_only();

CREATE OR REPLACE FUNCTION get_structure_only()
RETURNS TABLE (
  id UUID,
  hid INTEGER,
  father_id UUID,
  mother_id UUID,
  name TEXT,
  kunya TEXT,
  laqab TEXT,
  gender TEXT,
  deleted_at TIMESTAMPTZ,
  professional_title TEXT,
  professional_title_label TEXT,
  photo_url TEXT,
  generation INTEGER,
  version INTEGER
  -- NOTE: Crop fields removed (crop_top, crop_bottom, crop_left, crop_right)
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.hid,
    p.father_id,
    p.mother_id,
    p.name,
    p.kunya,
    p.laqab,
    p.gender,
    p.deleted_at,
    p.professional_title,
    p.professional_title_label,
    p.photo_url,
    p.generation,
    p.version
  FROM profiles p
  WHERE p.deleted_at IS NULL
  ORDER BY p.generation ASC, p.hid ASC;
$$;

COMMENT ON FUNCTION get_structure_only() IS 'Returns minimal profile data for tree structure (crop fields removed by rollback)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify crop columns are dropped
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name LIKE 'crop_%';
-- Expected: Empty result (0 rows)

-- Verify get_structure_only() has 14 fields (not 18)
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_name = 'get_structure_only';
-- Expected: 1 row with routine_name = 'get_structure_only'

-- ============================================================================
-- POST-ROLLBACK ACTIONS REQUIRED
-- ============================================================================

/*
1. Frontend Cache Invalidation:
   - Delete AsyncStorage key 'tree-structure-v4'
   - Force app restart to clear in-memory cache

2. Schema Version:
   - Revert TREE_STRUCTURE_SCHEMA_VERSION from 1.3.0 to 1.2.0
   - File: src/components/TreeView/hooks/useStructureLoader.js

3. Disable Crop UI:
   - Comment out PhotoCropEditor integration in ProfileViewer
   - Remove "تعديل الصورة" menu option
   - Disable crop_update in Activity Feed

4. Database Cleanup:
   - Audit log entries remain (historical record)
   - No need to clean audit_log_enhanced table

5. Monitor for Issues:
   - Check app logs for "undefined crop field" errors
   - Verify tree rendering works without crop fields
   - Test photo display on various devices

Timeline: 2-3 hours for full rollback + testing
*/
