const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Create Supabase client with service role key for admin operations
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables");
  console.error(
    "Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_DB_PASSWORD)",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function deployProfilePhotos() {
  console.log("🚀 Deploying Profile Photos Gallery System...\n");

  try {
    // Read the migration file
    const migrationPath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "038_profile_photos_gallery.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    // Split SQL into individual statements
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip if it's just a comment
      if (statement.startsWith("--") || statement.length === 0) {
        continue;
      }

      // Get a description of what we're doing
      let description = "SQL statement";
      if (statement.includes("CREATE TABLE")) {
        description = "Creating profile_photos table";
      } else if (statement.includes("CREATE INDEX")) {
        const indexMatch = statement.match(/CREATE INDEX[^"]+"?(\w+)"?/i);
        description = `Creating index ${indexMatch ? indexMatch[1] : ""}`;
      } else if (statement.includes("CREATE POLICY")) {
        const policyMatch = statement.match(/CREATE POLICY[^"]+"([^"]+)"/);
        description = `Creating policy: ${policyMatch ? policyMatch[1] : "policy"}`;
      } else if (statement.includes("CREATE OR REPLACE FUNCTION")) {
        const funcMatch = statement.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/);
        description = `Creating function: ${funcMatch ? funcMatch[1] : "function"}`;
      } else if (statement.includes("CREATE TRIGGER")) {
        const triggerMatch = statement.match(/CREATE TRIGGER\s+(\w+)/);
        description = `Creating trigger: ${triggerMatch ? triggerMatch[1] : "trigger"}`;
      } else if (statement.includes("GRANT")) {
        description = "Granting permissions";
      } else if (statement.includes("ALTER TABLE")) {
        description = "Altering table";
      }

      process.stdout.write(
        `[${i + 1}/${statements.length}] ${description}... `,
      );

      try {
        // Use the admin API endpoint to execute raw SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            sql: statement + ";",
          }),
        });

        if (response.ok) {
          console.log("✅");
          successCount++;
        } else {
          const errorText = await response.text();
          if (
            errorText.includes("already exists") ||
            errorText.includes("duplicate")
          ) {
            console.log("⚠️  Already exists");
            successCount++;
          } else {
            console.log("❌");
            console.error(`   Error: ${errorText.substring(0, 100)}`);
            errorCount++;
          }
        }
      } catch (error) {
        console.log("❌");
        console.error(`   Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Results: ${successCount} succeeded, ${errorCount} failed`);

    // Test if the table was created
    console.log("\n🧪 Testing the deployment...\n");

    // Test 1: Check if table exists
    const { data: tableTest, error: tableError } = await supabase
      .from("profile_photos")
      .select("id")
      .limit(1);

    if (!tableError || tableError.code === "PGRST116") {
      console.log("✅ Table profile_photos exists");
    } else {
      console.log("❌ Table profile_photos not found:", tableError.message);
    }

    // Test 2: Check if functions exist
    const testFunctions = [
      "get_profile_photos",
      "admin_add_profile_photo",
      "admin_reorder_profile_photos",
      "admin_delete_profile_photo",
    ];

    for (const funcName of testFunctions) {
      try {
        const { error } = await supabase.rpc(funcName, {
          p_profile_id: "00000000-0000-0000-0000-000000000000",
        });

        if (
          !error ||
          error.message.includes("not found") ||
          error.message.includes("violates")
        ) {
          console.log(`✅ Function ${funcName} exists`);
        } else {
          console.log(
            `⚠️  Function ${funcName} might have issues:`,
            error.message.substring(0, 50),
          );
        }
      } catch (err) {
        console.log(
          `❌ Function ${funcName} error:`,
          err.message.substring(0, 50),
        );
      }
    }

    console.log("\n" + "=".repeat(50));

    if (errorCount === 0) {
      console.log("🎉 Profile Photos Gallery system deployed successfully!");
      console.log("\n📸 You can now:");
      console.log("  - Add multiple photos per profile");
      console.log("  - Set primary photos");
      console.log("  - Add captions to photos");
      console.log("  - Reorder photo galleries");
    } else {
      console.log("⚠️  Deployment completed with some errors");
      console.log("Some features might not work correctly");
    }
  } catch (error) {
    console.error("❌ Fatal error during deployment:", error);
    process.exit(1);
  }
}

// Run the deployment
deployProfilePhotos().catch(console.error);
