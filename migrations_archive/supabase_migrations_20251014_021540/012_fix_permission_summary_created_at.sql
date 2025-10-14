-- Migration 012: Fix get_user_permissions_summary to use correct column name
--
-- ISSUE: Function tries to select "created_at" from suggestion_blocks
--        but the actual column name is "blocked_at" (from migration 007)
--
-- ERROR: column "created_at" does not exist in suggestion_blocks table

BEGIN;

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

  -- Get block status (FIXED: use blocked_at instead of created_at)
  SELECT reason, blocked_at INTO v_block_reason, v_blocked_at
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_permissions_summary(UUID) TO authenticated;

COMMIT;

SELECT '✅ Migration 012 completed successfully' as status;
SELECT '✅ get_user_permissions_summary now uses blocked_at column' as fix_status;
