const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyFunctions() {
  console.log('Verifying undo system deployment...\n');

  try {
    // Test 1: Check if check_undo_permission exists
    const { data: permCheck, error: err1 } = await supabase
      .rpc('check_undo_permission', {
        p_audit_log_id: '00000000-0000-0000-0000-000000000000',
        p_user_profile_id: '00000000-0000-0000-0000-000000000000'
      });

    if (err1 && err1.message.includes('function') && err1.message.includes('not found')) {
      console.log('❌ check_undo_permission NOT FOUND');
      return false;
    } else {
      console.log('✅ check_undo_permission exists');
    }

    // Test 2: Check if undo_profile_update exists
    const { data: undoUpdate, error: err2 } = await supabase
      .rpc('undo_profile_update', {
        p_audit_log_id: '00000000-0000-0000-0000-000000000000'
      });

    if (err2 && err2.message.includes('function') && err2.message.includes('not found')) {
      console.log('❌ undo_profile_update NOT FOUND');
      return false;
    } else {
      console.log('✅ undo_profile_update exists');
    }

    // Test 3: Check if undo_profile_delete exists
    const { data: undoDelete, error: err3 } = await supabase
      .rpc('undo_profile_delete', {
        p_audit_log_id: '00000000-0000-0000-0000-000000000000'
      });

    if (err3 && err3.message.includes('function') && err3.message.includes('not found')) {
      console.log('❌ undo_profile_delete NOT FOUND');
      return false;
    } else {
      console.log('✅ undo_profile_delete exists');
    }

    console.log('\n✅ All undo functions deployed successfully!');
    return true;

  } catch (error) {
    console.error('Error during verification:', error.message);
    return false;
  }
}

verifyFunctions().then(success => {
  process.exit(success ? 0 : 1);
});
