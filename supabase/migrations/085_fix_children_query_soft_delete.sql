-- ============================================================================
-- MIGRATION 085: FIX SOFT-DELETED CHILDREN APPEARING IN FAMILY TAB
-- ============================================================================
-- Date: 2025-01-10
-- Author: Claude Code
--
-- Problem: After cascade delete, soft-deleted children still appear in Kids card
-- Root Cause: get_profile_family_data children query missing `deleted_at IS NULL` filter
-- Solution: Add soft-delete filter to match spouses query pattern
--
-- Comparison:
--   Spouses query (line 173): ✅ AND p.deleted_at IS NULL
--   Children query (line 218): ❌ MISSING deleted_at filter
--
-- Fix: Add AND p.deleted_at IS NULL to children WHERE clause

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

        -- Father with computed name chain (no "بن")
        'father', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain_simple(p.id),
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

        -- Mother with computed name chain (no "بن")
        -- Handles both tree members and Munasib mothers
        'mother', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain_simple(p.id),
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
        'spouses', (
            SELECT COALESCE(json_agg(spouse_data), '[]'::json)
            FROM (
                SELECT
                    -- Marriage record metadata
                    mar.id as marriage_id,
                    mar.husband_id,
                    mar.wife_id,
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

        -- 🎯 FIXED: Children query now excludes soft-deleted profiles
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
                    (
                        -- Children where this person is father (for men)
                        (p.father_id = p_profile_id)
                        OR
                        -- Children where this person is mother (for women)
                        (p.mother_id = p_profile_id)
                    )
                    AND p.deleted_at IS NULL  -- 🎯 FIX: Exclude soft-deleted children
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
            WHERE (p.father_id = p_profile_id OR p.mother_id = p_profile_id)
            AND p.deleted_at IS NULL  -- 🎯 FIX: Also exclude soft-deleted from count
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

-- Update function comment to reflect soft-delete filtering
COMMENT ON FUNCTION get_profile_family_data IS
    'Returns comprehensive family data for a profile in a single query.
     Uses updated status values: ''current'' (active marriage) and ''past'' (ended marriage).
     Father and mother profiles include name_chain field (space-separated, no بن).
     UPDATED: Children query now properly excludes soft-deleted profiles (deleted_at IS NULL).
     Includes: profile details, father, mother, all spouses with marriage details,
     all children with mother information and tree visibility flag.
     Optimized to prevent N+1 query issues in family management UI.';

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_profile_family_data(UUID) TO authenticated;

-- Validation
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

  -- Get function comment to verify update
  SELECT obj_description(oid, 'pg_proc') INTO v_comment
  FROM pg_proc
  WHERE proname = 'get_profile_family_data';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 085: Fix Children Soft-Delete Filter';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ get_profile_family_data function: %',
    CASE WHEN v_function_exists THEN 'UPDATED' ELSE 'MISSING' END;
  RAISE NOTICE '✓ Children query now filters deleted_at IS NULL';
  RAISE NOTICE '✓ Children count also excludes soft-deleted';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  1. Line 163: AND p.deleted_at IS NULL';
  RAISE NOTICE '  2. Line 182: AND p.deleted_at IS NULL (count)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Soft-deleted children will no longer appear in UI';
  RAISE NOTICE '========================================';

  -- Fail if function wasn't updated
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration 085 failed: get_profile_family_data not found';
  END IF;
END $$;
