-- Combined Deployment: Migration 075 + Migration 059
-- Deploy these together in this exact order
-- Part 1: Add missing columns to marriages table
-- Part 2: Deploy fixed get_profile_family_data RPC function

-- ========================================================================
-- PART 1: Migration 075 - Add Missing Columns to Marriages Table
-- ========================================================================

-- Add deleted_at for soft delete support
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add audit columns for tracking who made changes
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add marriage_order to track sequence of marriages
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS marriage_order INT DEFAULT 1;

-- Create index on deleted_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_marriages_deleted_at
ON marriages(deleted_at)
WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN marriages.deleted_at IS
    'Soft delete timestamp. NULL = active marriage, NOT NULL = deleted';

COMMENT ON COLUMN marriages.marriage_order IS
    'Sequence number for multiple marriages (1 = first marriage, 2 = second, etc.)';

-- ========================================================================
-- PART 2: Migration 059 - Profile Family Data RPC Function
-- ========================================================================

CREATE OR REPLACE FUNCTION get_profile_family_data(
    p_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_profile profiles%ROWTYPE;
BEGIN
    -- Permission check: Can view profile (either admin or family member)
    IF NOT (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    -- Get main profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found: %', p_profile_id;
    END IF;

    -- Build comprehensive result with all family relationships
    v_result := jsonb_build_object(
        -- Main profile data
        'profile', to_jsonb(v_profile),

        -- Father (NULL if not set or not found)
        'father', (
            SELECT to_jsonb(p)
            FROM profiles p
            WHERE p.id = v_profile.father_id
        ),

        -- Mother (NULL if not set or not found)
        -- Handles both tree members and Munasib mothers
        'mother', (
            SELECT to_jsonb(p)
            FROM profiles p
            WHERE p.id = v_profile.mother_id
        ),

        -- Spouses: All marriages with spouse profile details
        'spouses', (
            SELECT COALESCE(json_agg(spouse_data), '[]'::json)
            FROM (
                SELECT
                    -- Marriage record
                    mar.id as marriage_id,
                    mar.husband_id,
                    mar.wife_id,
                    mar.start_date as marriage_date,
                    mar.status,
                    mar.munasib,
                    (
                        SELECT COUNT(*)
                        FROM profiles p
                        WHERE p.father_id = mar.husband_id
                          AND p.mother_id = mar.wife_id
                          AND p.deleted_at IS NULL
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
                AND mar.status IN ('married', 'divorced', 'widowed') -- Include all, UI can filter
                AND mar.deleted_at IS NULL
                ORDER BY
                    CASE mar.status
                        WHEN 'married' THEN 1
                        WHEN 'widowed' THEN 2
                        WHEN 'divorced' THEN 3
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
            AND mar.status = 'married'
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
     Includes: profile details, father, mother, all spouses with marriage details,
     all children with mother information and tree visibility flag.
     Optimized to prevent N+1 query issues in family management UI.';

-- Log success
DO $$
BEGIN
    RAISE NOTICE 'Combined deployment successful: Migration 075 + Migration 059';
END $$;
