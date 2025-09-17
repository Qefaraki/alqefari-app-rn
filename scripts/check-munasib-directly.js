import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMunasib() {
  console.log('Checking Munasib profiles...\n');
  
  // Check for profiles with NULL HID
  const { data: nullHID, count: nullCount } = await supabase
    .from('profiles')
    .select('id, name, hid', { count: 'exact' })
    .is('hid', null)
    .limit(5);
  
  console.log(`Profiles with HID = NULL: ${nullCount || 0}`);
  if (nullHID && nullHID.length > 0) {
    console.log('Sample profiles without HID:');
    nullHID.forEach(p => console.log(`  - ${p.name} (HID: ${p.hid})`));
  }
  
  // Check a specific profile we know was updated
  const testId = '1513fa11-9a13-4a5e-932a-607c3d4a16f2'; // حصة
  const { data: testProfile } = await supabase
    .from('profiles')
    .select('id, name, hid')
    .eq('id', testId)
    .single();
  
  console.log('\nTest profile (حصة):');
  console.log(`  Name: ${testProfile?.name}`);
  console.log(`  HID: ${testProfile?.hid}`);
  
  // Check profiles starting with HID 2000
  const { data: spouses, count: spouseCount } = await supabase
    .from('profiles')
    .select('id, name, hid', { count: 'exact' })
    .like('hid', '2000.%')
    .limit(5);
  
  console.log(`\nProfiles with HID starting with 2000: ${spouseCount || 0}`);
  if (spouses && spouses.length > 0) {
    console.log('Samples:');
    spouses.forEach(p => console.log(`  - ${p.name} (HID: ${p.hid})`));
  }
}

checkMunasib();
