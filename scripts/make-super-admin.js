#!/usr/bin/env node

/**
 * Script to bootstrap the first super admin
 * Run this to assign super admin role to a user
 *
 * Usage:
 *   node scripts/make-super-admin.js <user-email>
 *   OR
 *   node scripts/make-super-admin.js <user-id>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function findUserByEmail(email) {
  // First try to find in auth.users
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email);

  if (authError || !authUser?.user) {
    console.log(`⚠️  No auth user found with email: ${email}`);
    return null;
  }

  // Get the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.user.id)
    .single();

  if (profileError || !profile) {
    console.log(`⚠️  No profile found for auth user: ${authUser.user.id}`);
    return null;
  }

  return profile;
}

async function findUserById(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.log(`⚠️  No profile found with ID: ${userId}`);
    return null;
  }

  return profile;
}

async function makeSuperAdmin(profile) {
  console.log(`\n✅ Found user: ${profile.name} (ID: ${profile.id})`);
  console.log(`Current role: ${profile.role || 'user'}`);

  // Update to super_admin
  const { error } = await supabase
    .from('profiles')
    .update({
      role: 'super_admin',
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    console.error('❌ Failed to update role:', error.message);
    return false;
  }

  console.log('🎉 Successfully granted super admin role!');

  // Log to audit
  const { error: auditError } = await supabase
    .from('audit_log')
    .insert({
      action: 'ROLE_CHANGE',
      table_name: 'profiles',
      target_profile_id: profile.id,
      actor_id: profile.id, // Self-assignment
      old_data: { role: profile.role || null },
      new_data: { role: 'super_admin' },
      details: {
        action_type: 'bootstrap_super_admin',
        old_role: profile.role || 'user',
        new_role: 'super_admin',
        target_name: profile.name,
        note: 'Bootstrap script - initial super admin'
      },
      created_at: new Date().toISOString()
    });

  if (auditError) {
    console.warn('⚠️  Warning: Failed to log audit entry:', auditError.message);
  }

  return true;
}

async function listCurrentAdmins() {
  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['admin', 'super_admin'])
    .order('role', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch admins:', error.message);
    return;
  }

  if (!admins || admins.length === 0) {
    console.log('📭 No admins found in the system');
    return;
  }

  console.log('\n👥 Current admins:');
  console.log('================');
  admins.forEach(admin => {
    const icon = admin.role === 'super_admin' ? '👑' : '🛡️';
    console.log(`${icon} ${admin.name} - ${admin.role}`);
  });
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log('🔧 Super Admin Bootstrap Script');
    console.log('===============================\n');
    console.log('Usage:');
    console.log('  node scripts/make-super-admin.js <email>');
    console.log('  node scripts/make-super-admin.js <user-id>\n');

    await listCurrentAdmins();

    rl.question('\n📧 Enter email or user ID to make super admin: ', async (input) => {
      if (!input) {
        console.log('❌ No input provided');
        rl.close();
        process.exit(1);
      }

      await processUser(input);
      rl.close();
    });
  } else {
    await processUser(arg);
    rl.close();
  }
}

async function processUser(input) {
  let profile = null;

  // Check if it's an email
  if (input.includes('@')) {
    profile = await findUserByEmail(input);
  } else {
    // Try as UUID
    profile = await findUserById(input);
  }

  if (!profile) {
    // Try searching by name
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('name', `%${input}%`)
      .limit(5);

    if (!error && profiles && profiles.length > 0) {
      if (profiles.length === 1) {
        profile = profiles[0];
      } else {
        console.log('\n🔍 Found multiple matches:');
        profiles.forEach((p, i) => {
          console.log(`${i + 1}. ${p.name} (ID: ${p.id})`);
        });

        await new Promise(resolve => {
          rl.question('\nSelect a number (or 0 to cancel): ', async (choice) => {
            const index = parseInt(choice) - 1;
            if (index >= 0 && index < profiles.length) {
              profile = profiles[index];
            }
            resolve();
          });
        });
      }
    }
  }

  if (!profile) {
    console.log('❌ User not found');
    process.exit(1);
  }

  // Check if already super admin
  if (profile.role === 'super_admin') {
    console.log('✨ User is already a super admin!');
    process.exit(0);
  }

  // Confirm action
  await new Promise(resolve => {
    rl.question(`\n⚠️  Are you sure you want to make "${profile.name}" a SUPER ADMIN? (yes/no): `, async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        const success = await makeSuperAdmin(profile);
        if (success) {
          console.log('\n✅ Done! The user now has super admin privileges.');
          console.log('They can now:');
          console.log('  • Manage all user roles');
          console.log('  • Assign branch moderators');
          console.log('  • Access all admin functions');
        }
      } else {
        console.log('❌ Operation cancelled');
      }
      resolve();
    });
  });
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  rl.close();
  process.exit(1);
});