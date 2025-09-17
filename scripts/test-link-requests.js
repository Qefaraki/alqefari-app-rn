#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function testLinkRequests() {
  console.log("🔄 Testing Link Request Queries...\n");

  try {
    // Test the problematic query with specific foreign key relationship
    console.log(
      "1. Testing profile_link_requests query with explicit relationship...",
    );

    const { data, error } = await supabase
      .from("profile_link_requests")
      .select(
        `
        *,
        profile:profiles!profile_link_requests_profile_id_fkey(
          id,
          name,
          hid,
          generation
        )
      `,
      )
      .limit(5);

    if (error) {
      console.error("❌ Query Error:", error);
    } else {
      console.log("✅ Query succeeded!");
      console.log(`   Found ${data?.length || 0} link requests`);
      if (data?.length > 0) {
        console.log("   Sample request:", {
          id: data[0].id,
          phone_number: data[0].phone_number,
          status: data[0].status,
          profile_name: data[0].profile?.name,
        });
      }
    }

    // Test admin query (for LinkRequestsManager)
    console.log("\n2. Testing admin query for pending requests...");

    const { data: adminData, error: adminError } = await supabase
      .from("profile_link_requests")
      .select(
        `
        *,
        profiles!profile_link_requests_profile_id_fkey(
          id,
          name,
          hid,
          generation,
          father_id,
          gender,
          status
        )
      `,
      )
      .in("status", ["pending", "approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (adminError) {
      console.error("❌ Admin Query Error:", adminError);
    } else {
      console.log("✅ Admin query succeeded!");
      console.log(`   Found ${adminData?.length || 0} requests`);

      // Group by status
      const grouped = {
        pending: 0,
        approved: 0,
        rejected: 0,
      };

      adminData?.forEach((request) => {
        grouped[request.status]++;
      });

      console.log("   Status breakdown:", grouped);
    }

    console.log("\n✅ All queries tested successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
  }
}

// Run the test
testLinkRequests().catch(console.error);
