import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testRawStats() {
  const { data, error } = await supabase.rpc('admin_get_enhanced_statistics');
  
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Raw response:');
    console.log(JSON.stringify(data, null, 2));
  }
}

testRawStats();
