import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres.ezkioroyhzpavmbfavyn:FwxS5z3MseYqRy2Q@db.ezkioroyhzpavmbfavyn.supabase.co:5432/postgres",
});

const sql = `
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
    total_profiles_count INT;
    male_count INT;
    female_count INT;
    alive_count INT;
    deceased_count INT;
    profiles_with_photos INT;
    profiles_with_dates INT;
    orphaned_profiles INT;
    missing_dates INT;
    new_this_month INT;
    births_this_year INT;
    total_marriages INT;
    family_branches INT;
    largest_branch_size INT;
    avg_children NUMERIC;
    duplicate_names INT;
    generation_counts JSONB;
    newest_members JSONB;
BEGIN
    -- Basic counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE gender = 'male'),
        COUNT(*) FILTER (WHERE gender = 'female'),
        COUNT(*) FILTER (WHERE status = 'alive'),
        COUNT(*) FILTER (WHERE status = 'deceased'),
        COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url != ''),
        COUNT(*) FILTER (WHERE dob_data IS NOT NULL),
        COUNT(*) FILTER (WHERE father_id IS NULL AND mother_id IS NULL AND hid != '1'),
        COUNT(*) FILTER (WHERE dob_data IS NULL OR (status = 'deceased' AND dod_data IS NULL)),
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'),
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 year' AND status = 'alive')
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
    SELECT COUNT(*) INTO total_marriages FROM marriages;

    -- Family branches (count distinct root HIDs)
    SELECT COUNT(DISTINCT SPLIT_PART(hid, '.', 1))
    INTO family_branches
    FROM profiles
    WHERE hid IS NOT NULL AND hid != '';

    -- Largest branch
    SELECT COALESCE(MAX(branch_count), 0)
    INTO largest_branch_size
    FROM (
        SELECT COUNT(*) as branch_count
        FROM profiles
        WHERE hid IS NOT NULL AND deleted_at IS NULL
        GROUP BY SPLIT_PART(hid, '.', 1)
    ) AS branches;

    -- Average children per parent
    SELECT COALESCE(ROUND(AVG(child_count), 1), 0)
    INTO avg_children
    FROM (
        SELECT COUNT(*) as child_count
        FROM profiles
        WHERE father_id IS NOT NULL AND deleted_at IS NULL
        GROUP BY father_id
    ) AS family_sizes;

    -- Generation counts
    SELECT jsonb_object_agg(
        generation::text,
        count
    )
    INTO generation_counts
    FROM (
        SELECT 
            generation,
            COUNT(*) as count
        FROM profiles
        WHERE generation IS NOT NULL AND deleted_at IS NULL
        GROUP BY generation
        ORDER BY generation
        LIMIT 10
    ) AS gen_counts;

    -- Handle null generation_counts
    IF generation_counts IS NULL THEN
        generation_counts := '{}'::jsonb;
    END IF;

    -- Duplicate names
    SELECT COUNT(*)
    INTO duplicate_names
    FROM (
        SELECT name, COUNT(*) as name_count
        FROM profiles
        WHERE deleted_at IS NULL
        GROUP BY name
        HAVING COUNT(*) > 1
    ) AS duplicates;

    -- Newest members
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'added_date', TO_CHAR(created_at, 'DD/MM/YYYY')
        )
        ORDER BY created_at DESC
    )
    INTO newest_members
    FROM (
        SELECT name, created_at
        FROM profiles
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5
    ) AS recent;

    -- Handle null newest_members
    IF newest_members IS NULL THEN
        newest_members := '[]'::jsonb;
    END IF;

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
        'largest_branch_size', largest_branch_size,
        'avg_children', avg_children,
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
`;

async function deploy() {
  console.log("🚀 Deploying via direct PostgreSQL connection...\n");

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    await client.query(sql);
    console.log("✅ Function deployed successfully!\n");

    // Test the function
    const result = await client.query("SELECT admin_get_enhanced_statistics()");
    const stats = result.rows[0].admin_get_enhanced_statistics;

    console.log("📊 Statistics:");
    console.log("  Total profiles:", stats.total_profiles);
    console.log("  Males:", stats.male_count);
    console.log("  Females:", stats.female_count);
    console.log("  Living:", stats.alive_count);
    console.log("  With photos:", stats.profiles_with_photos);
    console.log("  Family branches:", stats.family_branches);
    console.log("  Average children:", stats.avg_children);
    console.log("\n✨ All done!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.end();
  }
}

deploy();
