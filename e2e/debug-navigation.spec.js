import { test } from '@playwright/test';
import { debugPageStructure } from './helpers.js';

test.describe('Debug Navigation Structure', () => {
  test('debug authenticated home page structure', async ({ page }) => {
    // Go to home page (should be authenticated via setup)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Let React Native web hydrate

    // Debug the page structure
    await debugPageStructure(page, 'Authenticated Home Page');
  });

  test('debug after attempting navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    console.log('\n🚀 Attempting to find navigation elements...\n');

    // Try to find menu button
    const menuAttempts = [
      { name: 'testID menu', selector: page.getByTestId('menu-button') },
      { name: 'testID hamburger', selector: page.getByTestId('hamburger-menu') },
      { name: 'role button menu', selector: page.getByRole('button', { name: /menu|قائمة/i }) },
      { name: 'text ☰', selector: page.getByText('☰') },
      { name: 'aria-label menu', selector: page.locator('[aria-label*="menu"]') },
    ];

    for (const attempt of menuAttempts) {
      const count = await attempt.selector.count();
      const visible = count > 0 ? await attempt.selector.first().isVisible().catch(() => false) : false;
      console.log(`  ${visible ? '✅' : '❌'} ${attempt.name}: ${count} found, visible: ${visible}`);
    }

    // Try to find admin dashboard link
    const adminAttempts = [
      { name: 'testID admin-dashboard', selector: page.getByTestId('admin-dashboard-link') },
      { name: 'text لوحة التحكم', selector: page.getByText(/لوحة التحكم/i) },
      { name: 'text Admin', selector: page.getByText(/Admin/i) },
      { name: 'text الإدارة', selector: page.getByText(/الإدارة/i) },
    ];

    console.log('\n🎯 Admin dashboard link attempts:');
    for (const attempt of adminAttempts) {
      const count = await attempt.selector.count();
      const visible = count > 0 ? await attempt.selector.first().isVisible().catch(() => false) : false;
      console.log(`  ${visible ? '✅' : '❌'} ${attempt.name}: ${count} found, visible: ${visible}`);
    }

    // Debug full structure
    await debugPageStructure(page, 'After Navigation Attempt');
  });
});
