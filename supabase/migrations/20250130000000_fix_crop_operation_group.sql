-- Migration: Fix admin_update_profile_crop to create operation_group record
-- Author: Claude Code
-- Date: 2025-01-30
-- Purpose: Fix foreign key constraint violation - create operation_group before audit log
-- Issue: RPC generates operation_group_id but doesn't INSERT into operation_groups table
-- Solution: Create operation_group record with proper fields before audit_log_enhanced insert

-- ============================================================================
-- FUNCTION: admin_update_profile_crop (Fixed Operation Group Creation)
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

  v_permission := check_family_permission_v4(p_user_id, p_profile_id);

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
  -- VALIDATION 3: Check Photo URL Exists
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
  -- VALIDATION 5: Bounds Validation
  -- ========================================

  IF (p_crop_left + p_crop_right) >= 1.0 THEN
    RAISE EXCEPTION 'Horizontal crop (left % + right % = %) must be < 1.0',
      p_crop_left, p_crop_right, (p_crop_left + p_crop_right);
  END IF;

  IF (p_crop_top + p_crop_bottom) >= 1.0 THEN
    RAISE EXCEPTION 'Vertical crop (top % + bottom % = %) must be < 1.0',
      p_crop_top, p_crop_bottom, (p_crop_top + p_crop_bottom);
  END IF;

  -- ========================================
  -- VALIDATION 6: Minimum Crop Area
  -- ========================================

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
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = p_profile_id
    AND version = p_version
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Version conflict: expected version %, profile %', p_version, p_profile_id;
  END IF;

  -- ========================================
  -- OPERATION GROUP: Create Record BEFORE Audit Log (FIX)
  -- ========================================

  -- Generate or use provided operation group ID
  v_group_id := COALESCE(p_operation_group_id, gen_random_uuid());

  -- ✅ FIX: Create operation_group record to satisfy FK constraint
  INSERT INTO operation_groups (
    id,
    created_by,
    group_type,
    operation_count,
    description
  ) VALUES (
    v_group_id,
    p_user_id,  -- FK: profiles.id
    'crop_update',
    1,  -- Single crop operation
    'تحديث قص الصورة'  -- "Update photo crop" in Arabic
  )
  ON CONFLICT (id) DO NOTHING;  -- Idempotent if called with existing group_id

  -- ========================================
  -- ACTIVITY LOG: Undo System Integration
  -- ========================================

  INSERT INTO audit_log_enhanced (
    table_name,
    record_id,
    action_type,
    actor_id,
    old_data,
    new_data,
    changed_fields,
    description,
    severity,
    is_undoable,
    operation_group_id
  ) VALUES (
    'profiles',
    p_profile_id,
    'crop_update',
    auth.uid(),
    jsonb_build_object(
      'crop_top', v_old_crop_top,
      'crop_bottom', v_old_crop_bottom,
      'crop_left', v_old_crop_left,
      'crop_right', v_old_crop_right
    ),
    jsonb_build_object(
      'crop_top', p_crop_top,
      'crop_bottom', p_crop_bottom,
      'crop_left', p_crop_left,
      'crop_right', p_crop_right
    ),
    ARRAY['crop_top', 'crop_bottom', 'crop_left', 'crop_right']::text[],
    'تحديث قص الصورة',
    'low',
    true,
    v_group_id  -- FK now satisfied because operation_group exists
  );

  -- ========================================
  -- RETURN: New Version Number
  -- ========================================

  RETURN QUERY SELECT (p_version + 1)::INTEGER;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION admin_update_profile_crop TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION admin_update_profile_crop IS
  'Atomically update all 4 crop fields with comprehensive validation and fixed operation group creation.

OPERATION GROUP FIX (2025-01-30):
- Creates operation_group record BEFORE audit_log_enhanced insert
- Satisfies FK constraint: audit_log_enhanced.operation_group_id → operation_groups.id
- Idempotent INSERT with ON CONFLICT DO NOTHING
- Sets created_by = p_user_id (profiles.id FK)
- Sets group_type = ''crop_update''
- Sets operation_count = 1 (single crop operation)

PREVIOUS ACTIVITY LOG FIX (2025-10-27):
- Uses audit_log_enhanced table (not activity_log)
- JSONB format for old_data/new_data
- Single entry with all 4 fields
- changed_fields as ARRAY
- actor_id uses auth.uid()

VALIDATIONS:
1. Permission check (admin/moderator/inner only)
2. Profile exists & not deleted
3. Photo URL not null
4. Range validation (0.0-1.0 per field)
5. Bounds validation (left+right < 1.0, top+bottom < 1.0)
6. Minimum area (10% width × 10% height)
7. Version conflict prevention';

-- ============================================================================
-- TESTING
-- ============================================================================

-- Test crop update (replace UUIDs with real values):
-- SELECT * FROM admin_update_profile_crop(
--   p_profile_id := 'fe6a1a39-c198-4964-9815-701c3d2b008e'::UUID,
--   p_crop_top := 0.1,
--   p_crop_bottom := 0.1,
--   p_crop_left := 0.1,
--   p_crop_right := 0.1,
--   p_version := 1,
--   p_user_id := 'your-profile-id'::UUID
-- );
--
-- Verify operation_group created:
-- SELECT * FROM operation_groups WHERE group_type = 'crop_update' ORDER BY created_at DESC LIMIT 1;
--
-- Verify audit log created:
-- SELECT * FROM audit_log_enhanced WHERE action_type = 'crop_update' ORDER BY created_at DESC LIMIT 1;
