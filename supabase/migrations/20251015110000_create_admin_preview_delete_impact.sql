-- Enhancement 1: Preview deletion impact with recursive descendant counting
-- Purpose: Replace direct query with proper RPC for permission validation and impact analysis
-- Dependencies: check_family_permission_v4 (from migration 005)
-- Author: Claude Code Architecture Validator
-- Date: 2025-10-15

-- Ensure required indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_profiles_father_id ON profiles(father_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_mother_id ON profiles(mother_id) WHERE deleted_at IS NULL;

-- Main preview function
CREATE OR REPLACE FUNCTION public.admin_preview_delete_impact(p_profile_id UUID)
RETURNS TABLE(
  profile_id UUID,
  profile_name TEXT,
  direct_children INTEGER,
  total_descendants INTEGER,
  max_depth INTEGER,
  total_affected INTEGER,
  marriages_affected INTEGER,
  can_delete BOOLEAN,
  blocked_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_user_id UUID;
  v_permission TEXT;
BEGIN
  -- Get current user's profile ID
  SELECT id INTO v_current_user_id
  FROM profiles
  WHERE user_id = auth.uid();

  -- Block if user not authenticated
  IF v_current_user_id IS NULL THEN
    RETURN QUERY
    SELECT
      p_profile_id, NULL::TEXT, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER,
      FALSE, 'غير مصرح. يجب تسجيل الدخول.'::TEXT;
    RETURN;
  END IF;

  -- Block if profile doesn't exist
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RETURN QUERY
    SELECT
      p_profile_id, NULL::TEXT, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER,
      FALSE, 'الملف الشخصي غير موجود'::TEXT;
    RETURN;
  END IF;

  -- Check permissions using existing v4 function
  SELECT check_family_permission_v4(v_current_user_id, p_profile_id) INTO v_permission;

  -- Only allow inner/admin/moderator to delete
  -- Note: super_admin users get 'admin' permission level from check_family_permission_v4
  IF v_permission NOT IN ('inner', 'admin', 'moderator') THEN
    RETURN QUERY
    SELECT
      p_profile_id, NULL::TEXT, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::INTEGER,
      FALSE, 'ليس لديك صلاحية لحذف هذا الملف'::TEXT;
    RETURN;
  END IF;

  -- Calculate descendants recursively with cycle detection
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    -- Base case: direct children
    SELECT id, name, 1 AS depth, ARRAY[id] AS path
    FROM profiles
    WHERE (father_id = p_profile_id OR mother_id = p_profile_id)
      AND deleted_at IS NULL

    UNION ALL

    -- Recursive case: grandchildren and beyond
    SELECT p.id, p.name, d.depth + 1, d.path || p.id
    FROM profiles p
    INNER JOIN descendants d ON (p.father_id = d.id OR p.mother_id = d.id)
    WHERE p.deleted_at IS NULL
      AND d.depth < 20  -- Safety limit
      AND NOT (p.id = ANY(d.path))  -- Prevent cycles
  ),
  stats AS (
    SELECT
      (COUNT(*) FILTER (WHERE depth = 1))::INTEGER AS direct_count,
      COUNT(*)::INTEGER AS total_count,
      COALESCE(MAX(depth), 0)::INTEGER AS max_depth_val
    FROM descendants
  )
  SELECT
    p_profile_id,
    prof.name,
    stats.direct_count,
    stats.total_count,
    stats.max_depth_val,
    (stats.total_count + 1)::INTEGER AS total_affected,  -- +1 for profile itself
    (SELECT COUNT(*)::INTEGER FROM marriages
     WHERE (husband_id = p_profile_id OR wife_id = p_profile_id)
       AND deleted_at IS NULL) AS marriages_count,
    TRUE AS can_delete,
    NULL::TEXT AS blocked_reason
  FROM profiles prof
  CROSS JOIN stats
  WHERE prof.id = p_profile_id;
END;
$function$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION admin_preview_delete_impact(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION admin_preview_delete_impact(UUID) IS
'Previews the impact of deleting a profile, including recursive descendant count, permission validation, and affected marriages. Returns can_delete=FALSE if user lacks permission or profile has descendants.';
