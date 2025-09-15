-- Optimized admin statistics function with better performance
-- Uses CTEs and indexes for faster queries

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_hid ON profiles(hid) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marriages_munasib ON marriages(munasib);
CREATE INDEX IF NOT EXISTS idx_marriages_husband_wife ON marriages(husband_id, wife_id);

-- Drop existing function if exists
DROP FUNCTION IF EXISTS admin_get_enhanced_statistics_optimized();

-- Create optimized version
CREATE OR REPLACE FUNCTION admin_get_enhanced_statistics_optimized()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- Use CTEs to gather all data in one query
    WITH profile_stats AS (
        SELECT 
            COUNT(*) AS total_profiles,
            COUNT(*) FILTER (WHERE gender = 'male') AS male_count,
            COUNT(*) FILTER (WHERE gender = 'female') AS female_count,
            COUNT(*) FILTER (WHERE status = 'alive') AS living_count,
            COUNT(*) FILTER (WHERE status = 'deceased') AS deceased_count,
            COUNT(*) FILTER (WHERE photo_url IS NOT NULL) AS with_photos,
            COUNT(*) FILTER (WHERE dob_data IS NOT NULL) AS with_birth_date,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS added_last_week,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS added_last_month,
            COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') AS updated_last_week
        FROM profiles
        WHERE deleted_at IS NULL
    ),
    marriage_stats AS (
        SELECT 
            COUNT(*) AS total_marriages,
            COUNT(*) FILTER (WHERE divorce_date IS NOT NULL) AS divorced_count
        FROM marriages
    ),
    munasib_stats AS (
        SELECT 
            COUNT(DISTINCT p.id) AS total_munasib,
            COUNT(DISTINCT p.id) FILTER (WHERE p.gender = 'male') AS male_munasib,
            COUNT(DISTINCT p.id) FILTER (WHERE p.gender = 'female') AS female_munasib
        FROM profiles p
        WHERE p.hid IS NULL
        AND p.deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM marriages m 
            WHERE m.husband_id = p.id OR m.wife_id = p.id
        )
    ),
    top_families AS (
        SELECT 
            COALESCE(
                SPLIT_PART(p.name, ' ', array_length(string_to_array(p.name, ' '), 1)),
                'غير محدد'
            ) AS family_name,
            COUNT(*) AS count
        FROM profiles p
        WHERE p.hid IS NULL
        AND p.deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM marriages m 
            WHERE m.husband_id = p.id OR m.wife_id = p.id
        )
        GROUP BY family_name
        ORDER BY count DESC
        LIMIT 10
    ),
    recent_profiles AS (
        SELECT 
            name,
            TO_CHAR(created_at, 'YYYY-MM-DD') AS added_date
        FROM profiles
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'basic', jsonb_build_object(
            'total_profiles', ps.total_profiles,
            'male_count', ps.male_count,
            'female_count', ps.female_count,
            'living_count', ps.living_count,
            'deceased_count', ps.deceased_count
        ),
        'data_quality', jsonb_build_object(
            'with_photos', ps.with_photos,
            'photo_percentage', ROUND((ps.with_photos::numeric / NULLIF(ps.total_profiles, 0) * 100)::numeric, 1),
            'with_birth_date', ps.with_birth_date,
            'birth_date_percentage', ROUND((ps.with_birth_date::numeric / NULLIF(ps.total_profiles, 0) * 100)::numeric, 1)
        ),
        'family', jsonb_build_object(
            'total_marriages', ms.total_marriages,
            'divorced_count', ms.divorced_count
        ),
        'munasib', jsonb_build_object(
            'total_munasib', mus.total_munasib,
            'male_munasib', mus.male_munasib,
            'female_munasib', mus.female_munasib,
            'top_families', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'family_name', tf.family_name,
                        'count', tf.count,
                        'percentage', ROUND((tf.count::numeric / NULLIF(mus.total_munasib, 0) * 100)::numeric, 1)
                    )
                ) FROM top_families tf),
                '[]'::jsonb
            )
        ),
        'activity', jsonb_build_object(
            'added_last_week', ps.added_last_week,
            'added_last_month', ps.added_last_month,
            'updated_last_week', ps.updated_last_week,
            'recent_profiles', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'name', rp.name,
                        'added_date', rp.added_date
                    )
                ) FROM recent_profiles rp),
                '[]'::jsonb
            )
        )
    ) INTO v_result
    FROM profile_stats ps
    CROSS JOIN marriage_stats ms
    CROSS JOIN munasib_stats mus;
    
    RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_get_enhanced_statistics_optimized() TO authenticated;

-- Create a lightweight version for quick loading
CREATE OR REPLACE FUNCTION admin_get_basic_statistics()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT jsonb_build_object(
        'total_profiles', COUNT(*),
        'male_count', COUNT(*) FILTER (WHERE gender = 'male'),
        'female_count', COUNT(*) FILTER (WHERE gender = 'female'),
        'alive_count', COUNT(*) FILTER (WHERE status = 'alive'),
        'deceased_count', COUNT(*) FILTER (WHERE status = 'deceased'),
        'profiles_with_photos', COUNT(*) FILTER (WHERE photo_url IS NOT NULL),
        'profiles_with_dates', COUNT(*) FILTER (WHERE dob_data IS NOT NULL)
    )
    FROM profiles
    WHERE deleted_at IS NULL;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_get_basic_statistics() TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_get_enhanced_statistics_optimized() IS 'Optimized version of admin statistics with better performance using CTEs';
COMMENT ON FUNCTION admin_get_basic_statistics() IS 'Lightweight statistics for quick initial loading';