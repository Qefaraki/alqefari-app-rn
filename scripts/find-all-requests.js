const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function findAllRequests() {
  console.log('\n🔍 Finding ALL Profile Link Requests\n');
  console.log('='.repeat(50));

  // 1. Get ALL link requests
  const { data: allRequests, error: reqError } = await supabase
    .from('profile_link_requests')
    .select(`
      *,
      profiles!profile_link_requests_profile_id_fkey(
        id,
        name,
        name_ar
      )
    `)
    .order('created_at', { ascending: false });

  if (reqError) {
    console.log('Error fetching requests:', reqError);

    // Try without join
    console.log('\nTrying without join...');
    const { data: simpleRequests, error: simpleError } = await supabase
      .from('profile_link_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (simpleError) {
      console.log('Error:', simpleError);
    } else {
      console.log(`\nFound ${simpleRequests?.length || 0} requests (no join):`);
      simpleRequests?.forEach(req => {
        console.log(`\n📋 Request:`);
        console.log(`   ID: ${req.id}`);
        console.log(`   User ID: ${req.user_id}`);
        console.log(`   Profile ID: ${req.profile_id}`);
        console.log(`   Name Chain: ${req.name_chain}`);
        console.log(`   Phone: ${req.phone}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Created: ${req.created_at}`);
      });
    }
  } else {
    console.log(`\nFound ${allRequests?.length || 0} total requests:`);

    allRequests?.forEach(req => {
      console.log(`\n📋 Request:`);
      console.log(`   ID: ${req.id}`);
      console.log(`   User ID: ${req.user_id}`);
      console.log(`   Profile: ${req.profiles?.name || req.profiles?.name_ar || 'N/A'}`);
      console.log(`   Name Chain: ${req.name_chain}`);
      console.log(`   Phone: ${req.phone}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Created: ${req.created_at}`);
    });
  }

  // 2. Find users matching the phone patterns
  console.log('\n' + '='.repeat(50));
  console.log('\n🔍 Searching for users with phone 966501669043...\n');

  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (!userError && users?.users) {
    const phoneVariations = [
      '966501669043',
      '+966501669043',
      '00966501669043',
      '0501669043',
      '501669043'
    ];

    const matchingUsers = users.users.filter(u => {
      if (!u.phone) return false;
      return phoneVariations.some(variant =>
        u.phone.includes('501669043') || variant.includes(u.phone)
      );
    });

    if (matchingUsers.length > 0) {
      console.log(`Found ${matchingUsers.length} matching users:`);
      matchingUsers.forEach(u => {
        console.log(`\n👤 User:`);
        console.log(`   ID: ${u.id}`);
        console.log(`   Phone: ${u.phone}`);
        console.log(`   Email: ${u.email || 'N/A'}`);
        console.log(`   Created: ${u.created_at}`);
      });

      // Check requests for these users
      for (const user of matchingUsers) {
        const { data: userRequests } = await supabase
          .from('profile_link_requests')
          .select('*')
          .eq('user_id', user.id);

        if (userRequests?.length > 0) {
          console.log(`\n   ⭐ User ${user.phone} has ${userRequests.length} request(s)`);
        }
      }
    } else {
      console.log('No users found with that phone number pattern');
    }
  }

  console.log('\n' + '='.repeat(50));
}

findAllRequests();