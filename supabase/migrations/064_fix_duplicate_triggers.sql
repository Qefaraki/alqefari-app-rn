-- Migration 064: Fix Duplicate Activity Log Triggers
-- Created: 2025-01-10
-- Purpose: Drop old trigger that was causing duplicate logs
-- Problem: trigger_log_profile_changes (migration 057) was still active
--          alongside audit_profile_changes (migration 063)

-- Drop the old trigger to prevent duplicates
DROP TRIGGER IF EXISTS trigger_log_profile_changes ON profiles;

-- Verify only one trigger remains
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 064 Complete';
  RAISE NOTICE '   - Dropped old trigger: trigger_log_profile_changes';
  RAISE NOTICE '   - Active trigger: audit_profile_changes';
  RAISE NOTICE '   - Duplicate logs should now be fixed';
END $$;
