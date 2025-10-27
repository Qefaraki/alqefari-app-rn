-- Migration: Add crop fields to get_structure_only() RPC
-- Author: Claude Code
-- Date: 2025-10-27
-- Purpose: Return crop coordinates in structure loading (backwards-compatible)
-- Impact: +4 fields in RPC response, ~60-80 KB size increase

-- ============================================================================
-- UPDATE: get_structure_only() - Add crop fields
-- ============================================================================

-- Drop existing function (will recreate with new signature)
DROP FUNCTION IF EXISTS get_structure_only(UUID, INTEGER);

-- Create updated function with 4 additional crop fields
CREATE OR REPLACE FUNCTION get_structure_only(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE(
  -- ========================================
  -- EXISTING FIELDS (12 fields, unchanged)
  -- ========================================
  id UUID,
  hid TEXT,
  name TEXT,
  father_id UUID,
  mother_id UUID,
  generation INTEGER,
  sibling_order INTEGER,
  gender TEXT,
  photo_url TEXT,
  "nodeWidth" INTEGER,
  version INTEGER,
  blurhash TEXT,

  -- ========================================
  -- NEW CROP FIELDS (4 fields added)
  -- ========================================
  crop_top NUMERIC(4,3),
  crop_bottom NUMERIC(4,3),
  crop_left NUMERIC(4,3),
  crop_right NUMERIC(4,3)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return all non-deleted profiles with crop data
  -- Note: Old app versions will ignore extra fields (backwards-compatible)
  RETURN QUERY
  SELECT
    p.id,
    p.hid,
    p.name,
    p.father_id,
    p.mother_id,
    p.generation,
    p.sibling_order,
    p.gender,
    p.photo_url,
    p."nodeWidth",
    p.version,
    p.blurhash,
    p.crop_top,
    p.crop_bottom,
    p.crop_left,
    p.crop_right
  FROM profiles p
  WHERE p.deleted_at IS NULL
  ORDER BY p.generation, p.sibling_order
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- PERMISSIONS: Grant execute to authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_structure_only(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_structure_only(UUID, INTEGER) IS
  'Returns tree structure with crop data. Backwards-compatible: old apps ignore new fields (16 total fields: 12 original + 4 crop).';

-- ============================================================================
-- BACKWARDS COMPATIBILITY NOTES
-- ============================================================================

-- Old apps (before crop feature):
--   - Expect 12 fields
--   - Supabase client ignores extra 4 fields
--   - No breaking changes
--
-- New apps (with crop feature):
--   - Expect 16 fields
--   - Uses crop_top/bottom/left/right for rendering
--   - Defaults to 0.0 (no crop) for old profiles

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Test RPC returns crop fields
-- SELECT id, hid, crop_top, crop_bottom, crop_left, crop_right
-- FROM get_structure_only(NULL, 10);

-- Verify all profiles have default crop (0.0)
-- SELECT COUNT(*) FROM get_structure_only(NULL, 10000)
-- WHERE crop_top <> 0 OR crop_bottom <> 0 OR crop_left <> 0 OR crop_right <> 0;
-- Expected: 0 (no profiles cropped yet)
