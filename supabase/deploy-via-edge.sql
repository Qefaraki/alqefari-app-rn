-- Drop existing function if exists
DROP FUNCTION IF EXISTS admin_get_enhanced_statistics();

-- Enhanced admin statistics function for Arabic family tree
CREATE OR REPLACE FUNCTION admin_get_enhanced_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats JSONB;
    total_profiles_count INT := 0;
    male_count INT := 0;
    female_count INT := 0;
    alive_count INT := 0;
    deceased_count INT := 0;
    profiles_with_photos INT := 0;
    profiles_with_dates INT := 0;
    orphaned_profiles INT := 0;
    missing_dates INT := 0;
    new_this_month INT := 0;
    births_this_year INT := 0;
    total_marriages INT := 0;
    family_branches INT := 0;
    largest_branch_size INT := 0;
    avg_children NUMERIC := 0;
    duplicate_names INT := 0;
    generation_counts JSONB := '{}'::jsonb;
    newest_members JSONB := '[]'::jsonb;
BEGIN
    -- Basic counts with NULL handling
    SELECT 
        COALESCE(COUNT(*), 0),
        COALESCE(COUNT(*) FILTER (WHERE gender = 'male'), 0),
        COALESCE(COUNT(*) FILTER (WHERE gender = 'female'), 0),
        COALESCE(COUNT(*) FILTER (WHERE status = 'alive'), 0),
        COALESCE(COUNT(*) FILTER (WHERE status = 'deceased'), 0),
        COALESCE(COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url != ''), 0),
        COALESCE(COUNT(*) FILTER (WHERE dob_data IS NOT NULL), 0),
        COALESCE(COUNT(*) FILTER (WHERE father_id IS NULL AND mother_id IS NULL AND hid != '1'), 0),
        COALESCE(COUNT(*) FILTER (WHERE dob_data IS NULL), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0),
        COALESCE(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 year'), 0)
    INTO 
        total_profiles_count,
        male_count,
        female_count,
        alive_count,
        deceased_count,
        profiles_with_photos,
        profiles_with_dates,
        orphaned_profiles,
        missing_dates,
        new_this_month,
        births_this_year
    FROM profiles
    WHERE deleted_at IS NULL;

    -- Marriage count
    SELECT COALESCE(COUNT(*), 0) INTO total_marriages FROM marriages;

    -- Family branches
    SELECT COALESCE(COUNT(DISTINCT SPLIT_PART(hid, '.', 1)), 0)
    INTO family_branches
    FROM profiles
    WHERE hid IS NOT NULL AND hid != '';

    -- Build final result
    stats := jsonb_build_object(
        'total_profiles', total_profiles_count,
        'male_count', male_count,
        'female_count', female_count,
        'alive_count', alive_count,
        'deceased_count', deceased_count,
        'profiles_with_photos', profiles_with_photos,
        'profiles_with_dates', profiles_with_dates,
        'orphaned_profiles', orphaned_profiles,
        'missing_dates', missing_dates,
        'new_this_month', new_this_month,
        'births_this_year', births_this_year,
        'total_marriages', total_marriages,
        'total_photos', profiles_with_photos,
        'family_branches', family_branches,
        'largest_branch_size', 0,
        'avg_children', 0,
        'generation_counts', generation_counts,
        'duplicate_names', duplicate_names,
        'newest_members', newest_members
    );
    
    RETURN stats;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_enhanced_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_enhanced_statistics() TO anon;