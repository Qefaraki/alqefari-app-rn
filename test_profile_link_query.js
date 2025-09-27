#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testProfileLinkQuery() {
  console.log('Testing the fixed ProfileLinkStatusCard query...\n');

  // Test the original failing query (should work now)
  console.log('1. Testing with user_id that has a pending request:');
  try {
    const { data, error } = await supabase
      .from("profile_link_requests")
      .select(`
        *,
        profile:profiles!profile_link_requests_profile_id_fkey(
          id,
          name,
          father_id,
          mother_id
        )
      `)
      .eq("user_id", "f387f27e-0fdb-4379-b474-668c0edfc3d1")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Query failed:', error.message);
    } else {
      console.log('✅ Query succeeded!');
      console.log('   Found requests:', data.length);
      if (data.length > 0) {
        console.log('   Request ID:', data[0].id);
        console.log('   Status:', data[0].status);
        console.log('   Profile name:', data[0].profile?.name || 'No profile');
        console.log('   Name chain:', data[0].name_chain);
      }
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n2. Testing simple profile query to verify column exists:');
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, father_id, mother_id")
      .eq("id", "ff239ed7-24d5-4298-a135-79dc0f70e5b8")
      .single();

    if (error) {
      console.error('❌ Profile query failed:', error.message);
    } else {
      console.log('✅ Profile query succeeded!');
      console.log('   Profile name:', data.name);
      console.log('   Profile ID:', data.id);
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n3. Testing the loadProfileStatus logic for this specific user:');
  const userId = "f387f27e-0fdb-4379-b474-668c0edfc3d1";

  try {
    // Check if user has a linked profile first
    const { data: linkedProfile, error: linkedError } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .single();

    if (linkedProfile) {
      console.log('✅ User has linked profile:', linkedProfile.name);
    } else if (linkedError && linkedError.code !== 'PGRST116') { // PGRST116 is "no rows found"
      console.log('❌ Linked profile query error:', linkedError.message);
    } else {
      console.log('ℹ️  User has no linked profile, checking for pending requests...');

      // Check for pending requests (this is the fixed query)
      const { data: requests, error: requestError } = await supabase
        .from("profile_link_requests")
        .select(`
          *,
          profile:profiles!profile_link_requests_profile_id_fkey(
            id,
            name,
            father_id,
            mother_id
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (requestError) {
        console.error('❌ Request query failed:', requestError.message);
      } else {
        console.log('✅ Request query succeeded!');
        if (requests && requests.length > 0) {
          console.log('   Found pending request');
          console.log('   Status:', requests[0].status);
          console.log('   Profile name:', requests[0].profile?.name);
          console.log('   Should show ProfileLinkStatusCard with pending state ✅');
        } else {
          console.log('   No pending requests found');
        }
      }
    }
  } catch (err) {
    console.error('❌ Exception in user check:', err.message);
  }
}

testProfileLinkQuery().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});