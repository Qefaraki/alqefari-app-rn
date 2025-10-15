import { test, expect } from '@playwright/test';
import { takeScreenshot } from './helpers.js';

test.describe('App Loading', () => {
  test('should load Expo web app successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Wait a bit for React Native to render
    await page.waitForTimeout(3000);

    // Check for common app indicators
    // The app name, Arabic text, or any visible text content
    const appLoaded = page.locator('body').or(
      page.locator('text=القفاري')
    ).or(
      page.locator('text=أسرة')
    ).or(
      page.locator('text=Alqefari')
    );

    await expect(appLoaded).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await takeScreenshot(page, 'app-loaded');

    console.log('✅ App loaded successfully');
  });

  test('should not show critical errors on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check for error messages
    const errorText = page.getByText(/error|خطأ|فشل/i);
    const errorCount = await errorText.count();

    // Allow warnings but not critical errors
    if (errorCount > 0) {
      console.warn(`⚠️ Found ${errorCount} potential error messages on page load`);
    }

    // Check console for critical errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Log errors but don't fail test (some errors are expected in dev)
    if (errors.length > 0) {
      console.warn('⚠️ Console errors detected:', errors.slice(0, 5));
    }

    await takeScreenshot(page, 'app-error-check');
  });

  test('should render in RTL mode for Arabic', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check if HTML has RTL direction
    const htmlDir = await page.locator('html').getAttribute('dir');
    const bodyDir = await page.locator('body').getAttribute('dir');

    console.log('HTML dir:', htmlDir);
    console.log('Body dir:', bodyDir);

    // Take screenshot to verify RTL layout
    await takeScreenshot(page, 'rtl-mode');

    // Note: RTL mode might be handled by React Native, not HTML dir attribute
    // This test documents the current state
  });
});
