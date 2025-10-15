import { expect } from '@playwright/test';

/**
 * Helper functions for Playwright E2E tests
 */

/**
 * Login helper - authenticates with phone number and OTP
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} phoneNumber - Phone number (e.g., '966501669043')
 * @param {string} verificationCode - OTP code (e.g., '0000')
 */
export async function login(page, phoneNumber = '966501669043', verificationCode = '0000') {
  // Wait for app to load
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  // Use testID selector for phone input (stable, reliable)
  const phoneInput = page.getByTestId('phone-input');

  await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
  await phoneInput.fill(phoneNumber);

  // Use testID selector for send code button
  const sendCodeButton = page.getByTestId('send-code-button');
  await sendCodeButton.click();

  // Wait for OTP input to appear
  await page.waitForTimeout(2000); // Give UI time to transition

  // Enter verification code - OTP library (react-native-otp-entry) renders individual inputs
  // Try to find OTP inputs by type or placeholder
  const otpInput = page.locator('input[type="text"]').or(
    page.locator('input[placeholder*="رمز"]')
  ).first();

  if (await otpInput.isVisible()) {
    await otpInput.fill(verificationCode);
  }

  // Use testID selector for verify button
  const verifyButton = page.getByTestId('verify-button');
  if (await verifyButton.isVisible()) {
    await verifyButton.click();
  }

  // Wait for successful login - look for home screen indicators
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  console.log(`✅ Logged in as ${phoneNumber}`);
}

/**
 * Navigate to Admin Dashboard
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function navigateToAdminDashboard(page) {
  // Look for hamburger menu or profile icon
  const menuButton = page.getByRole('button', { name: /قائمة|menu/i }).or(
    page.locator('[aria-label*="menu"]')
  ).or(
    page.locator('button').filter({ hasText: /☰|≡/ })
  ).first();

  if (await menuButton.isVisible({ timeout: 5000 })) {
    await menuButton.click();
  }

  // Wait for menu to open
  await page.waitForTimeout(500);

  // Click "لوحة التحكم" or "Admin Dashboard"
  const adminDashboardLink = page.getByText(/لوحة التحكم|Admin|الإدارة/i).first();
  await adminDashboardLink.waitFor({ state: 'visible', timeout: 5000 });
  await adminDashboardLink.click();

  // Wait for dashboard to load
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  console.log('✅ Navigated to Admin Dashboard');
}

/**
 * Navigate to Activity Log Dashboard
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function navigateToActivityLog(page) {
  // First navigate to admin dashboard
  await navigateToAdminDashboard(page);

  // Look for "سجل النشاط" or "Activity Log" link/button
  const activityLogButton = page.getByText(/سجل النشاط|Activity Log|النشاط/i).first();
  await activityLogButton.waitFor({ state: 'visible', timeout: 10000 });
  await activityLogButton.click();

  // Wait for activity log to load
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');

  // Verify we're on the activity log page
  await expect(page.getByText(/سجل النشاط|Activity Log/i)).toBeVisible();

  console.log('✅ Navigated to Activity Log Dashboard');
}

/**
 * Wait for toast message to appear
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} messagePattern - Regex pattern to match toast message
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForToast(page, messagePattern, timeout = 5000) {
  const toast = page.getByText(new RegExp(messagePattern, 'i'));
  await toast.waitFor({ state: 'visible', timeout });
  return toast;
}

/**
 * Take a screenshot with timestamp
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Screenshot name
 */
export async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `e2e-screenshots/${name}-${timestamp}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

/**
 * Debug page structure - shows available testIDs and clickable elements
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} label - Label for this debug session
 */
export async function debugPageStructure(page, label = 'DEBUG') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 ${label} - Page Structure Analysis`);
  console.log('='.repeat(60));

  try {
    // 1. List all elements with testID
    const testIdElements = await page.locator('[data-testid]').all();
    console.log(`\n📋 Found ${testIdElements.length} elements with data-testid:`);
    for (const el of testIdElements) {
      const testId = await el.getAttribute('data-testid');
      const isVisible = await el.isVisible().catch(() => false);
      const tag = await el.evaluate(node => node.tagName.toLowerCase());
      console.log(`  ${isVisible ? '✅' : '❌'} [${tag}] ${testId}`);
    }

    // 2. List all text elements (useful for navigation)
    const textElements = await page.getByText(/.+/).all();
    console.log(`\n📝 Found ${Math.min(textElements.length, 20)} text elements (showing first 20):`);
    for (let i = 0; i < Math.min(textElements.length, 20); i++) {
      const el = textElements[i];
      const text = await el.textContent().catch(() => '');
      const isVisible = await el.isVisible().catch(() => false);
      if (text && text.trim().length > 0 && text.trim().length < 50) {
        console.log(`  ${isVisible ? '✅' : '❌'} "${text.trim()}"`);
      }
    }

    // 3. List clickable elements (divs with role or onclick)
    const clickables = await page.locator('[role="button"], div[onclick], [data-pressable="true"]').all();
    console.log(`\n🖱️  Found ${clickables.length} potentially clickable elements`);

    // 4. Check for common navigation patterns
    const hasMenu = await page.locator('[data-testid*="menu"]').count();
    const hasAdmin = await page.getByText(/لوحة التحكم|Admin|الإدارة/i).count();
    const hasActivity = await page.getByText(/سجل النشاط|Activity|النشاط/i).count();

    console.log(`\n🧭 Navigation Elements:`);
    console.log(`  Menu elements: ${hasMenu}`);
    console.log(`  Admin dashboard references: ${hasAdmin}`);
    console.log(`  Activity log references: ${hasActivity}`);

    // 5. Take screenshot
    await takeScreenshot(page, `debug-${label.toLowerCase().replace(/\s+/g, '-')}`);

  } catch (error) {
    console.error(`❌ Error during debug: ${error.message}`);
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Wait for element with retry
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch (error) {
    console.warn(`⚠️ Element not found: ${selector}`);
    return false;
  }
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function isLoggedIn(page) {
  // Check for indicators that user is logged in (e.g., profile menu, logout button)
  const logoutButton = page.getByText(/تسجيل الخروج|Logout/i);
  const profileMenu = page.getByText(/الملف الشخصي|Profile|الحساب/i);

  try {
    await Promise.race([
      logoutButton.waitFor({ state: 'visible', timeout: 3000 }),
      profileMenu.waitFor({ state: 'visible', timeout: 3000 }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find undo button in activity log
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function findUndoButton(page) {
  // Look for "تراجع" button
  const undoButton = page.getByRole('button', { name: /تراجع/i }).first();
  return undoButton;
}

/**
 * Click undo button and wait for confirmation
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function clickUndoAndConfirm(page) {
  const undoButton = await findUndoButton(page);

  if (!(await undoButton.isVisible({ timeout: 5000 }))) {
    throw new Error('Undo button not found');
  }

  await undoButton.click();

  // Wait for potential confirmation dialog
  await page.waitForTimeout(1000);

  // Look for confirmation button in dialog
  const confirmButton = page.getByRole('button', { name: /تأكيد|موافق|نعم/i });
  if (await confirmButton.isVisible({ timeout: 2000 })) {
    await confirmButton.click();
  }

  console.log('✅ Clicked undo button');
}

/**
 * Wait for undo success message
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function waitForUndoSuccess(page) {
  return await waitForToast(page, 'تم التراجع بنجاح|نجح|success', 5000);
}

/**
 * Logout helper
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export async function logout(page) {
  // Look for logout button or menu
  const logoutButton = page.getByText(/تسجيل الخروج|Logout/i).first();

  if (await logoutButton.isVisible({ timeout: 5000 })) {
    await logoutButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Logged out');
  }
}
