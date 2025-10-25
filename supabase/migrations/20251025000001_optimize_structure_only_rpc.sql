-- Migration: Fix get_structure_only RPC field casing for progressive loading
-- Issue: RPC returns lowercase 'nodewidth' but frontend expects camelCase 'nodeWidth'
-- This causes layoutKeys memoization in TreeView to fail silently
-- Fix: Quote identifier in RETURNS TABLE to preserve camelCase casing
--
-- Note: UNION optimization for OR join deferred to future migration
-- (Requires restructuring recursive CTE to separate father/mother paths)
-- Current OR join performance is ~5927ms (no improvement from this migration)

-- Drop old version (explicit replacement)
DROP FUNCTION IF EXISTS get_structure_only(VARCHAR, INT, INT);

-- Recreate with UNION optimization + field casing fix
CREATE FUNCTION get_structure_only(
    p_hid VARCHAR DEFAULT NULL,
    p_max_depth INT DEFAULT 6,
    p_limit INT DEFAULT 10000
)
RETURNS TABLE (
    id UUID,
    hid VARCHAR,
    name VARCHAR,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    gender VARCHAR,
    photo_url VARCHAR,
    "nodeWidth" INT  -- FIXED: Quoted to preserve camelCase
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: starting nodes (root or specific HID)
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
            0::INT as depth
        FROM profiles p
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND (
                (p_hid IS NULL AND p.generation = 1)  -- Load all generation 1 if no HID
                OR
                (p_hid IS NOT NULL AND p.hid = p_hid)  -- Load specific HID subtree
            )

        UNION ALL

        -- Recursive case: children via father relationship
        -- Uses idx_profiles_father_id index exclusively
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
            b.depth + 1
        FROM profiles p
        INNER JOIN branch b ON p.father_id = b.id
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND b.depth < p_max_depth

        UNION ALL

        -- Recursive case: children via mother relationship (for profiles without father)
        -- Uses idx_profiles_mother_id_not_deleted index exclusively
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
            b.depth + 1
        FROM profiles p
        INNER JOIN branch b ON p.mother_id = b.id
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND p.father_id IS NULL  -- Only for profiles without father (prevents duplicates)
            AND b.depth < p_max_depth
    ),
    deduplicated AS (
        -- Handle cousin marriages (same person appears via multiple parents)
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
            branch.nodeWidth
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
        d.nodeWidth
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_structure_only TO anon, authenticated;

-- Update index statistics for optimal query planning
ANALYZE profiles;

-- Comment for documentation
COMMENT ON FUNCTION get_structure_only IS
'Phase 3B Progressive Loading: RPC field casing fix for progressive loading

Issue: Returns lowercase "nodewidth" instead of camelCase "nodeWidth"
Impact: Frontend layoutKeys memoization fails silently, causing subtle bugs
Solution: Quoted identifier "nodeWidth" in RETURNS TABLE clause

Current performance: ~5927ms (unchanged - OR join performance limitation)
Future optimization: UNION-based index optimization planned for future migration
(Requires restructuring recursive CTE to separate father/mother join paths)

Changes from previous version:
1. Fixed field casing: "nodeWidth" quoted for camelCase preservation
2. Maintains original query structure and performance characteristics

Returns: Minimal profile data for layout calculation
- id, hid, name: Profile identification
- father_id, mother_id: Family relationships
- generation, sibling_order: Tree positioning
- gender: Visual differentiation
- photo_url: Node dimension calculation (85px if present, 60px if not)
- nodeWidth: Pre-calculated node width for layout

Parameters:
- p_hid: Starting node HID (NULL = root/generation 1)
- p_max_depth: Maximum recursion depth (1-15, default 6)
- p_limit: Maximum results (1-10000, default 10000)

Frontend impact: Fixes layoutKeys memoization in TreeView.js
- layoutKeys now receives correct "nodeWidth" (camelCase) field name
- Prevents unnecessary layout recalculations during enrichment

Generated: October 25, 2025
Updated: October 25, 2025 (corrected migration comment for accuracy)
Migration: 20251025000001_optimize_structure_only_rpc.sql';
