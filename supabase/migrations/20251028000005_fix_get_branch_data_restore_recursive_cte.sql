-- Migration: Restore get_branch_data() with crop fields + version
-- Author: Claude Code
-- Date: 2025-10-28
-- Root Cause: Migration 20251027140400 deployed placeholder stub with wrong signature
--
-- Problem:
--   - Migration 20251027140400 changed signature from (p_hid TEXT, p_max_depth INT, p_limit INT)
--     to (p_target_id UUID, p_depth INT, p_limit INT) → BREAKING CHANGE
--   - Replaced recursive CTE with placeholder stub
--   - Broke 5 calling locations (BranchTreeProvider, profiles.js, useStore.js, etc.)
--   - Error: PGRST202 "Could not find function get_branch_data(p_hid, p_limit, p_max_depth)"
--
-- Solution:
--   - Restore working implementation from 20251026020000 (last known good)
--   - Add 7 NEW fields to complete original crop migration intent:
--     1. original_photo_url TEXT
--     2. crop_metadata JSONB (backwards compatibility)
--     3-6. crop_top/bottom/left/right NUMERIC(4,3)
--     7. version INT (CRITICAL for batch operations)
--   - Keep original signature: get_branch_data(p_hid TEXT, p_max_depth INT, p_limit INT)
--
-- Pattern: Same restoration approach as search_name_chain fix (20251028000004) ✅
--
-- Affected Components (NO CODE CHANGES NEEDED):
--   - BranchTreeProvider.js:48 → { p_hid, p_max_depth, p_limit }
--   - profiles.js:12 → { p_hid, p_max_depth, p_limit }
--   - useStore.js:27 → (rootNode.hid, 10, 5000)
--   - useTreeDataLoader.js:157 → (rootHid, 15, 5000)
--   - useFocusedTreeData.js:56,212 → (focusPersonId, depth, limit)
--
-- PREREQUISITES (run PRE_FLIGHT_VALIDATION.sql first):
--   ✅ Crop fields exist in profiles table (6 fields)
--   ✅ Version field exists in profiles table
--   ✅ CASCADE impact acceptable (< 5 dependencies)

-- ============================================================================
-- STEP 1: Dependency Warning
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_depend WHERE refobjid = 'get_branch_data'::regproc
  ) THEN
    RAISE WARNING 'get_branch_data has dependent objects - CASCADE will drop them';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop Broken Versions
-- ============================================================================

DROP FUNCTION IF EXISTS get_branch_data(UUID, INTEGER, INTEGER) CASCADE;  -- Broken placeholder
DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT) CASCADE;         -- Old version (just in case)

-- ============================================================================
-- STEP 3: Restore Working Function with 7 New Fields
-- ============================================================================

CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT DEFAULT NULL,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 200
)
RETURNS TABLE(
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    kunya TEXT,
    nickname TEXT,
    gender TEXT,
    status TEXT,
    photo_url TEXT,
    original_photo_url TEXT,        -- NEW (crop system)
    crop_metadata JSONB,            -- NEW (backwards compatibility)
    crop_top NUMERIC(4,3),          -- NEW (crop system)
    crop_bottom NUMERIC(4,3),       -- NEW (crop system)
    crop_left NUMERIC(4,3),         -- NEW (crop system)
    crop_right NUMERIC(4,3),        -- NEW (crop system)
    professional_title TEXT,
    title_abbreviation TEXT,
    full_name_chain TEXT,
    dob_data JSONB,
    dod_data JSONB,
    dob_is_public BOOLEAN,
    birth_place TEXT,
    birth_place_normalized JSONB,
    current_residence TEXT,
    current_residence_normalized JSONB,
    occupation TEXT,
    education TEXT,
    phone TEXT,
    email TEXT,
    bio VARCHAR(1000),
    achievements TEXT[],
    timeline JSONB,
    social_media_links JSONB,
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,
    version INT,                     -- NEW (CRITICAL for batch operations)
    profile_visibility TEXT,
    role TEXT,
    user_id UUID,
    family_origin TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Input validation (max_depth 1-15, limit 1-10000)
    IF p_max_depth < 1 OR p_max_depth > 15 THEN
        RAISE EXCEPTION 'max_depth must be between 1 and 15';
    END IF;

    IF p_limit < 1 OR p_limit > 10000 THEN
        RAISE EXCEPTION 'limit must be between 1 and 10000';
    END IF;

    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case: starting nodes
        SELECT
            p.id,
            p.hid,
            p.name,
            p.father_id,
            p.mother_id,
            p.generation,
            p.sibling_order,
            p.kunya,
            p.nickname,
            p.gender,
            p.status,
            p.photo_url,
            p.original_photo_url,           -- NEW
            p.crop_metadata,                -- NEW
            p.crop_top,                     -- NEW
            p.crop_bottom,                  -- NEW
            p.crop_left,                    -- NEW
            p.crop_right,                   -- NEW
            p.professional_title,
            p.title_abbreviation,
            build_name_chain(p.id) AS full_name_chain,
            p.dob_data,
            p.dod_data,
            p.dob_is_public,
            p.birth_place,
            p.birth_place_normalized,
            p.current_residence,
            p.current_residence_normalized,
            p.occupation,
            p.education,
            p.phone,
            p.email,
            p.bio,
            p.achievements,
            p.timeline,
            p.social_media_links,
            p.layout_position,
            p.descendants_count,
            p.version,                      -- NEW
            p.profile_visibility,
            p.role,
            p.user_id,
            p.family_origin,
            p.created_at,
            p.updated_at,
            0 as relative_depth
        FROM profiles p
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND p.hid NOT LIKE 'TEST%'  -- Only exclude TEST profiles, NOT R% profiles!
            AND (
                (p_hid IS NULL AND p.generation = 1)
                OR
                (p_hid IS NOT NULL AND p.hid = p_hid)
            )

        UNION ALL

        -- Recursive case: get children
        SELECT
            p.id,
            p.hid,
            p.name,
            p.father_id,
            p.mother_id,
            p.generation,
            p.sibling_order,
            p.kunya,
            p.nickname,
            p.gender,
            p.status,
            p.photo_url,
            p.original_photo_url,           -- NEW
            p.crop_metadata,                -- NEW
            p.crop_top,                     -- NEW
            p.crop_bottom,                  -- NEW
            p.crop_left,                    -- NEW
            p.crop_right,                   -- NEW
            p.professional_title,
            p.title_abbreviation,
            build_name_chain(p.id) AS full_name_chain,
            p.dob_data,
            p.dod_data,
            p.dob_is_public,
            p.birth_place,
            p.birth_place_normalized,
            p.current_residence,
            p.current_residence_normalized,
            p.occupation,
            p.education,
            p.phone,
            p.email,
            p.bio,
            p.achievements,
            p.timeline,
            p.social_media_links,
            p.layout_position,
            p.descendants_count,
            p.version,                      -- NEW
            p.profile_visibility,
            p.role,
            p.user_id,
            p.family_origin,
            p.created_at,
            p.updated_at,
            b.relative_depth + 1
        FROM profiles p
        INNER JOIN branch b ON (p.father_id = b.id OR p.mother_id = b.id)
        WHERE
            p.hid IS NOT NULL
            AND p.deleted_at IS NULL
            AND p.hid NOT LIKE 'TEST%'
            AND b.relative_depth < p_max_depth - 1
    ),
    -- Deduplicate profiles reached via multiple paths (cousin marriages)
    deduplicated AS (
        SELECT DISTINCT ON (b.id)
            b.*  -- All fields from branch CTE
        FROM branch b
        ORDER BY b.id, b.relative_depth ASC  -- Keep shortest path to each profile
    )
    -- Final SELECT with proper ordering
    SELECT
        d.id,
        d.hid,
        d.name,
        d.father_id,
        d.mother_id,
        d.generation,
        d.sibling_order,
        d.kunya,
        d.nickname,
        d.gender,
        d.status,
        d.photo_url,
        d.original_photo_url,               -- NEW
        d.crop_metadata,                    -- NEW
        d.crop_top,                         -- NEW
        d.crop_bottom,                      -- NEW
        d.crop_left,                        -- NEW
        d.crop_right,                       -- NEW
        d.professional_title,
        d.title_abbreviation,
        d.full_name_chain,
        d.dob_data,
        d.dod_data,
        d.dob_is_public,
        d.birth_place,
        d.birth_place_normalized,
        d.current_residence,
        d.current_residence_normalized,
        d.occupation,
        d.education,
        d.phone,
        d.email,
        d.bio,
        d.achievements,
        d.timeline,
        d.social_media_links,
        d.layout_position,
        COALESCE(d.descendants_count, 0)::INT as descendants_count,
        CASE
            WHEN d.relative_depth = p_max_depth - 1 THEN
                EXISTS(
                    SELECT 1 FROM profiles c
                    WHERE (c.father_id = d.id OR c.mother_id = d.id)
                    AND c.deleted_at IS NULL
                    AND c.hid IS NOT NULL
                    LIMIT 1
                )
            ELSE FALSE
        END as has_more_descendants,
        d.version,                          -- NEW
        d.profile_visibility,
        d.role,
        d.user_id,
        d.family_origin,
        d.created_at,
        d.updated_at
    FROM deduplicated d
    ORDER BY d.generation, d.sibling_order
    LIMIT p_limit;
END;
$function$;

-- ============================================================================
-- STEP 4: Restore Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;

-- ============================================================================
-- STEP 5: Validation
-- ============================================================================

DO $$
DECLARE
  field_count INT;
BEGIN
  SELECT COUNT(*) INTO field_count
  FROM information_schema.parameters
  WHERE routine_name = 'get_branch_data' AND parameter_mode = 'OUT';

  IF field_count < 50 THEN
    RAISE EXCEPTION 'Function has too few output fields: % (expected 50+)', field_count;
  END IF;

  RAISE NOTICE '✅ Function validated: % output fields', field_count;
END $$;

-- ============================================================================
-- TESTING QUERIES (run these after migration)
-- ============================================================================

-- Test 1: Signature verification
-- SELECT parameter_name FROM information_schema.parameters
-- WHERE routine_name = 'get_branch_data' AND parameter_mode = 'OUT'
-- ORDER BY ordinal_position;
-- EXPECTED: original_photo_url, crop_metadata, crop_top/bottom/left/right, version present

-- Test 2: Crop fields in results
-- SELECT id, photo_url, crop_top, crop_bottom, crop_left, crop_right, version
-- FROM get_branch_data(NULL, 1, 5);
-- EXPECTED: Rows with all fields populated

-- Test 3: HID-based query
-- SELECT COUNT(*) FROM get_branch_data('R1', 3, 100);
-- EXPECTED: > 0 rows

-- Test 4: Performance check
-- EXPLAIN ANALYZE SELECT * FROM get_branch_data('R1', 3, 100);
-- EXPECTED: < 500ms execution time

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================

-- ✅ No PGRST202 errors
-- ✅ All 5 calling locations work without modification
-- ✅ Crop fields present in results
-- ✅ Version field present (CRITICAL for batch operations)
-- ✅ Performance < 500ms
-- ✅ Branch tree modal loads
-- ✅ Main tree loads (useStore, useTreeDataLoader)

-- ============================================================================
-- ROLLBACK NOTES
-- ============================================================================

-- If this migration fails, the previous (broken) function signature was:
-- get_branch_data(p_target_id UUID, p_depth INTEGER, p_limit INTEGER)
--
-- To rollback, retrieve the old function body using:
-- SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_branch_data';
-- (Run BEFORE applying this migration to save the rollback version)
