import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployOptimizedStats() {
  try {
    console.log("Deploying optimized admin statistics functions...");

    // Create indexes for better performance
    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender) WHERE deleted_at IS NULL",
      "CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status) WHERE deleted_at IS NULL",
      "CREATE INDEX IF NOT EXISTS idx_profiles_hid ON profiles(hid) WHERE deleted_at IS NULL",
      "CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC) WHERE deleted_at IS NULL",
      "CREATE INDEX IF NOT EXISTS idx_marriages_munasib ON marriages(munasib)",
      "CREATE INDEX IF NOT EXISTS idx_marriages_husband_wife ON marriages(husband_id, wife_id)",
    ];

    for (const query of indexQueries) {
      console.log(`Creating index: ${query.substring(0, 50)}...`);
      const { error } = await supabase.rpc("execute_sql", { query });
      if (error && !error.message.includes("already exists")) {
        console.log(`Index creation warning: ${error.message}`);
      }
    }

    // Create basic statistics function
    const basicStatsSQL = `
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
$$;`;

    console.log("Creating admin_get_basic_statistics function...");
    const { error: basicError } = await supabase.rpc("execute_sql", {
      query: basicStatsSQL,
    });

    if (basicError) {
      console.error("Error creating basic stats function:", basicError);
    } else {
      console.log("✓ Basic statistics function created");
    }

    // Grant permissions
    await supabase.rpc("execute_sql", {
      query:
        "GRANT EXECUTE ON FUNCTION admin_get_basic_statistics() TO authenticated",
    });

    // Update the existing enhanced statistics function to be more efficient
    const optimizedEnhancedSQL = `
CREATE OR REPLACE FUNCTION admin_get_enhanced_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_basic jsonb;
    v_munasib jsonb;
    v_marriages jsonb;
BEGIN
    -- Get basic stats quickly
    SELECT jsonb_build_object(
        'total_profiles', COUNT(*),
        'male_count', COUNT(*) FILTER (WHERE gender = 'male'),
        'female_count', COUNT(*) FILTER (WHERE gender = 'female'),
        'living_count', COUNT(*) FILTER (WHERE status = 'alive'),
        'deceased_count', COUNT(*) FILTER (WHERE status = 'deceased')
    ) INTO v_basic
    FROM profiles
    WHERE deleted_at IS NULL;
    
    -- Get marriage stats
    SELECT jsonb_build_object(
        'total_marriages', COUNT(*),
        'divorced_count', COUNT(*) FILTER (WHERE divorce_date IS NOT NULL)
    ) INTO v_marriages
    FROM marriages;
    
    -- Get munasib stats with top families
    WITH munasib_profiles AS (
        SELECT p.id, p.name, p.gender
        FROM profiles p
        WHERE p.hid IS NULL
        AND p.deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM marriages m 
            WHERE m.husband_id = p.id OR m.wife_id = p.id
        )
    ),
    munasib_counts AS (
        SELECT 
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE gender = 'male') AS males,
            COUNT(*) FILTER (WHERE gender = 'female') AS females
        FROM munasib_profiles
    ),
    family_counts AS (
        SELECT 
            COALESCE(
                SPLIT_PART(name, ' ', array_length(string_to_array(name, ' '), 1)),
                'غير محدد'
            ) AS family_name,
            COUNT(*) AS count
        FROM munasib_profiles
        GROUP BY family_name
        ORDER BY count DESC
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'total_munasib', mc.total,
        'male_munasib', mc.males,
        'female_munasib', mc.females,
        'top_families', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'family_name', fc.family_name,
                    'count', fc.count,
                    'percentage', ROUND((fc.count::numeric / NULLIF(mc.total, 0) * 100)::numeric, 1)
                )
            ),
            '[]'::jsonb
        )
    ) INTO v_munasib
    FROM munasib_counts mc
    LEFT JOIN family_counts fc ON true
    GROUP BY mc.total, mc.males, mc.females;
    
    -- Build final result
    v_result := jsonb_build_object(
        'basic', v_basic,
        'family', v_marriages,
        'munasib', v_munasib,
        'data_quality', jsonb_build_object(
            'with_photos', (SELECT COUNT(*) FROM profiles WHERE photo_url IS NOT NULL AND deleted_at IS NULL),
            'with_birth_date', (SELECT COUNT(*) FROM profiles WHERE dob_data IS NOT NULL AND deleted_at IS NULL)
        ),
        'activity', jsonb_build_object(
            'added_last_week', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL),
            'added_last_month', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL)
        )
    );
    
    RETURN v_result;
END;
$$;`;

    console.log("Updating admin_get_enhanced_statistics function...");
    const { error: enhancedError } = await supabase.rpc("execute_sql", {
      query: optimizedEnhancedSQL,
    });

    if (enhancedError) {
      console.error("Error updating enhanced stats function:", enhancedError);
    } else {
      console.log("✓ Enhanced statistics function updated");
    }

    console.log("\n✅ Optimization complete!");
    console.log("\nThe admin dashboard will now:");
    console.log("1. Load basic stats immediately");
    console.log("2. Show skeleton loaders during loading");
    console.log("3. Progressively load additional data");
    console.log("4. Use optimized database queries");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

deployOptimizedStats();
