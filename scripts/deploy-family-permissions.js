#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployMigration() {
  console.log('🚀 Deploying Family Edit Permissions System...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '005_family_edit_permissions_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (handling multi-line statements properly)
    const statements = sql
      .split(/;(?=\s*(?:--|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|DO|$))/gi)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();

      // Skip empty statements or pure comments
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      // Add semicolon back if not present
      const finalStatement = statement.endsWith(';') ? statement : statement + ';';

      // Get a preview of the statement for logging
      const preview = finalStatement
        .split('\n')[0]
        .substring(0, 80) + (finalStatement.length > 80 ? '...' : '');

      process.stdout.write(`[${i + 1}/${statements.length}] ${preview}`);

      try {
        const { error } = await supabase.rpc('query', {
          query_text: finalStatement
        });

        if (error) {
          // Try direct execution as fallback
          const { error: directError } = await supabase.from('_migrations').select('*').limit(0);

          // Actually execute via a different method
          const { data, error: execError } = await executeDirectSQL(finalStatement);

          if (execError) {
            throw execError;
          }
        }

        console.log(' ✅');
        successCount++;
      } catch (error) {
        console.log(' ❌');
        console.error(`   Error: ${error.message}`);
        errorCount++;

        // Don't stop on errors for CREATE IF NOT EXISTS
        if (finalStatement.includes('IF NOT EXISTS') ||
            finalStatement.includes('DROP POLICY IF EXISTS')) {
          console.log('   (Continuing - safe to ignore for IF NOT EXISTS)');
        } else if (error.message.includes('already exists')) {
          console.log('   (Continuing - object already exists)');
        } else {
          // For critical errors, ask whether to continue
          console.error('\n❗ Critical error encountered. The migration may be incomplete.');
          console.error('   You may need to run this migration directly in Supabase Dashboard SQL editor.');
          break;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Migration Summary:`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${errorCount}`);
    console.log('='.repeat(60));

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. This is often OK if objects already exist.');
      console.log('   Check your Supabase dashboard to verify the migration.');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

    // Test the new permission function
    console.log('\n🧪 Testing permission function...');
    await testPermissions();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📋 To complete manually:');
    console.error('1. Go to your Supabase Dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy the contents of supabase/migrations/005_family_edit_permissions_system.sql');
    console.error('4. Paste and run in the SQL Editor');
    process.exit(1);
  }
}

async function executeDirectSQL(sql) {
  try {
    // Try to use admin functions if available
    const { data, error } = await supabase.rpc('admin_exec_sql', {
      sql_query: sql
    });

    if (error && error.message.includes('does not exist')) {
      // Function doesn't exist, return error to try another method
      return { error: new Error('Direct SQL execution not available') };
    }

    return { data, error };
  } catch (error) {
    return { error };
  }
}

async function testPermissions() {
  try {
    console.log('Testing can_user_edit_profile function...');

    // Get a sample user
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .limit(2);

    if (profileError || !profiles || profiles.length < 2) {
      console.log('⚠️  Could not test permissions (need at least 2 profiles)');
      return;
    }

    // Test the permission check
    const { data, error } = await supabase.rpc('can_user_edit_profile', {
      p_user_id: profiles[0].id,
      p_target_id: profiles[1].id
    });

    if (error) {
      console.log('❌ Permission function test failed:', error.message);
    } else {
      console.log('✅ Permission function working! Result:', data);
    }

  } catch (error) {
    console.log('⚠️  Could not test permissions:', error.message);
  }
}

// Run the migration
deployMigration();