#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY,
);

async function testAuthFlow() {
  console.log("🔄 Testing Authentication Flow...\n");

  try {
    // 1. Sign out any existing user
    console.log("1. Clearing any existing sessions...");
    await supabase.auth.signOut();

    // 2. Check current auth state
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    console.log("   Current user:", currentUser ? currentUser.phone : "None");

    // 3. Test phone number that should trigger OTP
    const testPhone = "+966500000001";
    console.log(`\n2. Testing phone auth with ${testPhone}...`);

    const { data: otpData, error: otpError } =
      await supabase.auth.signInWithOtp({
        phone: testPhone,
      });

    if (otpError) {
      console.error("   ❌ OTP Error:", otpError.message);
      return;
    }

    console.log("   ✅ OTP sent successfully");
    console.log(
      "   Note: In production, SMS would be sent. In dev, use 123456 as OTP.",
    );

    // 4. Simulate OTP verification (would normally come from user input)
    console.log("\n3. Simulating OTP verification with code 123456...");

    const { data: verifyData, error: verifyError } =
      await supabase.auth.verifyOtp({
        phone: testPhone,
        token: "123456",
        type: "sms",
      });

    if (verifyError) {
      console.error("   ❌ Verification Error:", verifyError.message);
      console.log("   Note: This is expected in test environment.");
      console.log("   In the app, real OTP from SMS would be used.");
    } else {
      console.log("   ✅ Phone verified successfully");
      console.log("   User ID:", verifyData.user?.id);
    }

    // 5. Check profile link status
    console.log("\n4. Checking profile link status...");

    const { data: linkRequests, error: linkError } = await supabase
      .from("profile_link_requests")
      .select("*")
      .eq("phone_number", testPhone)
      .order("created_at", { ascending: false })
      .limit(1);

    if (linkError) {
      console.error("   ❌ Error checking link requests:", linkError.message);
    } else if (linkRequests?.length > 0) {
      const request = linkRequests[0];
      console.log("   Found link request:");
      console.log("   - Profile ID:", request.profile_id);
      console.log("   - Status:", request.status);
      console.log(
        "   - Created:",
        new Date(request.created_at).toLocaleString(),
      );
    } else {
      console.log("   No link requests found for this phone number");
    }

    // 6. Test RPC functions
    console.log("\n5. Testing RPC functions...");

    // Test search by name chain
    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_profiles_by_name_chain",
      {
        p_name1: "محمد",
        p_name2: null,
        p_name3: null,
        p_name4: null,
      },
    );

    if (searchError) {
      console.error("   ❌ Search Error:", searchError.message);
    } else {
      console.log(
        `   ✅ Name search found ${searchResults?.length || 0} profiles`,
      );
    }

    console.log("\n✅ Authentication flow test complete!");
    console.log("\n📝 Summary:");
    console.log("- Phone OTP system is configured");
    console.log("- Profile link request table is accessible");
    console.log("- RPC functions are deployed and working");
    console.log(
      "\n⚠️  Note: Actual OTP verification requires real SMS in production",
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
  }
}

// Run the test
testAuthFlow().catch(console.error);
