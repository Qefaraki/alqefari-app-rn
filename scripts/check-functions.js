import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkFunctions() {
  console.log('Checking available RPC functions...\n');
  
  // Try to get function list (this won't work directly but let's see the error)
  const functionsToTest = [
    'get_enhanced_statistics',
    'admin_get_enhanced_statistics', 
    'admin_get_statistics',
    'get_statistics'
  ];
  
  for (const func of functionsToTest) {
    const { data, error } = await supabase.rpc(func);
    console.log(`${func}: ${error ? '❌ Not found' : '✅ Exists'}`);
  }
}

checkFunctions();
