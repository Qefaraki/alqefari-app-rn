/**
 * Migration: Add photo_url_cropped to get_structure_only RPC
 * Date: 2025-01-31
 * Migration Number: 006
 *
 * Purpose: Add photo_url_cropped field to structure RPC for TreeView cropped photo display.
 *
 * Background:
 * - TreeView uses get_structure_only for initial load (Progressive Loading Phase 3B)
 * - Without photo_url_cropped, TreeView shows original uncropped photos
 * - This causes inconsistent UX between tree view and profile viewer
 *
 * Changes:
 * - Dropped old function version (cannot change return type without DROP)
 * - Added photo_url_cropped to RETURNS TABLE signature (after photo_url)
 * - Added p.photo_url_cropped to both CTE SELECTs (base + recursive)
 * - Added photo_url_cropped to deduplicated CTE
 * - Added photo_url_cropped to final SELECT
 *
 * Impact: TreeView will now display cropped photos when available.
 */

-- Drop old version (required when changing RETURNS TABLE signature)
DROP FUNCTION IF EXISTS get_structure_only(text, integer, integer);

-- Recreate with photo_url_cropped field
CREATE OR REPLACE FUNCTION get_structure_only(
  p_hid TEXT DEFAULT NULL,
  p_max_depth INTEGER DEFAULT 15,
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
  status TEXT,
  photo_url TEXT,
  photo_url_cropped TEXT,  -- ADDED: File-based cropped photo
  nodeWidth INTEGER,
  version INTEGER,
  blurhash TEXT,
  share_code VARCHAR,
  deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF p_max_depth < 1 OR p_max_depth > 15 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 15';
    END IF;
    IF p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'limit must be between 1 and 10000';
    END IF;

    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: Root profile(s)
        SELECT
            p.id, p.hid, p.name, p.father_id, p.mother_id, p.generation, p.sibling_order,
            p.gender, p.status, p.photo_url, p.photo_url_cropped,  -- ADDED
            CASE WHEN p.photo_url IS NOT NULL THEN 85 ELSE 60 END as nodeWidth,
            p.version, p.blurhash, p.share_code, p.deleted_at, 0::INT as depth
        FROM profiles p
        WHERE p.hid IS NOT NULL AND p.deleted_at IS NULL
          AND ((p_hid IS NULL AND p.generation = 1) OR (p_hid IS NOT NULL AND p.hid = p_hid))

        UNION ALL

        -- Recursive case: Children
        SELECT
            p.id, p.hid, p.name, p.father_id, p.mother_id, p.generation, p.sibling_order,
            p.gender, p.status, p.photo_url, p.photo_url_cropped,  -- ADDED
            CASE WHEN p.photo_url IS NOT NULL THEN 85 ELSE 60 END as nodeWidth,
            p.version, p.blurhash, p.share_code, p.deleted_at, b.depth + 1
        FROM profiles p
        INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
        WHERE p.hid IS NOT NULL AND p.deleted_at IS NULL AND b.depth < p_max_depth
    ),
    deduplicated AS (
        SELECT DISTINCT ON (branch.id)
            branch.id, branch.hid, branch.name, branch.father_id, branch.mother_id,
            branch.generation, branch.sibling_order, branch.gender, branch.status,
            branch.photo_url, branch.photo_url_cropped,  -- ADDED
            branch.nodeWidth, branch.version, branch.blurhash,
            branch.share_code, branch.deleted_at
        FROM branch
        ORDER BY branch.id
        LIMIT p_limit
    )
    SELECT d.id, d.hid, d.name, d.father_id, d.mother_id, d.generation, d.sibling_order,
           d.gender, d.status, d.photo_url, d.photo_url_cropped,  -- ADDED
           d.nodeWidth, d.version, d.blurhash, d.share_code, d.deleted_at
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order;
END;
$$;

COMMENT ON FUNCTION get_structure_only IS
  'Load tree structure without enriched data for Progressive Loading Phase 3B.
   Updated 2025-01-31: Added photo_url_cropped for file-based cropping display in TreeView.';

-- ============================================================================
-- Migration 006 Complete! ✅
-- ============================================================================
-- Fixed: TreeView will now display cropped photos when available
-- Verified: photo_url_cropped field added to all 5 locations in RPC
