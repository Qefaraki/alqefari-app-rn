const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const sqlPath = path.join(__dirname, "..", "supabase", "deploy-date-fix.sql");
const sqlContent = fs.readFileSync(sqlPath, "utf8");

console.log("Attempting to fix get_branch_data function...");

// Split SQL into statements and execute
async function executeSql() {
  try {
    // First, check if admin_execute_sql exists
    const { data: adminCheck, error: adminError } = await supabase.rpc(
      "admin_execute_sql",
      {
        sql: "SELECT 1",
      },
    );

    if (!adminError) {
      console.log("Using admin_execute_sql...");
      const { data, error } = await supabase.rpc("admin_execute_sql", {
        sql: sqlContent,
      });

      if (error) {
        console.error("Admin execution failed:", error);
        return false;
      }

      console.log("✓ SQL executed via admin function");
      return true;
    }
  } catch (e) {
    console.log("Admin function not available");
  }

  // Try creating a migration file as fallback
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    `${timestamp}_fix_get_branch_data_dates.sql`,
  );

  fs.writeFileSync(migrationPath, sqlContent);
  console.log(`Migration file created: ${migrationPath}`);
  console.log("Run: npx supabase db push");

  return false;
}

// Test the function after execution
async function testFunction() {
  console.log("\nTesting get_branch_data function...");

  const { data, error } = await supabase.rpc("get_branch_data", {
    p_hid: null,
    p_max_depth: 1,
    p_limit: 1,
  });

  if (error) {
    console.error("Function test failed:", error);
    return;
  }

  if (data && data[0]) {
    const fields = Object.keys(data[0]);
    console.log("✓ Function returned", fields.length, "fields");
    console.log("✓ Has dob_data:", fields.includes("dob_data"));
    console.log("✓ Has dod_data:", fields.includes("dod_data"));

    if (fields.includes("dob_data") && fields.includes("dod_data")) {
      console.log(
        "\n✅ Success! Date fields are now included in get_branch_data",
      );
    } else {
      console.log("\n⚠️  Date fields still missing. Manual execution needed.");
    }
  }
}

// Main execution
executeSql().then((success) => {
  if (success) {
    setTimeout(testFunction, 1000);
  } else {
    testFunction();
  }
});
