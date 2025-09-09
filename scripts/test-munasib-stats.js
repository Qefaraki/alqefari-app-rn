import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testMunasibStats() {
  console.log('Testing Munasib statistics...\n');
  
  // Get the statistics
  const { data, error } = await supabase.rpc('admin_get_enhanced_statistics');
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log('Statistics Response:');
  console.log('Total profiles:', data.total_profiles);
  console.log('Total marriages:', data.total_marriages);
  console.log('Orphaned profiles:', data.orphaned_profiles);
  
  // Check marriages with Munasib
  const { data: marriages } = await supabase
    .from('marriages')
    .select(`
      id,
      husband_id,
      wife_id,
      husband:profiles!husband_id(id, name, hid),
      wife:profiles!wife_id(id, name, hid)
    `)
    .limit(5);
  
  console.log('\nSample marriages:');
  marriages?.forEach(m => {
    console.log(`  Husband: ${m.husband?.name} (HID: ${m.husband?.hid})`);
    console.log(`  Wife: ${m.wife?.name} (HID: ${m.wife?.hid})`);
    console.log('  ---');
  });
  
  // Count Munasib by gender
  const { data: munasibMale, count: maleCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('hid', null)
    .eq('gender', 'male');
    
  const { data: munasibFemale, count: femaleCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('hid', null)
    .eq('gender', 'female');
  
  console.log('\nMunasib by gender:');
  console.log(`  Male: ${maleCount}`);
  console.log(`  Female: ${femaleCount}`);
  console.log(`  Total: ${(maleCount || 0) + (femaleCount || 0)}`);
}

testMunasibStats();
