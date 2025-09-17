import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkConstraints() {
  console.log('Checking HID constraints...\n');
  
  // Try to set one profile's HID to null as a test
  const testProfileId = '1513fa11-9a13-4a5e-932a-607c3d4a16f2'; // One of the spouse IDs
  
  console.log('Testing HID = NULL update...');
  const { data, error } = await supabase
    .from('profiles')
    .update({ hid: null })
    .eq('id', testProfileId)
    .select();
  
  if (error) {
    console.log('❌ Failed:', error.message);
    console.log('Error code:', error.code);
    console.log('Error details:', error.details);
  } else {
    console.log('✅ Success! Profile updated:', data);
  }
}

checkConstraints();
