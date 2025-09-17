#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function checkFunctions() {
  console.log("🔍 Checking if deletion functions exist in Supabase...\n");

  try {
    // Test 1: Check if unlink_profile_only exists
    console.log("1. Testing unlink_profile_only function...");
    const { data: unlinkData, error: unlinkError } = await supabase.rpc(
      "unlink_profile_only",
    );

    if (unlinkError) {
      if (unlinkError.message.includes("not authenticated")) {
        console.log("   ✅ Function exists (requires authentication)");
      } else if (
        unlinkError.message.includes("function") &&
        unlinkError.message.includes("does not exist")
      ) {
        console.log("   ❌ Function NOT found in database");
      } else {
        console.log(
          "   ⚠️  Function exists but returned:",
          unlinkError.message,
        );
      }
    } else {
      console.log("   ✅ Function exists and returned:", unlinkData);
    }

    // Test 2: Check if delete_user_account_and_unlink exists
    console.log("\n2. Testing delete_user_account_and_unlink function...");
    const { data: deleteData, error: deleteError } = await supabase.rpc(
      "delete_user_account_and_unlink",
    );

    if (deleteError) {
      if (deleteError.message.includes("not authenticated")) {
        console.log("   ✅ Function exists (requires authentication)");
      } else if (
        deleteError.message.includes("function") &&
        deleteError.message.includes("does not exist")
      ) {
        console.log("   ❌ Function NOT found in database");
      } else {
        console.log(
          "   ⚠️  Function exists but returned:",
          deleteError.message,
        );
      }
    } else {
      console.log("   ✅ Function exists and returned:", deleteData);
    }

    // Test 3: List all RPC functions (if we have access)
    console.log("\n3. Checking database for our functions...");
    const { data: functions, error: listError } = await supabase
      .from("pg_proc")
      .select("proname")
      .in("proname", ["delete_user_account_and_unlink", "unlink_profile_only"]);

    if (!listError && functions) {
      console.log(
        "   Found functions:",
        functions.map((f) => f.proname).join(", "),
      );
    } else if (listError) {
      // pg_proc might not be accessible due to permissions
      console.log("   Cannot access pg_proc table (normal for security)");
    }

    console.log("\n📝 Summary:");
    console.log("If functions are not found, they need to be deployed.");
    console.log(
      "Run: node scripts/execute-sql.js supabase/migrations/20250117_delete_account_function.sql",
    );
  } catch (error) {
    console.error("\n❌ Error checking functions:", error.message);
  }
}

// Run the check
checkFunctions().catch(console.error);
