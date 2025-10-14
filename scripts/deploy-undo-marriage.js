/**
 * Deployment Script: Undo Marriage Create Function
 * Migration: 20251014222147_undo_marriage_create_function
 *
 * This script documents the deployment of the undo_marriage_create function
 * for removing incorrectly created marriages.
 *
 * WHAT THIS DOES:
 * 1. Updates check_undo_permission() to support 'add_marriage' action type
 * 2. Creates undo_marriage_create() function to soft delete marriages
 * 3. Enforces admin-only permission for marriage undo operations
 * 4. Creates audit trail for undo actions
 *
 * USAGE:
 * const result = await supabase.rpc('undo_marriage_create', {
 *   p_audit_log_id: 'uuid-of-add-marriage-audit-log',
 *   p_undo_reason: 'تم إضافة الزواج بالخطأ' // Optional
 * });
 *
 * SAFETY CHECKS:
 * - Admin-only operation (enforced by check_undo_permission)
 * - Verifies action_type is 'add_marriage'
 * - Checks marriage exists and is not already deleted
 * - Prevents double-undo (checks undone_at)
 * - Creates audit trail for accountability
 *
 * RETURN FORMAT:
 * Success: { success: true, message: 'تم التراجع عن الزواج بنجاح' }
 * Error:   { success: false, error: 'error message in Arabic' }
 */

// This is a documentation file only.
// The actual migration was deployed via MCP: mcp__supabase__apply_migration

module.exports = {
  migrationName: '20251014222147_undo_marriage_create_function',
  deployedAt: '2025-10-15',

  // Test query to verify deployment
  testQuery: `
    SELECT
      p.proname as function_name,
      pg_get_function_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'undo_marriage_create';
  `,

  // Expected result
  expectedResult: {
    function_name: 'undo_marriage_create',
    arguments: 'p_audit_log_id uuid, p_undo_reason text DEFAULT NULL::text'
  },

  // Integration notes
  integrationNotes: `
    1. Add to NotificationCenter.tsx undo actions registry
    2. Update ActivityLogItem.tsx to show undo button for add_marriage
    3. Ensure admin-only UI visibility for marriage undo
    4. Test with real marriage creation and undo flow
  `
};
