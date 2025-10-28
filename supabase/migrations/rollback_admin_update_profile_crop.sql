/**
 * ROLLBACK MIGRATION: Remove admin_update_profile_crop RPC
 *
 * ⚠️ EMERGENCY USE ONLY ⚠️
 *
 * Purpose: Rollback dedicated crop RPC (keeps crop fields in profiles table)
 *
 * When to Use:
 * - Bug in crop RPC validation logic
 * - Performance issues with crop updates
 * - Security vulnerability in crop RPC
 * - Need to disable crop editing without removing data
 *
 * What This Does:
 * - Drops admin_update_profile_crop() RPC function
 * - Existing crop data in profiles table remains intact
 * - Users can still view crops but cannot edit them
 *
 * Data Loss Impact:
 * - NONE: Crop data remains in profiles table
 * - Only the editing capability is removed
 * - Crop values still applied during rendering (ImageNode.tsx)
 *
 * Alternative After Rollback:
 * - Can use generic admin_update_profile() RPC to edit crop fields
 * - Less safe (no dedicated crop validation)
 * - Activity log will use 'admin_update' instead of 'crop_update'
 *
 * Recovery Steps After Rollback:
 * 1. Update ProfileViewer to use admin_update_profile() for crop edits
 * 2. Add manual crop validation in frontend before RPC call
 * 3. Change activity log action_type from 'crop_update' to 'admin_update'
 *
 * To Apply Rollback:
 * mcp__supabase__apply_migration({ name: "rollback_admin_update_profile_crop", query: <content> })
 *
 * Created: 2025-10-28
 */

-- ============================================================================
-- STEP 1: Drop admin_update_profile_crop RPC Function
-- ============================================================================

DROP FUNCTION IF EXISTS admin_update_profile_crop(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER);

COMMENT ON SCHEMA public IS 'admin_update_profile_crop() RPC removed by rollback';

-- ============================================================================
-- STEP 2: Verify Crop Fields Still Exist (Data Preserved)
-- ============================================================================

-- Verify crop columns still exist in profiles table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name LIKE 'crop_%';
-- Expected: 4 rows (crop_top, crop_bottom, crop_left, crop_right)

-- Verify crop data is preserved
SELECT COUNT(*) AS profiles_with_crop
FROM profiles
WHERE crop_top > 0 OR crop_bottom > 0 OR crop_left > 0 OR crop_right > 0;
-- Expected: Count of profiles that had crop adjustments (data intact)

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RPC is dropped
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'admin_update_profile_crop';
-- Expected: Empty result (0 rows)

-- Verify generic admin_update_profile still exists (fallback)
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'admin_update_profile';
-- Expected: 1 row (fallback RPC available)

-- ============================================================================
-- POST-ROLLBACK ACTIONS REQUIRED
-- ============================================================================

/*
1. Update ProfileViewer Integration:
   File: src/components/ProfileViewer/index.js

   Before (dedicated RPC):
   const { data, error } = await supabase.rpc('admin_update_profile_crop', {
     p_profile_id: profile.id,
     p_crop_top: crop.crop_top,
     p_crop_bottom: crop.crop_bottom,
     p_crop_left: crop.crop_left,
     p_crop_right: crop.crop_right,
     p_version: profile.version ?? 1
   });

   After (fallback to generic RPC):
   const { data, error } = await supabase.rpc('admin_update_profile', {
     p_profile_id: profile.id,
     p_updates: {
       crop_top: crop.crop_top,
       crop_bottom: crop.crop_bottom,
       crop_left: crop.crop_right,
       crop_right: crop.crop_right
     },
     p_version: profile.version ?? 1
   });

2. Add Manual Validation:
   Before calling admin_update_profile(), add:

   import { isValidCrop } from '../utils/cropUtils';

   if (!isValidCrop(crop)) {
     Alert.alert('خطأ', 'قيم الاقتصاص غير صالحة');
     return;
   }

3. Update Activity Log Handling:
   - Remove 'crop_update' from undoService.js ACTION_TYPE_CONFIG
   - Crop edits will appear as 'admin_update' in Activity Feed
   - Less specific action description

4. PhotoCropEditor Still Works:
   - Component remains functional (returns crop coordinates)
   - Only the save RPC changed (uses generic instead of dedicated)

5. Disable Crop-Specific Undo:
   File: src/services/undoService.js

   Comment out:
   'crop_update': {
     rpcFunction: 'undo_crop_update',
     // ... config
   },

Timeline: 1-2 hours for frontend updates + testing
*/

-- ============================================================================
-- OPTIONAL: Re-enable Dedicated RPC Later
-- ============================================================================

/*
To restore the dedicated crop RPC:
1. Re-run forward migration: 20251027140000_add_crop_fields_to_profiles.sql
2. Re-run RPC fix: 20251027141000_fix_admin_update_profile_crop_activity_log.sql
3. Revert frontend changes (use dedicated RPC again)
4. Test crop editing end-to-end
*/
