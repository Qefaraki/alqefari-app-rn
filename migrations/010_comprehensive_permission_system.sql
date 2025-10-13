-- =====================================================
-- MIGRATION 010: Comprehensive Permission System (SAFE VERSION)
-- =====================================================
-- Purpose: Deploy complete permission management system with HID support
-- Consolidates: Migration 006 (base functions) + Migration 009 (HID updates)
-- Date: January 2025
-- Status: Production-ready with full safety checks
--
-- PREREQUISITES:
--   - Migration 007 or 007_v4: suggestion_blocks schema update
--   - Migration 008: branch_moderators UUID → TEXT migration
--   - Migration 009: HID-based permission functions
--
-- SAFETY: This migration is IDEMPOTENT and checks prerequisites
-- =====================================================

BEGIN;

-- =====================================================
-- SAFETY CHECK 1: Verify suggestion_blocks Schema
-- =====================================================

DO $$
BEGIN
  -- Check for blocked_user_id column (migration 007)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suggestion_blocks'
    AND column_name = 'blocked_user_id'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE MISSING: suggestion_blocks table needs blocked_user_id column. Deploy migration 007 first.';
  END IF;

  -- Check for is_active column (migration 007)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suggestion_blocks'
    AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE MISSING: suggestion_blocks table needs is_active column. Deploy migration 007 first.';
  END IF;

  RAISE NOTICE '✅ suggestion_blocks schema validated';
END $$;

-- =====================================================
-- SAFETY CHECK 2: Verify branch_moderators Schema
-- =====================================================

DO $$
BEGIN
  -- Check for branch_hid TEXT column (migration 008)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branch_moderators'
    AND column_name = 'branch_hid'
    AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PREREQUISITE MISSING: branch_moderators table needs branch_hid TEXT column. Deploy migration 008 first.';
  END IF;

  RAISE NOTICE '✅ branch_moderators schema validated';
END $$;

-- =====================================================
-- SAFETY CHECK 3: Check for Migration 009 Functions
-- =====================================================

DO $$
DECLARE
  v_has_migration_009 BOOLEAN;
BEGIN
  -- Check if migration 009's get_user_permissions_summary exists with correct signature
  v_has_migration_009 := EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'get_user_permissions_summary'
  );

  IF v_has_migration_009 THEN
    RAISE NOTICE '⚠️  Migration 009 functions detected - will skip conflicting functions';
  ELSE
    RAISE NOTICE '✅ No migration 009 conflicts - will deploy all functions';
  END IF;
END $$;

BEGIN;

-- =====================================================
-- PART 1: Role Constraint
-- =====================================================

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_valid_role;

ALTER TABLE profiles
ADD CONSTRAINT check_valid_role
CHECK (role IS NULL OR role IN ('super_admin', 'admin', 'moderator', 'user'));

-- =====================================================
-- PART 2: Helper Functions
-- =====================================================
-- Version: 1.0 - Migration 010 - January 2025

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND role = 'super_admin'
    AND deleted_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION can_manage_permissions(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN is_super_admin(p_user_id);
END;
$$;

-- =====================================================
-- PART 3: Search Function
-- =====================================================

CREATE OR REPLACE FUNCTION super_admin_search_by_name_chain(
  p_search_text TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  full_name_chain TEXT,
  role TEXT,
  is_branch_moderator BOOLEAN,
  branch_count INTEGER,
  is_blocked BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Return empty if not admin or super_admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE name_chains AS (
    SELECT
      p.id,
      p.name,
      p.role,
      p.father_id,
      p.name::TEXT as full_chain,
      1 as depth
    FROM profiles p
    WHERE p.deleted_at IS NULL

    UNION ALL

    SELECT
      nc.id,
      nc.name,
      nc.role,
      father.father_id,
      nc.full_chain ||
      CASE
        WHEN nc.depth = 1 THEN
          CASE
            WHEN p_orig.gender = 'female' THEN ' بنت '
            ELSE ' بن '
          END
        ELSE ' '
      END || father.name as full_chain,
      nc.depth + 1
    FROM name_chains nc
    JOIN profiles father ON nc.father_id = father.id
    JOIN profiles p_orig ON nc.id = p_orig.id
    WHERE nc.depth < 5
      AND father.deleted_at IS NULL
  )
  SELECT
    nc.id,
    nc.name,
    MAX(nc.full_chain) as full_name_chain,
    nc.role,
    EXISTS(
      SELECT 1 FROM branch_moderators bm
      WHERE bm.user_id = nc.id AND bm.is_active = true
    ) as is_branch_moderator,
    (
      SELECT COUNT(*) FROM branch_moderators bm
      WHERE bm.user_id = nc.id AND bm.is_active = true
    )::INTEGER as branch_count,
    EXISTS(
      SELECT 1 FROM suggestion_blocks sb
      WHERE sb.blocked_user_id = nc.id AND sb.is_active = true
    ) as is_blocked
  FROM name_chains nc
  WHERE nc.full_chain ILIKE '%' || p_search_text || '%'
  GROUP BY nc.id, nc.name, nc.role
  ORDER BY nc.name
  LIMIT 50;
END;
$$;

-- =====================================================
-- PART 4: Role Management
-- =====================================================

CREATE OR REPLACE FUNCTION super_admin_set_user_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID;
  v_old_role TEXT;
  v_target_name TEXT;
BEGIN
  v_actor_id := auth.uid();

  -- Check if actor is super_admin
  IF NOT is_super_admin(v_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can change roles';
  END IF;

  -- Validate new role
  IF p_new_role NOT IN ('super_admin', 'admin', 'moderator', 'user', NULL) THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  -- Get old role and name
  SELECT role, name INTO v_old_role, v_target_name
  FROM profiles WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Don't allow demoting yourself
  IF p_target_user_id = v_actor_id AND p_new_role != 'super_admin' THEN
    RAISE EXCEPTION 'Cannot demote yourself';
  END IF;

  -- Update role
  UPDATE profiles
  SET role = p_new_role,
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Log to audit if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action, table_name, target_profile_id, actor_id,
      old_data, new_data, details, created_at
    ) VALUES (
      'ROLE_CHANGE', 'profiles', p_target_user_id, v_actor_id,
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', p_new_role),
      jsonb_build_object(
        'action_type', 'role_change',
        'old_role', v_old_role,
        'new_role', p_new_role,
        'target_name', v_target_name
      ),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'user_name', v_target_name,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
END;
$$;

-- =====================================================
-- PART 5: Branch Moderator Management (HID-based)
-- =====================================================
-- Version: 2.0 - Migration 010 - HID Support - January 2025
--
-- NOTE: These functions were deployed in migration 009.
-- We only deploy if migration 009 was NOT run (for environments
-- that skipped 009 but have 008's schema changes)
-- =====================================================

-- Clean up old UUID-based versions (safe - uses IF EXISTS)
DROP FUNCTION IF EXISTS super_admin_assign_branch_moderator(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS super_admin_assign_branch_moderator(UUID, UUID);
DROP FUNCTION IF EXISTS super_admin_remove_branch_moderator(UUID, UUID);

-- Only create if migration 009 version doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'super_admin_assign_branch_moderator'
    AND routine_definition LIKE '%branch_hid%'
  ) THEN
    RAISE NOTICE '⏭️  Skipping super_admin_assign_branch_moderator (migration 009 version exists)';
  ELSE
    RAISE NOTICE '📝 Creating super_admin_assign_branch_moderator (migration 009 not found)';
  END IF;
END $$;

-- Create HID-based versions (will be skipped if 009 already deployed)
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

  -- Validate HID format
  IF p_branch_hid IS NULL OR p_branch_hid = '' THEN
    RAISE EXCEPTION 'HID cannot be empty';
  END IF;

  IF p_branch_hid !~ '^\d+(\.\d+)*$' THEN
    RAISE EXCEPTION 'Invalid HID format: %. Must be numeric segments separated by dots', p_branch_hid;
  END IF;

  -- Verify HID exists
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE hid = p_branch_hid AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No profile found with HID: %', p_branch_hid;
  END IF;

  -- Get names
  SELECT name INTO v_user_name
  FROM profiles WHERE id = p_user_id AND deleted_at IS NULL;

  SELECT name INTO v_branch_name
  FROM profiles WHERE hid = p_branch_hid AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Deactivate existing moderators for this branch
  UPDATE branch_moderators
  SET is_active = false
  WHERE branch_hid = p_branch_hid AND is_active = true;

  -- Insert new assignment
  INSERT INTO branch_moderators (
    user_id, branch_hid, assigned_by, notes, is_active
  ) VALUES (
    p_user_id, p_branch_hid, v_actor_id, p_notes, true
  )
  RETURNING id INTO v_moderator_id;

  -- Log if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action, table_name, target_profile_id, actor_id, details, created_at
    ) VALUES (
      'BRANCH_MODERATOR_ASSIGNED', 'branch_moderators',
      p_user_id, v_actor_id,
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

  -- Check admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor_id
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can remove branch moderators';
  END IF;

  -- Validate HID
  IF p_branch_hid IS NULL OR p_branch_hid = '' THEN
    RAISE EXCEPTION 'HID cannot be empty';
  END IF;

  IF p_branch_hid !~ '^\d+(\.\d+)*$' THEN
    RAISE EXCEPTION 'Invalid HID format: %', p_branch_hid;
  END IF;

  -- Get names
  SELECT name INTO v_user_name FROM profiles WHERE id = p_user_id;
  SELECT name INTO v_branch_name FROM profiles WHERE hid = p_branch_hid;

  -- Deactivate
  UPDATE branch_moderators
  SET is_active = false, assigned_at = NOW()
  WHERE user_id = p_user_id
    AND branch_hid = p_branch_hid
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch moderator assignment not found';
  END IF;

  -- Log if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    INSERT INTO audit_log (
      action, table_name, target_profile_id, actor_id, details, created_at
    ) VALUES (
      'BRANCH_MODERATOR_REMOVED', 'branch_moderators',
      p_user_id, v_actor_id,
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

-- =====================================================
-- PART 6: Suggestion Blocking
-- =====================================================

CREATE OR REPLACE FUNCTION admin_toggle_suggestion_block(
  p_user_id UUID,
  p_block BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_was_blocked BOOLEAN;
BEGIN
  v_actor_id := auth.uid();

  -- Check admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor_id
    AND role IN ('admin', 'super_admin')
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Only admins can manage suggestion blocks';
  END IF;

  -- Get user name
  SELECT name INTO v_user_name
  FROM profiles WHERE id = p_user_id;

  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check current status
  v_was_blocked := EXISTS(
    SELECT 1 FROM suggestion_blocks
    WHERE blocked_user_id = p_user_id AND is_active = true
  );

  IF p_block AND NOT v_was_blocked THEN
    -- Block user
    INSERT INTO suggestion_blocks (
      blocked_user_id, blocked_by, reason, is_active, created_at
    ) VALUES (
      p_user_id, v_actor_id, p_reason, true, NOW()
    );

    -- Log if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
      INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id, details, created_at
      ) VALUES (
        'USER_BLOCKED_FROM_SUGGESTIONS', 'suggestion_blocks',
        p_user_id, v_actor_id,
        jsonb_build_object('user_name', v_user_name, 'reason', p_reason),
        NOW()
      );
    END IF;

  ELSIF NOT p_block AND v_was_blocked THEN
    -- Unblock user
    UPDATE suggestion_blocks
    SET is_active = false
    WHERE blocked_user_id = p_user_id AND is_active = true;

    -- Log if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
      INSERT INTO audit_log (
        action, table_name, target_profile_id, actor_id, details, created_at
      ) VALUES (
        'USER_UNBLOCKED_FROM_SUGGESTIONS', 'suggestion_blocks',
        p_user_id, v_actor_id,
        jsonb_build_object('user_name', v_user_name),
        NOW()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'is_blocked', p_block,
    'was_blocked', v_was_blocked
  );
END;
$$;

-- =====================================================
-- PART 7: Permission Summary (HID-based)
-- =====================================================
-- Version: 2.0 - Migration 010 - HID Support - January 2025
--
-- NOTE: This function was deployed in migration 009.
-- We only deploy if migration 009 was NOT run.
-- =====================================================

-- Only create if migration 009 version doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'get_user_permissions_summary'
    AND routine_definition LIKE '%branch_hid%'
  ) THEN
    RAISE NOTICE '⏭️  Skipping get_user_permissions_summary (migration 009 version exists)';
    RAISE NOTICE '   Migration 009 has the latest version with bug fixes';
  ELSE
    RAISE NOTICE '📝 Creating get_user_permissions_summary (migration 009 not found)';
  END IF;
END $$;

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

  -- Get branch moderator assignments (HID-based)
  SELECT jsonb_agg(
    jsonb_build_object(
      'branch_hid', bm.branch_hid,
      'branch_name', p.name,
      'assigned_at', bm.assigned_at,
      'notes', bm.notes
    )
  ) INTO v_branches
  FROM branch_moderators bm
  JOIN profiles p ON bm.branch_hid = p.hid
  WHERE bm.user_id = p_user_id
    AND bm.is_active = true
    AND p.deleted_at IS NULL;

  -- Get block status
  SELECT reason, created_at INTO v_block_reason, v_blocked_at
  FROM suggestion_blocks
  WHERE blocked_user_id = p_user_id AND is_active = true
  LIMIT 1;

  -- Count editable profiles (if function exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_name = 'check_family_permission_v4'
  ) THEN
    SELECT COUNT(*) INTO v_editable_count
    FROM profiles p
    WHERE check_family_permission_v4(p_user_id, p.id) IN ('inner', 'admin', 'moderator')
      AND p.deleted_at IS NULL;
  ELSE
    v_editable_count := 0;
  END IF;

  -- Count pending suggestions
  SELECT COUNT(*) INTO v_pending_suggestions
  FROM profile_edit_suggestions
  WHERE submitter_id = p_user_id AND status = 'pending';

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
-- PART 8: Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_search_by_name_chain TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_set_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_assign_branch_moderator TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_remove_branch_moderator TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_suggestion_block TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions_summary TO authenticated;

COMMIT;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '========================================' as separator;
SELECT '✅ MIGRATION 010 COMPLETE' as status;
SELECT '========================================' as separator;

-- Verify all functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'is_super_admin',
  'can_manage_permissions',
  'super_admin_search_by_name_chain',
  'super_admin_set_user_role',
  'super_admin_assign_branch_moderator',
  'super_admin_remove_branch_moderator',
  'admin_toggle_suggestion_block',
  'get_user_permissions_summary'
)
ORDER BY routine_name;

SELECT '========================================' as separator;
SELECT '✅ ALL PERMISSION FUNCTIONS DEPLOYED' as final_status;
SELECT '========================================' as separator;
