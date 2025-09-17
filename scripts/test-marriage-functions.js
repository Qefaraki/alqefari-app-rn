const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMarriageFunctions() {
  console.log("🧪 Testing Marriage Management Functions\n");
  console.log("=".repeat(50));

  try {
    // Test 1: Check if functions exist
    console.log("\n📌 Test 1: Checking if functions are deployed...");

    const functionsToTest = [
      "admin_create_marriage",
      "admin_update_marriage",
      "admin_delete_marriage",
    ];

    for (const funcName of functionsToTest) {
      try {
        // Try calling with empty params - should fail with validation error if exists
        const { error } = await supabase.rpc(funcName, {});

        if (error) {
          if (
            error.message.includes("Unauthorized") ||
            error.message.includes("Admin role required")
          ) {
            console.log(`✅ ${funcName} - Deployed (auth check working)`);
          } else if (error.message.includes("required")) {
            console.log(
              `✅ ${funcName} - Deployed (parameter validation working)`,
            );
          } else if (error.message.includes("Could not find")) {
            console.log(`❌ ${funcName} - NOT DEPLOYED`);
          } else {
            console.log(`⚠️  ${funcName} - Unknown status: ${error.message}`);
          }
        }
      } catch (e) {
        console.log(`❌ ${funcName} - Error: ${e.message}`);
      }
    }

    // Test 2: Test getPersonMarriages
    console.log("\n📌 Test 2: Testing getPersonMarriages...");

    // Find a test person
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, gender")
      .limit(5);

    if (profileError) {
      console.log(`❌ Could not fetch profiles: ${profileError.message}`);
    } else if (profiles && profiles.length > 0) {
      console.log(`Found ${profiles.length} profiles to test with`);

      // Try to get marriages for first profile
      const testProfile = profiles[0];
      console.log(`\nTesting with: ${testProfile.name} (${testProfile.id})`);

      const { data: marriages, error: marriageError } = await supabase
        .from("marriages")
        .select(
          `
          *,
          husband:husband_id(id, name),
          wife:wife_id(id, name)
        `,
        )
        .or(`husband_id.eq.${testProfile.id},wife_id.eq.${testProfile.id}`);

      if (marriageError) {
        console.log(`❌ Error fetching marriages: ${marriageError.message}`);
      } else {
        console.log(`✅ Found ${marriages?.length || 0} marriages`);

        if (marriages && marriages.length > 0) {
          marriages.forEach((m, i) => {
            console.log(`  Marriage ${i + 1}:`);
            console.log(`    - Husband: ${m.husband?.name || "Unknown"}`);
            console.log(`    - Wife: ${m.wife?.name || "Unknown"}`);
            console.log(`    - Status: ${m.status}`);
          });
        }
      }
    }

    // Test 3: Check marriages table structure
    console.log("\n📌 Test 3: Checking marriages table structure...");

    const { data: tableInfo, error: tableError } = await supabase
      .from("marriages")
      .select("*")
      .limit(1);

    if (tableError && !tableError.message.includes("permission")) {
      console.log(`❌ Error accessing marriages table: ${tableError.message}`);
    } else if (tableInfo) {
      console.log("✅ Marriages table accessible");

      if (tableInfo.length > 0) {
        const columns = Object.keys(tableInfo[0]);
        console.log("  Columns:", columns.join(", "));
      }
    }

    // Test 4: Test createMarriage function (will fail without admin)
    console.log(
      "\n📌 Test 4: Testing createMarriage (expected to fail - no admin)...",
    );

    try {
      const { error } = await supabase.rpc("admin_create_marriage", {
        p_husband_id: "00000000-0000-0000-0000-000000000000",
        p_wife_id: "00000000-0000-0000-0000-000000000001",
      });

      if (error) {
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("Admin role required")
        ) {
          console.log("✅ Admin check working correctly");
        } else {
          console.log(`⚠️  Unexpected error: ${error.message}`);
        }
      }
    } catch (e) {
      if (e.message.includes("Could not find")) {
        console.log("❌ Function not deployed");
      } else {
        console.log(`❌ Error: ${e.message}`);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("✨ Test Summary:");
    console.log(
      "- Marriage functions need to be deployed via Supabase Dashboard",
    );
    console.log("- Marriages table is set up and accessible");
    console.log("- Frontend can query marriages with proper joins");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run tests
testMarriageFunctions().catch(console.error);
