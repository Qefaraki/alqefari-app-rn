/**
 * ROLLBACK MIGRATION: Remove undo_crop_update RPC
 *
 * ⚠️ EMERGENCY USE ONLY ⚠️
 *
 * Purpose: Rollback undo system for crop updates
 *
 * When to Use:
 * - Bug in crop undo logic causing data corruption
 * - Undo RPC reverting wrong crop values
 * - Security issue with undo permission checks
 * - Need to disable crop undo without affecting crop editing
 *
 * What This Does:
 * - Drops undo_crop_update() RPC function
 * - Crop editing still works (admin_update_profile_crop remains)
 * - Existing crop data preserved
 * - Users can edit crops but cannot undo crop changes
 *
 * Data Loss Impact:
 * - NONE: Crop data and audit log remain intact
 * - Only the undo capability is removed
 * - Audit log entries with action_type='crop_update' remain visible
 * - Users see "Cannot undo" message in Activity Feed
 *
 * Alternative After Rollback:
 * - Manual undo via ProfileViewer (re-enter old values)
 * - Admin can view old_data in Activity Feed and manually restore
 * - Use generic admin_update_profile() to restore old crop values
 *
 * Recovery Steps After Rollback:
 * 1. Update Activity Feed to hide undo button for crop_update actions
 * 2. Add tooltip: "التراجع غير متاح حالياً" (Undo temporarily unavailable)
 * 3. Document manual undo process for admins
 *
 * To Apply Rollback:
 * mcp__supabase__apply_migration({ name: "rollback_undo_crop_update", query: <content> })
 *
 * Created: 2025-10-28
 */

-- ============================================================================
-- STEP 1: Drop undo_crop_update RPC Function
-- ============================================================================

DROP FUNCTION IF EXISTS undo_crop_update(UUID, TEXT);

COMMENT ON SCHEMA public IS 'undo_crop_update() RPC removed by rollback';

-- ============================================================================
-- STEP 2: Verify Crop Editing Still Works (admin_update_profile_crop intact)
-- ============================================================================

-- Verify admin_update_profile_crop RPC still exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'admin_update_profile_crop';
-- Expected: 1 row (crop editing still functional)

-- Verify crop audit log entries are preserved
SELECT COUNT(*) AS crop_audit_entries
FROM audit_log_enhanced
WHERE action_type = 'crop_update';
-- Expected: Count of existing crop_update audit entries (data intact)

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify undo RPC is dropped
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'undo_crop_update';
-- Expected: Empty result (0 rows)

-- Verify audit log table structure intact
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'audit_log_enhanced'
  AND column_name IN ('undone_at', 'undone_by', 'undo_reason');
-- Expected: 3 rows (undo columns still exist for other action types)

-- ============================================================================
-- POST-ROLLBACK ACTIONS REQUIRED
-- ============================================================================

/*
1. Update undoService.js Configuration:
   File: src/services/undoService.js

   Update ACTION_TYPE_CONFIG:
   'crop_update': {
     rpcFunction: null,  // Changed from 'undo_crop_update'
     description: 'تعديل اقتصاص الصورة',
     requiresAdmin: false,
     timeLimitDays: 30,
     dangerous: false,
   },

   Effect: crop_update actions will show as "not undoable" in Activity Feed

2. Update Activity Feed UI:
   File: src/screens/admin/ActivityLogDashboard.js

   Add disabled state for crop_update undo buttons:
   {item.action_type === 'crop_update' && (
     <Text style={styles.undoDisabled}>
       التراجع غير متاح حالياً
     </Text>
   )}

3. Activity Feed Still Shows crop_update:
   - Audit entries remain visible
   - Changed fields displayed (crop_top: 0.0 → 0.15)
   - Only undo button disabled
   - User can manually restore via PhotoCropEditor

4. Manual Undo Process (Admin Workaround):
   a) Open Activity Feed
   b) Click crop_update entry to see old_data
   c) Copy old crop values
   d) Open profile → "تعديل الصورة"
   e) Manually adjust crop to match old values
   f) Save (creates new crop_update entry)

5. Monitor for Confusion:
   - Users may wonder why they can't undo crops
   - Add in-app notice: "ميزة التراجع عن الاقتصاص معطلة مؤقتاً"
   - Support team should know manual undo process

6. Alternative: Generic Undo (Fallback):
   Can use generic undo_profile_update() for crop changes:
   - Change action_type in audit_log_enhanced: 'crop_update' → 'admin_update'
   - Generic undo will work but less specific

Timeline: 1 hour for frontend updates + user communication
*/

-- ============================================================================
-- OPTIONAL: Re-enable Undo Later
-- ============================================================================

/*
To restore crop undo functionality:
1. Re-run forward migration: 20251027141100_create_undo_crop_update_rpc.sql
2. Revert undoService.js changes (rpcFunction: 'undo_crop_update')
3. Remove disabled state from Activity Feed UI
4. Test undo end-to-end with crop changes
5. Announce restoration to users

Downtime: Minimal (undo feature disabled during rollback only)
*/

-- ============================================================================
-- DATA INTEGRITY NOTES
-- ============================================================================

/*
Audit Log Preservation:
- All crop_update entries remain in audit_log_enhanced
- old_data and new_data JSONB fields intact
- Can reconstruct crop history even without undo RPC
- undone_at remains NULL (no undo performed)

Future Recovery:
- If crop undo bug is fixed, just recreate RPC
- No need to re-migrate audit log
- Existing crop_update entries become undoable immediately

Zero Data Loss:
- Crop fields: Intact
- Audit log: Intact
- Photos: Intact
- Only capability lost: Programmatic undo (UI button still shows history)
*/
