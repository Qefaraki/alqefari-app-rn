const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role for full access

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exploreDatabase() {
  console.log("🔍 Exploring Alqefari Family Tree Database");
  console.log("=".repeat(50));

  try {
    // 1. Try to identify tables by attempting to query known tables
    console.log("\n📋 IDENTIFYING DATABASE TABLES:");
    const potentialTables = ["profiles", "marriages", "photos", "admins", "auth_users", "profile_links", "link_requests", "performance_metrics"];
    const tableNames = [];

    for (const tableName of potentialTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .limit(1);

        if (!error) {
          tableNames.push(tableName);
          console.log(`  ✓ ${tableName} - exists`);
        }
      } catch (e) {
        console.log(`  ✗ ${tableName} - not found`);
      }
    }
    console.log(tableNames.join(", "));

    // 2. Get row counts for main tables
    console.log("\n📊 TABLE ROW COUNTS:");
    const mainTables = ["profiles", "marriages", "photos", "admins", "auth_users", "profile_links", "link_requests"];

    for (const tableName of mainTables) {
      if (tableNames.includes(tableName)) {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });

          if (!error) {
            console.log(`  ${tableName}: ${count} rows`);
          }
        } catch (e) {
          console.log(`  ${tableName}: Unable to count (${e.message})`);
        }
      }
    }

    // 3. Explore profiles table structure by querying actual data
    console.log("\n🏗️  PROFILES TABLE STRUCTURE:");
    if (tableNames.includes("profiles")) {
      const { data: sampleProfile } = await supabase
        .from("profiles")
        .select("*")
        .limit(1);

      if (sampleProfile && sampleProfile[0]) {
        const columns = Object.keys(sampleProfile[0]);
        console.log("  Columns:", columns.join(", "));
        console.log("  Sample data structure:");
        Object.entries(sampleProfile[0]).forEach(([key, value]) => {
          const type = value === null ? "null" : typeof value;
          console.log(`    ${key}: ${type} (${value === null ? "null" : "has value"})`);
        });
      }
    }

    // 4. Sample profiles data
    console.log("\n👥 SAMPLE PROFILES DATA:");
    const { data: sampleProfiles, error: sampleError } = await supabase
      .from("profiles")
      .select("id, hid, name, gender, generation, father_id, mother_id")
      .limit(5);

    if (!sampleError && sampleProfiles) {
      sampleProfiles.forEach(profile => {
        console.log(`  HID: ${profile.hid}, Name: ${profile.name}, Gender: ${profile.gender}, Gen: ${profile.generation}`);
      });
    }

    // 5. Family tree statistics
    console.log("\n📈 FAMILY TREE STATISTICS:");

    // Gender breakdown
    const { data: genderStats } = await supabase
      .from("profiles")
      .select("gender")
      .not("gender", "is", null);

    if (genderStats) {
      const genderCount = genderStats.reduce((acc, p) => {
        acc[p.gender] = (acc[p.gender] || 0) + 1;
        return acc;
      }, {});
      console.log(`  Gender distribution:`, genderCount);
    }

    // Generation breakdown
    const { data: generationStats } = await supabase
      .from("profiles")
      .select("generation")
      .not("generation", "is", null);

    if (generationStats) {
      const genCount = generationStats.reduce((acc, p) => {
        acc[`Gen ${p.generation}`] = (acc[`Gen ${p.generation}`] || 0) + 1;
        return acc;
      }, {});
      console.log(`  Generation distribution:`, genCount);
    }

    // Munasib (spouses) count
    const { count: munasibCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .is("hid", null);

    console.log(`  Munasib (spouses): ${munasibCount} profiles`);

    // 6. Marriages table structure and data
    if (tableNames.includes("marriages")) {
      console.log("\n💑 MARRIAGES TABLE:");

      const { data: sampleMarriage } = await supabase
        .from("marriages")
        .select("*")
        .limit(1);

      if (sampleMarriage && sampleMarriage[0]) {
        const columns = Object.keys(sampleMarriage[0]);
        console.log("  Columns:", columns.join(", "));
      }

      const { count: marriageCount } = await supabase
        .from("marriages")
        .select("*", { count: "exact", head: true });

      console.log(`  Total marriages: ${marriageCount}`);
    }

    // 7. Test key RPC functions
    console.log("\n⚙️  TESTING KEY RPC FUNCTIONS:");

    // Test get_branch_data function
    try {
      const { data: branchTest, error: branchError } = await supabase
        .rpc("get_branch_data", { p_hid: null, p_max_depth: 1, p_limit: 1 });

      if (!branchError && branchTest && branchTest[0]) {
        console.log("  ✓ get_branch_data - Available");
        console.log("    Returns fields:", Object.keys(branchTest[0]).join(", "));
      } else {
        console.log("  ✗ get_branch_data - Error:", branchError?.message);
      }
    } catch (e) {
      console.log("  ✗ get_branch_data - Not available");
    }

    // Test admin functions
    try {
      const { data: adminTest, error: adminError } = await supabase
        .rpc("admin_validation_dashboard");

      if (!adminError) {
        console.log("  ✓ admin_validation_dashboard - Available");
      } else {
        console.log("  ✗ admin_validation_dashboard - Error:", adminError?.message);
      }
    } catch (e) {
      console.log("  ✗ admin_validation_dashboard - Not available");
    }

    console.log("\n✅ Database exploration complete!");

  } catch (error) {
    console.error("Error exploring database:", error);
  }
}

exploreDatabase();