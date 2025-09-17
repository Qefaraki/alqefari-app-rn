import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTreeLoading() {
  console.log("Testing date fields in tree data...\n");

  // Test 1: Check what get_branch_data returns
  console.log("1. Testing get_branch_data function:");
  const { data: branchData, error: branchError } = await supabase.rpc(
    "get_branch_data",
    {
      p_hid: null,
      p_max_depth: 2,
      p_limit: 10,
    },
  );

  if (branchError) {
    console.error("❌ get_branch_data error:", branchError);
    return;
  }

  if (branchData && branchData.length > 0) {
    const fields = Object.keys(branchData[0]);
    console.log(
      `✓ Returned ${branchData.length} profiles with ${fields.length} fields`,
    );
    console.log(`  Has dob_data: ${fields.includes("dob_data") ? "✅" : "❌"}`);
    console.log(`  Has dod_data: ${fields.includes("dod_data") ? "✅" : "❌"}`);

    // Check if any profile actually has date data
    const profileWithDate = branchData.find((p) => p.dob_data || p.dod_data);
    if (profileWithDate) {
      console.log("\n✓ Found profile with dates:");
      console.log(`  Name: ${profileWithDate.name}`);
      console.log(`  Birth: ${JSON.stringify(profileWithDate.dob_data)}`);
      console.log(`  Death: ${JSON.stringify(profileWithDate.dod_data)}`);
    } else {
      console.log(
        "\n⚠️  No profiles have date data in get_branch_data results",
      );
    }

    // Show first profile structure
    console.log("\nFirst profile structure:");
    const firstProfile = branchData[0];
    console.log(`  ID: ${firstProfile.id}`);
    console.log(`  Name: ${firstProfile.name}`);
    console.log(`  Fields present: ${Object.keys(firstProfile).join(", ")}`);
  }

  // Test 2: Check profiles table directly
  console.log("\n2. Checking profiles table directly:");
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, dob_data, dod_data, birth_date, death_date")
    .or("dob_data.not.is.null,birth_date.not.is.null")
    .limit(5);

  if (profilesError) {
    console.error("❌ Profiles query error:", profilesError);
  } else if (profiles && profiles.length > 0) {
    console.log(`✓ Found ${profiles.length} profiles with date data:`);
    profiles.forEach((p) => {
      console.log(`\n  ${p.name}:`);
      if (p.dob_data) {
        console.log(`    dob_data: ${JSON.stringify(p.dob_data)}`);
      }
      if (p.birth_date) {
        console.log(`    birth_date (old): ${p.birth_date}`);
      }
      if (p.dod_data) {
        console.log(`    dod_data: ${JSON.stringify(p.dod_data)}`);
      }
      if (p.death_date) {
        console.log(`    death_date (old): ${p.death_date}`);
      }
    });
  } else {
    console.log("⚠️  No profiles have any date data in the database");
  }

  // Test 3: Check if dates need migration
  console.log("\n3. Checking for date migration needs:");
  const { data: oldDateProfiles, error: oldError } = await supabase
    .from("profiles")
    .select("id, name, birth_date, death_date")
    .or("birth_date.not.is.null,death_date.not.is.null")
    .is("dob_data", null)
    .limit(5);

  if (oldDateProfiles && oldDateProfiles.length > 0) {
    console.log(
      `⚠️  Found ${oldDateProfiles.length} profiles with old date format that need migration:`,
    );
    oldDateProfiles.forEach((p) => {
      console.log(
        `  - ${p.name}: birth=${p.birth_date}, death=${p.death_date}`,
      );
    });
    console.log("\n  These need to be migrated to dob_data/dod_data format!");
  } else {
    console.log("✓ No profiles need date migration");
  }

  // Test 4: Show exact function signature
  console.log("\n4. Checking function signature:");
  const { data: funcData, error: funcError } = await supabase.rpc(
    "get_branch_data",
    {
      p_hid: "1",
      p_max_depth: 1,
      p_limit: 1,
    },
  );

  if (funcData && funcData[0]) {
    const returnedFields = Object.keys(funcData[0]);
    console.log(`Function returns ${returnedFields.length} fields`);

    const expectedDateFields = [
      "dob_data",
      "dod_data",
      "birth_date",
      "death_date",
    ];
    const missingFields = expectedDateFields.filter(
      (f) => !returnedFields.includes(f),
    );

    if (missingFields.length > 0) {
      console.log(
        `\n❌ Missing date fields in function: ${missingFields.join(", ")}`,
      );
      console.log("\n📋 ACTION REQUIRED:");
      console.log(
        "The get_branch_data function needs to be updated to include date fields.",
      );
      console.log(
        "Run the SQL from /supabase/deploy-date-fix.sql in Supabase Dashboard",
      );
    } else {
      console.log("✅ All date fields are included in function return");
    }
  }
}

testTreeLoading().catch(console.error);
