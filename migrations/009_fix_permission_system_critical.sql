-- =====================================================
-- MIGRATION 009: Fix Permission System Critical Issues
-- =====================================================
-- Purpose: Fix get_user_permissions_summary to use branch_hid TEXT
-- and add server-side HID validation
-- Date: January 2025
-- Status: CRITICAL FIX for Phase 4 deployment
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Fix get_user_permissions_summary function
-- =====================================================
-- Issue: Function still references branch_root_id (UUID)
-- after migration 008 changed to branch_hid (TEXT)

CREATE OR REPLACE FUNCTION get_user_permissions_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_role TEXT;
  v_name TEXT;
  v_branches JSONB;
  v_block_reason TEXT;
  v_blocked_at TIMESTAMPTZ;
  v_editable_count INTEGER;
  v_pending_suggestions INTEGER;
BEGIN
  -- Get basic info
  SELECT role, name INTO v_role, v_name
  FROM profiles WHERE id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Get branch moderator assignments (FIXED: use branch_hid TEXT)
  SELECT jsonb_agg(
    jsonb_build_object(
      'branch_hid', bm.branch_hid,        -- Fixed from branch_root_id
      'branch_name', p.name,
      'assigned_at', bm.assigned_at,
      'notes', bm.notes
    )
  ) INTO v_branches
  FROM branch_moderators bm
  JOIN profiles p ON bm.branch_hid = p.hid  -- Fixed: HID-based join
  WHERE bm.user_id = p_user_id
    AND bm.is_active = true
    AND p.deleted_at IS NULL;

  -- Get block status (check if user is blocked from suggestions)
  SELECT reason, created_at INTO v_block_reason, v_blocked_at
  FROM suggestion_blocks
  WHERE blocked_user_id = p_user_id
    AND is_active = true
  LIMIT 1;

  -- Count editable profiles using check_family_permission_v4
  SELECT COUNT(*) INTO v_editable_count
  FROM profiles p
  WHERE check_family_permission_v4(p_user_id, p.id) IN ('inner', 'admin', 'moderator')
    AND p.deleted_at IS NULL;

  -- Count pending suggestions submitted by user
  SELECT COUNT(*) INTO v_pending_suggestions
  FROM profile_edit_suggestions
  WHERE submitter_id = p_user_id
    AND status = 'pending';

  -- Build result
  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'name', v_name,
    'role', COALESCE(v_role, 'user'),
    'is_super_admin', v_role = 'super_admin',
    'is_admin', v_role IN ('admin', 'super_admin'),
    'is_moderator', v_role = 'moderator',
    'is_branch_moderator', v_branches IS NOT NULL,
    'moderated_branches', COALESCE(v_branches, '[]'::jsonb),
    'is_blocked', v_block_reason IS NOT NULL,
    'block_reason', v_block_reason,
    'blocked_at', v_blocked_at,
    'total_editable_profiles', COALESCE(v_editable_count, 0),
    'pending_suggestions', COALESCE(v_pending_suggestions, 0)
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- STEP 2: Add server-side HID validation
-- =====================================================
-- Drop existing function versions first to avoid ambiguity
DROP FUNCTION IF EXISTS super_admin_assign_branch_moderator(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS super_admin_assign_branch_moderator(UUID, TEXT);
DROP FUNCTION IF EXISTS super_admin_assign_branch_moderator(UUID, UUID, TEXT);

-- Create new version with HID validation
CREATE OR REPLACE FUNCTION super_admin_assign_branch_moderator(
  p_user_id UUID,
  p_branch_hid TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_branch_name TEXT;
  v_moderator_id UUID;
BEGIN
  v_actor_id := auth.uid();

  -- Check caller is super_admin or admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor_id
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can assign branch moderators';
  END IF;

  -- Validate HID format (server-side validation)
  IF p_branch_hid IS NULL OR p_branch_hid = '' THEN
    RAISE EXCEPTION 'HID cannot be empty';
  END IF;

  IF p_branch_hid !~ '^\d+(\.\d+)*$' THEN
    RAISE EXCEPTION 'Invalid HID format: %. Must be numeric segments separated by dots (e.g., "1.2.3")', p_branch_hid;
  END IF;

  -- Verify HID exists in profiles
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE hid = p_branch_hid
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No profile found with HID: %', p_branch_hid;
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

-- =====================================================
-- STEP 3: Update super_admin_remove_branch_moderator
-- =====================================================
-- Drop existing function versions first to avoid ambiguity
DROP FUNCTION IF EXISTS super_admin_remove_branch_moderator(UUID, TEXT);
DROP FUNCTION IF EXISTS super_admin_remove_branch_moderator(UUID, UUID);

-- Create new version with HID
CREATE OR REPLACE FUNCTION super_admin_remove_branch_moderator(
  p_user_id UUID,
  p_branch_hid TEXT
) RETURNS JSONB AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_branch_name TEXT;
BEGIN
  v_actor_id := auth.uid();

  -- Check super_admin or admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor_id
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can remove branch moderators';
  END IF;

  -- Validate HID format
  IF p_branch_hid IS NULL OR p_branch_hid = '' THEN
    RAISE EXCEPTION 'HID cannot be empty';
  END IF;

  IF p_branch_hid !~ '^\d+(\.\d+)*$' THEN
    RAISE EXCEPTION 'Invalid HID format: %', p_branch_hid;
  END IF;

  -- Get names for logging
  SELECT name INTO v_user_name FROM profiles WHERE id = p_user_id;
  SELECT name INTO v_branch_name FROM profiles WHERE hid = p_branch_hid;

  -- Deactivate assignment
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
GRANT EXECUTE ON FUNCTION get_user_permissions_summary TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_assign_branch_moderator TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_remove_branch_moderator TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

SELECT '========================================' as separator;
SELECT '✅ MIGRATION 009 COMPLETE' as status;
SELECT '========================================' as separator;

-- Test get_user_permissions_summary
SELECT 'Testing get_user_permissions_summary...' as test;

-- Show function signature
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name IN (
  'get_user_permissions_summary',
  'super_admin_assign_branch_moderator',
  'super_admin_remove_branch_moderator'
)
ORDER BY routine_name;

SELECT '========================================' as separator;
SELECT '✅ ALL FUNCTIONS UPDATED' as final_status;
SELECT '========================================' as separator;
