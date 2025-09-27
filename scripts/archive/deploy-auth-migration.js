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

async function deployMigration() {
  try {
    // Read the entire migration file
    const migrationPath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "038_phone_auth_system.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("📦 Deploying phone authentication system migration...");

    // Test database connection first
    const { data: testData, error: testError } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("❌ Cannot connect to database:", testError.message);
      return;
    }

    console.log("✅ Connected to database");

    // Since we can't execute raw SQL via the JS client directly,
    // we'll create individual operations for each table and function

    // Test if tables already exist
    const { data: linkRequests } = await supabase
      .from("profile_link_requests")
      .select("id")
      .limit(1);

    if (!linkRequests) {
      console.log(
        "⚠️  Tables need to be created. Please run the following in Supabase SQL Editor:",
      );
      console.log("---");
      console.log(sql);
      console.log("---");
      console.log("\n📝 Copy the SQL above and paste it in:");
      console.log(
        "   https://supabase.com/dashboard/project/ezkioroyhzpavyn/editor",
      );

      // Save to a file for easy access
      const outputPath = path.join(__dirname, "..", "MIGRATION_TO_RUN.sql");
      fs.writeFileSync(outputPath, sql);
      console.log(`\n💾 SQL also saved to: ${outputPath}`);
    } else {
      console.log("✅ Tables already exist");
    }

    // Test if functions exist
    try {
      const { data: searchTest, error: searchError } = await supabase.rpc(
        "search_profiles_by_name_chain",
        {
          p_name_chain: "test",
        },
      );

      if (searchError) {
        console.log("⚠️  Functions need to be created");
      } else {
        console.log("✅ Functions already exist");
      }
    } catch (e) {
      console.log("⚠️  Functions need to be created");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

deployMigration().then(() => {
  console.log("\n🎯 Next steps:");
  console.log("1. Run the migration in Supabase SQL Editor if needed");
  console.log("2. Enable Phone Auth in Authentication > Providers");
  console.log("3. Configure SMS provider (Twilio/MessageBird)");
  console.log("4. Test the authentication flow");
});
