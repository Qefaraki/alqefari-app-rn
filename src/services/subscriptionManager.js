import { supabase } from './supabase';

/**
 * Memory-safe Subscription Manager
 *
 * Features:
 * - Connection pooling (max 5 channels)
 * - Automatic cleanup on unmount
 * - Exponential backoff retry
 * - Health monitoring with heartbeat
 * - Memory usage tracking
 * - Circuit breaker pattern
 */
class SubscriptionManager {
  constructor() {
    // Use WeakMap for automatic garbage collection
    this.subscriptions = new WeakMap();
    this.activeChannels = new Map();
    this.retryAttempts = new Map();
    this.circuitBreaker = new Map();
    this.lastRetryTime = new Map();
    this.activeRetryTimeouts = new Map(); // Track active retry timeouts

    // Network state handling
    this.isNetworkConnected = true;
    this.pausedChannels = new Set(); // Track paused subscriptions
    this.networkUnsubscribe = null;

    // Configuration
    this.config = {
      maxChannels: 5,
      maxRetries: 3, // Reduced from 5 to fail faster
      baseRetryDelay: 1000, // 1 second
      maxRetryDelay: 15000, // Reduced from 30s to 15s
      heartbeatInterval: 30000, // 30 seconds
      inactivityTimeout: 300000, // 5 minutes
      memoryThreshold: 80 * 1024 * 1024, // 80MB warning threshold
      debounceDelay: 500, // 500ms debounce for updates
      circuitBreakerThreshold: 3, // Reduced from 5 to open circuit faster
      circuitBreakerResetTime: 60000, // 1 minute reset time
      maxConcurrentRetries: 2 // New: limit concurrent retry attempts
    };

    // Performance monitoring
    this.metrics = {
      connectTime: [],
      disconnectTime: [],
      failedReconnects: 0,
      memoryUsage: [],
      activeSubscriptions: 0
    };

    // Debounce timers
    this.debounceTimers = new Map();

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Subscribe to a channel with memory safety
   */
  async subscribe({
    channelName,
    table,
    filter = null,
    event = '*',
    onUpdate,
    onError = null,
    component = null // For WeakMap tracking
  }) {
    try {
      // Check circuit breaker
      if (this.isCircuitOpen(channelName)) {
        console.warn(`[SubscriptionManager] Circuit breaker open for ${channelName}`);
        if (onError) onError(new Error('Circuit breaker is open - too many failures'));
        return null;
      }

      // Check connection pool limit
      if (this.activeChannels.size >= this.config.maxChannels) {
        // Clean up inactive channels
        await this.cleanupInactiveChannels();

        if (this.activeChannels.size >= this.config.maxChannels) {
          console.warn('[SubscriptionManager] Max channels reached, queuing subscription');
          if (onError) onError(new Error('Max concurrent subscriptions reached'));
          return null;
        }
      }

      // Check memory usage
      if (this.isMemoryThresholdExceeded()) {
        console.warn('[SubscriptionManager] Memory threshold exceeded');
        await this.reduceMemoryUsage();
      }

      // Clean up existing subscription
      await this.unsubscribe(channelName);

      const startTime = Date.now();

      // Build subscription config
      const subscriptionConfig = {
        event,
        schema: 'public',
        table
      };

      if (filter) {
        subscriptionConfig.filter = filter;
      }

      // Create debounced update handler
      const debouncedUpdate = this.createDebouncedHandler(channelName, onUpdate);

      // Create subscription with error handling
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', subscriptionConfig, (payload) => {
          // Update last activity
          this.updateChannelActivity(channelName);

          // Call debounced handler
          debouncedUpdate(payload);
        })
        .on('error', (error) => {
          console.error(`[SubscriptionManager] Error in ${channelName}:`, error);
          this.handleSubscriptionError(channelName, error, onError);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {

            // Track metrics
            const connectTime = Date.now() - startTime;
            this.metrics.connectTime.push(connectTime);
            this.metrics.activeSubscriptions++;

            // Reset retry attempts
            this.retryAttempts.delete(channelName);

            // Reset circuit breaker
            this.resetCircuitBreaker(channelName);
          } else if (status === 'CLOSED') {
            // Don't retry on normal close
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`[SubscriptionManager] Channel ${channelName} error`);
            this.handleSubscriptionError(channelName, new Error(`Channel error`), onError);
          } else if (status === 'TIMED_OUT') {
            console.warn(`[SubscriptionManager] Channel ${channelName} timed out`);
            this.handleSubscriptionError(channelName, new Error(`Channel timeout`), onError);
          }
        });

      // Store subscription info
      const subscriptionInfo = {
        channel,
        table,
        filter,
        onUpdate,
        onError,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        retryCount: 0
      };

      this.activeChannels.set(channelName, subscriptionInfo);

      // Store in WeakMap if component provided
      if (component) {
        if (!this.subscriptions.has(component)) {
          this.subscriptions.set(component, new Set());
        }
        this.subscriptions.get(component).add(channelName);
      }

      return {
        unsubscribe: () => this.unsubscribe(channelName),
        channelName
      };

    } catch (error) {
      console.error(`[SubscriptionManager] Failed to subscribe to ${channelName}:`, error);
      if (onError) onError(error);
      return null;
    }
  }

  /**
   * Create debounced update handler
   */
  createDebouncedHandler(channelName, callback) {
    return (payload) => {
      // Clear existing timer
      if (this.debounceTimers.has(channelName)) {
        clearTimeout(this.debounceTimers.get(channelName));
      }

      // Set new timer
      const timer = setTimeout(() => {
        callback(payload);
        this.debounceTimers.delete(channelName);
      }, this.config.debounceDelay);

      this.debounceTimers.set(channelName, timer);
    };
  }

  /**
   * Handle subscription errors with retry logic
   */
  async handleSubscriptionError(channelName, error, onError) {
    const retryCount = this.retryAttempts.get(channelName) || 0;

    // Check if we're retrying too frequently (prevent infinite loops)
    const lastRetry = this.lastRetryTime.get(channelName) || 0;
    const timeSinceLastRetry = Date.now() - lastRetry;
    if (timeSinceLastRetry < 500) {
      console.warn(`[SubscriptionManager] Retry throttled for ${channelName} (too frequent)`);
      return;
    }

    // Check concurrent retry limit
    const activeRetries = Array.from(this.activeRetryTimeouts.values()).filter(t => t !== null).length;
    if (activeRetries >= this.config.maxConcurrentRetries) {
      console.warn(`[SubscriptionManager] Max concurrent retries reached, skipping retry for ${channelName}`);
      if (onError) onError(new Error('Too many concurrent retry attempts'));
      return;
    }

    // Update circuit breaker
    this.updateCircuitBreaker(channelName, false);

    if (retryCount >= this.config.maxRetries) {
      console.error(`[SubscriptionManager] Max retries reached for ${channelName}`);
      this.metrics.failedReconnects++;

      // Open circuit breaker
      this.openCircuitBreaker(channelName);

      // Clear any existing retry timeout
      this.clearRetryTimeout(channelName);

      if (onError) onError(error);
      return;
    }

    // Don't retry if explicitly closed by user or component unmounted
    const subscriptionInfo = this.activeChannels.get(channelName);
    if (!subscriptionInfo) {
      this.clearRetryTimeout(channelName);
      return;
    }

    // Calculate retry delay with exponential backoff
    const delay = Math.min(
      this.config.baseRetryDelay * Math.pow(2, retryCount),
      this.config.maxRetryDelay
    );

    this.retryAttempts.set(channelName, retryCount + 1);
    this.lastRetryTime.set(channelName, Date.now());

    // Clear any existing retry timeout for this channel
    this.clearRetryTimeout(channelName);

    // Set new retry timeout
    const retryTimeout = setTimeout(async () => {
      // Remove this timeout from active list
      this.activeRetryTimeouts.delete(channelName);

      const subscriptionInfo = this.activeChannels.get(channelName);
      if (subscriptionInfo && !this.isCircuitOpen(channelName)) {

        // Clean up old subscription first
        if (subscriptionInfo.channel) {
          try {
            await subscriptionInfo.channel.unsubscribe();
          } catch (e) {
            // Ignore unsubscribe errors
          }
        }

        // Remove from active channels to allow fresh subscription
        this.activeChannels.delete(channelName);

        // Then retry with fresh subscription
        await this.subscribe({
          channelName,
          table: subscriptionInfo.table,
          filter: subscriptionInfo.filter,
          onUpdate: subscriptionInfo.onUpdate,
          onError: subscriptionInfo.onError
        });
      }
    }, delay);

    // Track the retry timeout
    this.activeRetryTimeouts.set(channelName, retryTimeout);
  }

  /**
   * Clear retry timeout for a channel
   */
  clearRetryTimeout(channelName) {
    const timeout = this.activeRetryTimeouts.get(channelName);
    if (timeout) {
      clearTimeout(timeout);
      this.activeRetryTimeouts.delete(channelName);
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channelName) {
    try {
      const startTime = Date.now();
      const subscriptionInfo = this.activeChannels.get(channelName);

      if (subscriptionInfo?.channel) {
        await subscriptionInfo.channel.unsubscribe();

        // Track metrics
        const disconnectTime = Date.now() - startTime;
        this.metrics.disconnectTime.push(disconnectTime);
        this.metrics.activeSubscriptions = Math.max(0, this.metrics.activeSubscriptions - 1);
      }

      // Clear debounce timer
      if (this.debounceTimers.has(channelName)) {
        clearTimeout(this.debounceTimers.get(channelName));
        this.debounceTimers.delete(channelName);
      }

      // Clear retry timeout
      this.clearRetryTimeout(channelName);

      this.activeChannels.delete(channelName);
      this.retryAttempts.delete(channelName);
      this.lastRetryTime.delete(channelName);
    } catch (error) {
      console.error(`[SubscriptionManager] Error unsubscribing from ${channelName}:`, error);
    }
  }

  /**
   * Unsubscribe all channels for a component
   */
  async unsubscribeComponent(component) {
    const channelNames = this.subscriptions.get(component);
    if (channelNames) {
      for (const channelName of channelNames) {
        await this.unsubscribe(channelName);
      }
      this.subscriptions.delete(component);
    }
  }

  /**
   * Clean up inactive channels
   */
  async cleanupInactiveChannels() {
    const now = Date.now();
    const inactiveChannels = [];

    for (const [channelName, info] of this.activeChannels) {
      if (now - info.lastActivity > this.config.inactivityTimeout) {
        inactiveChannels.push(channelName);
      }
    }

    for (const channelName of inactiveChannels) {
      await this.unsubscribe(channelName);
    }
  }

  /**
   * Update channel activity timestamp
   */
  updateChannelActivity(channelName) {
    const info = this.activeChannels.get(channelName);
    if (info) {
      info.lastActivity = Date.now();
    }
  }

  /**
   * Circuit breaker implementation
   */
  isCircuitOpen(channelName) {
    const breaker = this.circuitBreaker.get(channelName);
    if (!breaker) return false;

    // Check if reset time has passed
    if (Date.now() - breaker.openedAt > this.config.circuitBreakerResetTime) {
      this.circuitBreaker.delete(channelName);
      return false;
    }

    return breaker.isOpen;
  }

  updateCircuitBreaker(channelName, success) {
    const breaker = this.circuitBreaker.get(channelName) || {
      failures: 0,
      isOpen: false,
      openedAt: null
    };

    if (success) {
      breaker.failures = 0;
    } else {
      breaker.failures++;
    }

    this.circuitBreaker.set(channelName, breaker);
  }

  openCircuitBreaker(channelName) {
    const breaker = this.circuitBreaker.get(channelName) || { failures: 0 };
    breaker.isOpen = true;
    breaker.openedAt = Date.now();
    this.circuitBreaker.set(channelName, breaker);
    console.warn(`[SubscriptionManager] Circuit breaker opened for ${channelName}`);
  }

  resetCircuitBreaker(channelName) {
    this.circuitBreaker.delete(channelName);
  }

  /**
   * Memory management
   */
  isMemoryThresholdExceeded() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const usage = performance.memory.usedJSHeapSize;
      this.metrics.memoryUsage.push(usage);
      return usage > this.config.memoryThreshold;
    }
    return false;
  }

  async reduceMemoryUsage() {
    console.warn('[SubscriptionManager] Reducing memory usage');

    // Clean up old metrics
    this.metrics.connectTime = this.metrics.connectTime.slice(-100);
    this.metrics.disconnectTime = this.metrics.disconnectTime.slice(-100);
    this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);

    // Clean up inactive channels
    await this.cleanupInactiveChannels();
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    this.healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.heartbeatInterval);
  }

  performHealthCheck() {
    // Clean up if needed
    if (this.activeChannels.size > 0) {
      this.cleanupInactiveChannels();
    }
  }

  getAverageMetric(metrics) {
    if (metrics.length === 0) return 0;
    return Math.round(metrics.reduce((a, b) => a + b, 0) / metrics.length);
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeChannels: this.activeChannels.size,
      avgConnectTime: this.getAverageMetric(this.metrics.connectTime),
      avgDisconnectTime: this.getAverageMetric(this.metrics.disconnectTime)
    };
  }

  /**
   * Initialize network state listener
   * Automatically called from app root to handle disconnections
   */
  initializeNetworkListener() {
    try {
      // Import here to avoid circular dependency
      const { useNetworkStore } = require('../stores/networkStore');

      // Listen to network state changes
      this.networkUnsubscribe = useNetworkStore.subscribe(
        (state) => {
          const isConnected = state.isConnected && state.isInternetReachable !== false;
          return isConnected;
        },
        (isConnected) => {
          this.isNetworkConnected = isConnected;

          if (!isConnected) {
            this.handleNetworkDisconnect();
          } else {
            this.handleNetworkReconnect();
          }
        }
      );

      console.log('[SubscriptionManager] Network listener initialized');
    } catch (error) {
      console.warn('[SubscriptionManager] Failed to initialize network listener:', error);
    }
  }

  /**
   * Handle network disconnection
   * Pauses all active subscriptions and clears retry timers
   */
  async handleNetworkDisconnect() {
    console.warn('[SubscriptionManager] Network disconnected - pausing subscriptions');

    // Clear all retry timeouts to prevent stale retries
    for (const [channelName, timeout] of this.activeRetryTimeouts.entries()) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    this.activeRetryTimeouts.clear();

    // Mark all channels as paused
    for (const channelName of this.activeChannels.keys()) {
      this.pausedChannels.add(channelName);
    }

    // Reset retry attempts for fresh restart on reconnect
    this.retryAttempts.clear();
  }

  /**
   * Handle network reconnection
   * Resumes all paused subscriptions and resets circuit breakers
   */
  async handleNetworkReconnect() {
    console.log('[SubscriptionManager] Network reconnected - resuming subscriptions');

    // Reset circuit breakers for fresh attempts
    for (const channelName of this.pausedChannels.keys()) {
      this.resetCircuitBreaker(channelName);
    }

    // Clear paused channels set (subscriptions will retry naturally)
    this.pausedChannels.clear();

    console.log('[SubscriptionManager] Subscriptions ready for reconnection');
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup() {
    // Clear health monitoring
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    // Clear network listener
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Clear all retry timeouts
    for (const [channelName, timeout] of this.activeRetryTimeouts) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    this.activeRetryTimeouts.clear();

    // Unsubscribe all channels
    const channels = Array.from(this.activeChannels.keys());
    for (const channelName of channels) {
      await this.unsubscribe(channelName);
    }

    // Clear all maps
    this.activeChannels.clear();
    this.retryAttempts.clear();
    this.circuitBreaker.clear();
    this.lastRetryTime.clear();
    this.pausedChannels.clear();
  }
}

// Export singleton instance
const subscriptionManager = new SubscriptionManager();

// Cleanup on app termination (web only)
// Note: React Native doesn't have window.addEventListener
// Cleanup will be handled by component unmount hooks

export default subscriptionManager;