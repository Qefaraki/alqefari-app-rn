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
    const sqlPath = path.join(process.cwd(), 'supabase/migrations/20250928_fix_name_chain_rpc.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Deploying SQL migration...');

    // Split SQL into individual statements
    const statements = sql
      .split(/;(?=\s*(?:CREATE|DROP|ALTER|GRANT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|--|\n|$))/i)
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.length > 0) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('query', {
          query_text: statement
        });

        if (error) {
          // Try direct execution if RPC fails
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
            console.error(`Error executing statement: ${errorText}`);
            throw new Error(`Failed to execute SQL: ${errorText}`);
          }
        }
      }
    }

    console.log('✅ SQL migration deployed successfully!');

    // Test the functions
    console.log('\nTesting functions...');

    // Test get_name_chain_for_user
    const { data: testData, error: testError } = await supabase.rpc('get_name_chain_for_user');
    if (testError) {
      console.log('Note: Function test failed (expected if no user context):', testError.message);
    } else {
      console.log('✅ Functions are available and working!');
    }

  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

deploySQL();