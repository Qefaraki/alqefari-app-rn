import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing Expo Web
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // Maximum time one test can run
  timeout: 60000,

  // Test file pattern
  testMatch: '**/*.spec.js',

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 1,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:8081',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time each action such as `click()` can take
    actionTimeout: 10000,

    // Emulate Arabic locale
    locale: 'ar-SA',

    // Set timezone to match Saudi Arabia
    timezoneId: 'Asia/Riyadh',
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - runs once before all tests to authenticate
    {
      name: 'setup',
      testMatch: '**/auth.setup.js',
    },

    // Main test project - runs after setup with authenticated state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the authenticated state from setup
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for Expo to start
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
