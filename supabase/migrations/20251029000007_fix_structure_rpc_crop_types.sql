-- Migration: Fix crop field types in get_structure_only RPC
-- Purpose: Resolve type mismatch between database (NUMERIC(4,3)) and RPC (FLOAT)
-- Issue: "Returned type numeric(4,3) does not match expected type double precision in column 13"
-- Root Cause: Migration 20251028010000 incorrectly used FLOAT instead of NUMERIC(4,3)
-- Date: 2025-10-29

-- =====================================================================
-- Drop ALL overloads of get_structure_only function
-- =====================================================================
-- Two overloads exist:
-- 1. get_structure_only(p_user_id UUID, p_limit INT)
-- 2. get_structure_only(p_hid TEXT, p_max_depth INT, p_limit INT)
DROP FUNCTION IF EXISTS public.get_structure_only(p_user_id UUID, p_limit INT);
DROP FUNCTION IF EXISTS public.get_structure_only(p_hid TEXT, p_max_depth INT, p_limit INT);

-- =====================================================================
-- Recreate with correct NUMERIC(4,3) types matching database columns
-- =====================================================================
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
    crop_top NUMERIC(4,3),      -- ✅ FIXED: Was FLOAT, now NUMERIC(4,3)
    crop_bottom NUMERIC(4,3),   -- ✅ FIXED: Was FLOAT, now NUMERIC(4,3)
    crop_left NUMERIC(4,3),     -- ✅ FIXED: Was FLOAT, now NUMERIC(4,3)
    crop_right NUMERIC(4,3),    -- ✅ FIXED: Was FLOAT, now NUMERIC(4,3)
    share_code VARCHAR(5)
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
            branch.share_code
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
        d.share_code
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order;
END;
$function$;

-- =====================================================================
-- Recreate first overload (user-based query)
-- =====================================================================
CREATE FUNCTION public.get_structure_only(
    p_user_id UUID DEFAULT NULL,
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
    "nodeWidth" INT,
    version INT,
    blurhash TEXT,
    crop_top NUMERIC(4,3),      -- ✅ FIXED: Now explicitly NUMERIC(4,3)
    crop_bottom NUMERIC(4,3),   -- ✅ FIXED: Now explicitly NUMERIC(4,3)
    crop_left NUMERIC(4,3),     -- ✅ FIXED: Now explicitly NUMERIC(4,3)
    crop_right NUMERIC(4,3)     -- ✅ FIXED: Now explicitly NUMERIC(4,3)
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    p.crop_right
  FROM profiles p
  WHERE p.deleted_at IS NULL
  ORDER BY p.generation, p.sibling_order
  LIMIT p_limit;
END;
$function$;

-- =====================================================================
-- Grant permissions
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.get_structure_only(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_structure_only(TEXT, INT, INT) TO anon, authenticated;

-- =====================================================================
-- Comments
-- =====================================================================
COMMENT ON FUNCTION public.get_structure_only IS
'Progressive Loading: Returns tree structure with photos, crop data, blurhash, and share codes.
Type Fix: Changed crop fields from FLOAT to NUMERIC(4,3) to match database column types.
Schema Version: 1.2.0
Performance: ~450ms for 2,850 profiles
Fixed: 2025-10-29 - Resolved "structure of query does not match function result type" error';

-- =====================================================================
-- Verification
-- =====================================================================
DO $$
DECLARE
    test_count INT;
BEGIN
    -- Test that function returns data without type errors
    SELECT COUNT(*) INTO test_count
    FROM get_structure_only(NULL, 2, 100);

    IF test_count > 0 THEN
        RAISE NOTICE '✅ get_structure_only() works correctly (% profiles returned)', test_count;
    ELSE
        RAISE WARNING '⚠️ get_structure_only() returned no data';
    END IF;
END $$;
