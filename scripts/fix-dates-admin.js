const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
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

console.log("Connected with service role privileges");

// Read the SQL file
const sqlPath = path.join(__dirname, "..", "supabase", "deploy-date-fix.sql");
const sqlContent = fs.readFileSync(sqlPath, "utf8");

async function executeFix() {
  try {
    console.log("Executing SQL fix for get_branch_data...\n");

    // Execute the SQL directly using the service role client
    // We'll need to parse and execute each statement separately
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (
        statement.toLowerCase().includes("drop function") ||
        statement.toLowerCase().includes("create function") ||
        statement.toLowerCase().includes("grant")
      ) {
        // For DDL statements, we need to execute them via raw SQL
        // Since Supabase doesn't expose raw SQL execution, we'll use a workaround
        console.log(`Executing: ${statement.substring(0, 50)}...`);

        // Create a temporary function to execute our SQL
        const wrapperSql = `
          CREATE OR REPLACE FUNCTION temp_execute_sql()
          RETURNS void AS $$
          BEGIN
            ${statement};
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;

        try {
          // First create the wrapper function
          await supabase.rpc("temp_execute_sql", {});
        } catch (e) {
          // Function doesn't exist yet, that's okay
        }

        // Now we need to execute it differently
        // Let's try the admin_execute_sql if it exists
        const { data, error } = await supabase.rpc("admin_execute_sql", {
          sql: statement + ";",
        });

        if (error) {
          console.log(`Note: ${error.message}`);
        } else {
          console.log(`✓ Statement executed`);
        }
      }
    }

    // Test the function
    console.log("\nTesting get_branch_data function...");
    const { data: testData, error: testError } = await supabase.rpc(
      "get_branch_data",
      {
        p_hid: null,
        p_max_depth: 1,
        p_limit: 1,
      },
    );

    if (testError) {
      console.error("Function test failed:", testError);
      return;
    }

    if (testData && testData[0]) {
      const fields = Object.keys(testData[0]);
      console.log(`✓ Function returned ${fields.length} fields`);

      const hasDobData = fields.includes("dob_data");
      const hasDodData = fields.includes("dod_data");

      console.log(`${hasDobData ? "✓" : "✗"} Has dob_data: ${hasDobData}`);
      console.log(`${hasDodData ? "✓" : "✗"} Has dod_data: ${hasDodData}`);

      if (hasDobData && hasDodData) {
        console.log(
          "\n✅ SUCCESS! Date fields are now included in get_branch_data",
        );
        console.log(
          "The app should now display dates correctly in ProfileSheet.",
        );
      } else {
        console.log("\n⚠️ Date fields still missing.");
        console.log("Creating a direct SQL execution approach...");

        // Try one more approach - create an admin function
        await createAdminFunction();
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

async function createAdminFunction() {
  console.log("\nAttempting to create admin execution function...");

  const createAdminFunctionSql = `
    CREATE OR REPLACE FUNCTION admin_fix_get_branch_data()
    RETURNS void 
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      -- Drop existing function
      DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);
      
      -- Recreate with all fields including dates
      CREATE OR REPLACE FUNCTION get_branch_data(
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
      ) AS $func$
      BEGIN
        RETURN QUERY
        WITH RECURSIVE family_tree AS (
          -- Base case
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
          
          -- Recursive case
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
      $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

      GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;
    END;
    $$ LANGUAGE plpgsql;
  `;

  try {
    // Try to create this function
    const { error: createError } = await supabase.rpc("admin_execute_sql", {
      sql: createAdminFunctionSql,
    });

    if (!createError) {
      // Now execute it
      const { error: execError } = await supabase.rpc(
        "admin_fix_get_branch_data",
        {},
      );

      if (!execError) {
        console.log("✓ Admin function created and executed");

        // Test again
        const { data: finalTest } = await supabase.rpc("get_branch_data", {
          p_hid: null,
          p_max_depth: 1,
          p_limit: 1,
        });

        if (finalTest && finalTest[0] && finalTest[0].dob_data !== undefined) {
          console.log("\n✅ SUCCESS! Dates are now working!");
        }
      }
    }
  } catch (e) {
    console.log("Admin approach not available");
  }
}

executeFix();
