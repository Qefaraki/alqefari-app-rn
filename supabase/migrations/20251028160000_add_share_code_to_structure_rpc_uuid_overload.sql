-- Migration: Add share_code to get_structure_only(UUID, INT) overload
-- Purpose: Complete share code implementation for all RPC overloads
-- Impact: Enables QR code generation for profiles loaded via UUID overload
-- Date: 2025-10-28
-- Related: 20251028010000 (TEXT overload), 20251028020000 (get_branch_data), 20251028030000 (search_name_chain)

-- ============================================================================
-- UPDATE: get_structure_only(UUID, INTEGER) - Add share_code field
-- ============================================================================

-- Drop existing function (will recreate with new signature)
DROP FUNCTION IF EXISTS get_structure_only(UUID, INTEGER);

-- Create updated function with share_code field added
CREATE OR REPLACE FUNCTION get_structure_only(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE(
  -- ========================================
  -- EXISTING FIELDS (16 fields, unchanged)
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
  crop_top NUMERIC(4,3),
  crop_bottom NUMERIC(4,3),
  crop_left NUMERIC(4,3),
  crop_right NUMERIC(4,3),

  -- ========================================
  -- NEW FIELD (1 field added)
  -- ========================================
  share_code VARCHAR(5)  -- For deep linking and QR code generation
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return all non-deleted profiles with share_code
  -- Note: This ensures QR code generation works for all profiles
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
    CASE WHEN p.photo_url IS NOT NULL THEN 85 ELSE 60 END as "nodeWidth",  -- Calculated field
    p.version,
    p.blurhash,
    p.crop_top,
    p.crop_bottom,
    p.crop_left,
    p.crop_right,
    p.share_code  -- NEW: Critical for QR code generation
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
  'Returns tree structure with share_code for QR generation. Total fields: 17 (16 previous + 1 share_code).';

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Test RPC returns share_code field
-- SELECT id, hid, share_code
-- FROM get_structure_only(NULL, 10)
-- WHERE share_code IS NOT NULL
-- LIMIT 5;

-- Verify all profiles have share_code populated
-- SELECT COUNT(*) as total_profiles,
--        COUNT(share_code) as with_share_code
-- FROM get_structure_only(NULL, 10000);
-- Expected: Both counts should match (all profiles have share_code)
