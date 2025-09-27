-- Fix Munasib Statistics Function
-- This fixes the column names and logic for counting married-in family members

DROP FUNCTION IF EXISTS admin_get_enhanced_statistics CASCADE;
DROP FUNCTION IF EXISTS get_enhanced_statistics CASCADE;

CREATE OR REPLACE FUNCTION get_enhanced_statistics()
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Check if user is admin (optional, can be removed for public access)
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        -- For now, allow all authenticated users to see stats
        -- RAISE EXCEPTION 'Unauthorized: Admin access required';
        NULL; -- Continue anyway
    END IF;

    WITH stats AS (
        SELECT 
            -- Basic counts
            COUNT(*) as total_profiles,
            COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_count,
            COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_count,
            COUNT(CASE WHEN status = 'deceased' THEN 1 END) as deceased_count,
            COUNT(CASE WHEN status = 'alive' OR status IS NULL THEN 1 END) as living_count,
            
            -- Data quality
            COUNT(CASE WHEN dob_hijri IS NOT NULL OR dob_gregorian IS NOT NULL THEN 1 END) as with_birth_date,
            COUNT(CASE WHEN dod_hijri IS NOT NULL OR dod_gregorian IS NOT NULL THEN 1 END) as with_death_date,
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
        WHERE deleted_at IS NULL
    ),
    marriage_stats AS (
        SELECT 
            COUNT(*) as total_marriages,
            COUNT(CASE WHEN status = 'divorced' THEN 1 END) as divorced_count,
            COUNT(CASE WHEN status = 'widowed' THEN 1 END) as widowed_count,
            COUNT(CASE WHEN status = 'married' THEN 1 END) as active_marriages
        FROM marriages
    ),
    munasib_stats AS (
        -- المنتسبين - People who married INTO the family (no HID)
        -- For now, count all spouses referenced in marriages who don't have HID
        SELECT 
            COUNT(DISTINCT p.id) as total_munasib,
            COUNT(DISTINCT CASE WHEN p.gender = 'male' THEN p.id END) as male_munasib,
            COUNT(DISTINCT CASE WHEN p.gender = 'female' THEN p.id END) as female_munasib
        FROM profiles p
        WHERE p.hid IS NULL  -- External family members don't have HID
        AND EXISTS (
            SELECT 1 FROM marriages m
            WHERE m.husband_id = p.id OR m.wife_id = p.id
        )
    ),
    munasib_families AS (
        -- Top families that married into our family
        SELECT 
            COALESCE(
                SPLIT_PART(p.name, ' ', -1),  -- Get last name as family name
                'غير محدد'
            ) as family_name,
            COUNT(*) as count
        FROM profiles p
        WHERE p.hid IS NULL  -- External family members
        AND EXISTS (
            SELECT 1 FROM marriages m
            WHERE m.husband_id = p.id OR m.wife_id = p.id
        )
        GROUP BY family_name
        ORDER BY count DESC
        LIMIT 10
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
        WHERE deleted_at IS NULL
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
            'widowed_count', COALESCE(marriage_stats.widowed_count, 0),
            'active_marriages', COALESCE(marriage_stats.active_marriages, 0)
        ),
        'munasib', json_build_object(
            'total_munasib', COALESCE(munasib_stats.total_munasib, 0),
            'male_munasib', COALESCE(munasib_stats.male_munasib, 0),
            'female_munasib', COALESCE(munasib_stats.female_munasib, 0),
            'top_families', COALESCE(
                (SELECT json_agg(
                    json_build_object(
                        'family_name', family_name,
                        'count', count,
                        'percentage', CASE 
                            WHEN munasib_stats.total_munasib > 0
                            THEN ROUND((count::numeric / munasib_stats.total_munasib) * 100, 1)
                            ELSE 0
                        END
                    )
                ) FROM munasib_families),
                '[]'::json
            )
        ),
        'activity', json_build_object(
            'added_last_week', stats.added_last_week,
            'added_last_month', stats.added_last_month,
            'updated_last_week', stats.updated_last_week,
            'recent_profiles', COALESCE(recent_activity.recent_profiles, '[]'::json)
        )
    ) INTO result
    FROM stats
    CROSS JOIN marriage_stats
    CROSS JOIN munasib_stats
    CROSS JOIN recent_activity;

    RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_enhanced_statistics() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_enhanced_statistics() IS 'Returns comprehensive statistics including Munasib (married-in family members) analytics';