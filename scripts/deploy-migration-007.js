const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deployMigration() {
  try {
    console.log('🔄 Dropping duplicate admin_update_profile function...');

    // Drop the old 2-argument version
    const { error } = await supabase.rpc('query', {
      query_text: 'DROP FUNCTION IF EXISTS admin_update_profile(uuid, jsonb) CASCADE'
    });

    if (error) {
      console.error('❌ Error:', error.message);
      console.log('\n📋 Please run this SQL manually in Supabase Dashboard:');
      console.log('   DROP FUNCTION IF EXISTS admin_update_profile(uuid, jsonb) CASCADE;');
      process.exit(1);
    }

    console.log('✅ Successfully dropped duplicate function');

    // Verify
    const { data: functions } = await supabase.rpc('query', {
      query_text: `SELECT proname, pronargs FROM pg_proc WHERE proname = 'admin_update_profile'`
    });

    if (functions && functions.length === 1) {
      console.log('✅ Verified: Only 1 admin_update_profile function remains');
    } else {
      console.log('⚠️  Warning: Found', functions?.length || 0, 'functions');
    }

  } catch (err) {
    console.error('❌ Deployment failed:', err.message);
    console.log('\n📋 Please run this SQL manually in Supabase Dashboard → SQL Editor:');
    console.log('   DROP FUNCTION IF EXISTS admin_update_profile(uuid, jsonb) CASCADE;');
    process.exit(1);
  }
}

deployMigration();
