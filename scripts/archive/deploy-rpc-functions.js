const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRPCFunctions() {
  console.log("🧪 Testing RPC Functions...\n");

  // Test 1: search_profiles_by_name_chain
  try {
    console.log("1️⃣ Testing search_profiles_by_name_chain...");
    const { data, error } = await supabase.rpc(
      "search_profiles_by_name_chain",
      {
        p_name_chain: "محمد",
      },
    );

    if (error) {
      console.log("❌ Function not found or error:", error.message);
      console.log("   You need to deploy the SQL migration first!\n");
    } else {
      console.log("✅ search_profiles_by_name_chain works!");
      console.log(`   Found ${data?.length || 0} profiles\n`);
    }
  } catch (err) {
    console.log("❌ search_profiles_by_name_chain not deployed\n");
  }

  // Test 2: get_profile_tree_context
  try {
    console.log("2️⃣ Testing get_profile_tree_context...");

    // First get a sample profile ID
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (profiles && profiles[0]) {
      const { data, error } = await supabase.rpc("get_profile_tree_context", {
        p_profile_id: profiles[0].id,
      });

      if (error) {
        console.log("❌ Function not found or error:", error.message);
        console.log("   You need to deploy the SQL migration first!\n");
      } else {
        console.log("✅ get_profile_tree_context works!");
        console.log("   Retrieved tree context successfully\n");
      }
    }
  } catch (err) {
    console.log("❌ get_profile_tree_context not deployed\n");
  }

  // Test 3: submit_profile_link_request (requires auth)
  try {
    console.log("3️⃣ Testing submit_profile_link_request...");

    // This will fail without auth, but we can check if function exists
    const { error } = await supabase.rpc("submit_profile_link_request", {
      p_profile_id: "00000000-0000-0000-0000-000000000000",
      p_name_chain: "test",
    });

    if (error?.message?.includes("يجب تسجيل الدخول")) {
      console.log("✅ submit_profile_link_request exists (auth required)\n");
    } else if (error?.code === "PGRST202") {
      console.log("❌ Function not found - needs deployment\n");
    } else {
      console.log(
        "⚠️  Function status unclear:",
        error?.message || "Unknown\n",
      );
    }
  } catch (err) {
    console.log("❌ submit_profile_link_request not deployed\n");
  }
}

async function showDeploymentInstructions() {
  const migrationFile = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "20250117_auth_rpc_functions.sql",
  );
  const sqlContent = fs.readFileSync(migrationFile, "utf8");

  console.log("📋 DEPLOYMENT INSTRUCTIONS:");
  console.log("═══════════════════════════\n");

  console.log("Option 1: Use Supabase Dashboard (Recommended)");
  console.log("──────────────────────────────────────────────");
  console.log(
    "1. Go to: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new",
  );
  console.log(
    "2. Copy the SQL from: supabase/migrations/20250117_auth_rpc_functions.sql",
  );
  console.log('3. Paste and click "Run"\n');

  console.log("Option 2: Use Supabase CLI");
  console.log("───────────────────────────");
  console.log("1. Install: npm install -g supabase");
  console.log("2. Login: supabase login");
  console.log("3. Link: supabase link --project-ref ezkioroyhzpavmbfavyn");
  console.log("4. Push: supabase db push\n");

  console.log("Option 3: Copy to Clipboard (macOS)");
  console.log("────────────────────────────────────");
  console.log(
    "Run: cat supabase/migrations/20250117_auth_rpc_functions.sql | pbcopy",
  );
  console.log("Then paste in Supabase Dashboard SQL Editor\n");

  console.log("📝 The SQL file contains:");
  console.log("• search_profiles_by_name_chain - Search by Arabic names");
  console.log("• get_profile_tree_context - Get family tree context");
  console.log("• submit_profile_link_request - Request profile linking");
  console.log("• profile_link_requests table - Store link requests\n");
}

async function main() {
  console.log("🚀 RPC Functions Deployment Helper\n");
  console.log("═══════════════════════════════════\n");

  await testRPCFunctions();

  console.log("─────────────────────────────────────\n");

  // Check if any function is missing
  const { error: searchError } = await supabase.rpc(
    "search_profiles_by_name_chain",
    {
      p_name_chain: "test",
    },
  );

  if (searchError?.code === "PGRST202") {
    console.log("⚠️  RPC FUNCTIONS NOT DEPLOYED!\n");
    await showDeploymentInstructions();
  } else {
    console.log("✅ RPC functions are deployed and working!\n");
    console.log("You can now test the authentication flow.");
  }
}

main().catch(console.error);
