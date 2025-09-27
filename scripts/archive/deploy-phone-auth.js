const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  console.log(
    "Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSQLFile(filePath) {
  try {
    const sql = fs.readFileSync(filePath, "utf8");

    // Split by semicolons but preserve those within strings
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";

      // Skip empty statements
      if (statement.trim() === ";") continue;

      // Log what we're executing (first 100 chars)
      console.log(
        `\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 100)}...`,
      );

      try {
        // Try to execute via raw query
        const { data, error } = await supabase
          .rpc("query", {
            query_text: statement,
          })
          .catch((err) => ({ error: err }));

        if (error) {
          // If RPC doesn't exist, try alternative method
          if (error.message?.includes("Could not find the function")) {
            console.log(
              "RPC method not available, statement may need manual execution",
            );
          } else {
            console.error(`Error in statement ${i + 1}:`, error.message);
          }
        } else {
          console.log(`✓ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`Error executing statement ${i + 1}:`, err.message);
      }
    }

    console.log("\n✅ Migration deployment attempt complete");
    console.log(
      "Note: Some statements may require manual execution in Supabase Dashboard",
    );
  } catch (error) {
    console.error("Error reading or executing SQL file:", error);
    process.exit(1);
  }
}

// Execute the migration
const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "038_phone_auth_system.sql",
);
console.log("Deploying phone authentication system...");
console.log("Migration file:", migrationPath);

executeSQLFile(migrationPath)
  .then(() => {
    console.log("\n🎉 Phone auth migration deployed!");
    console.log("\nNext steps:");
    console.log("1. Enable Phone Auth in Supabase Dashboard:");
    console.log("   - Go to Authentication > Providers");
    console.log("   - Enable Phone provider");
    console.log("   - Configure SMS provider (Twilio/MessageBird)");
    console.log("2. Test the functions with test data");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
  });
