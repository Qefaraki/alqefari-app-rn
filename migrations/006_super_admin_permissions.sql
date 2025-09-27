-- Migration: Super Admin Role and Permission Management
-- This adds a super admin role that can manage other admins and permissions

-- ============================================================================
-- PART 1: ADD SUPER ADMIN ROLE
-- ============================================================================

-- Update role constraint to include super_admin
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_valid_role;

ALTER TABLE profiles
ADD CONSTRAINT check_valid_role
CHECK (role IS NULL OR role IN ('super_admin', 'admin', 'moderator', 'user'));

-- ============================================================================
-- PART 2: PERMISSION CHECK FUNCTIONS
-- ============================================================================

-- Function to check if user is super admin
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

-- Function to check if user can manage permissions
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

-- ============================================================================
-- PART 3: SEARCH BY NAME CHAIN
-- ============================================================================

CREATE OR REPLACE FUNCTION search_profiles_by_name_chain(
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
      -- Start with just the person's name
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
      -- Build the chain with بن/بنت
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
    WHERE nc.depth < 5  -- Limit ancestry depth
      AND father.deleted_at IS NULL
  )
  SELECT
    nc.id,
    nc.name,
    MAX(nc.full_chain) as full_name_chain,  -- Get the longest chain
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
      WHERE sb.user_id = nc.id
    ) as is_blocked
  FROM name_chains nc
  WHERE nc.full_chain ILIKE '%' || p_search_text || '%'
  GROUP BY nc.id, nc.name, nc.role
  ORDER BY nc.name
  LIMIT 50;
END;
$$;

-- ============================================================================
-- PART 4: ROLE MANAGEMENT FUNCTIONS (SUPER ADMIN ONLY)
-- ============================================================================

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
  -- Get actor
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

  -- Log to audit
  INSERT INTO audit_log (
    action,
    table_name,
    target_profile_id,
    actor_id,
    old_data,
    new_data,
    details,
    created_at
  ) VALUES (
    'ROLE_CHANGE',
    'profiles',
    p_target_user_id,
    v_actor_id,
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

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'user_name', v_target_name,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
END;
$$;

-- ============================================================================
-- PART 5: BRANCH MODERATOR MANAGEMENT (SUPER ADMIN ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION super_admin_assign_branch_moderator(
  p_user_id UUID,
  p_branch_root_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_branch_name TEXT;
  v_moderator_id UUID;
BEGIN
  v_actor_id := auth.uid();

  -- Check super_admin
  IF NOT is_super_admin(v_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can assign branch moderators';
  END IF;

  -- Get user and branch names for logging
  SELECT name INTO v_user_name
  FROM profiles WHERE id = p_user_id AND deleted_at IS NULL;

  SELECT name INTO v_branch_name
  FROM profiles WHERE id = p_branch_root_id AND deleted_at IS NULL;

  IF v_user_name IS NULL OR v_branch_name IS NULL THEN
    RAISE EXCEPTION 'User or branch not found';
  END IF;

  -- Insert or update
  INSERT INTO branch_moderators (
    user_id,
    branch_root_id,
    assigned_by,
    notes,
    is_active
  ) VALUES (
    p_user_id,
    p_branch_root_id,
    v_actor_id,
    p_notes,
    true
  )
  ON CONFLICT (user_id, branch_root_id)
  DO UPDATE SET
    is_active = true,
    assigned_by = v_actor_id,
    assigned_at = NOW(),
    notes = p_notes
  RETURNING id INTO v_moderator_id;

  -- Log
  INSERT INTO audit_log (
    action,
    table_name,
    target_profile_id,
    actor_id,
    details,
    created_at
  ) VALUES (
    'BRANCH_MODERATOR_ASSIGNED',
    'branch_moderators',
    p_user_id,
    v_actor_id,
    jsonb_build_object(
      'moderator_assignment_id', v_moderator_id,
      'user_name', v_user_name,
      'branch_root_id', p_branch_root_id,
      'branch_name', v_branch_name,
      'notes', p_notes
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'moderator_id', v_moderator_id,
    'user_name', v_user_name,
    'branch_name', v_branch_name
  );
END;
$$;

-- Function to remove branch moderator
CREATE OR REPLACE FUNCTION super_admin_remove_branch_moderator(
  p_user_id UUID,
  p_branch_root_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id UUID;
  v_user_name TEXT;
  v_branch_name TEXT;
BEGIN
  v_actor_id := auth.uid();

  -- Check super_admin
  IF NOT is_super_admin(v_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can remove branch moderators';
  END IF;

  -- Get names for logging
  SELECT name INTO v_user_name FROM profiles WHERE id = p_user_id;
  SELECT name INTO v_branch_name FROM profiles WHERE id = p_branch_root_id;

  -- Deactivate
  UPDATE branch_moderators
  SET is_active = false,
      assigned_at = NOW()
  WHERE user_id = p_user_id
    AND branch_root_id = p_branch_root_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch moderator assignment not found';
  END IF;

  -- Log
  INSERT INTO audit_log (
    action,
    table_name,
    target_profile_id,
    actor_id,
    details,
    created_at
  ) VALUES (
    'BRANCH_MODERATOR_REMOVED',
    'branch_moderators',
    p_user_id,
    v_actor_id,
    jsonb_build_object(
      'user_name', v_user_name,
      'branch_name', v_branch_name
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'branch_name', v_branch_name
  );
END;
$$;

-- ============================================================================
-- PART 6: SUGGESTION BLOCKING (SUPER ADMIN/ADMIN)
-- ============================================================================

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

  -- Check if admin or super_admin
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

  -- Check current block status
  v_was_blocked := EXISTS(
    SELECT 1 FROM suggestion_blocks WHERE user_id = p_user_id
  );

  IF p_block AND NOT v_was_blocked THEN
    -- Block user
    INSERT INTO suggestion_blocks (
      user_id,
      blocked_by,
      reason,
      created_at
    ) VALUES (
      p_user_id,
      v_actor_id,
      p_reason,
      NOW()
    );

    -- Log
    INSERT INTO audit_log (
      action, table_name, target_profile_id,
      actor_id, details, created_at
    ) VALUES (
      'USER_BLOCKED_FROM_SUGGESTIONS',
      'suggestion_blocks',
      p_user_id,
      v_actor_id,
      jsonb_build_object(
        'user_name', v_user_name,
        'reason', p_reason
      ),
      NOW()
    );

  ELSIF NOT p_block AND v_was_blocked THEN
    -- Unblock user
    DELETE FROM suggestion_blocks
    WHERE user_id = p_user_id;

    -- Log
    INSERT INTO audit_log (
      action, table_name, target_profile_id,
      actor_id, details, created_at
    ) VALUES (
      'USER_UNBLOCKED_FROM_SUGGESTIONS',
      'suggestion_blocks',
      p_user_id,
      v_actor_id,
      jsonb_build_object('user_name', v_user_name),
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'is_blocked', p_block,
    'was_blocked', v_was_blocked
  );
END;
$$;

-- ============================================================================
-- PART 7: GET USER PERMISSIONS SUMMARY
-- ============================================================================

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
BEGIN
  -- Get basic info
  SELECT role, name INTO v_role, v_name
  FROM profiles WHERE id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Get branch moderator assignments
  SELECT jsonb_agg(
    jsonb_build_object(
      'branch_id', bm.branch_root_id,
      'branch_name', p.name,
      'assigned_at', bm.assigned_at,
      'notes', bm.notes
    )
  ) INTO v_branches
  FROM branch_moderators bm
  JOIN profiles p ON bm.branch_root_id = p.id
  WHERE bm.user_id = p_user_id
    AND bm.is_active = true;

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
    'is_blocked_from_suggestions', EXISTS(
      SELECT 1 FROM suggestion_blocks WHERE user_id = p_user_id
    ),
    'can_edit_count', (
      SELECT COUNT(*)
      FROM profiles p2
      WHERE can_user_edit_profile(p_user_id, p2.id) = 'full'
        AND p2.deleted_at IS NULL
    )
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- PART 8: UPDATE RLS POLICIES
-- ============================================================================

-- Policy for branch_moderators table (view only for non-super-admins)
DROP POLICY IF EXISTS "Admins manage moderators" ON branch_moderators;

CREATE POLICY "Super admins manage moderators" ON branch_moderators
  FOR ALL USING (
    is_super_admin(auth.uid())
  );

-- Policy for suggestion_blocks (admins and super admins can manage)
DROP POLICY IF EXISTS "Admins manage blocks" ON suggestion_blocks;

CREATE POLICY "Admins manage blocks" ON suggestion_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND deleted_at IS NULL
    )
  );

-- ============================================================================
-- PART 9: GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_profiles_by_name_chain(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_assign_branch_moderator(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_remove_branch_moderator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_suggestion_block(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions_summary(UUID) TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================