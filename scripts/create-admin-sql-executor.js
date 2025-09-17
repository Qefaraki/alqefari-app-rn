const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Use service role key for admin access
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createExecutorAndFix() {
  console.log("Setting up SQL execution capability...\n");

  try {
    // First, let's check current function fields
    const { data: currentTest } = await supabase.rpc("get_branch_data", {
      p_hid: null,
      p_max_depth: 1,
      p_limit: 1,
    });

    if (currentTest && currentTest[0]) {
      const fields = Object.keys(currentTest[0]);
      console.log(`Current get_branch_data returns ${fields.length} fields`);
      if (fields.includes("dob_data") && fields.includes("dod_data")) {
        console.log("✅ Date fields already present! No fix needed.");
        return;
      }
    }

    // Create a simplified version that works with existing structure
    console.log("Creating fixed get_branch_data function...");

    // We'll create a new function with a slightly different name first
    const createNewFunction = `
      CREATE OR REPLACE FUNCTION get_branch_data_v2(
        p_hid TEXT,
        p_max_depth INT DEFAULT 3,
        p_limit INT DEFAULT 100
      )
      RETURNS TABLE (
        id UUID,
        hid TEXT,
        name TEXT,
        father_id UUID,
        mother_id UUID,
        generation INT,
        sibling_order INT,
        gender TEXT,
        photo_url TEXT,
        status TEXT,
        current_residence TEXT,
        occupation TEXT,
        layout_position JSONB,
        descendants_count INT,
        has_more_descendants BOOLEAN,
        dob_data JSONB,
        dod_data JSONB,
        bio TEXT,
        birth_place TEXT
      ) 
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        WITH RECURSIVE family_tree AS (
          -- Base case: start from root or specified HID
          SELECT 
            p.*,
            0 as depth
          FROM profiles p
          WHERE 
            CASE 
              WHEN p_hid IS NULL THEN p.generation = 1
              ELSE p.hid = p_hid
            END
          
          UNION ALL
          
          -- Recursive case: get descendants
          SELECT 
            p.*,
            ft.depth + 1
          FROM profiles p
          INNER JOIN family_tree ft ON p.father_id = ft.id OR p.mother_id = ft.id
          WHERE ft.depth < p_max_depth - 1
        )
        SELECT 
          ft.id,
          ft.hid,
          ft.name,
          ft.father_id,
          ft.mother_id,
          ft.generation,
          ft.sibling_order,
          ft.gender,
          ft.photo_url,
          ft.status,
          ft.current_residence,
          ft.occupation,
          ft.layout_position,
          COALESCE(
            (SELECT COUNT(*)::INT FROM profiles WHERE father_id = ft.id OR mother_id = ft.id),
            0
          ) as descendants_count,
          CASE 
            WHEN ft.depth >= p_max_depth - 1 THEN
              EXISTS(SELECT 1 FROM profiles WHERE father_id = ft.id OR mother_id = ft.id)
            ELSE 
              false
          END as has_more_descendants,
          ft.dob_data,
          ft.dod_data,
          ft.bio,
          ft.birth_place
        FROM family_tree ft
        ORDER BY ft.generation, ft.sibling_order, ft.hid
        LIMIT p_limit;
      END;
      $$;
    `;

    // Since we can't execute raw SQL directly, let's try creating it as an RPC function
    // First check if we have any admin capabilities
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (profiles) {
      console.log("✓ Connected to database");

      // Try to call the new function
      const { data: v2Test, error: v2Error } = await supabase.rpc(
        "get_branch_data_v2",
        {
          p_hid: null,
          p_max_depth: 1,
          p_limit: 1,
        },
      );

      if (!v2Error && v2Test && v2Test[0]) {
        const v2Fields = Object.keys(v2Test[0]);
        if (v2Fields.includes("dob_data") && v2Fields.includes("dod_data")) {
          console.log("✅ get_branch_data_v2 works with date fields!");
          console.log(
            "\nTo fix the issue, run this SQL in Supabase Dashboard:",
          );
          console.log(
            "https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new",
          );
          console.log("\n--- COPY SQL BELOW ---");
          console.log(createNewFunction);
          console.log("\n-- Then rename the function:");
          console.log(
            "DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);",
          );
          console.log(
            "ALTER FUNCTION get_branch_data_v2 RENAME TO get_branch_data;",
          );
          console.log("--- END SQL ---");
          return;
        }
      }

      // If v2 doesn't exist, we need manual intervention
      console.log("\n📋 MANUAL FIX REQUIRED");
      console.log("═══════════════════════");
      console.log("\n1. Go to Supabase SQL Editor:");
      console.log(
        "   https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new",
      );
      console.log("\n2. Copy and paste the SQL from:");
      console.log("   /supabase/deploy-date-fix.sql");
      console.log("\n3. Click 'Run' to execute");
      console.log(
        "\nThis will update get_branch_data to include dob_data and dod_data fields.",
      );
    }
  } catch (error) {
    console.error("Error:", error.message);

    console.log("\n📋 MANUAL FIX REQUIRED");
    console.log("═══════════════════════");
    console.log("\n1. Go to Supabase SQL Editor:");
    console.log(
      "   https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new",
    );
    console.log("\n2. Copy and paste the SQL from:");
    console.log("   /supabase/deploy-date-fix.sql");
    console.log("\n3. Click 'Run' to execute");
  }
}

createExecutorAndFix();
