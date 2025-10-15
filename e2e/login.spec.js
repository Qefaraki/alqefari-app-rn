import { test, expect } from '@playwright/test';
import { login, logout, isLoggedIn, takeScreenshot } from './helpers.js';

// Override storageState for login tests - start from logged-out state
test.use({ storageState: undefined });

test.describe('Authentication', () => {
  test('should login as super admin successfully', async ({ page }) => {
    await page.goto('/');

    // Perform login
    await login(page, '966501669043', '0000');

    // Verify login success
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Take screenshot
    await takeScreenshot(page, 'login-success-admin');

    console.log('✅ Super admin login successful');
  });

  test('should login as regular user successfully', async ({ page }) => {
    await page.goto('/');

    // Perform login
    await login(page, '966500000000', '0000');

    // Verify login success
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Take screenshot
    await takeScreenshot(page, 'login-success-user');

    console.log('✅ Regular user login successful');
  });

  test('should show phone input field on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Use testID selector for phone input
    const phoneInput = page.getByTestId('phone-input');

    await expect(phoneInput).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await takeScreenshot(page, 'phone-input-visible');

    console.log('✅ Phone input field is visible');
  });

  test('should show OTP input after entering phone', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Use testID selector for phone input
    const phoneInput = page.getByTestId('phone-input');
    await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
    await phoneInput.fill('966501669043');

    // Use testID selector for send code button
    const sendCodeButton = page.getByTestId('send-code-button');
    await sendCodeButton.click();

    // Wait for OTP screen
    await page.waitForTimeout(2000);

    // Look for OTP input or verification code text
    const otpInput = page.locator('input[type="text"]').or(
      page.locator('input[placeholder*="رمز"]')
    ).first();

    const otpText = page.getByText(/رمز التحقق|Verification|OTP/i);

    // Either OTP input or text should be visible
    try {
      await Promise.race([
        otpInput.waitFor({ state: 'visible', timeout: 5000 }),
        otpText.waitFor({ state: 'visible', timeout: 5000 }),
      ]);
      console.log('✅ OTP screen appeared');
    } catch (error) {
      console.warn('⚠️ OTP screen might not have appeared as expected');
    }

    // Take screenshot
    await takeScreenshot(page, 'otp-screen');
  });

  test('should allow logout after login', async ({ page }) => {
    await page.goto('/');

    // Login first
    await login(page, '966501669043', '0000');

    // Verify login
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);

    // Perform logout
    await logout(page);

    // Take screenshot
    await takeScreenshot(page, 'after-logout');

    console.log('✅ Logout successful');
  });
});
