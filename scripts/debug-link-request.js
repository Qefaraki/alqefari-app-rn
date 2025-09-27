const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function debugLinkRequest() {
  console.log('\n🔍 DEBUG: Profile Link Request Status\n');
  console.log('='.repeat(50));

  // 1. Get the current user (you need to provide the phone number)
  const phoneNumber = '+966501669043'; // Your phone number from the screenshot

  console.log(`\n📱 Checking for user with phone: ${phoneNumber}`);

  // Find user by phone
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }

  const user = users.users.find(u => u.phone === phoneNumber);

  if (!user) {
    console.log('❌ No user found with this phone number');
    return;
  }

  console.log(`✅ Found user: ${user.id}`);
  console.log(`   Email: ${user.email || 'N/A'}`);
  console.log(`   Phone: ${user.phone}`);

  // 2. Check if user has a linked profile
  console.log('\n🔗 Checking for linked profile...');
  const { data: linkedProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (linkedProfile) {
    console.log(`✅ User has linked profile: ${linkedProfile.name || linkedProfile.name_ar}`);
  } else {
    console.log('❌ No linked profile found');
  }

  // 3. Check for profile link requests (all methods)
  console.log('\n📋 Checking for profile link requests...');

  // Method 1: Simple query
  const { data: simpleRequests, error: simpleError } = await supabase
    .from('profile_link_requests')
    .select('*')
    .eq('user_id', user.id);

  console.log('\nMethod 1 - Simple query:');
  if (simpleError) {
    console.log(`   ❌ Error: ${simpleError.message}`);
  } else {
    console.log(`   📊 Found ${simpleRequests?.length || 0} requests`);
    if (simpleRequests?.length > 0) {
      simpleRequests.forEach(req => {
        console.log(`\n   Request ID: ${req.id}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Profile ID: ${req.profile_id}`);
        console.log(`   Name Chain: ${req.name_chain}`);
        console.log(`   Created: ${req.created_at}`);
      });
    }
  }

  // Method 2: With join (like in the component)
  const { data: joinRequests, error: joinError } = await supabase
    .from('profile_link_requests')
    .select(`
      *,
      profile:profiles!profile_link_requests_profile_id_fkey(
        id,
        name,
        name_ar
      )
    `)
    .eq('user_id', user.id);

  console.log('\nMethod 2 - With profile join:');
  if (joinError) {
    console.log(`   ❌ Error: ${joinError.message}`);
  } else {
    console.log(`   📊 Found ${joinRequests?.length || 0} requests with profiles`);
  }

  // Method 3: Left join (safer)
  const { data: leftJoinRequests, error: leftJoinError } = await supabase
    .from('profile_link_requests')
    .select(`
      *,
      profiles!left(
        id,
        name,
        name_ar
      )
    `)
    .eq('user_id', user.id);

  console.log('\nMethod 3 - Left join:');
  if (leftJoinError) {
    console.log(`   ❌ Error: ${leftJoinError.message}`);
  } else {
    console.log(`   📊 Found ${leftJoinRequests?.length || 0} requests with left join`);
  }

  // 4. Check ALL link requests to see if yours is there
  console.log('\n🔍 All pending requests in system:');
  const { data: allRequests, error: allError } = await supabase
    .from('profile_link_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (allRequests?.length > 0) {
    console.log(`Found ${allRequests.length} pending requests total`);
    allRequests.forEach(req => {
      const isYours = req.user_id === user.id ? ' ⭐ YOUR REQUEST' : '';
      console.log(`   - ${req.name_chain} (${req.phone})${isYours}`);
    });
  }

  console.log('\n' + '='.repeat(50));
}

debugLinkRequest();