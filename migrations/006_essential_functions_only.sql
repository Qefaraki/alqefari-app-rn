-- Essential Functions from Migration 006 (No migrations table references)
-- Safe to deploy alongside migration 009

BEGIN;

-- ============================================================================
-- PART 1: Permission Check Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = p_user_id
    AND profiles.role = 'super_admin'
    AND profiles.deleted_at IS NULL
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

-- ============================================================================
-- PART 2: Search by Name Chain (THE FUNCTION WE NEED!)
-- ============================================================================

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
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
    AND profiles.deleted_at IS NULL
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
      WHERE sb.blocked_user_id = nc.id AND sb.is_active = true
    ) as is_blocked
  FROM name_chains nc
  WHERE nc.full_chain ILIKE '%' || p_search_text || '%'
  GROUP BY nc.id, nc.name, nc.role
  ORDER BY nc.name
  LIMIT 50;
END;
$$;

-- ============================================================================
-- PART 3: Role Management (SUPER ADMIN ONLY)
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
  SELECT profiles.role, profiles.name INTO v_old_role, v_target_name
  FROM profiles WHERE profiles.id = p_target_user_id;

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
      updated_at = NOW()
  WHERE profiles.id = p_target_user_id;

  -- Log to audit if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
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

-- ============================================================================
-- PART 4: Suggestion Blocking (ADMIN/SUPER ADMIN)
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
    WHERE profiles.id = v_actor_id
    AND profiles.role IN ('admin', 'super_admin')
    AND profiles.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Only admins can manage suggestion blocks';
  END IF;

  -- Get user name
  SELECT profiles.name INTO v_user_name
  FROM profiles WHERE profiles.id = p_user_id;

  IF v_user_name IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check current block status
  v_was_blocked := EXISTS(
    SELECT 1 FROM suggestion_blocks WHERE blocked_user_id = p_user_id AND is_active = true
  );

  IF p_block AND NOT v_was_blocked THEN
    -- Block user
    INSERT INTO suggestion_blocks (
      blocked_user_id,
      blocked_by,
      reason,
      is_active,
      created_at
    ) VALUES (
      p_user_id,
      v_actor_id,
      p_reason,
      true,
      NOW()
    );

    -- Log if audit_log exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
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
    END IF;

  ELSIF NOT p_block AND v_was_blocked THEN
    -- Unblock user
    UPDATE suggestion_blocks
    SET is_active = false
    WHERE blocked_user_id = p_user_id AND is_active = true;

    -- Log if audit_log exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
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
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_name', v_user_name,
    'is_blocked', p_block,
    'was_blocked', v_was_blocked
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_search_by_name_chain(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION super_admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_suggestion_block(UUID, BOOLEAN, TEXT) TO authenticated;

COMMIT;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================

SELECT '✅ Essential functions deployed successfully' as status;
SELECT '✅ super_admin_search_by_name_chain is now available' as search_status;
