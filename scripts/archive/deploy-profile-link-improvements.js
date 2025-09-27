const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  console.error("SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function deployMigration() {
  try {
    console.log("🚀 Deploying profile link improvements migration...");

    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "057_profile_link_improvements.sql"
    );
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Split into individual statements (simple split on semicolons at end of line)
    const statements = sqlContent
      .split(/;\s*$/gm)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith("--")) {
        continue;
      }

      // Show progress
      const preview = statement.substring(0, 50).replace(/\n/g, " ");
      console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}...`);

      try {
        const { data, error } = await supabase.rpc("query", {
          query_text: statement + ";"
        });

        if (error) {
          // Try direct execution if RPC fails
          console.log("RPC failed, trying direct execution...");

          // For some statements, we might need to use different approaches
          if (statement.includes("CREATE TABLE") || statement.includes("ALTER TABLE")) {
            // These usually work through RPC, but log the error
            console.error(`❌ Error: ${error.message}`);
            errorCount++;
          } else {
            console.log("⚠️ Statement might need manual execution");
            errorCount++;
          }
        } else {
          console.log("✅ Success");
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error executing statement: ${err.message}`);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Deployment Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log("=".repeat(50));

    // Check if critical tables exist
    console.log("\n🔍 Verifying critical tables...");

    const tables = ["admin_messages", "profile_link_requests", "notifications"];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(1);

      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`);
      } else {
        console.log(`✅ Table '${table}': Exists and accessible`);
      }
    }

    console.log("\n✨ Deployment check complete!");

  } catch (error) {
    console.error("Fatal error during deployment:", error);
    process.exit(1);
  }
}

deployMigration();