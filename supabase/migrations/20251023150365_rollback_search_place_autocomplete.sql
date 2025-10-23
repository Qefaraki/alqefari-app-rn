-- ROLLBACK Migration: Revert search_place_autocomplete to previous state
-- Use this if the corrected function causes issues
-- Date: 2025-10-23

-- ========================================
-- STEP 1: Retrieve backed up function
-- ========================================
DO $$
DECLARE
  v_backup_exists BOOLEAN;
BEGIN
  -- Check if backup exists
  SELECT EXISTS (
    SELECT 1 FROM function_backups
    WHERE function_name = 'search_place_autocomplete'
    ORDER BY backed_up_at DESC
    LIMIT 1
  ) INTO v_backup_exists;

  IF NOT v_backup_exists THEN
    RAISE EXCEPTION 'No backup found for search_place_autocomplete. Cannot rollback.';
  END IF;

  RAISE NOTICE 'Backup found. Proceeding with rollback...';
END $$;

-- ========================================
-- STEP 2: Drop corrected function
-- ========================================
DROP FUNCTION IF EXISTS search_place_autocomplete(TEXT, INTEGER);

-- ========================================
-- STEP 3: Restore from backup
-- ========================================
DO $$
DECLARE
  v_backup_definition TEXT;
BEGIN
  -- Get most recent backup
  SELECT definition INTO v_backup_definition
  FROM function_backups
  WHERE function_name = 'search_place_autocomplete'
  ORDER BY backed_up_at DESC
  LIMIT 1;

  -- Execute backed up definition
  EXECUTE v_backup_definition;

  RAISE NOTICE 'Function restored from backup successfully.';
END $$;

-- ========================================
-- STEP 4: Log rollback
-- ========================================
INSERT INTO function_backups (function_name, function_signature, reason)
VALUES (
  'search_place_autocomplete',
  'search_place_autocomplete(TEXT, INTEGER)',
  'ROLLBACK: Restored to previous broken state due to issues with corrected version'
);

-- ========================================
-- Rollback completed
-- ========================================
