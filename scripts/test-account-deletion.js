#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

async function testAccountDeletion() {
  console.log("🧪 Testing Account Deletion Functions...\n");

  try {
    // 1. Check current auth state
    console.log("1. Checking current authentication state...");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("   ⚠️  No user is currently logged in");
      console.log("   Please log in through the app first to test deletion");
      return;
    }

    console.log("   ✅ Current user:", user.email || user.phone);
    console.log("   User ID:", user.id);

    // 2. Check if user has a linked profile
    console.log("\n2. Checking for linked profile...");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, hid, user_id")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      console.log("   ✅ Found linked profile:");
      console.log("   - Name:", profile.name);
      console.log("   - HID:", profile.hid);
      console.log("   - Profile ID:", profile.id);
    } else {
      console.log("   ℹ️  No linked profile found");
    }

    // 3. Check for any pending link requests
    console.log("\n3. Checking for link requests...");
    const { data: requests } = await supabase
      .from("profile_link_requests")
      .select("id, status, profile_id")
      .eq("user_id", user.id);

    if (requests && requests.length > 0) {
      console.log(`   Found ${requests.length} link request(s):`);
      requests.forEach((req) => {
        console.log(`   - Request ID: ${req.id}, Status: ${req.status}`);
      });
    } else {
      console.log("   No link requests found");
    }

    // 4. Test the unlink_profile_only function (safer for testing)
    console.log("\n4. Testing unlink_profile_only function...");
    console.log("   This will unlink the profile but keep your account");

    const { data: unlinkResult, error: unlinkError } = await supabase.rpc(
      "unlink_profile_only",
    );

    if (unlinkError) {
      console.error("   ❌ Unlink Error:", unlinkError.message);
    } else {
      console.log("   ✅ Unlink Result:", unlinkResult);

      if (unlinkResult.success) {
        console.log("   Profile successfully unlinked!");
        console.log("   You can now test the authentication flow again.");
      }
    }

    // 5. Verify the profile was unlinked
    console.log("\n5. Verifying profile is unlinked...");
    const { data: checkProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", profile?.id)
      .single();

    if (checkProfile && checkProfile.user_id === null) {
      console.log("   ✅ Profile is now unlinked (user_id is null)");
    } else if (checkProfile) {
      console.log("   ⚠️  Profile still linked to user:", checkProfile.user_id);
    }

    // 6. Info about full deletion
    console.log("\n📝 Note about full account deletion:");
    console.log("   The delete_user_account_and_unlink() function will:");
    console.log("   • Unlink your profile");
    console.log("   • Delete all link requests");
    console.log("   • Prepare for account deletion");
    console.log("   • You'll need to sign out after calling it");
    console.log(
      '\n   To test full deletion, use the "Delete Account" button in Settings',
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
  }
}

// Run the test
testAccountDeletion().catch(console.error);
