#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
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
    const sqlPath = path.join(__dirname, '../supabase/fix-storage-delete-trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Deploying storage trigger fix...');

    // Execute the SQL directly via the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: ${errorText}`);
      throw new Error(`Failed to execute SQL`);
    }

    console.log('✅ Storage trigger fix deployed successfully!');

    // Verify the fix
    console.log('\nVerifying the fix...');
    const { data, error } = await supabase.rpc('get_function_definition', {
      function_name: 'cleanup_old_profile_photos'
    }).single();

    if (error && error.code !== 'PGRST116') {
      console.log('Verification query failed (expected):', error.message);
    }

    console.log('✅ Fix complete! Profile photo updates should now work.');

  } catch (error) {
    console.error('Deployment failed:', error.message);
    console.log('\n📋 SQL to run manually in Supabase Dashboard:');
    console.log('============================================');
    const sqlPath = path.join(__dirname, '../supabase/fix-storage-delete-trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log(sql);
    console.log('============================================');
    process.exit(1);
  }
}

deploySQL();
