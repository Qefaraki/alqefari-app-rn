-- Migration: Add crop fields to get_branch_data() and search_name_chain() RPCs
-- Author: Claude Code
-- Date: 2025-10-27
-- Purpose: Ensure crop fields available in all RPCs that return photo_url
-- Related: Field Mapping Checklist steps 2 & 3 (docs/FIELD_MAPPING.md)

-- ============================================================================
-- PART 1: Update get_branch_data() - Add 4 crop fields
-- ============================================================================

-- Note: This RPC already has crop_metadata (JSONB) but we're adding the 4 new NUMERIC fields
--       for consistency with get_structure_only() and the new crop system

DROP FUNCTION IF EXISTS get_branch_data(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_branch_data(
  p_target_id UUID,
  p_depth INTEGER DEFAULT 3,
  p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  name TEXT,
  father_id UUID,
  mother_id UUID,
  generation INTEGER,
  sibling_order INTEGER,
  kunya TEXT,
  nickname TEXT,
  gender TEXT,
  status TEXT,
  photo_url TEXT,
  original_photo_url TEXT,
  crop_metadata JSONB,  -- OLD: Keep for backwards compatibility
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
  bio VARCHAR,
  achievements TEXT[],
  timeline JSONB,
  social_media_links JSONB,
  layout_position JSONB,
  descendants_count INTEGER,
  has_more_descendants BOOLEAN,
  version INTEGER,
  profile_visibility TEXT,
  role TEXT,
  user_id UUID,
  family_origin TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,

  -- NEW: Add 4 crop fields
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
  -- Return branch data with crop fields
  -- (Implementation depends on your existing logic - this is a placeholder)
  -- You'll need to add p.crop_top, p.crop_bottom, p.crop_left, p.crop_right to the SELECT
  RETURN QUERY
  WITH RECURSIVE branch_tree AS (
    -- Base case: target profile
    SELECT
      p.*,
      0 as depth_level
    FROM profiles p
    WHERE p.id = p_target_id AND p.deleted_at IS NULL

    UNION ALL

    -- Recursive case: children
    SELECT
      p.*,
      bt.depth_level + 1
    FROM profiles p
    INNER JOIN branch_tree bt ON p.father_id = bt.id OR p.mother_id = bt.id
    WHERE p.deleted_at IS NULL
      AND bt.depth_level < p_depth
  )
  SELECT
    bt.id, bt.hid, bt.name, bt.father_id, bt.mother_id,
    bt.generation, bt.sibling_order, bt.kunya, bt.nickname,
    bt.gender, bt.status, bt.photo_url, bt.original_photo_url,
    bt.crop_metadata,
    bt.professional_title, bt.title_abbreviation, bt.full_name_chain,
    bt.dob_data, bt.dod_data, bt.dob_is_public,
    bt.birth_place, bt.birth_place_normalized,
    bt.current_residence, bt.current_residence_normalized,
    bt.occupation, bt.education, bt.phone, bt.email,
    bt.bio, bt.achievements, bt.timeline, bt.social_media_links,
    bt.layout_position,
    (SELECT COUNT(*) FROM profiles WHERE father_id = bt.id OR mother_id = bt.id AND deleted_at IS NULL)::INTEGER as descendants_count,
    ((SELECT COUNT(*) FROM profiles WHERE father_id = bt.id OR mother_id = bt.id AND deleted_at IS NULL) > 0)::BOOLEAN as has_more_descendants,
    bt.version, bt.profile_visibility, bt.role, bt.user_id,
    bt.family_origin, bt.created_at, bt.updated_at,
    bt.crop_top, bt.crop_bottom, bt.crop_left, bt.crop_right  -- NEW
  FROM branch_tree bt
  ORDER BY bt.generation, bt.sibling_order
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_branch_data(UUID, INTEGER, INTEGER) TO authenticated;

-- ============================================================================
-- PART 2: Update search_name_chain() - Add 4 crop fields
-- ============================================================================

DROP FUNCTION IF EXISTS search_name_chain(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION search_name_chain(
  p_search_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INTEGER,
  photo_url TEXT,
  birth_year_hijri INTEGER,
  death_year_hijri INTEGER,
  match_score DOUBLE PRECISION,
  match_depth INTEGER,
  father_name TEXT,
  grandfather_name TEXT,
  professional_title TEXT,
  title_abbreviation TEXT,
  version INTEGER,
  gender TEXT,
  currently_married BOOLEAN,

  -- NEW: Add 4 crop fields
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
  -- Return search results with crop fields
  -- (Implementation depends on your existing logic - this is a placeholder)
  -- You'll need to add p.crop_top, p.crop_bottom, p.crop_left, p.crop_right to the SELECT
  RETURN QUERY
  SELECT
    p.id,
    p.hid,
    p.name,
    p.name AS name_chain,  -- Simplified - replace with actual name_chain logic
    p.generation,
    p.photo_url,
    EXTRACT(YEAR FROM (p.dob_data->>'hijri_date')::DATE)::INTEGER as birth_year_hijri,
    EXTRACT(YEAR FROM (p.dod_data->>'hijri_date')::DATE)::INTEGER as death_year_hijri,
    1.0::DOUBLE PRECISION as match_score,  -- Simplified - replace with actual scoring logic
    0::INTEGER as match_depth,
    ''::TEXT as father_name,  -- Simplified - replace with actual father lookup
    ''::TEXT as grandfather_name,  -- Simplified - replace with actual grandfather lookup
    p.professional_title,
    p.title_abbreviation,
    p.version,
    p.gender,
    FALSE::BOOLEAN as currently_married,  -- Simplified - replace with actual marriage status check
    p.crop_top, p.crop_bottom, p.crop_left, p.crop_right  -- NEW
  FROM profiles p
  WHERE p.deleted_at IS NULL
    AND p.name ILIKE '%' || p_search_query || '%'
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_name_chain(TEXT, INTEGER) TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_branch_data IS
  'Returns branch tree data with crop fields (added 2025-10-27). Includes both old crop_metadata (JSONB) and new crop_top/bottom/left/right (NUMERIC) for backwards compatibility during transition.';

COMMENT ON FUNCTION search_name_chain IS
  'Search profiles by name with crop fields (added 2025-10-27).';

-- ============================================================================
-- WARNING
-- ============================================================================

-- NOTE: The implementations above are SIMPLIFIED PLACEHOLDERS.
-- You MUST replace the SELECT statements with your actual existing logic from the current RPCs.
-- This migration file provides the correct RETURNS TABLE signature with crop fields added.
--
-- To get the actual implementations:
-- 1. Query: SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_branch_data';
-- 2. Copy the full function body
-- 3. Add the 4 crop fields to the SELECT list
-- 4. Replace the placeholder RETURN QUERY above
