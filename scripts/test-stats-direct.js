import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testStats() {
  console.log('Testing statistics functions...\n');
  
  // Test get_enhanced_statistics
  console.log('1. Testing get_enhanced_statistics():');
  const { data: enhanced, error: enhancedError } = await supabase.rpc('get_enhanced_statistics');
  
  if (enhancedError) {
    console.log('❌ Error:', enhancedError.message);
  } else {
    console.log('✅ Success!');
    if (enhanced?.munasib) {
      console.log('Munasib stats:', enhanced.munasib);
    } else {
      console.log('No munasib data in response');
    }
  }
  
  // Test admin_get_statistics (old function)
  console.log('\n2. Testing admin_get_statistics():');
  const { data: admin, error: adminError } = await supabase.rpc('admin_get_statistics');
  
  if (adminError) {
    console.log('❌ Error:', adminError.message);
  } else {
    console.log('✅ Success!');
  }
  
  // Check marriages table directly
  console.log('\n3. Checking marriages table:');
  const { data: marriages, count } = await supabase
    .from('marriages')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total marriages: ${count}`);
  
  // Check for profiles without HID
  console.log('\n4. Checking for Munasib profiles (HID = NULL):');
  const { data: munasib, count: munasibCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('hid', null);
  
  console.log(`Profiles without HID: ${munasibCount}`);
}

testStats();
