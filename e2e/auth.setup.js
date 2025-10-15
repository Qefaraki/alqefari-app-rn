import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTI2MjAsImV4cCI6MjA3MjA2ODYyMH0.-9bUFjeXEwAcdl1d8fj7dX1ZmHMCpuX5TdzmFTOwO-Q';

// Test credentials
const TEST_PHONE = '+966501669043';  // Super admin from test report
const TEST_OTP = '0000';  // Test OTP code

// Storage paths
const authDir = path.join(process.cwd(), 'playwright/.auth');
const authFile = path.join(authDir, 'user.json');

/**
 * Playwright setup project to authenticate via Supabase API
 * This runs once before all tests and saves the authenticated session
 */
setup('authenticate', async ({ page }) => {
  console.log('🔐 Starting API authentication setup...');

  // Create Supabase client (for Node.js, not browser)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  try {
    // Step 1: Request OTP
    console.log(`📱 Requesting OTP for ${TEST_PHONE}...`);
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
      phone: TEST_PHONE,
    });

    if (otpError) {
      console.error('❌ OTP request failed:', otpError.message);
      throw otpError;
    }

    console.log('✅ OTP sent successfully');

    // Step 2: Verify OTP and get session
    console.log(`🔑 Verifying OTP code ${TEST_OTP}...`);
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      phone: TEST_PHONE,
      token: TEST_OTP,
      type: 'sms',
    });

    if (verifyError) {
      console.error('❌ OTP verification failed:', verifyError.message);
      throw verifyError;
    }

    if (!verifyData.session) {
      throw new Error('No session returned after OTP verification');
    }

    console.log('✅ Authentication successful');
    console.log(`👤 User ID: ${verifyData.user.id}`);
    console.log(`📧 Phone: ${verifyData.user.phone}`);

    // Step 3: Navigate to app and inject session into localStorage
    console.log('🌐 Navigating to app...');
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Inject Supabase session into localStorage
    console.log('💉 Injecting session into localStorage...');
    await page.evaluate((session) => {
      // Supabase stores session in localStorage with specific key format
      const supabaseKey = `sb-${window.location.hostname.split('.')[0]}-auth-token`;

      const authData = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      };

      localStorage.setItem(supabaseKey, JSON.stringify(authData));
      console.log('✅ Session injected into localStorage');
    }, verifyData.session);

    // Step 4: Save storage state using Playwright's format
    console.log('💾 Saving storage state to file...');

    // Ensure directory exists
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Save storage state in Playwright's expected format
    await page.context().storageState({ path: authFile });

    console.log(`✅ Storage state saved to ${authFile}`);

    // Step 5: Verify authentication worked
    console.log('🔍 Verifying authentication...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if we're authenticated by looking for authenticated UI elements
    // (Adjust selector based on your app's authenticated state)
    const isAuthenticated = await page.evaluate(() => {
      const supabaseKey = `sb-${window.location.hostname.split('.')[0]}-auth-token`;
      const authData = localStorage.getItem(supabaseKey);
      return authData !== null;
    });

    if (!isAuthenticated) {
      throw new Error('Authentication verification failed - session not found in localStorage');
    }

    console.log('✅ Authentication verified successfully');
    console.log('🎉 Auth setup complete!');

    // Take screenshot for debugging
    await page.screenshot({ path: path.join(authDir, 'authenticated-state.png') });

  } catch (error) {
    console.error('❌ Authentication setup failed:', error);

    // Take screenshot of failure state
    await page.screenshot({ path: path.join(authDir, 'auth-failed.png') });

    throw error;
  }
});
