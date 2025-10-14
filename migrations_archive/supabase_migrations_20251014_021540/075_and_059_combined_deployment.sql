-- Combined Deployment: Migration 075 + Migration 059
-- Deploy these together in this exact order with transaction safety
-- Part 0: Pre-flight checks
-- Part 1: Add missing columns to marriages table
-- Part 2: Deploy fixed get_profile_family_data RPC function
-- Part 3: Validation

BEGIN;

-- ========================================================================
-- PART 0: Pre-Flight Checks
-- ========================================================================

-- Verify profiles table has deleted_at column (migration 059 depends on this)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'deleted_at'
    ) THEN
        RAISE EXCEPTION 'ABORT: profiles.deleted_at column missing. Deploy baseline migration first.';
    END IF;

    RAISE NOTICE 'Pre-flight check passed: profiles.deleted_at exists';
END $$;

-- ========================================================================
-- PART 1: Migration 075 - Add Missing Columns to Marriages Table
-- ========================================================================

-- Add deleted_at for soft delete support
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add audit columns for tracking who made changes
-- Note: References profiles(id) to align with permission system v4.2
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id);

-- Add marriage_order to track sequence of marriages
ALTER TABLE marriages
ADD COLUMN IF NOT EXISTS marriage_order INT DEFAULT 1;

-- Backfill marriage_order based on start_date for existing records
-- This ensures correct chronological ordering for users with multiple marriages
WITH ranked_marriages AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY husband_id
            ORDER BY start_date NULLS LAST, created_at NULLS LAST
        ) as calculated_order
    FROM marriages
)
UPDATE marriages m
SET marriage_order = rm.calculated_order
FROM ranked_marriages rm
WHERE m.id = rm.id AND m.marriage_order = 1;  -- Only update defaults

-- Create index on deleted_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_marriages_deleted_at
ON marriages(deleted_at)
WHERE deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN marriages.deleted_at IS
    'Soft delete timestamp. NULL = active marriage, NOT NULL = deleted';

COMMENT ON COLUMN marriages.created_by IS
    'Profile ID of user who created this marriage record. NULL for historical records created before audit system implementation.';

COMMENT ON COLUMN marriages.updated_by IS
    'Profile ID of user who last updated this marriage record.';

COMMENT ON COLUMN marriages.marriage_order IS
    'Sequence number for multiple marriages (1 = first marriage, 2 = second, etc.). Calculated based on start_date.';

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
                    -- Marriage record metadata
                    mar.id as marriage_id,
                    mar.husband_id,
                    mar.wife_id,
                    mar.start_date as marriage_date,
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
     Optimized to prevent N+1 query issues in family management UI.
     Uses Permission System v4.2 for access control.';

-- ========================================================================
-- PART 3: Post-Deployment Validation
-- ========================================================================

DO $$
DECLARE
    v_column_count INT;
    v_index_count INT;
    v_updated_marriages INT;
    v_function_exists BOOLEAN;
BEGIN
    -- Validate all 4 columns were created
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marriages'
      AND column_name IN ('deleted_at', 'created_by', 'updated_by', 'marriage_order');

    IF v_column_count < 4 THEN
        RAISE EXCEPTION 'Migration 075 failed: Only % of 4 columns created', v_column_count;
    END IF;

    -- Validate index was created
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'marriages'
      AND indexname = 'idx_marriages_deleted_at';

    IF v_index_count = 0 THEN
        RAISE EXCEPTION 'Migration 075 failed: Index idx_marriages_deleted_at not created';
    END IF;

    -- Count marriages with updated order
    SELECT COUNT(*) INTO v_updated_marriages
    FROM marriages
    WHERE marriage_order != 1;

    -- Validate function was created
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_profile_family_data'
    ) INTO v_function_exists;

    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'Migration 059 failed: Function get_profile_family_data not created';
    END IF;

    -- All validations passed - log success
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Combined deployment successful!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 075:';
    RAISE NOTICE '  ✓ Added 4 columns to marriages table';
    RAISE NOTICE '  ✓ Backfilled marriage_order for % records', v_updated_marriages;
    RAISE NOTICE '  ✓ Created partial index on deleted_at';
    RAISE NOTICE 'Migration 059:';
    RAISE NOTICE '  ✓ Deployed get_profile_family_data() function';
    RAISE NOTICE '  ✓ Added Permission System v4.2 checks';
    RAISE NOTICE '  ✓ Fixed schema references (marriage_date → start_date)';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Transaction committed successfully. Family Tab is now ready to use.';
END $$;
