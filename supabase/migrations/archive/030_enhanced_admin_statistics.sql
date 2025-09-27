-- Enhanced admin statistics function for Arabic family tree
CREATE OR REPLACE FUNCTION admin_get_enhanced_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats JSONB;
BEGIN
    WITH base_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE true) AS total_profiles,
            COUNT(*) FILTER (WHERE gender = 'male') AS male_count,
            COUNT(*) FILTER (WHERE gender = 'female') AS female_count,
            COUNT(*) FILTER (WHERE status = 'alive') AS alive_count,
            COUNT(*) FILTER (WHERE status = 'deceased') AS deceased_count,
            COUNT(*) FILTER (WHERE photo_url IS NOT NULL) AS profiles_with_photos,
            COUNT(*) FILTER (WHERE birth_date IS NOT NULL) AS profiles_with_dates,
            COUNT(*) FILTER (WHERE father_id IS NULL AND mother_id IS NULL AND hid != '1') AS orphaned_profiles,
            COUNT(*) FILTER (WHERE birth_date IS NULL OR (status = 'deceased' AND death_date IS NULL)) AS missing_dates,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 year' AND status = 'alive') AS births_this_year
        FROM profiles
    ),
    marriage_stats AS (
        SELECT COUNT(*) AS total_marriages
        FROM marriages
    ),
    photo_stats AS (
        SELECT COUNT(*) AS total_photos
        FROM profiles
        WHERE photo_url IS NOT NULL
    ),
    branch_stats AS (
        SELECT 
            COUNT(DISTINCT SUBSTRING(hid FROM '^[0-9]+')) AS family_branches
        FROM profiles
        WHERE hid IS NOT NULL
    ),
    largest_branch AS (
        SELECT 
            MAX(branch_count) AS largest_branch_size
        FROM (
            SELECT 
                SUBSTRING(hid FROM '^[0-9]+') AS branch,
                COUNT(*) AS branch_count
            FROM profiles
            WHERE hid IS NOT NULL
            GROUP BY SUBSTRING(hid FROM '^[0-9]+')
        ) AS branches
    ),
    avg_children AS (
        SELECT 
            ROUND(AVG(child_count), 1) AS avg_children
        FROM (
            SELECT 
                father_id,
                COUNT(*) AS child_count
            FROM profiles
            WHERE father_id IS NOT NULL
            GROUP BY father_id
        ) AS family_sizes
        WHERE child_count > 0
    ),
    generation_data AS (
        SELECT 
            jsonb_object_agg(
                generation::text,
                count
            ) AS generation_counts
        FROM (
            SELECT 
                LENGTH(hid) - LENGTH(REPLACE(hid, '.', '')) + 1 AS generation,
                COUNT(*) AS count
            FROM profiles
            WHERE hid IS NOT NULL
            GROUP BY generation
            ORDER BY generation
        ) AS gen_counts
    ),
    duplicate_name_check AS (
        SELECT COUNT(*) AS duplicate_names
        FROM (
            SELECT name, COUNT(*) AS name_count
            FROM profiles
            GROUP BY name
            HAVING COUNT(*) > 1
        ) AS duplicates
    ),
    newest_members_data AS (
        SELECT 
            jsonb_agg(
                jsonb_build_object(
                    'name', name,
                    'added_date', TO_CHAR(created_at, 'DD/MM/YYYY')
                )
                ORDER BY created_at DESC
            ) AS newest_members
        FROM (
            SELECT name, created_at
            FROM profiles
            ORDER BY created_at DESC
            LIMIT 5
        ) AS recent
    )
    SELECT jsonb_build_object(
        'total_profiles', bs.total_profiles,
        'male_count', bs.male_count,
        'female_count', bs.female_count,
        'alive_count', bs.alive_count,
        'deceased_count', bs.deceased_count,
        'profiles_with_photos', bs.profiles_with_photos,
        'profiles_with_dates', bs.profiles_with_dates,
        'orphaned_profiles', bs.orphaned_profiles,
        'missing_dates', bs.missing_dates,
        'new_this_month', bs.new_this_month,
        'births_this_year', bs.births_this_year,
        'total_marriages', ms.total_marriages,
        'total_photos', ps.total_photos,
        'family_branches', brs.family_branches,
        'largest_branch_size', lbs.largest_branch_size,
        'avg_children', ac.avg_children,
        'generation_counts', gd.generation_counts,
        'duplicate_names', dn.duplicate_names,
        'newest_members', nm.newest_members
    ) INTO stats
    FROM base_stats bs
    CROSS JOIN marriage_stats ms
    CROSS JOIN photo_stats ps
    CROSS JOIN branch_stats brs
    CROSS JOIN largest_branch lbs
    CROSS JOIN avg_children ac
    CROSS JOIN generation_data gd
    CROSS JOIN duplicate_name_check dn
    CROSS JOIN newest_members_data nm;
    
    RETURN stats;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_enhanced_statistics() TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_get_enhanced_statistics() IS 'Returns comprehensive statistics for admin dashboard including demographics, growth trends, and data quality metrics';