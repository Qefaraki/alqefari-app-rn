#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminDashboard() {
  console.log('Testing Admin Dashboard Data...\n');

  try {
    // Test 1: Check profiles statistics
    console.log('1. Checking profile statistics...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, hid, is_active', { count: 'exact' });

    if (profilesError) {
      console.error('❌ Error loading profiles:', profilesError.message);
    } else {
      const totalProfiles = profiles.length;
      const activeProfiles = profiles.filter(p => p.is_active).length;
      const totalMunasib = profiles.filter(p => !p.hid).length;

      console.log(`✅ Total Profiles: ${totalProfiles}`);
      console.log(`✅ Active Profiles: ${activeProfiles}`);
      console.log(`✅ Total Munasib: ${totalMunasib}`);

      // Calculate data health
      const completeProfiles = profiles.filter(p => p.hid || p.name).length;
      const dataHealth = Math.round((completeProfiles / totalProfiles) * 100);
      console.log(`✅ Data Health: ${dataHealth}%`);
    }

    // Test 2: Check admin permissions
    console.log('\n2. Checking admin permissions...');
    const { data: admins, error: adminsError } = await supabase
      .from('admin_permissions')
      .select('*');

    if (adminsError) {
      console.error('❌ Error loading admin permissions:', adminsError.message);
    } else {
      console.log(`✅ Found ${admins.length} admin users`);
      admins.forEach(admin => {
        console.log(`   - ${admin.user_id}: ${admin.permission_level}`);
      });
    }

    // Test 3: Check suggestions (if table exists)
    console.log('\n3. Checking suggestions system...');
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('suggestions')
      .select('*')
      .eq('status', 'pending')
      .limit(5);

    if (suggestionsError) {
      if (suggestionsError.message.includes('relation') && suggestionsError.message.includes('does not exist')) {
        console.log('ℹ️  Suggestions table not yet created');
      } else {
        console.error('❌ Error loading suggestions:', suggestionsError.message);
      }
    } else {
      console.log(`✅ Found ${suggestions?.length || 0} pending suggestions`);
    }

    console.log('\n✅ Admin Dashboard data test completed successfully!');
    console.log('📱 Please test the following in the app:');
    console.log('   1. Tap the admin toggle button (fan icon) to enable admin mode');
    console.log('   2. When admin mode is active, a dashboard button should appear above it');
    console.log('   3. Tap the dashboard button to open the redesigned admin dashboard');
    console.log('   4. Verify all sections load properly: Overview, Action Center, Management Hub, System Tools');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAdminDashboard();