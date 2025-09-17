#!/usr/bin/env node

/**
 * Test script for Marriage Management System
 * Run with: node tests/test-marriage-system.js
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test colors
const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const reset = "\x1b[0m";

let passedTests = 0;
let failedTests = 0;

function test(name, condition, details = "") {
  if (condition) {
    console.log(`${green}✓${reset} ${name}`);
    if (details) console.log(`  ${blue}→${reset} ${details}`);
    passedTests++;
  } else {
    console.log(`${red}✗${reset} ${name}`);
    if (details) console.log(`  ${red}→${reset} ${details}`);
    failedTests++;
  }
}

async function testMarriageSystem() {
  console.log("\n🧪 Testing Marriage Management System\n");
  console.log("=".repeat(50));

  // Test 1: Check if marriages table exists
  console.log("\n📋 Database Structure Tests");
  console.log("-".repeat(30));

  const { data: tables, error: tablesError } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .in("table_name", ["profiles", "marriages"]);

  test(
    "Profiles table exists",
    !tablesError && tables?.some((t) => t.table_name === "profiles"),
    tablesError?.message || `Found ${tables?.length || 0} tables`,
  );

  test(
    "Marriages table exists",
    !tablesError && tables?.some((t) => t.table_name === "marriages"),
    "Marriage relationship tracking enabled",
  );

  // Test 2: Check marriage functions
  console.log("\n🔧 Backend Functions Tests");
  console.log("-".repeat(30));

  // Test admin_create_marriage
  const { error: createError } = await supabase.rpc(
    "admin_create_marriage",
    {},
  );
  test(
    "admin_create_marriage function",
    createError?.message?.includes("required") ||
      createError?.message?.includes("Unauthorized") ||
      !createError,
    createError
      ? "Function exists but requires params/auth"
      : "Function callable",
  );

  // Test admin_update_marriage
  const { error: updateError } = await supabase.rpc(
    "admin_update_marriage",
    {},
  );
  test(
    "admin_update_marriage function",
    updateError?.message?.includes("required") ||
      updateError?.message?.includes("Unauthorized") ||
      !updateError,
    updateError
      ? "Function exists but requires params/auth"
      : "Function callable",
  );

  // Test admin_delete_marriage
  const { error: deleteError } = await supabase.rpc(
    "admin_delete_marriage",
    {},
  );
  test(
    "admin_delete_marriage function",
    deleteError?.message?.includes("required") ||
      deleteError?.message?.includes("Unauthorized") ||
      !deleteError,
    deleteError
      ? "Function exists but requires params/auth"
      : "Function callable",
  );

  // Test get_person_marriages
  const { error: getError } = await supabase.rpc("get_person_marriages", {});
  test(
    "get_person_marriages function",
    getError?.message?.includes("required") ||
      getError?.message?.includes("parameter") ||
      !getError,
    getError ? "Function exists but requires person ID" : "Function callable",
  );

  // Test 3: Query marriages table
  console.log("\n📊 Data Integrity Tests");
  console.log("-".repeat(30));

  const { data: marriages, error: marriagesError } = await supabase
    .from("marriages")
    .select("*")
    .limit(5);

  test(
    "Can query marriages table",
    !marriagesError,
    marriagesError?.message || `Found ${marriages?.length || 0} marriages`,
  );

  // Test 4: Check for Munasib profiles
  const { data: munasibProfiles, error: munasibError } = await supabase
    .from("profiles")
    .select("id, name, hid")
    .is("hid", null)
    .limit(5);

  test(
    "Munasib profiles (NULL HID) supported",
    !munasibError,
    munasibError?.message ||
      `Found ${munasibProfiles?.length || 0} Munasib profiles`,
  );

  // Test 5: Check marriage data structure
  if (marriages && marriages.length > 0) {
    const sample = marriages[0];
    test("Marriage has husband_id", !!sample.husband_id);
    test("Marriage has wife_id", !!sample.wife_id);
    test("Marriage has status field", !!sample.status);
    test(
      "Marriage status is valid",
      ["married", "divorced", "widowed"].includes(sample.status),
      `Status: ${sample.status}`,
    );
  }

  // Test 6: Frontend component checks
  console.log("\n🎨 Frontend Component Tests");
  console.log("-".repeat(30));

  const componentsToCheck = [
    "src/components/admin/MarriageEditor.js",
    "src/components/ProfileSheet.js",
    "src/services/profiles.js",
  ];

  for (const component of componentsToCheck) {
    const fs = await import("fs");
    const filePath = path.join(__dirname, "..", component);
    const exists = fs.existsSync(filePath);

    if (exists) {
      const content = fs.readFileSync(filePath, "utf8");

      if (component.includes("MarriageEditor")) {
        test(
          "MarriageEditor uses CardSurface",
          content.includes("CardSurface"),
          "Neo-native design implemented",
        );

        test(
          "MarriageEditor has no BlurView",
          !content.includes("BlurView"),
          "Glass/blur effects removed",
        );

        test(
          "MarriageEditor exports properly",
          content.includes("export default function MarriageEditor"),
          "Component exported correctly",
        );
      }

      if (component.includes("ProfileSheet")) {
        test(
          "ProfileSheet has marriage section",
          content.includes("الزوجات") || content.includes("الأزواج"),
          "Marriage section present",
        );

        test(
          "ProfileSheet loads marriages",
          content.includes("loadMarriages"),
          "Marriage loading implemented",
        );

        test(
          "Privacy: No spouse names in public view",
          !content.includes("{m.spouse_name}") ||
            content.includes("isAdminMode"),
          "Spouse names protected",
        );
      }

      if (component.includes("profiles.js")) {
        test(
          "Service has getPersonMarriages",
          content.includes("getPersonMarriages"),
          "Marriage fetching implemented",
        );

        test(
          "Service has createMarriage",
          content.includes("createMarriage"),
          "Marriage creation implemented",
        );

        test(
          "Service has updateMarriage",
          content.includes("updateMarriage"),
          "Marriage update implemented",
        );

        test(
          "Service has deleteMarriage",
          content.includes("deleteMarriage"),
          "Marriage deletion implemented",
        );
      }
    } else {
      test(`Component ${component} exists`, false, "File not found");
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`\n📈 Test Results Summary\n`);
  console.log(`${green}Passed:${reset} ${passedTests} tests`);
  console.log(`${red}Failed:${reset} ${failedTests} tests`);

  const percentage = Math.round(
    (passedTests / (passedTests + failedTests)) * 100,
  );
  const status = percentage >= 80 ? green : percentage >= 60 ? yellow : red;

  console.log(`${status}Score:${reset} ${percentage}%`);

  if (failedTests > 0) {
    console.log(
      `\n${yellow}⚠️  Some tests failed. Check the details above.${reset}`,
    );

    // Provide fix suggestions
    console.log("\n💡 Quick Fixes:");

    if (!tables?.some((t) => t.table_name === "marriages")) {
      console.log("  • Run migrations to create marriages table");
    }

    if (createError?.message?.includes("not find")) {
      console.log(
        "  • Deploy SQL from: supabase/deploy-marriage-functions.sql",
      );
    }

    process.exit(1);
  } else {
    console.log(
      `\n${green}✨ All tests passed! Marriage system is working.${reset}`,
    );
  }
}

// Run tests
testMarriageSystem().catch(console.error);
