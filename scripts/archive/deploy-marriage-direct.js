const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables");
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Read the SQL file
const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "021_marriage_admin_rpcs.sql",
);
const sqlContent = fs.readFileSync(sqlPath, "utf8");

async function deployFunctions() {
  console.log("🚀 Deploying marriage admin functions to Supabase...\n");
  console.log("📄 SQL File:", sqlPath);
  console.log("🌐 Supabase URL:", supabaseUrl);
  console.log(
    "\n⚠️  IMPORTANT: This deployment requires direct database access.",
  );
  console.log(
    "   The SQL functions need to be deployed via Supabase Dashboard.\n",
  );

  // Output the SQL for manual deployment
  const outputPath = path.join(
    __dirname,
    "..",
    "supabase",
    "deploy-marriage-functions.sql",
  );
  fs.writeFileSync(outputPath, sqlContent);

  console.log("✅ SQL file prepared for deployment:", outputPath);
  console.log("\n📋 Next Steps:");
  console.log("1. Go to Supabase Dashboard: https://app.supabase.com");
  console.log("2. Select your project");
  console.log("3. Go to SQL Editor");
  console.log("4. Paste and run the content from:", outputPath);
  console.log("\n🔧 Alternatively, you can deploy using Supabase CLI:");
  console.log("   supabase db push --db-url $DATABASE_URL");

  // Test if functions already exist
  console.log("\n🔍 Checking if functions already exist...");

  try {
    // Try to call admin_create_marriage with no params (will fail but shows if function exists)
    const { error: createError } = await supabase.rpc(
      "admin_create_marriage",
      {},
    );
    if (createError) {
      if (
        createError.message.includes("required") ||
        createError.message.includes("Unauthorized")
      ) {
        console.log("✅ admin_create_marriage already exists");
      } else if (createError.message.includes("not find")) {
        console.log("❌ admin_create_marriage not found - needs deployment");
      }
    }

    // Try to call admin_update_marriage
    const { error: updateError } = await supabase.rpc(
      "admin_update_marriage",
      {},
    );
    if (updateError) {
      if (
        updateError.message.includes("required") ||
        updateError.message.includes("Unauthorized")
      ) {
        console.log("✅ admin_update_marriage already exists");
      } else if (updateError.message.includes("not find")) {
        console.log("❌ admin_update_marriage not found - needs deployment");
      }
    }

    // Try to call admin_delete_marriage
    const { error: deleteError } = await supabase.rpc(
      "admin_delete_marriage",
      {},
    );
    if (deleteError) {
      if (
        deleteError.message.includes("required") ||
        deleteError.message.includes("Unauthorized")
      ) {
        console.log("✅ admin_delete_marriage already exists");
      } else if (deleteError.message.includes("not find")) {
        console.log("❌ admin_delete_marriage not found - needs deployment");
      }
    }
  } catch (error) {
    console.error("Error checking functions:", error.message);
  }

  console.log("\n📝 Summary:");
  console.log("The marriage admin functions SQL has been prepared.");
  console.log("Please deploy it manually via Supabase Dashboard or CLI.");
}

// Run deployment
deployFunctions().catch(console.error);
