// Test script for admin system
// Run with: node tests/test-admin-system.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminSystem() {
  console.log('🧪 Testing Admin System...\n');
  
  try {
    // 1. Sign in as admin
    console.log('1️⃣ Signing in as admin@test.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'test123456' // You'll need to set this password
    });
    
    if (authError) {
      console.error('❌ Auth failed:', authError.message);
      console.log('   Please ensure admin@test.com has a password set in Supabase Auth');
      return;
    }
    
    console.log('✅ Signed in successfully\n');
    
    // 2. Check admin status via view
    console.log('2️⃣ Checking admin status...');
    const { data: adminCheck, error: adminError } = await supabase
      .from('is_current_user_admin')
      .select('is_admin, email')
      .single();
    
    if (adminError) {
      console.error('❌ Admin check failed:', adminError);
      return;
    }
    
    console.log('✅ Admin status:', adminCheck);
    console.log('   Is Admin:', adminCheck.is_admin ? '✅ YES' : '❌ NO');
    console.log('   Email:', adminCheck.email, '\n');
    
    if (!adminCheck.is_admin) {
      console.error('❌ User is not an admin. Cannot proceed with admin function tests.');
      return;
    }
    
    // 3. Test admin_create_profile function
    console.log('3️⃣ Testing admin_create_profile...');
    const testProfile = {
      p_name: 'Test Person ' + Date.now(),
      p_gender: 'male',
      p_generation: 1,
      p_sibling_order: 1,
      p_status: 'alive',
      p_profile_visibility: 'public'
    };
    
    const { data: newProfile, error: createError } = await supabase.rpc('admin_create_profile', testProfile);
    
    if (createError) {
      console.error('❌ Create profile failed:', createError);
      return;
    }
    
    console.log('✅ Profile created successfully!');
    console.log('   ID:', newProfile.id);
    console.log('   Name:', newProfile.name);
    console.log('   HID:', newProfile.hid, '\n');
    
    // 4. Test admin_create_marriage function
    console.log('4️⃣ Testing admin_create_marriage...');
    
    // First create a wife profile
    const wifeProfile = {
      p_name: 'Test Wife ' + Date.now(),
      p_gender: 'female',
      p_generation: 1,
      p_sibling_order: 1,
      p_status: 'alive',
      p_profile_visibility: 'public'
    };
    
    const { data: wife, error: wifeError } = await supabase.rpc('admin_create_profile', wifeProfile);
    
    if (wifeError) {
      console.error('❌ Create wife profile failed:', wifeError);
      return;
    }
    
    // Now create marriage
    const { data: marriage, error: marriageError } = await supabase.rpc('admin_create_marriage', {
      p_husband_id: newProfile.id,
      p_wife_id: wife.id,
      p_status: 'married',
      p_munasib: 'Test Marriage'
    });
    
    if (marriageError) {
      console.error('❌ Create marriage failed:', marriageError);
      return;
    }
    
    console.log('✅ Marriage created successfully!');
    console.log('   Marriage ID:', marriage.id);
    console.log('   Husband:', newProfile.name);
    console.log('   Wife:', wife.name, '\n');
    
    // 5. Check audit log
    console.log('5️⃣ Checking audit log...');
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_log')
      .select('action, table_name, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (auditError) {
      console.error('❌ Audit log check failed:', auditError);
    } else {
      console.log('✅ Recent audit entries:');
      auditLogs.forEach(log => {
        console.log(`   - ${log.action} on ${log.table_name} at ${new Date(log.created_at).toLocaleString()}`);
      });
    }
    
    console.log('\n✅ All admin system tests passed!');
    
    // Clean up - delete test profiles
    console.log('\n🧹 Cleaning up test data...');
    await supabase.rpc('admin_delete_profile', { p_id: newProfile.id });
    await supabase.rpc('admin_delete_profile', { p_id: wife.id });
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  } finally {
    // Sign out
    await supabase.auth.signOut();
    console.log('\n👋 Signed out');
  }
}

// Run the test
testAdminSystem();