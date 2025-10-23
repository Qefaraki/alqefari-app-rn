-- Fix admin_get_enhanced_statistics to check user_id instead of id column
--
-- CRITICAL BUG FIX: The previous migration (20251024000000) incorrectly checked:
--   WHERE id = auth.uid()
-- This is wrong because:
--   - auth.uid() returns auth.users.id
--   - profiles.id is the profile's primary key (different UUID)
--   - profiles.user_id links to auth.users.id (correct column to check)
--
-- This bug existed in the original migration (20251023000000) and was inherited
-- in our update (20251024000000). Now we fix it properly.
--
-- Solution: Change to WHERE user_id = auth.uid()

DROP FUNCTION IF EXISTS admin_get_enhanced_statistics() CASCADE;

CREATE OR REPLACE FUNCTION admin_get_enhanced_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user is admin (super_admin, admin, or moderator)
    -- CRITICAL FIX: Check user_id column (links to auth.users.id), not id column (profile primary key)
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
        AND role IN ('super_admin', 'admin', 'moderator')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required'
            USING ERRCODE = 'P0001',
                  HINT = 'Only admin roles (super_admin, admin, moderator) can access dashboard statistics';
    END IF;

    WITH stats AS (
        SELECT
            -- Basic counts - ONLY Al-Qefari family (hid IS NOT NULL, not soft-deleted)
            COUNT(*) as total_profiles,
            COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_count,
            COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_count,
            COUNT(CASE WHEN status = 'deceased' THEN 1 END) as deceased_count,
            COUNT(CASE WHEN status = 'alive' OR status IS NULL THEN 1 END) as living_count,

            -- Data quality
            COUNT(CASE WHEN dob_data IS NOT NULL THEN 1 END) as with_birth_date,
            COUNT(CASE WHEN dod_data IS NOT NULL THEN 1 END) as with_death_date,
            COUNT(CASE WHEN photo_url IS NOT NULL THEN 1 END) as with_photos,

            -- Family metrics
            COUNT(DISTINCT father_id) as unique_fathers,
            COUNT(DISTINCT mother_id) as unique_mothers,
            COUNT(CASE WHEN father_id IS NOT NULL THEN 1 END) as with_father,
            COUNT(CASE WHEN mother_id IS NOT NULL THEN 1 END) as with_mother,

            -- Activity
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as added_last_week,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as added_last_month,
            COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) as updated_last_week
        FROM profiles
        WHERE hid IS NOT NULL  -- Only Al-Qefari family members
        AND deleted_at IS NULL  -- Exclude soft-deleted profiles
    ),
    marriage_stats AS (
        SELECT
            COUNT(*) as total_marriages,
            COUNT(CASE WHEN status = 'past' THEN 1 END) as divorced_count,
            COUNT(CASE WHEN spouse_father_id IS NOT NULL OR spouse_mother_id IS NOT NULL THEN 1 END) as with_spouse_parents
        FROM marriages
        WHERE deleted_at IS NULL
    ),
    munasib_stats AS (
        -- المنتسبين - Married-in family members (hid IS NULL)
        SELECT
            COUNT(DISTINCT p.id) as total_munasib,
            COUNT(DISTINCT CASE WHEN p.gender = 'male' THEN p.id END) as male_munasib,
            COUNT(DISTINCT CASE WHEN p.gender = 'female' THEN p.id END) as female_munasib,
            COUNT(DISTINCT CASE
                WHEN p.father_id IS NOT NULL OR p.mother_id IS NOT NULL
                THEN p.id
            END) as munasib_with_parents
        FROM profiles p
        WHERE EXISTS (
            SELECT 1 FROM marriages m
            WHERE (m.husband_id = p.id OR m.wife_id = p.id)
            AND m.deleted_at IS NULL
            AND p.hid IS NULL  -- External family members don't have HID
        )
        AND p.deleted_at IS NULL  -- Exclude soft-deleted munasib
    ),
    recent_activity AS (
        SELECT
            json_agg(
                json_build_object(
                    'id', id,
                    'name', name,
                    'created_at', created_at,
                    'created_by', created_by
                ) ORDER BY created_at DESC
            ) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_profiles
        FROM profiles
        WHERE hid IS NOT NULL  -- Only Al-Qefari family
        AND deleted_at IS NULL  -- Exclude soft-deleted
        LIMIT 10
    )
    SELECT json_build_object(
        'basic', json_build_object(
            'total_profiles', stats.total_profiles,
            'male_count', stats.male_count,
            'female_count', stats.female_count,
            'deceased_count', stats.deceased_count,
            'living_count', stats.living_count
        ),
        'data_quality', json_build_object(
            'with_birth_date', stats.with_birth_date,
            'birth_date_percentage', CASE
                WHEN stats.total_profiles > 0
                THEN ROUND((stats.with_birth_date::numeric / stats.total_profiles) * 100, 1)
                ELSE 0
            END,
            'with_death_date', stats.with_death_date,
            'with_photos', stats.with_photos,
            'photo_percentage', CASE
                WHEN stats.total_profiles > 0
                THEN ROUND((stats.with_photos::numeric / stats.total_profiles) * 100, 1)
                ELSE 0
            END
        ),
        'family', json_build_object(
            'unique_fathers', stats.unique_fathers,
            'unique_mothers', stats.unique_mothers,
            'with_father', stats.with_father,
            'with_mother', stats.with_mother,
            'total_marriages', COALESCE(marriage_stats.total_marriages, 0),
            'divorced_count', COALESCE(marriage_stats.divorced_count, 0),
            'with_spouse_parents', COALESCE(marriage_stats.with_spouse_parents, 0)
        ),
        'munasib', json_build_object(
            'total_munasib', COALESCE(munasib_stats.total_munasib, 0),
            'male_munasib', COALESCE(munasib_stats.male_munasib, 0),
            'female_munasib', COALESCE(munasib_stats.female_munasib, 0),
            'munasib_with_parents', COALESCE(munasib_stats.munasib_with_parents, 0)
        ),
        'activity', json_build_object(
            'added_last_week', stats.added_last_week,
            'added_last_month', stats.added_last_month,
            'updated_last_week', stats.updated_last_week,
            'recent_profiles', recent_activity.recent_profiles
        )
    ) INTO result
    FROM stats, marriage_stats, munasib_stats, recent_activity;

    RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_enhanced_statistics() TO authenticated;

-- Add function documentation
COMMENT ON FUNCTION admin_get_enhanced_statistics IS
'Returns comprehensive family tree statistics for admin dashboard.
Permission: Requires super_admin, admin, or moderator role
Used by: AdminDashboardUltraOptimized.js (lines 218, 230)
Aligns with: ADMIN_FEATURES registry (src/config/adminFeatures.js)
Returns: JSON object with basic, data_quality, family, munasib, and activity metrics
Modified: 2025-10-24 - Fixed user_id column reference (critical bug fix)
Previous: Checked profiles.id = auth.uid() (WRONG - auth.uid() is user ID, not profile ID)
Now: Checks profiles.user_id = auth.uid() (CORRECT - user_id links to auth.users)';
