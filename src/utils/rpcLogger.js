/**
 * RPC Logger Utility - Minimal Version
 *
 * Logs RPC calls with minimal output:
 * - Development: 1 line per successful call showing duration
 * - Production: Only errors (silent on success)
 * - Smart error handling: Downgrades expected errors (like PGRST202) to warnings
 */

/**
 * Create a wrapped RPC function with minimal logging
 * @param {Function} originalRpc - Original supabase.rpc function
 * @returns {Function} Wrapped function with minimal logging
 */
export function wrapRPCWithLogging(originalRpc) {
  return async function wrappedRpc(functionName, params) {
    const startTime = performance.now();

    try {
      const response = await originalRpc.call(this, functionName, params);
      const duration = Math.round(performance.now() - startTime);

      if (response.error) {
        const { code, message, details } = response.error;

        // PGRST202 = Function not found (expected for optional RPCs with fallbacks)
        // Downgrade to warning instead of error to avoid alarm
        if (code === 'PGRST202') {
          if (__DEV__) {
            console.warn(
              `[RPC] ${functionName} not found (${duration}ms) - using fallback if available`
            );
          }
        } else {
          // Real errors - always log with full context
          console.error(
            `[RPC] ${functionName} ERROR (${duration}ms):`,
            message,
            '\nCode:', code || 'N/A',
            '\nDetails:', details || 'N/A'
          );
        }
      } else if (__DEV__) {
        // Only log success in dev mode (1 line, clean format)
        console.log(`[RPC] ${functionName} (${duration}ms)`);
      }

      return response;
    } catch (error) {
      // Always log exceptions (network errors, timeouts, etc.)
      console.error(`[RPC] ${functionName} EXCEPTION:`, error.message);
      throw error;
    }
  };
}
