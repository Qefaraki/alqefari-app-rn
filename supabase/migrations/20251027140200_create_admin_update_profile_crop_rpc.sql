-- Migration: Create atomic crop update RPC with comprehensive validation
-- Author: Claude Code
-- Date: 2025-10-27
-- Purpose: Update all 4 crop fields atomically with safety checks
-- Security: Permission check, version validation, edge case protection

-- ============================================================================
-- FUNCTION: admin_update_profile_crop
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_update_profile_crop(
  p_profile_id UUID,
  p_crop_top NUMERIC(4,3),
  p_crop_bottom NUMERIC(4,3),
  p_crop_left NUMERIC(4,3),
  p_crop_right NUMERIC(4,3),
  p_version INTEGER,
  p_user_id UUID,
  p_operation_group_id UUID DEFAULT NULL
)
RETURNS TABLE(new_version INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permission TEXT;
  v_photo_url TEXT;
  v_old_crop_top NUMERIC(4,3);
  v_old_crop_bottom NUMERIC(4,3);
  v_old_crop_left NUMERIC(4,3);
  v_old_crop_right NUMERIC(4,3);
  v_group_id UUID;
  v_updated_count INTEGER;
  v_crop_width NUMERIC(4,3);
  v_crop_height NUMERIC(4,3);
BEGIN
  -- ========================================
  -- VALIDATION 1: Check Permission
  -- ========================================

  SELECT permission INTO v_permission
  FROM check_family_permission_v4(p_user_id, p_profile_id);

  IF v_permission NOT IN ('admin', 'moderator', 'inner') THEN
    RAISE EXCEPTION 'Insufficient permissions to edit crop (permission: %)', v_permission;
  END IF;

  -- ========================================
  -- VALIDATION 2: Check Profile Exists & Get Photo URL
  -- ========================================

  SELECT photo_url, crop_top, crop_bottom, crop_left, crop_right
  INTO v_photo_url, v_old_crop_top, v_old_crop_bottom, v_old_crop_left, v_old_crop_right
  FROM profiles
  WHERE id = p_profile_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or deleted: %', p_profile_id;
  END IF;

  -- ========================================
  -- VALIDATION 3: Check Photo URL Exists (NEW FIX)
  -- ========================================

  IF v_photo_url IS NULL OR v_photo_url = '' THEN
    RAISE EXCEPTION 'Cannot crop profile without photo (photo_url is null)';
  END IF;

  -- ========================================
  -- VALIDATION 4: Range Validation (0.0-1.0)
  -- ========================================

  IF p_crop_top < 0.0 OR p_crop_top > 1.0 THEN
    RAISE EXCEPTION 'crop_top must be between 0.0 and 1.0, got %', p_crop_top;
  END IF;
  IF p_crop_bottom < 0.0 OR p_crop_bottom > 1.0 THEN
    RAISE EXCEPTION 'crop_bottom must be between 0.0 and 1.0, got %', p_crop_bottom;
  END IF;
  IF p_crop_left < 0.0 OR p_crop_left > 1.0 THEN
    RAISE EXCEPTION 'crop_left must be between 0.0 and 1.0, got %', p_crop_left;
  END IF;
  IF p_crop_right < 0.0 OR p_crop_right > 1.0 THEN
    RAISE EXCEPTION 'crop_right must be between 0.0 and 1.0, got %', p_crop_right;
  END IF;

  -- ========================================
  -- VALIDATION 5: Bounds Validation (NEW FIX)
  -- ========================================

  -- Check horizontal crop doesn't exceed image bounds
  IF (p_crop_left + p_crop_right) >= 1.0 THEN
    RAISE EXCEPTION 'Horizontal crop (left % + right % = %) must be < 1.0',
      p_crop_left, p_crop_right, (p_crop_left + p_crop_right);
  END IF;

  -- Check vertical crop doesn't exceed image bounds
  IF (p_crop_top + p_crop_bottom) >= 1.0 THEN
    RAISE EXCEPTION 'Vertical crop (top % + bottom % = %) must be < 1.0',
      p_crop_top, p_crop_bottom, (p_crop_top + p_crop_bottom);
  END IF;

  -- ========================================
  -- VALIDATION 6: Minimum Crop Area (NEW FIX)
  -- ========================================

  -- Calculate remaining visible area (must be >= 10%)
  v_crop_width := 1.0 - p_crop_left - p_crop_right;
  v_crop_height := 1.0 - p_crop_top - p_crop_bottom;

  IF v_crop_width < 0.1 THEN
    RAISE EXCEPTION 'Crop area too narrow (% visible, min 10%% required)',
      (v_crop_width * 100);
  END IF;

  IF v_crop_height < 0.1 THEN
    RAISE EXCEPTION 'Crop area too short (% visible, min 10%% required)',
      (v_crop_height * 100);
  END IF;

  -- ========================================
  -- UPDATE: Atomic Update with Version Check
  -- ========================================

  UPDATE profiles SET
    crop_top = p_crop_top,
    crop_bottom = p_crop_bottom,
    crop_left = p_crop_left,
    crop_right = p_crop_right,
    version = version + 1,
    updated_at = NOW()
  WHERE id = p_profile_id
    AND version = p_version
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Version conflict: expected version %, profile %', p_version, p_profile_id;
  END IF;

  -- ========================================
  -- ACTIVITY LOG: Undo System Integration
  -- ========================================

  -- Generate or use provided operation group ID (ONE UUID for all 4 fields)
  v_group_id := COALESCE(p_operation_group_id, gen_random_uuid());

  -- Insert 4 activity log entries with SAME operation_group_id
  -- This ensures undo reverts all 4 fields atomically
  INSERT INTO activity_log (
    user_id,
    profile_id,
    action_type,
    field_name,
    old_value,
    new_value,
    operation_group_id
  ) VALUES
    (p_user_id, p_profile_id, 'profile_update', 'crop_top', v_old_crop_top::TEXT, p_crop_top::TEXT, v_group_id),
    (p_user_id, p_profile_id, 'profile_update', 'crop_bottom', v_old_crop_bottom::TEXT, p_crop_bottom::TEXT, v_group_id),
    (p_user_id, p_profile_id, 'profile_update', 'crop_left', v_old_crop_left::TEXT, p_crop_left::TEXT, v_group_id),
    (p_user_id, p_profile_id, 'profile_update', 'crop_right', v_old_crop_right::TEXT, p_crop_right::TEXT, v_group_id);

  -- ========================================
  -- RETURN: New Version Number
  -- ========================================

  RETURN QUERY SELECT (p_version + 1)::INTEGER;
END;
$$;

-- ============================================================================
-- PERMISSIONS: Grant execute to authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION admin_update_profile_crop TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION admin_update_profile_crop IS
  'Atomically update all 4 crop fields with comprehensive validation: permission check, photo_url null check, range/bounds validation, minimum crop area (10%), version conflict prevention, undo system integration.';

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Example 1: Crop photo (25% from top, 10% from bottom, 5% from sides)
-- SELECT * FROM admin_update_profile_crop(
--   p_profile_id := 'abc-123',
--   p_crop_top := 0.25,
--   p_crop_bottom := 0.10,
--   p_crop_left := 0.05,
--   p_crop_right := 0.05,
--   p_version := 5,
--   p_user_id := 'user-456'
-- );
-- Returns: {new_version: 6}

-- Example 2: Reset crop to full image
-- SELECT * FROM admin_update_profile_crop(
--   p_profile_id := 'abc-123',
--   p_crop_top := 0.0,
--   p_crop_bottom := 0.0,
--   p_crop_left := 0.0,
--   p_crop_right := 0.0,
--   p_version := 6,
--   p_user_id := 'user-456'
-- );

-- ============================================================================
-- ERROR SCENARIOS
-- ============================================================================

-- Error 1: Photo URL is null
-- ERROR: Cannot crop profile without photo (photo_url is null)

-- Error 2: Crop exceeds bounds
-- ERROR: Horizontal crop (left 0.6 + right 0.5 = 1.1) must be < 1.0

-- Error 3: Crop area too small
-- ERROR: Crop area too narrow (8% visible, min 10% required)

-- Error 4: Version conflict
-- ERROR: Version conflict: expected version 5, profile abc-123

-- Error 5: Permission denied
-- ERROR: Insufficient permissions to edit crop (permission: suggest)
