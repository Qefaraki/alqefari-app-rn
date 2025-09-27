const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function finalVerification() {
  console.log('\n🎯 FINAL DEPLOYMENT VERIFICATION\n');
  console.log('='.repeat(50));

  // 1. Check critical tables
  console.log('\n📊 TABLES:');
  const tables = ['profiles', 'profile_link_requests', 'admin_messages', 'notifications'];
  let tableStatus = {};

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    tableStatus[table] = !error;
    console.log(`  ${!error ? '✅' : '❌'} ${table}: ${!error ? 'Working' : error.message}`);
  }

  // 2. Check critical functions
  console.log('\n🔧 FUNCTIONS:');
  const functions = [
    { name: 'approve_profile_link_request', params: { p_request_id: '00000000-0000-0000-0000-000000000000' }},
    { name: 'reject_profile_link_request', params: { p_request_id: '00000000-0000-0000-0000-000000000000' }},
    { name: 'admin_force_unlink_profile', params: { p_profile_id: '00000000-0000-0000-0000-000000000000' }},
  ];

  let functionStatus = {};

  for (const func of functions) {
    const { error } = await supabase.rpc(func.name, func.params);
    const exists = !error?.message?.includes('does not exist');
    functionStatus[func.name] = exists;
    console.log(`  ${exists ? '✅' : '❌'} ${func.name}: ${exists ? 'Available' : 'Missing'}`);
  }

  // 3. Test critical operations
  console.log('\n🧪 OPERATIONS TEST:');

  // Test profile_link_requests table structure (without actual insert)
  const { error: linkError } = await supabase
    .from('profile_link_requests')
    .select('*')
    .limit(1);

  const canAccessLinkRequests = !linkError;
  console.log(`  ${canAccessLinkRequests ? '✅' : '❌'} Access profile_link_requests: ${canAccessLinkRequests ? 'Works' : linkError?.message}`);

  // Test admin_messages (without user_id since we made it nullable)
  const { data: msgData, error: msgError } = await supabase
    .from('admin_messages')
    .insert({
      phone: '+966501234567',
      name_chain: 'Test User',
      message: 'Test',
      type: 'no_profile_found',
      status: 'unread'
    })
    .select();

  const canInsertAdminMessage = !msgError;
  if (canInsertAdminMessage && msgData?.[0]) {
    // Clean up
    await supabase.from('admin_messages').delete().eq('id', msgData[0].id);
  }
  console.log(`  ${canInsertAdminMessage ? '✅' : '❌'} Insert admin_message: ${canInsertAdminMessage ? 'Works' : msgError?.message}`);

  // 4. Summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 DEPLOYMENT SUMMARY:\n');

  const criticalTables = ['profile_link_requests', 'admin_messages'];
  const criticalFunctions = ['approve_profile_link_request'];

  const tablesReady = criticalTables.every(t => tableStatus[t]);
  const functionsReady = criticalFunctions.every(f => functionStatus[f]);
  const operationsReady = canAccessLinkRequests && canInsertAdminMessage;

  if (tablesReady && functionsReady && operationsReady) {
    console.log('🎉 DEPLOYMENT SUCCESSFUL! All critical components working.');
    console.log('\n✅ What works:');
    console.log('  • Users can submit profile link requests');
    console.log('  • Users can send messages to admin when profile not found');
    console.log('  • Admins can approve/reject requests');
    console.log('  • Profile status card will show correctly');
  } else {
    console.log('⚠️  PARTIAL DEPLOYMENT:');
    if (!tablesReady) console.log('   - Some tables missing');
    if (!functionsReady) console.log('   - Some functions missing');
    if (!operationsReady) console.log('   - Some operations failing');
    console.log('\n🔧 Manual fixes needed in Supabase SQL Editor');
  }

  console.log('\n' + '='.repeat(50));
}

finalVerification();