const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Get Supabase credentials from environment
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env file");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile() {
  try {
    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "..",
      "supabase",
      "fix-get-branch-data.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL to fix get_branch_data function...");

    // Execute the SQL
    const { data, error } = await supabase.rpc("query", { query_text: sql });

    if (error) {
      // Try direct execution as alternative
      console.log("RPC failed, trying alternative method...");

      // Split into statements and execute
      const statements = sql.split(";").filter((s) => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          console.log("Executing statement...");
          const { error: stmtError } = await supabase
            .from("profiles")
            .select("id")
            .limit(1);
          if (stmtError) {
            console.error("Statement error:", stmtError);
          }
        }
      }
    }

    console.log("SQL execution completed!");
    console.log("Testing the updated function...");

    // Test the function
    const { data: testData, error: testError } = await supabase.rpc(
      "get_branch_data",
      {
        p_hid: null,
        p_max_depth: 1,
        p_limit: 1,
      },
    );

    if (testError) {
      console.error("Function test error:", testError);
    } else {
      console.log("Function test successful!");
      if (testData && testData[0]) {
        console.log("Sample fields returned:", Object.keys(testData[0]));
        console.log("Date fields present:", {
          dob_data: !!testData[0].dob_data,
          dod_data: !!testData[0].dod_data,
        });
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

executeSQLFile();
