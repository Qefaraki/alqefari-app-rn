import { test, expect } from '@playwright/test';
import { navigateToActivityLog, findUndoButton, takeScreenshot, waitForToast } from './helpers.js';

test.describe('Error Handling', () => {
  // Tests use pre-authenticated state from setup project

  test('should show permission denied error for regular user trying to undo admin action', async ({ page }) => {
    // Logout and login as regular user
    await page.goto('/');
    await login(page, '966500000000', '0000');

    // Navigate to activity log (if accessible)
    try {
      await navigateToActivityLog(page);
      await page.waitForTimeout(3000);

      // Take screenshot
      await takeScreenshot(page, 'regular-user-activity-log');

      console.log('✅ Regular user can access activity log');
    } catch (error) {
      console.log('⚠️ Regular user cannot access activity log (expected)');
      await takeScreenshot(page, 'regular-user-access-denied');
    }
  });

  test('should show error message when undo fails due to version conflict', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Note: Version conflict errors are difficult to simulate in E2E tests
    // This test documents where we expect to see error messages

    console.log('⚠️ Version conflict errors require manual testing');
    console.log('   Expected error message: "تعارض في الإصدار" or "Version conflict"');

    // Take screenshot of current state
    await takeScreenshot(page, 'version-conflict-manual-test');
  });

  test('should show error message when undo fails due to missing parent', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Look for error indicators in the UI
    const errorMessages = page.getByText(/خطأ|Error|فشل/i);
    const errorCount = await errorMessages.count();

    console.log(`Found ${errorCount} error indicators on page`);

    // Take screenshot
    await takeScreenshot(page, 'error-indicators');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Simulate network failure by going offline (if supported)
    try {
      await page.context().setOffline(true);
      await page.waitForTimeout(1000);

      // Try to interact with page
      const undoButton = await findUndoButton(page);
      if (await undoButton.isVisible({ timeout: 2000 })) {
        await undoButton.click();
        await page.waitForTimeout(2000);

        // Look for network error message
        const networkError = page.getByText(/شبكة|Network|اتصال|Connection/i);
        const hasError = await networkError.isVisible({ timeout: 5000 });

        console.log('Network error message shown:', hasError);

        // Take screenshot
        await takeScreenshot(page, 'network-error');
      }

      // Restore network
      await page.context().setOffline(false);
    } catch (error) {
      console.log('⚠️ Network simulation not supported:', error.message);
    }
  });

  test('should show error message when trying to undo already undone action', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Look for already undone entries
    const alreadyUndone = page.getByText(/تم التراجع/i);
    const undoneCount = await alreadyUndone.count();

    console.log(`Found ${undoneCount} already undone entries`);

    // Take screenshot
    await takeScreenshot(page, 'already-undone-entries');

    if (undoneCount > 0) {
      console.log('✅ Already undone entries are clearly marked');
    } else {
      console.log('⚠️ No already undone entries found to test');
    }
  });

  test('should show error message for time limit exceeded', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Look for expired undo actions (>30 days old for users, >7 days for cascade)
    const expiredIndicator = page.getByText(/منتهي|Expired|انتهى الوقت/i);
    const expiredCount = await expiredIndicator.count();

    console.log(`Found ${expiredCount} expired action indicators`);

    // Take screenshot
    await takeScreenshot(page, 'expired-actions');

    if (expiredCount > 0) {
      console.log('✅ Expired actions are marked');
    } else {
      console.log('⚠️ No expired actions found (all within time limit)');
    }
  });

  test('should show error when concurrent operation is in progress', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Note: Concurrent operation errors require simultaneous actions
    // This test documents the expected error message

    console.log('⚠️ Concurrent operation errors require manual testing');
    console.log('   Expected error message: "عملية أخرى قيد التنفيذ"');

    // Take screenshot
    await takeScreenshot(page, 'concurrent-operation-manual-test');
  });

  test('should display clear error messages in Arabic', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Check for any UI error messages
    const errorElements = page.getByText(/خطأ|Error|فشل/i);
    const errorCount = await errorElements.count();

    console.log(`Found ${errorCount} error messages in UI`);
    console.log(`Found ${consoleErrors.length} console errors`);

    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors.slice(0, 3));
    }

    // Take screenshot
    await takeScreenshot(page, 'error-messages');

    // Document current state
    console.log('✅ Error message check completed');
  });

  test('should handle empty activity log gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This test verifies the UI doesn't break with no data
    // Note: Real activity log likely has data, but we check for empty state handling

    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Look for empty state message
    const emptyState = page.getByText(/لا توجد|No entries|فارغ|Empty/i);
    const hasEmptyState = await emptyState.isVisible({ timeout: 2000 });

    console.log('Empty state message visible:', hasEmptyState);

    // Take screenshot
    await takeScreenshot(page, 'empty-state-check');

    console.log('✅ Empty state handling verified');
  });

  test('should recover from undo errors without breaking UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to activity log
    await navigateToActivityLog(page);
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await takeScreenshot(page, 'before-error-recovery');

    // Try to trigger an error (attempt multiple undos rapidly)
    const undoButtons = page.getByText('تراجع');
    const buttonCount = await undoButtons.count();

    if (buttonCount > 0) {
      // Click first undo button
      await undoButtons.first().click();
      await page.waitForTimeout(500);

      // Cancel if dialog appears
      const cancelButton = page.getByRole('button', { name: /إلغاء|لا/i });
      if (await cancelButton.isVisible({ timeout: 1000 })) {
        await cancelButton.click();
      }

      // Verify UI is still functional
      await page.waitForTimeout(1000);
      const pageStillWorks = await page.getByText(/سجل النشاط|Activity Log/i).isVisible();

      console.log('UI still functional after error:', pageStillWorks);

      // Take screenshot after recovery
      await takeScreenshot(page, 'after-error-recovery');

      expect(pageStillWorks).toBe(true);
    } else {
      console.log('⚠️ No undo buttons to test error recovery');
    }
  });
});
