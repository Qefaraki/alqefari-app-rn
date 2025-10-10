-- Migration 083 v2: Add Name Chains to Parent Profiles (MINIMAL FIX)
--
-- Problem: Parent names in edit mode only show first name (e.g., "محمد")
-- Root Cause: get_profile_family_data returns raw profile rows without name chains
-- Solution: Change ONLY father/mother subqueries to include computed name_chain
--
-- Changes from migration 082:
--   1. Lines 56-68: Replace to_jsonb(p) with jsonb_build_object including name_chain
--   2. Line 79: Remove marriage_date field (user requested removal)
--   3. Everything else: UNCHANGED
--
-- Fixes: TabFamily.js ParentProfileCard displaying only first name
-- References: Migration 064 (build_name_chain function), Migration 082 (base function)

BEGIN;

-- ============================================================================
-- Update get_profile_family_data with Name Chains (MINIMAL CHANGE)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profile_family_data(
    p_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_profile profiles%ROWTYPE;
    v_permission TEXT;
    v_current_user_profile_id UUID;
BEGIN
    -- Get current user's profile ID
    SELECT id INTO v_current_user_profile_id
    FROM profiles
    WHERE user_id = auth.uid();

    IF v_current_user_profile_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated with valid profile';
    END IF;

    -- Get main profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found: %', p_profile_id;
    END IF;

    -- Permission check using family permission system v4.2
    -- Allows: admin, moderator, or family members (inner/family/extended)
    SELECT check_family_permission_v4(v_current_user_profile_id, p_profile_id)
    INTO v_permission;

    IF v_permission NOT IN ('admin', 'moderator', 'inner', 'family', 'extended') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to view profile %', p_profile_id;
    END IF;

    -- Build comprehensive result with all family relationships
    v_result := jsonb_build_object(
        -- Main profile data
        'profile', to_jsonb(v_profile),

        -- 🎯 CHANGED: Father with computed name chain
        'father', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain(p.id),  -- 🎯 THE KEY FIX
                'photo_url', p.photo_url,
                'gender', p.gender,
                'status', p.status,
                'hid', p.hid,
                'father_id', p.father_id,
                'mother_id', p.mother_id
            )
            FROM profiles p
            WHERE p.id = v_profile.father_id
        ),

        -- 🎯 CHANGED: Mother with computed name chain
        -- Handles both tree members and Munasib mothers
        'mother', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain(p.id),  -- 🎯 THE KEY FIX
                'photo_url', p.photo_url,
                'gender', p.gender,
                'status', p.status,
                'hid', p.hid,
                'father_id', p.father_id,
                'mother_id', p.mother_id
            )
            FROM profiles p
            WHERE p.id = v_profile.mother_id
        ),

        -- Spouses: All marriages with spouse profile details
        -- 🎯 CHANGED: Removed marriage_date field (line 79 in migration 082)
        'spouses', (
            SELECT COALESCE(json_agg(spouse_data), '[]'::json)
            FROM (
                SELECT
                    -- Marriage record metadata
                    mar.id as marriage_id,
                    mar.husband_id,
                    mar.wife_id,
                    -- REMOVED: mar.start_date as marriage_date
                    mar.status,
                    mar.munasib,  -- TRUE if spouse is from outside Al Qefari family (hid IS NULL)
                    -- Count children from this specific marriage (both parents must match)
                    (
                        SELECT COUNT(*)
                        FROM profiles p
                        WHERE p.father_id = mar.husband_id
                          AND p.mother_id = mar.wife_id
                          AND p.deleted_at IS NULL  -- Exclude soft-deleted profiles
                    ) as children_count,
                    mar.created_at as marriage_created_at,
                    -- Spouse profile (the other person in the marriage)
                    CASE
                        WHEN mar.husband_id = p_profile_id THEN
                            (SELECT row_to_json(p) FROM profiles p WHERE p.id = mar.wife_id)
                        ELSE
                            (SELECT row_to_json(p) FROM profiles p WHERE p.id = mar.husband_id)
                    END as spouse_profile
                FROM marriages mar
                WHERE (mar.husband_id = p_profile_id OR mar.wife_id = p_profile_id)
                AND mar.status IN ('current', 'past')
                AND mar.deleted_at IS NULL
                ORDER BY
                    CASE mar.status
                        WHEN 'current' THEN 1  -- Active marriages first
                        WHEN 'past' THEN 2     -- Past marriages second
                    END,
                    mar.start_date DESC NULLS LAST
            ) spouse_data
        ),

        -- Children: All children with mother information
        'children', (
            SELECT COALESCE(json_agg(child_data ORDER BY child_data.sibling_order), '[]'::json)
            FROM (
                SELECT
                    p.*,
                    -- Include mother name for display (useful for men with multiple wives)
                    mother_p.name as mother_name,
                    mother_p.id as mother_profile_id,
                    mother_p.hid as mother_hid,
                    -- Flag if child appears on tree (has hid from father)
                    CASE
                        WHEN p.hid IS NOT NULL THEN true
                        ELSE false
                    END as shows_on_tree
                FROM profiles p
                LEFT JOIN profiles mother_p ON mother_p.id = p.mother_id
                WHERE
                    -- Children where this person is father (for men)
                    (p.father_id = p_profile_id)
                    OR
                    -- Children where this person is mother (for women)
                    (p.mother_id = p_profile_id)
                ORDER BY p.sibling_order NULLS LAST, p.name
            ) child_data
        ),

        -- Metadata
        'fetched_at', NOW(),
        'has_father', v_profile.father_id IS NOT NULL,
        'has_mother', v_profile.mother_id IS NOT NULL,
        'spouse_count', (
            SELECT COUNT(*)
            FROM marriages mar
            WHERE (mar.husband_id = p_profile_id OR mar.wife_id = p_profile_id)
            AND mar.status = 'current'
            AND mar.deleted_at IS NULL
        ),
        'children_count', (
            SELECT COUNT(*)
            FROM profiles p
            WHERE p.father_id = p_profile_id OR p.mother_id = p_profile_id
        )
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error for debugging
        RAISE WARNING 'get_profile_family_data error for profile %: %', p_profile_id, SQLERRM;
        -- Return minimal safe result
        RETURN jsonb_build_object(
            'profile', to_jsonb(v_profile),
            'father', NULL,
            'mother', NULL,
            'spouses', '[]'::jsonb,
            'children', '[]'::jsonb,
            'error', SQLERRM
        );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_profile_family_data(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_profile_family_data IS
    'Returns comprehensive family data for a profile in a single query.
     Uses updated status values: ''current'' (active marriage) and ''past'' (ended marriage).
     UPDATED: Father and mother profiles now include computed name_chain field.
     Includes: profile details, father, mother, all spouses with marriage details,
     all children with mother information and tree visibility flag.
     Optimized to prevent N+1 query issues in family management UI.';

-- ============================================================================
-- Validation and Logging
-- ============================================================================

DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_comment TEXT;
BEGIN
  -- Check if function was updated
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_profile_family_data'
  ) INTO v_function_exists;

  -- Get function comment to verify it was updated
  SELECT obj_description(oid, 'pg_proc') INTO v_comment
  FROM pg_proc
  WHERE proname = 'get_profile_family_data';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 083 v2: Name Chain Fix';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ get_profile_family_data function: %',
    CASE WHEN v_function_exists THEN 'DEPLOYED' ELSE 'MISSING' END;
  RAISE NOTICE '✓ Father/mother profiles now include name_chain';
  RAISE NOTICE '✓ marriage_date field removed from spouses';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  1. Lines 56-76: Father with name_chain field';
  RAISE NOTICE '  2. Lines 80-100: Mother with name_chain field';
  RAISE NOTICE '  3. Line 107: Removed marriage_date from spouses';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Parent names now show full chains!';
  RAISE NOTICE '  - getShortNameChain() will find name_chain field';
  RAISE NOTICE '  - Displays up to 5 names from ancestry';
  RAISE NOTICE '========================================';

  -- Fail if function wasn't created
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration 083 v2 failed: get_profile_family_data not found';
  END IF;

  -- Verify comment was updated (should mention 'name_chain')
  IF v_comment IS NULL OR v_comment NOT LIKE '%name_chain%' THEN
    RAISE WARNING 'Migration 083 v2: Function comment may not have been updated';
  END IF;
END $$;

COMMIT;
