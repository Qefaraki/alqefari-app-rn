const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFunction() {
  console.log('Testing admin_create_munasib_profile availability...\n');

  // Test calling the function (will fail on permissions, but should exist)
  const { data, error } = await supabase
    .rpc('admin_create_munasib_profile', {
      p_name: 'Test',
      p_gender: 'male',
      p_generation: 1,
      p_family_origin: 'Test',
      p_sibling_order: 0,
      p_status: 'alive',
      p_phone: null
    });

  if (error) {
    if (error.message.includes('Admin role required')) {
      console.log('✅ Function exists! (Got expected admin permission error)');
    } else if (error.message.includes('Could not find the function')) {
      console.log('❌ Function not found in schema cache');
      console.log('Error:', error.message);
      console.log('\nTry refreshing the app or waiting a bit longer for cache refresh');
    } else {
      console.log('⚠️ Unexpected error:', error.message);
    }
  } else {
    console.log('✅ Function called successfully (unexpected - should require admin)');
  }
}

testFunction();