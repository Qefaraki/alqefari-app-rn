/**
 * Fix Type Mismatch in get_structure_only RPC Functions
 *
 * Problem:
 * - Two overloaded versions of get_structure_only() had inconsistent crop field types
 * - Version 1 declared crop_* as 'numeric' but returned numeric(4,3) from table
 * - Version 2 declared crop_* as 'double precision'
 * - PostgreSQL error: "Returned type numeric(4,3) does not match expected type double precision in column 13"
 *
 * Solution:
 * - Drop both existing functions
 * - Recreate with explicit CAST(... AS double precision) for all crop fields
 * - Makes return types consistent with declared types
 *
 * Impact:
 * - Fixes tree loading error in curves mode
 * - No behavioral changes (double precision can represent all numeric(4,3) values)
 * - Maintains backward compatibility (same parameters, same logic)
 */

-- Drop both overloaded versions
DROP FUNCTION IF EXISTS public.get_structure_only(uuid, integer);
DROP FUNCTION IF EXISTS public.get_structure_only(text, integer, integer);

-- Recreate Version 1: get_structure_only(p_user_id, p_limit)
-- Returns all profiles (used when loading full tree)
CREATE OR REPLACE FUNCTION public.get_structure_only(
  p_user_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 10000
)
RETURNS TABLE(
  id uuid,
  hid text,
  name text,
  father_id uuid,
  mother_id uuid,
  generation integer,
  sibling_order integer,
  gender text,
  photo_url text,
  "nodeWidth" integer,
  version integer,
  blurhash text,
  crop_top double precision,      -- Changed from 'numeric' to 'double precision'
  crop_bottom double precision,   -- Changed from 'numeric' to 'double precision'
  crop_left double precision,     -- Changed from 'numeric' to 'double precision'
  crop_right double precision,    -- Changed from 'numeric' to 'double precision'
  share_code character varying,
  deleted_at timestamp with time zone
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
    CAST(p.crop_top AS double precision),       -- Explicit cast
    CAST(p.crop_bottom AS double precision),    -- Explicit cast
    CAST(p.crop_left AS double precision),      -- Explicit cast
    CAST(p.crop_right AS double precision),     -- Explicit cast
    p.share_code,
    p.deleted_at
  FROM profiles p
  WHERE p.deleted_at IS NULL
  ORDER BY p.generation, p.sibling_order
  LIMIT p_limit;
END;
$function$;

-- Recreate Version 2: get_structure_only(p_hid, p_max_depth, p_limit)
-- Returns branch starting from specific HID (used for progressive loading)
CREATE OR REPLACE FUNCTION public.get_structure_only(
  p_hid text DEFAULT NULL::text,
  p_max_depth integer DEFAULT 15,
  p_limit integer DEFAULT 10000
)
RETURNS TABLE(
  id uuid,
  hid text,
  name text,
  father_id uuid,
  mother_id uuid,
  generation integer,
  sibling_order integer,
  gender text,
  photo_url text,
  nodewidth integer,
  version integer,
  blurhash text,
  crop_top double precision,
  crop_bottom double precision,
  crop_left double precision,
  crop_right double precision,
  share_code character varying,
  deleted_at timestamp with time zone
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
            CAST(p.crop_top AS double precision) as crop_top,         -- Explicit cast
            CAST(p.crop_bottom AS double precision) as crop_bottom,   -- Explicit cast
            CAST(p.crop_left AS double precision) as crop_left,       -- Explicit cast
            CAST(p.crop_right AS double precision) as crop_right,     -- Explicit cast
            p.share_code,
            p.deleted_at,
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
            CAST(p.crop_top AS double precision) as crop_top,         -- Explicit cast
            CAST(p.crop_bottom AS double precision) as crop_bottom,   -- Explicit cast
            CAST(p.crop_left AS double precision) as crop_left,       -- Explicit cast
            CAST(p.crop_right AS double precision) as crop_right,     -- Explicit cast
            p.share_code,
            p.deleted_at,
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
            branch.deleted_at
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
        d.deleted_at
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order;
END;
$function$;

-- Verification query (optional, for testing)
-- SELECT id, crop_top, crop_bottom, crop_left, crop_right
-- FROM get_structure_only(NULL::text, 15, 10)
-- LIMIT 5;
