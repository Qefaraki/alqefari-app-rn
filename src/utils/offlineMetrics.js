/**
 * Offline Handling Metrics Logging
 *
 * Tracks offline save attempts, debounce triggers, and version conflicts
 * to measure the effectiveness of the offline protection system.
 *
 * Usage:
 * ```javascript
 * import { logOfflineSaveAttempt, logDebounceTrigger } from '../../utils/offlineMetrics';
 *
 * logOfflineSaveAttempt('ProfileViewer', 'saveProfile');
 * logDebounceTrigger('ProfileViewer');
 * ```
 */

/**
 * Log when user attempts to perform an action while offline
 * @param {string} screen - Screen/component name (e.g., 'ProfileViewer', 'QuickAddOverlay')
 * @param {string} action - Action being attempted (e.g., 'saveProfile', 'addChildren')
 */
export function logOfflineSaveAttempt(screen, action) {
  const timestamp = new Date().toISOString();
  const message = `[OFFLINE_ATTEMPT] ${screen}.${action} blocked - user offline`;

  // Development: Always log to console
  if (__DEV__) {
    console.warn(message);
  }

  // Production: Send to analytics/monitoring service
  // TODO: Replace with actual analytics service (Firebase Analytics, Sentry, etc.)
  // Example: Analytics.logEvent('offline_save_attempt', { screen, action, timestamp });
}

/**
 * Log when debounce timer blocks a rapid save attempt
 * @param {string} screen - Screen/component name
 * @param {number} timeSinceLastAttempt - Milliseconds since last attempt
 */
export function logDebounceTrigger(screen, timeSinceLastAttempt = null) {
  const timestamp = new Date().toISOString();
  const message = `[DEBOUNCE] ${screen} save debounced${timeSinceLastAttempt ? ` (${timeSinceLastAttempt}ms after last attempt)` : ''}`;

  // Development: Log to console
  if (__DEV__) {
    console.warn(message);
  }

  // Production: Send to analytics/monitoring
  // Example: Analytics.logEvent('debounce_triggered', { screen, timeSinceLastAttempt, timestamp });
}

/**
 * Log when a version conflict is detected (concurrent edits)
 * @param {string} screen - Screen/component name
 * @param {string} profileId - ID of profile with conflict
 * @param {number} expectedVersion - Version we tried to update
 * @param {number} actualVersion - Current version in database
 */
export function logVersionConflict(screen, profileId, expectedVersion, actualVersion) {
  const timestamp = new Date().toISOString();
  const message = `[VERSION_CONFLICT] ${screen} profileId=${profileId} expected=${expectedVersion} actual=${actualVersion}`;

  // Development: Log to console
  if (__DEV__) {
    console.warn(message);
  }

  // Production: Send to monitoring
  // Example: Analytics.logEvent('version_conflict', { screen, profileId, expectedVersion, actualVersion, timestamp });
}

/**
 * Log when a network timeout occurs during a save
 * @param {string} screen - Screen/component name
 * @param {string} action - Action being performed
 * @param {number} duration - How long the request lasted before timing out
 */
export function logNetworkTimeout(screen, action, duration) {
  const timestamp = new Date().toISOString();
  const message = `[NETWORK_TIMEOUT] ${screen}.${action} timed out after ${duration}ms`;

  // Development: Log to console
  if (__DEV__) {
    console.warn(message);
  }

  // Production: Send to monitoring
  // Example: Analytics.logEvent('network_timeout', { screen, action, duration, timestamp });
}

/**
 * Log general offline-related errors
 * @param {string} screen - Screen/component name
 * @param {string} action - Action being performed
 * @param {Error} error - Error object
 */
export function logOfflineError(screen, action, error) {
  const timestamp = new Date().toISOString();
  const message = `[OFFLINE_ERROR] ${screen}.${action} error: ${error?.message || 'Unknown'}`;

  // Development: Log to console
  if (__DEV__) {
    console.error(message, error);
  }

  // Production: Send to error tracking
  // Example: Sentry.captureException(error, { tags: { screen, action, type: 'offline' } });
}

/**
 * Get current offline metrics summary for debugging
 * Used for checking overall system health
 */
export function getMetricsSummary() {
  return {
    timestamp: new Date().toISOString(),
    message: 'Offline metrics logging active. Check console for [OFFLINE_ATTEMPT], [DEBOUNCE], [VERSION_CONFLICT] logs.',
    note: 'In production, integrate with Analytics/Sentry to track metrics',
  };
}
