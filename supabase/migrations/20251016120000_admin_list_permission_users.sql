-- Permission Manager: Optimized RPC for listing users with pagination and role filtering
-- Consolidates 4 separate queries into 1 efficient function
-- Includes photo_url, generation, professional_title, title_abbreviation for rich UI display
--
-- Migration: 20251016120000
-- Author: Claude Code
-- Purpose: Refactor Permission Manager for better UX and performance

CREATE OR REPLACE FUNCTION admin_list_permission_users(
  p_search_query TEXT DEFAULT NULL,
  p_role_filter TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  full_name_chain TEXT,
  phone TEXT,
  user_role TEXT,
  photo_url TEXT,
  generation INT,
  professional_title TEXT,
  title_abbreviation TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID;
  v_current_role TEXT;
  v_total_count BIGINT;
BEGIN
  -- Get current user's profile ID from auth.users.id
  SELECT p.id INTO v_current_user_id
  FROM profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;

  -- Get current user's role
  SELECT p.role INTO v_current_role
  FROM profiles p
  WHERE p.id = v_current_user_id;

  -- Permission check: Only super_admin and admin can access
  IF v_current_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Permission denied: Only admins can list users';
  END IF;

  -- Get total count for pagination (before LIMIT/OFFSET)
  -- Use subquery to avoid counting name_chain builds
  SELECT COUNT(*) INTO v_total_count
  FROM profiles p
  WHERE p.deleted_at IS NULL
    AND p.user_id IS NOT NULL  -- Only users with accounts
    AND (p_role_filter IS NULL OR p.role = p_role_filter)
    AND (
      p_search_query IS NULL
      OR p_search_query = ''
      OR LENGTH(TRIM(p_search_query)) < 2
      OR build_name_chain(p.id) ILIKE '%' || p_search_query || '%'
    );

  -- Return paginated results with all required fields
  RETURN QUERY
  SELECT
    p.id,
    p.hid,
    build_name_chain(p.id) AS full_name_chain,
    p.phone,
    COALESCE(p.role, 'user') AS user_role,
    p.photo_url,
    p.generation,
    p.professional_title,
    p.title_abbreviation,
    v_total_count AS total_count
  FROM profiles p
  WHERE p.deleted_at IS NULL
    AND p.user_id IS NOT NULL  -- Only users with accounts
    AND (p_role_filter IS NULL OR p.role = p_role_filter)
    AND (
      p_search_query IS NULL
      OR p_search_query = ''
      OR LENGTH(TRIM(p_search_query)) < 2
      OR build_name_chain(p.id) ILIKE '%' || p_search_query || '%'
    )
  ORDER BY
    -- Prioritize admins/moderators first
    CASE
      WHEN p.role = 'super_admin' THEN 1
      WHEN p.role = 'admin' THEN 2
      WHEN p.role = 'moderator' THEN 3
      ELSE 4
    END,
    -- Then by name
    p.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at_role ON profiles(deleted_at, role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- Grant execute permission to authenticated users (function handles its own permission checks)
GRANT EXECUTE ON FUNCTION admin_list_permission_users TO authenticated;

COMMENT ON FUNCTION admin_list_permission_users IS
'Permission Manager RPC: Lists users with pagination, role filtering, and search.
Returns photo_url, generation, professional_title, title_abbreviation for rich UI display.
Admin/super_admin only. Only returns profiles with linked user accounts (user_id IS NOT NULL).
Note: Uses explicit table aliases (p.id instead of id) to avoid ambiguous column references.';
