#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deploySQL() {
  try {
    // Read the SQL file
    const sqlPath = path.join(process.cwd(), 'supabase/migrations/20251014120000_undo_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Deploying undo system migration...');
    console.log('================================================');

    // Split SQL into individual statements (handling multi-line function definitions)
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    let dollarQuoteCount = 0;

    const lines = sql.split('\n');
    for (const line of lines) {
      // Skip empty lines and comments at start of line
      if (line.trim() === '' || line.trim().startsWith('--')) {
        if (!inFunction) continue;
      }

      currentStatement += line + '\n';

      // Track $$ quotes for function bodies
      const dollarSigns = (line.match(/\$\$/g) || []).length;
      dollarQuoteCount += dollarSigns;

      // We're in a function if we have an odd number of $$
      inFunction = (dollarQuoteCount % 2 === 1);

      // End of statement: semicolon outside of function body
      if (line.includes(';') && !inFunction) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
        dollarQuoteCount = 0;
      }
    }

    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`Found ${statements.length} statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

      try {
        // Use PostgreSQL REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query_text: statement })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Error: ${errorText}`);

          // Continue with other statements (some might be "already exists" errors)
          if (!errorText.includes('already exists')) {
            throw new Error(`Failed to execute SQL: ${errorText}`);
          } else {
            console.log('   (Already exists, continuing...)');
            successCount++;
          }
        } else {
          console.log('   ✅ Success');
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        // Continue with other statements
      }
    }

    console.log('\n================================================');
    console.log(`Deployment complete: ${successCount}/${statements.length} statements executed successfully`);

    // Test the functions
    console.log('\nTesting undo functions...');

    // Test check_undo_permission (should fail without auth, but function should exist)
    const { error: testError } = await supabase.rpc('check_undo_permission', {
      p_audit_log_id: '00000000-0000-0000-0000-000000000000',
      p_user_profile_id: '00000000-0000-0000-0000-000000000000'
    });

    if (testError) {
      // Check if it's a "not found" error vs "permission denied" error
      if (testError.message.includes('سجل غير موجود')) {
        console.log('✅ check_undo_permission is working (returned expected "not found" error)');
      } else if (testError.code === '42883') {
        console.log('❌ Functions do not exist - deployment may have failed');
      } else {
        console.log(`⚠️  Function exists but returned: ${testError.message}`);
      }
    } else {
      console.log('✅ Undo functions are available and working!');
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

deploySQL();
