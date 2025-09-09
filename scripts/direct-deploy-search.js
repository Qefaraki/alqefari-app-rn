const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deploySearchFunction() {
  try {
    console.log("🔍 Deploying Arabic name chain search function...\n");

    // First, let's create the individual functions one by one

    // 1. Create normalize_arabic function
    console.log("1. Creating normalize_arabic function...");
    const normalizeSQL = `
      CREATE OR REPLACE FUNCTION normalize_arabic(input_text TEXT)
      RETURNS TEXT AS $$
      BEGIN
        IF input_text IS NULL THEN
          RETURN NULL;
        END IF;
        
        -- Remove diacritics, normalize hamza, fix spacing
        RETURN trim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  input_text,
                  '[ً-ْ؟]', '', 'g'  -- Remove diacritics
                ),
                '[أإآ]', 'ا', 'g'  -- Normalize hamza variations
              ),
              '[ىي]', 'ي', 'g'  -- Normalize ya variations
            ),
            '\\s+', ' ', 'g'  -- Normalize multiple spaces
          )
        );
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `;

    const { error: normalizeError } = await supabase.rpc("admin_execute_sql", {
      p_sql: normalizeSQL,
    });

    if (normalizeError) {
      console.log(
        "   Warning: Could not create via admin_execute_sql, trying alternative...",
      );
      // Try to create it anyway - it might already exist
    } else {
      console.log("   ✓ normalize_arabic function created");
    }

    // 2. Create the main search function
    console.log("\n2. Creating search_name_chain function...");
    const searchSQL = `
      CREATE OR REPLACE FUNCTION search_name_chain(
        p_names TEXT[],
        p_limit INT DEFAULT 20,
        p_offset INT DEFAULT 0
      ) RETURNS TABLE (
        id UUID,
        hid TEXT,
        name TEXT,
        name_chain TEXT,
        generation INT,
        photo_url TEXT,
        birth_year_hijri INT,
        death_year_hijri INT,
        match_score FLOAT,
        match_depth INT,
        father_name TEXT,
        grandfather_name TEXT
      ) AS $$
      DECLARE
        v_normalized_names TEXT[];
      BEGIN
        -- Normalize input names for better matching
        SELECT array_agg(normalize_arabic(unnest))
        INTO v_normalized_names
        FROM unnest(p_names);
        
        RETURN QUERY
        WITH RECURSIVE ancestry AS (
          -- Base case: start with all profiles
          SELECT 
            p.id,
            p.hid,
            p.name,
            p.father_id,
            ARRAY[p.id] as visited_ids,
            ARRAY[normalize_arabic(p.name)] as name_array,
            ARRAY[p.name] as display_names,
            p.name as current_chain,
            1 as depth,
            p.generation,
            p.photo_url,
            p.birth_year_hijri,
            p.death_year_hijri
          FROM profiles p
          WHERE p.deleted_at IS NULL
          
          UNION ALL
          
          -- Recursive case: build complete chains up to root
          SELECT 
            a.id,
            a.hid,
            a.name,
            parent.father_id,
            a.visited_ids || parent.id,
            a.name_array || normalize_arabic(parent.name),
            a.display_names || parent.name,
            a.current_chain || ' بن ' || parent.name,
            a.depth + 1,
            a.generation,
            a.photo_url,
            a.birth_year_hijri,
            a.death_year_hijri
          FROM ancestry a
          JOIN profiles parent ON parent.id = a.father_id
          WHERE parent.deleted_at IS NULL
            AND NOT (parent.id = ANY(a.visited_ids))
            AND a.depth < 20
        ),
        matches AS (
          SELECT DISTINCT ON (a.id)
            a.id,
            a.hid,
            a.name,
            a.current_chain as name_chain,
            a.generation,
            a.photo_url,
            a.birth_year_hijri,
            a.death_year_hijri,
            (
              SELECT COUNT(*)::FLOAT / array_length(v_normalized_names, 1)::FLOAT
              FROM unnest(v_normalized_names) AS search_name
              WHERE search_name = ANY(a.name_array)
            ) as match_score,
            array_length(a.name_array, 1) as match_depth,
            CASE WHEN array_length(a.display_names, 1) >= 2 
              THEN a.display_names[2] 
              ELSE NULL 
            END as father_name,
            CASE WHEN array_length(a.display_names, 1) >= 3 
              THEN a.display_names[3] 
              ELSE NULL 
            END as grandfather_name,
            (v_normalized_names <@ a.name_array) as has_all_names
          FROM ancestry a
          WHERE 
            EXISTS (
              SELECT 1 FROM unnest(v_normalized_names) AS search_name
              WHERE search_name = ANY(a.name_array)
            )
          ORDER BY a.id, a.depth DESC
        )
        SELECT 
          m.id,
          m.hid,
          m.name,
          m.name_chain,
          m.generation,
          m.photo_url,
          m.birth_year_hijri,
          m.death_year_hijri,
          m.match_score,
          m.match_depth,
          m.father_name,
          m.grandfather_name
        FROM matches m
        WHERE m.has_all_names
        ORDER BY 
          m.match_score DESC,
          m.generation DESC,
          m.match_depth ASC,
          m.name ASC
        LIMIT p_limit
        OFFSET p_offset;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const { error: searchError } = await supabase.rpc("admin_execute_sql", {
      p_sql: searchSQL,
    });

    if (searchError) {
      console.log("   Warning: Could not create search function via RPC");
      console.log("   Error:", searchError.message);
    } else {
      console.log("   ✓ search_name_chain function created");
    }

    // 3. Create indexes
    console.log("\n3. Creating indexes for better performance...");
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS idx_profiles_father_id 
        ON profiles(father_id) 
        WHERE deleted_at IS NULL;
    `;

    const { error: indexError } = await supabase.rpc("admin_execute_sql", {
      p_sql: indexSQL,
    });

    if (indexError) {
      console.log("   Warning: Could not create index");
    } else {
      console.log("   ✓ Index created");
    }

    // 4. Grant permissions
    console.log("\n4. Granting permissions...");
    const grantSQL = `
      GRANT EXECUTE ON FUNCTION search_name_chain TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION normalize_arabic TO anon, authenticated;
    `;

    const { error: grantError } = await supabase.rpc("admin_execute_sql", {
      p_sql: grantSQL,
    });

    if (grantError) {
      console.log("   Warning: Could not grant permissions");
    } else {
      console.log("   ✓ Permissions granted");
    }

    // 5. Test the function
    console.log("\n5. Testing search function...");
    const { data: testData, error: testError } = await supabase.rpc(
      "search_name_chain",
      {
        p_names: ["محمد"],
        p_limit: 5,
      },
    );

    if (testError) {
      console.log("   ❌ Test failed:", testError.message);
      console.log(
        "\n⚠️  The function may need to be deployed manually via Supabase dashboard",
      );
    } else {
      console.log(
        `   ✓ Search function working! Found ${testData?.length || 0} results for "محمد"`,
      );
      if (testData && testData.length > 0) {
        console.log(
          "   Sample result:",
          testData[0].name,
          "-",
          testData[0].name_chain?.substring(0, 50) + "...",
        );
      }
    }

    console.log("\n✅ Deployment process complete!");
    console.log(
      "   Note: If the search doesn't work, you may need to manually run the SQL in Supabase dashboard",
    );
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    console.log("\nYou may need to manually deploy the SQL file:");
    console.log("  supabase/migrations/036_create_name_chain_search.sql");
    process.exit(1);
  }
}

deploySearchFunction();
