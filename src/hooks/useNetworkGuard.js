import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNetworkStore } from '../stores/networkStore';

/**
 * useNetworkGuard Hook
 *
 * Provides network status checking and user feedback for network-dependent operations.
 * Use this hook for pre-flight network checks before critical operations.
 *
 * Features:
 * - Synchronous online/offline status checks
 * - Async accurate status verification
 * - Built-in user alerts for offline scenarios
 * - Callback for network check failures
 *
 * Usage Examples:
 * ```javascript
 * // Check before operation and show alert if offline
 * const { checkBeforeAction, isOnline, isOffline } = useNetworkGuard();
 *
 * const handleSave = async () => {
 *   if (!checkBeforeAction('حفظ التعديلات')) {
 *     return; // Offline - alert already shown
 *   }
 *   // Proceed with save
 *   await saveProfile();
 * };
 *
 * // Check current status
 * if (isOffline) {
 *   return <NetworkStatusIndicator mode="fullscreen" onRetry={retry} />;
 * }
 *
 * // Async accurate check for critical operations
 * const handleLogin = async () => {
 *   const isConnected = await checkConnection();
 *   if (!isConnected) {
 *     Alert.alert('خطأ', 'لا يوجد اتصال بالإنترنت');
 *     return;
 *   }
 *   // Proceed with login
 * };
 * ```
 */
export const useNetworkGuard = () => {
  const store = useNetworkStore();
  const { isConnected, isInternetReachable, isOnline, isOffline, checkConnection } = store;

  /**
   * Check network status synchronously and show alert if offline
   * Use this for quick pre-flight checks in user interactions
   *
   * @param {string} actionName - Name of the action (for alert message)
   * @param {boolean} showAlert - Whether to show alert if offline (default: true)
   * @returns {boolean} - True if online, false if offline
   */
  const checkBeforeAction = useCallback(
    (actionName = 'العملية', showAlert = true) => {
      const online = isOnline();

      if (!online && showAlert) {
        Alert.alert(
          'لا يوجد اتصال',
          `لا يمكن ${actionName} أثناء عدم الاتصال بالإنترنت. تحقق من اتصالك وحاول مرة أخرى.`,
          [{ text: 'حسناً', onPress: () => {} }]
        );
      }

      return online;
    },
    [isOnline]
  );

  /**
   * Async check for accurate connection status
   * Use this when you need accurate current status before critical operations
   *
   * @returns {Promise<boolean>} - True if connected
   */
  const verifyConnection = useCallback(async () => {
    return await checkConnection();
  }, [checkConnection]);

  /**
   * Check if should show offline UI
   * @returns {boolean} - True if device is offline
   */
  const shouldShowOfflineUI = useCallback(() => {
    return isOffline();
  }, [isOffline]);

  return {
    // Synchronous status checks
    isOnline: isOnline(),
    isOffline: isOffline(),
    isConnected,
    isInternetReachable,

    // Async checks
    checkBeforeAction,
    verifyConnection,
    checkConnection,

    // Helpers
    shouldShowOfflineUI,
  };
};
