import { create } from 'zustand';

// Gracefully handle NetInfo - it's a native module that requires native linking
// For Expo Go development, we'll provide a fallback
let NetInfo = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (e) {
  console.warn('[NetworkStore] NetInfo not available (requires native build). Using fallback.');
  // Fallback for development/testing
  NetInfo = {
    addEventListener: () => () => {},
    fetch: async () => ({
      isConnected: true,
      isInternetReachable: true,
      type: 'unknown',
    }),
  };
}

/**
 * Network Store
 *
 * Global network connectivity state using Zustand.
 * Monitors device network status and provides pre-flight checks for network-dependent operations.
 *
 * Features:
 * - Real-time network status monitoring (debounced 300ms)
 * - Synchronous state access for fast pre-flight checks
 * - Async connection verification for critical operations
 * - Proper cleanup on app unmount
 *
 * Usage:
 * ```javascript
 * // Hook: Real-time state
 * const { isConnected, isInternetReachable } = useNetworkStore();
 *
 * // Direct state access: Fast pre-flight check
 * const { isConnected } = useNetworkStore.getState();
 *
 * // Async check: Accurate current status
 * const state = await useNetworkStore.getState().checkConnection();
 *
 * // Initialize on app start
 * useNetworkStore.getState().initialize();
 *
 * // Cleanup on app unmount
 * useNetworkStore.getState().cleanup();
 * ```
 */

let unsubscribe = null;
let debounceTimer = null;

/**
 * Debounce function to prevent rapid state updates
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Debounce delay in milliseconds
 * @returns {Function} - Debounced function
 */
const debounce = (fn, ms) => {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), ms);
  };
};

export const useNetworkStore = create((set, get) => ({
  // Network state
  isConnected: true,
  isInternetReachable: true,
  connectionType: 'unknown', // 'wifi', 'cellular', 'ethernet', 'unknown', 'none'

  /**
   * Initialize network monitoring
   * Sets up NetInfo listener with 300ms debounce to prevent rapid state changes
   * Should be called once on app startup in _layout.tsx
   */
  initialize: () => {
    if (unsubscribe) return; // Already initialized

    // Debounced state setter to prevent rapid updates
    const debouncedSet = debounce((state) => {
      set({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type ?? 'unknown',
      });
    }, 300);

    // Get initial state and listen for changes
    NetInfo.fetch().then((state) => {
      set({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type ?? 'unknown',
      });
    });

    // Subscribe to network changes
    unsubscribe = NetInfo.addEventListener(debouncedSet);
  },

  /**
   * Check current network connection status asynchronously
   * Use this for critical operations that need accurate status
   * For pre-flight checks in hot paths, use getState() instead
   *
   * @returns {Promise<Object>} - Current network state
   */
  checkConnection: async () => {
    try {
      const state = await NetInfo.fetch();
      set({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type ?? 'unknown',
      });
      return state;
    } catch (error) {
      console.warn('Network check failed:', error);
      // Assume connected on error to be optimistic
      return { isConnected: true, isInternetReachable: true };
    }
  },

  /**
   * Check if device is currently online (synchronous)
   * Use this for fast pre-flight checks
   * For accurate status, use checkConnection() instead
   *
   * @returns {boolean} - True if device is connected
   */
  isOnline: () => {
    const { isConnected, isInternetReachable } = get();
    return isConnected && isInternetReachable !== false;
  },

  /**
   * Check if device is currently offline (synchronous)
   * Use this for fast pre-flight checks
   *
   * @returns {boolean} - True if device is offline
   */
  isOffline: () => {
    const { isConnected, isInternetReachable } = get();
    return !isConnected || isInternetReachable === false;
  },

  /**
   * Cleanup network listeners
   * Should be called on app unmount to prevent memory leaks
   */
  cleanup: () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  },
}));
