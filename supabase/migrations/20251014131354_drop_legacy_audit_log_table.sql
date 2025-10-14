-- =====================================================
-- Migration: Drop Legacy audit_log Table
-- Created: 2025-01-14 13:13:54
-- Purpose: Consolidate to single audit table (audit_log_enhanced)
-- =====================================================
--
-- CONTEXT:
-- The system previously had two audit tables from an incomplete migration:
-- - audit_log (legacy, 2,139 records)
-- - audit_log_enhanced (modern, 133 records)
--
-- This migration completes the consolidation by removing the legacy table.
-- User confirmed pre-production status, so no data migration needed.
--
-- SAFETY CHECKS PERFORMED:
-- ✅ No active code references audit_log (grepped codebase)
-- ✅ No FK dependencies found
-- ✅ Trigger log_profile_changes() only writes to audit_log_enhanced
-- ✅ All undo functions use audit_log_enhanced
-- ✅ activity_log_detailed view uses audit_log_enhanced
-- =====================================================

-- Drop the legacy table with CASCADE
-- CASCADE will automatically remove any dependent indexes, constraints, or views
DROP TABLE IF EXISTS audit_log CASCADE;

-- Clean up any related sync functions that may have been used for dual-write
DROP FUNCTION IF EXISTS sync_to_enhanced_audit() CASCADE;
DROP FUNCTION IF EXISTS sync_audit_to_enhanced() CASCADE;

-- Clean up any legacy RPC functions that referenced the old table
-- These were replaced by modern undo_profile_update() and undo_profile_delete()
DROP FUNCTION IF EXISTS admin_revert_action(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS admin_revert_action(UUID) CASCADE;

-- Verification check
-- This will raise an exception if the table still exists (migration failed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'audit_log'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: audit_log table still exists';
  END IF;

  RAISE NOTICE '✓ Legacy audit_log table successfully removed';
  RAISE NOTICE '✓ audit_log_enhanced is now the single source of truth';
END $$;

-- =====================================================
-- POST-MIGRATION STATE:
-- - audit_log_enhanced: Only audit table
-- - activity_log_detailed: View for enriched queries
-- - Undo system: Uses audit_log_enhanced exclusively
-- - Triggers: Write to audit_log_enhanced only
-- =====================================================
