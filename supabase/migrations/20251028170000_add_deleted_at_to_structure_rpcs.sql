-- Migration: Add deleted_at to both get_structure_only() overloads
-- Purpose: Fix "profile deleted" false positive in deep linking
-- Impact: Tree profiles will have proper deleted_at field for validation
-- Date: 2025-10-28
-- Related: deepLinking.ts line 318 deleted check

-- ============================================================================
-- UPDATE: get_structure_only(TEXT, INT, INT) - Add deleted_at field
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_structure_only(p_hid TEXT, p_max_depth INT, p_limit INT);

CREATE FUNCTION public.get_structure_only(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 15,
    p_limit INT DEFAULT 10000
)
RETURNS TABLE(
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    photo_url TEXT,
    nodeWidth INT,
    version INT,
    blurhash TEXT,
    crop_top FLOAT,
    crop_bottom FLOAT,
    crop_left FLOAT,
    crop_right FLOAT,
    share_code VARCHAR(5),
    deleted_at TIMESTAMP WITH TIME ZONE  -- NEW: For deleted profile checks
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Input validation
    IF p_max_depth < 1 OR p_max_depth > 15 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 15';
    END IF;

    IF p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'limit must be between 1 and 10000';
    END IF;

    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: starting nodes (root or specified HID)
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
            CASE WHEN p.photo_url IS NOT NULL THEN 85 ELSE 60 END as nodeWidth,
            p.version,
            p.blurhash,
            p.crop_top,
            p.crop_bottom,
            p.crop_left,
            p.crop_right,
            p.share_code,
            p.deleted_at,  -- NEW
            0::INT as depth
        FROM profiles p
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND (
                (p_hid IS NULL AND p.generation = 1)
                OR
                (p_hid IS NOT NULL AND p.hid = p_hid)
            )

        UNION ALL

        -- Recursive case: get children up to max_depth
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
            CASE WHEN p.photo_url IS NOT NULL THEN 85 ELSE 60 END as nodeWidth,
            p.version,
            p.blurhash,
            p.crop_top,
            p.crop_bottom,
            p.crop_left,
            p.crop_right,
            p.share_code,
            p.deleted_at,  -- NEW
            b.depth + 1
        FROM profiles p
        INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND b.depth < p_max_depth
    ),
    deduplicated AS (
        -- Handle cousin marriages
        SELECT DISTINCT ON (branch.id)
            branch.id,
            branch.hid,
            branch.name,
            branch.father_id,
            branch.mother_id,
            branch.generation,
            branch.sibling_order,
            branch.gender,
            branch.photo_url,
            branch.nodeWidth,
            branch.version,
            branch.blurhash,
            branch.crop_top,
            branch.crop_bottom,
            branch.crop_left,
            branch.crop_right,
            branch.share_code,
            branch.deleted_at  -- NEW
        FROM branch
        ORDER BY branch.id
        LIMIT p_limit
    )
    SELECT
        d.id,
        d.hid,
        d.name,
        d.father_id,
        d.mother_id,
        d.generation,
        d.sibling_order,
        d.gender,
        d.photo_url,
        d.nodeWidth,
        d.version,
        d.blurhash,
        d.crop_top,
        d.crop_bottom,
        d.crop_left,
        d.crop_right,
        d.share_code,
        d.deleted_at  -- NEW
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order;
END;
$function$;

-- ============================================================================
-- UPDATE: get_structure_only(UUID, INTEGER) - Add deleted_at field
-- ============================================================================

DROP FUNCTION IF EXISTS get_structure_only(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_structure_only(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE(
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
  share_code VARCHAR(5),
  deleted_at TIMESTAMP WITH TIME ZONE  -- NEW: For deleted profile checks
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    CASE WHEN p.photo_url IS NOT NULL THEN 85 ELSE 60 END as "nodeWidth",
    p.version,
    p.blurhash,
    p.crop_top,
    p.crop_bottom,
    p.crop_left,
    p.crop_right,
    p.share_code,
    p.deleted_at  -- NEW
  FROM profiles p
  WHERE p.deleted_at IS NULL
  ORDER BY p.generation, p.sibling_order
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- PERMISSIONS: Grant execute to authenticated users
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_structure_only(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_structure_only(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_structure_only(TEXT, INTEGER, INTEGER) IS
  'Returns tree structure with deleted_at for validation. Total fields: 18 (17 previous + 1 deleted_at).';

COMMENT ON FUNCTION get_structure_only(UUID, INTEGER) IS
  'Returns tree structure with deleted_at for validation. Total fields: 18 (17 previous + 1 deleted_at).';

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Test both overloads return deleted_at field
-- SELECT id, hid, share_code, deleted_at
-- FROM get_structure_only(NULL::TEXT, 15, 5);

-- SELECT id, hid, share_code, deleted_at
-- FROM get_structure_only(NULL::UUID, 5);

-- Verify all profiles have deleted_at = NULL (active profiles only)
-- SELECT COUNT(*) as total_profiles,
--        COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_profiles
-- FROM get_structure_only(NULL::TEXT, 15, 10000);
-- Expected: Both counts match (only active profiles returned)
