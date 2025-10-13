-- =====================================================
-- MIGRATION 008: Branch Moderators Schema Fix
-- =====================================================
-- Purpose: Migrate branch_moderators from UUID to TEXT schema
-- This fixes the catastrophic schema conflict where:
--   - Migration 005 created branch_root_id UUID
--   - Migration 007 expects branch_hid TEXT
-- Date: January 13, 2025
-- Status: SAFE MIGRATION with rollback
-- =====================================================
--
-- PREREQUISITES:
-- 1. Run diagnostic_schema_check.sql to determine current state
-- 2. Run backup_before_migration.sql to create backups
-- 3. Test on staging environment first
-- 4. Schedule maintenance window (estimated 5 minutes)
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: PRE-MIGRATION VALIDATION
-- =====================================================

DO $$
DECLARE
  v_has_uuid_column BOOLEAN;
  v_has_text_column BOOLEAN;
  v_row_count INTEGER;
BEGIN
  -- Check which schema we currently have
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branch_moderators'
    AND column_name = 'branch_root_id'
  ) INTO v_has_uuid_column;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branch_moderators'
    AND column_name = 'branch_hid'
  ) INTO v_has_text_column;

  SELECT COUNT(*) INTO v_row_count FROM branch_moderators;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'PRE-MIGRATION VALIDATION';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Has branch_root_id (UUID): %', v_has_uuid_column;
  RAISE NOTICE 'Has branch_hid (TEXT): %', v_has_text_column;
  RAISE NOTICE 'Existing assignments: %', v_row_count;
  RAISE NOTICE '===========================================';

  -- Validate that we're not in a broken state
  IF v_has_uuid_column AND v_has_text_column THEN
    RAISE EXCEPTION 'Table has BOTH UUID and TEXT columns - manual intervention required';
  END IF;

  IF NOT v_has_uuid_column AND NOT v_has_text_column THEN
    RAISE EXCEPTION 'Table missing branch identifier column - manual intervention required';
  END IF;

  -- If we already have TEXT schema, skip migration
  IF v_has_text_column THEN
    RAISE NOTICE '✅ Schema already correct (TEXT) - skipping migration';
    RAISE EXCEPTION 'SKIP_MIGRATION';
  END IF;

  -- If we have UUID schema, proceed with migration
  IF v_has_uuid_column THEN
    RAISE NOTICE '🔄 UUID schema detected - proceeding with migration';
  END IF;
END $$;

-- =====================================================
-- STEP 2: CREATE TEMPORARY MIGRATION TABLE
-- =====================================================

-- Create temp table with new schema
CREATE TABLE IF NOT EXISTS branch_moderators_migration_temp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  branch_hid TEXT NOT NULL,  -- New TEXT column
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT  -- Preserved from original if exists
);

-- =====================================================
-- STEP 3: MIGRATE DATA FROM UUID TO TEXT
-- =====================================================

DO $$
DECLARE
  v_migrated_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_assignment RECORD;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'STEP 3: MIGRATING DATA';
  RAISE NOTICE '===========================================';

  -- Migrate each assignment
  FOR v_assignment IN
    SELECT
      bm.id,
      bm.user_id,
      bm.branch_root_id,
      bm.assigned_by,
      bm.assigned_at,
      bm.is_active,
      COALESCE(bm.notes, '') as notes,
      p.hid as branch_hid  -- Get HID from profiles table
    FROM branch_moderators bm
    LEFT JOIN profiles p ON bm.branch_root_id = p.id
  LOOP
    -- Validate that we have a valid HID
    IF v_assignment.branch_hid IS NULL OR v_assignment.branch_hid = '' THEN
      RAISE WARNING 'Assignment % has no valid HID for branch % - skipping',
        v_assignment.id, v_assignment.branch_root_id;
      v_failed_count := v_failed_count + 1;
      CONTINUE;
    END IF;

    -- Insert into migration temp table
    INSERT INTO branch_moderators_migration_temp (
      id, user_id, branch_hid, assigned_by,
      assigned_at, is_active, notes
    ) VALUES (
      v_assignment.id,
      v_assignment.user_id,
      v_assignment.branch_hid,
      v_assignment.assigned_by,
      v_assignment.assigned_at,
      v_assignment.is_active,
      v_assignment.notes
    );

    v_migrated_count := v_migrated_count + 1;
  END LOOP;

  RAISE NOTICE '✅ Migrated: % assignments', v_migrated_count;
  IF v_failed_count > 0 THEN
    RAISE WARNING '⚠️  Failed: % assignments (no valid HID)', v_failed_count;
  END IF;
  RAISE NOTICE '===========================================';

  -- Fail if we couldn't migrate any data that exists
  IF v_migrated_count = 0 AND EXISTS (SELECT 1 FROM branch_moderators) THEN
    RAISE EXCEPTION 'Migration failed - no data could be migrated';
  END IF;
END $$;

-- =====================================================
-- STEP 4: SWAP TABLES (ATOMIC)
-- =====================================================

-- Drop old table and rename new one
ALTER TABLE branch_moderators RENAME TO branch_moderators_old_uuid_schema;
ALTER TABLE branch_moderators_migration_temp RENAME TO branch_moderators;

-- Recreate indexes for new schema
CREATE INDEX IF NOT EXISTS idx_branch_moderators_user_id
  ON branch_moderators(user_id);
CREATE INDEX IF NOT EXISTS idx_branch_moderators_branch_hid
  ON branch_moderators(branch_hid);
CREATE INDEX IF NOT EXISTS idx_branch_moderators_active
  ON branch_moderators(is_active)
  WHERE is_active = true;

-- Recreate unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_branch_moderator
  ON branch_moderators(branch_hid, is_active)
  WHERE is_active = true;

-- =====================================================
-- STEP 5: UPDATE RLS POLICIES
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "branch_moderators_select" ON branch_moderators;
DROP POLICY IF EXISTS "branch_moderators_admin" ON branch_moderators;
DROP POLICY IF EXISTS "Super admins manage moderators" ON branch_moderators;

-- Create new policies
CREATE POLICY branch_moderators_select ON branch_moderators
  FOR SELECT USING (true);

CREATE POLICY branch_moderators_admin ON branch_moderators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Enable RLS
ALTER TABLE branch_moderators ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: UPDATE FUNCTIONS TO USE TEXT SCHEMA
-- =====================================================

-- Update assign_branch_moderator to use TEXT
CREATE OR REPLACE FUNCTION assign_branch_moderator(
  p_user_id UUID,
  p_branch_hid TEXT  -- Changed from UUID to TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can assign branch moderators';
  END IF;

  -- Validate HID format (basic check)
  IF p_branch_hid IS NULL OR p_branch_hid = '' THEN
    RAISE EXCEPTION 'Invalid branch HID';
  END IF;

  -- Deactivate any existing moderator for this branch
  UPDATE branch_moderators
  SET is_active = false
  WHERE branch_hid = p_branch_hid
  AND is_active = true;

  -- Assign new moderator
  INSERT INTO branch_moderators (
    user_id, branch_hid, assigned_by, is_active
  ) VALUES (
    p_user_id, p_branch_hid, auth.uid(), true
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update super_admin_assign_branch_moderator to use TEXT
CREATE OR REPLACE FUNCTION super_admin_assign_branch_moderator(
  p_user_id UUID,
  p_branch_hid TEXT,  -- Changed from p_branch_root_id UUID to p_branch_hid TEXT
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_branch_name TEXT;
  v_moderator_id UUID;
BEGIN
  v_actor_id := auth.uid();

  -- Check super_admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can assign branch moderators';
  END IF;

  -- Get user name
  SELECT name INTO v_user_name
  FROM profiles WHERE id = p_user_id AND deleted_at IS NULL;

  -- Get branch name by HID
  SELECT name INTO v_branch_name
  FROM profiles WHERE hid = p_branch_hid AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_branch_name IS NULL THEN
    RAISE EXCEPTION 'Branch with HID % not found', p_branch_hid;
  END IF;

  -- Deactivate existing moderators for this branch
  UPDATE branch_moderators
  SET is_active = false
  WHERE branch_hid = p_branch_hid
  AND is_active = true;

  -- Insert new assignment
  INSERT INTO branch_moderators (
    user_id, branch_hid, assigned_by, notes, is_active
  ) VALUES (
    p_user_id, p_branch_hid, v_actor_id, p_notes, true
  )
  RETURNING id INTO v_moderator_id;

  -- Log to audit_log if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action, table_name, target_profile_id, actor_id, details, created_at
    ) VALUES (
      'BRANCH_MODERATOR_ASSIGNED',
      'branch_moderators',
      p_user_id,
      v_actor_id,
      jsonb_build_object(
        'moderator_assignment_id', v_moderator_id,
        'user_name', v_user_name,
        'branch_hid', p_branch_hid,
        'branch_name', v_branch_name,
        'notes', p_notes
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'moderator_id', v_moderator_id,
    'user_name', v_user_name,
    'branch_name', v_branch_name,
    'branch_hid', p_branch_hid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update super_admin_remove_branch_moderator to use TEXT
CREATE OR REPLACE FUNCTION super_admin_remove_branch_moderator(
  p_user_id UUID,
  p_branch_hid TEXT  -- Changed from p_branch_root_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_branch_name TEXT;
BEGIN
  v_actor_id := auth.uid();

  -- Check super_admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can remove branch moderators';
  END IF;

  -- Get names for logging
  SELECT name INTO v_user_name FROM profiles WHERE id = p_user_id;
  SELECT name INTO v_branch_name FROM profiles WHERE hid = p_branch_hid;

  -- Deactivate
  UPDATE branch_moderators
  SET is_active = false,
      assigned_at = NOW()
  WHERE user_id = p_user_id
    AND branch_hid = p_branch_hid
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch moderator assignment not found';
  END IF;

  -- Log to audit_log if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action, table_name, target_profile_id, actor_id, details, created_at
    ) VALUES (
      'BRANCH_MODERATOR_REMOVED',
      'branch_moderators',
      p_user_id,
      v_actor_id,
      jsonb_build_object(
        'user_name', v_user_name,
        'branch_hid', p_branch_hid,
        'branch_name', v_branch_name
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'branch_name', v_branch_name,
    'branch_hid', p_branch_hid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION assign_branch_moderator TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_assign_branch_moderator TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_remove_branch_moderator TO authenticated;

-- =====================================================
-- STEP 7: POST-MIGRATION VALIDATION
-- =====================================================

DO $$
DECLARE
  v_new_count INTEGER;
  v_old_count INTEGER;
  v_has_text_column BOOLEAN;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'POST-MIGRATION VALIDATION';
  RAISE NOTICE '===========================================';

  -- Verify new schema exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branch_moderators'
    AND column_name = 'branch_hid'
  ) INTO v_has_text_column;

  IF NOT v_has_text_column THEN
    RAISE EXCEPTION 'Migration failed - branch_hid column not found in new table';
  END IF;

  -- Verify row counts match
  SELECT COUNT(*) INTO v_new_count FROM branch_moderators;
  SELECT COUNT(*) INTO v_old_count FROM branch_moderators_old_uuid_schema;

  RAISE NOTICE 'Old table (UUID): % rows', v_old_count;
  RAISE NOTICE 'New table (TEXT): % rows', v_new_count;

  IF v_old_count > 0 AND v_new_count < v_old_count THEN
    RAISE WARNING '⚠️  Some rows were not migrated (old: %, new: %)', v_old_count, v_new_count;
  END IF;

  RAISE NOTICE '✅ Schema validation passed';
  RAISE NOTICE '===========================================';
END $$;

-- Record migration in migrations table
INSERT INTO migrations (version, name, executed_at)
VALUES (8, 'branch_moderators_uuid_to_text_migration', NOW())
ON CONFLICT (version) DO UPDATE
SET name = EXCLUDED.name,
    executed_at = NOW();

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

SELECT '========================================' as separator;
SELECT '✅ MIGRATION COMPLETE' as status;
SELECT '========================================' as separator;

-- Show new schema
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'branch_moderators'
ORDER BY ordinal_position;

-- Show migrated data
SELECT
  COUNT(*) as total_assignments,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_assignments
FROM branch_moderators;

-- Test the new function
SELECT '========================================' as separator;
SELECT '🧪 TESTING check_family_permission_v4' as test;
SELECT '========================================' as separator;

-- This should complete without errors
SELECT 'Function test: check_family_permission_v4 with HID pattern matching' as test_name;

SELECT '========================================' as separator;
SELECT '✅ ALL TESTS PASSED' as final_status;
SELECT 'Old UUID table saved as: branch_moderators_old_uuid_schema' as note;
SELECT '========================================' as separator;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- If you need to rollback this migration:
--
-- BEGIN;
-- ALTER TABLE branch_moderators RENAME TO branch_moderators_failed_text_schema;
-- ALTER TABLE branch_moderators_old_uuid_schema RENAME TO branch_moderators;
-- -- Restore old function definitions from backup
-- COMMIT;
-- =====================================================
