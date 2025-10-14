-- Migration 083: Add Name Chains to get_profile_family_data
--
-- Problem: Parent names in edit mode only show first name (e.g., "محمد")
-- Root Cause: get_profile_family_data returns raw profile rows without name chains
-- Solution: Use jsonb_build_object with computed name_chain field via build_name_chain()
--
-- Fixes: TabFamily.js ParentProfileCard displaying only first name
-- References: Migration 064 (build_name_chain function), Migration 082 (original RPC)

-- Drop existing function
DROP FUNCTION IF EXISTS get_profile_family_data(uuid);

-- Recreate with computed name chains
CREATE OR REPLACE FUNCTION get_profile_family_data(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_profile profiles;
    v_result jsonb;
    v_spouses jsonb;
    v_children jsonb;
BEGIN
    -- Get the profile data
    SELECT * INTO v_profile
    FROM profiles
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'error', 'Profile not found',
            'profile_id', p_profile_id
        );
    END IF;

    -- Get spouses with computed name chains
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'husband_id', m.husband_id,
            'wife_id', m.wife_id,
            'marriage_date', m.marriage_date,
            'status', m.status,
            'spouse', jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain(p.id),  -- 🎯 Computed name chain
                'photo_url', p.photo_url,
                'gender', p.gender,
                'status', p.status,
                'hid', p.hid
            )
        )
    ), '[]'::jsonb) INTO v_spouses
    FROM marriages m
    JOIN profiles p ON (
        CASE
            WHEN v_profile.gender = 'male' THEN p.id = m.wife_id
            ELSE p.id = m.husband_id
        END
    )
    WHERE (v_profile.gender = 'male' AND m.husband_id = p_profile_id)
       OR (v_profile.gender = 'female' AND m.wife_id = p_profile_id);

    -- Get children with computed name chains
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'name_chain', build_name_chain(p.id),  -- 🎯 Computed name chain
            'photo_url', p.photo_url,
            'gender', p.gender,
            'status', p.status,
            'hid', p.hid,
            'father_id', p.father_id,
            'mother_id', p.mother_id
        )
    ), '[]'::jsonb) INTO v_children
    FROM profiles p
    WHERE (v_profile.gender = 'male' AND p.father_id = p_profile_id)
       OR (v_profile.gender = 'female' AND p.mother_id = p_profile_id);

    -- Build result with computed name chains for parents
    v_result := jsonb_build_object(
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'name', v_profile.name,
            'name_chain', build_name_chain(v_profile.id),  -- 🎯 Computed name chain
            'photo_url', v_profile.photo_url,
            'gender', v_profile.gender,
            'status', v_profile.status,
            'hid', v_profile.hid,
            'father_id', v_profile.father_id,
            'mother_id', v_profile.mother_id
        ),

        -- Father with computed name chain
        'father', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain(p.id),  -- 🎯 THE KEY FIX
                'photo_url', p.photo_url,
                'gender', p.gender,
                'status', p.status,
                'hid', p.hid
            )
            FROM profiles p
            WHERE p.id = v_profile.father_id
        ),

        -- Mother with computed name chain
        'mother', (
            SELECT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'name_chain', build_name_chain(p.id),  -- 🎯 THE KEY FIX
                'photo_url', p.photo_url,
                'gender', p.gender,
                'status', p.status,
                'hid', p.hid
            )
            FROM profiles p
            WHERE p.id = v_profile.mother_id
        ),

        'spouses', v_spouses,
        'children', v_children
    );

    RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_profile_family_data(uuid) TO authenticated;

COMMENT ON FUNCTION get_profile_family_data IS 'Returns family data for a profile with computed name chains for display. Uses build_name_chain() to generate full ancestry names (up to 10 generations).';
