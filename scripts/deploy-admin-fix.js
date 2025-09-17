#!/usr/bin/env node

/**
 * Deploy Admin System Fix
 * This script applies the complete admin system fix to Supabase
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  console.log(
    "Please ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployAdminFix() {
  console.log("🚀 Starting Admin System Fix Deployment...\n");

  try {
    // Step 1: Read the SQL fix file
    const sqlPath = path.join(
      __dirname,
      "..",
      "supabase",
      "fix-admin-system-complete.sql",
    );
    const sqlContent = fs.readFileSync(sqlPath, "utf8");
    console.log("📄 Read SQL fix file successfully");

    // Step 2: Test current admin status
    console.log("\n🔍 Testing current admin status...");
    const { data: currentUser } = await supabase.auth.admin.listUsers();
    console.log(`   Current users count: ${currentUser?.users?.length || 0}`);

    // Step 3: Apply the fix via SQL (Note: This requires using Supabase CLI or dashboard)
    console.log(
      "\n⚠️  IMPORTANT: The SQL fix cannot be applied directly via JavaScript.",
    );
    console.log("   Please run the following command to apply the fix:\n");
    console.log(
      '   npx supabase db push --db-url "$DATABASE_URL" < supabase/fix-admin-system-complete.sql\n',
    );
    console.log(
      "   Or paste the contents of supabase/fix-admin-system-complete.sql",
    );
    console.log("   into the Supabase SQL Editor and run it.\n");

    // Step 4: Test if functions exist
    console.log("🧪 Testing if admin functions exist...");

    try {
      const { data: statsTest, error: statsError } = await supabase.rpc(
        "admin_get_statistics",
      );
      if (statsError) {
        console.log(
          "   ❌ admin_get_statistics not found or errored:",
          statsError.message,
        );
      } else {
        console.log(
          "   ✅ admin_get_statistics exists and returned:",
          statsTest,
        );
      }
    } catch (e) {
      console.log("   ❌ admin_get_statistics error:", e.message);
    }

    try {
      const { data: validationTest, error: validationError } =
        await supabase.rpc("admin_validation_dashboard");
      if (validationError) {
        console.log(
          "   ❌ admin_validation_dashboard not found or errored:",
          validationError.message,
        );
      } else {
        console.log("   ✅ admin_validation_dashboard exists");
      }
    } catch (e) {
      console.log("   ❌ admin_validation_dashboard error:", e.message);
    }

    // Step 5: Check if current user has admin role
    console.log("\n👤 Checking your admin status...");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, role")
        .eq("id", user.id)
        .single();

      if (profile) {
        console.log(`   Your profile: ${profile.name || "No name"}`);
        console.log(`   Your role: ${profile.role || "No role set"}`);

        if (profile.role !== "admin") {
          console.log(
            "\n   ⚠️  You are not an admin. To make yourself admin, run this SQL:",
          );
          console.log(
            `   UPDATE profiles SET role = 'admin' WHERE id = '${user.id}';`,
          );
        } else {
          console.log("   ✅ You are an admin!");
        }
      } else {
        console.log("   ❌ No profile found for your user.");
        console.log("\n   To create an admin profile, run this SQL:");
        console.log(
          `   INSERT INTO profiles (id, name, gender, hid, generation, role, status)`,
        );
        console.log(
          `   VALUES ('${user.id}', 'Admin User', 'male', 'ADMIN_1', 0, 'admin', 'alive');`,
        );
      }
    }

    console.log("\n✅ Deployment check complete!");
    console.log("\n📋 Next steps:");
    console.log("1. Apply the SQL fix using the command above");
    console.log("2. Ensure your user has admin role");
    console.log("3. Reload the app and test the admin dashboard");
  } catch (error) {
    console.error("\n❌ Error during deployment:", error);
    process.exit(1);
  }
}

// Run the deployment
deployAdminFix().catch(console.error);
