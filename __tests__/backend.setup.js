/**
 * Backend Test Setup - Real Supabase Database Connection
 *
 * This setup file creates REAL Supabase connections for testing RPC functions.
 * DO NOT use mocks here - we test against actual database behavior.
 *
 * Prerequisites:
 * 1. Run `supabase start` to start local Supabase stack
 * 2. Ensure Docker is running
 * 3. .env.test file is configured with local Supabase credentials
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load test environment variables manually (avoid dotenv/expo conflicts)
try {
  const envPath = path.resolve(__dirname, '../.env.test');
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  console.warn('Warning: Could not load .env.test file:', error.message);
}

// Supabase connection details
const SUPABASE_URL = process.env.SUPABASE_TEST_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  throw new Error(`
    ❌ Missing Supabase credentials for backend tests.

    Please ensure:
    1. Docker is running
    2. Run: supabase start
    3. .env.test file exists with credentials

    OR set these environment variables:
    - SUPABASE_TEST_URL
    - SUPABASE_TEST_ANON_KEY
    - SUPABASE_TEST_SERVICE_KEY
  `);
}

// Create global Supabase clients
// supabaseClient - Regular user (anon key) - tests normal permissions
global.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// supabaseAdmin - Service role - tests admin operations and bypasses RLS
global.supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Test utilities
global.cleanupTestData = async (table, filter = {}) => {
  try {
    const { error } = await global.supabaseAdmin
      .from(table)
      .delete()
      .match(filter);

    if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
      console.error(`⚠️  Cleanup failed for ${table}:`, error.message);
    }
  } catch (err) {
    console.error(`⚠️  Cleanup error for ${table}:`, err.message);
  }
};

// Wait for async operation
global.waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry helper for flaky operations
global.retryOperation = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await global.waitFor(delay);
    }
  }
};

// Get existing test auth user for audit logs
global.testAuthUserId = null;

// Setup: Log test environment info and get test user
beforeAll(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 Backend Test Suite');
  console.log('='.repeat(60));
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🔑 Using ${SUPABASE_URL.includes('localhost') ? 'LOCAL' : 'REMOTE'} database`);
  console.log('='.repeat(60) + '\n');

  // Get an existing auth user for audit log actor_id
  // Use raw SQL since auth schema is not accessible via Supabase client
  try {
    const { data, error } = await global.supabaseAdmin.rpc('exec_sql', {
      sql: 'SELECT id FROM auth.users LIMIT 1'
    });

    if (data && data.length > 0 && !error) {
      global.testAuthUserId = data[0].id;
      console.log(`✅ Using test auth user: ${global.testAuthUserId}\n`);
    } else {
      // Fallback: Use a hardcoded auth user ID from the database
      global.testAuthUserId = '24eeb723-cb9d-4014-ae27-f35178a83948';
      console.log(`✅ Using hardcoded test auth user: ${global.testAuthUserId}\n`);
    }
  } catch (err) {
    // Fallback: Use a hardcoded auth user ID from the database
    global.testAuthUserId = '24eeb723-cb9d-4014-ae27-f35178a83948';
    console.log(`✅ Using hardcoded test auth user: ${global.testAuthUserId}\n`);
  }
});

// Cleanup: Log summary
afterAll(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('✅ Backend Test Suite Complete');
  console.log('='.repeat(60) + '\n');
});
