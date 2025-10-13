/**
 * fetchWithTimeout - Wraps a promise with a timeout mechanism
 *
 * Prevents async operations from hanging indefinitely by racing the
 * original promise against a timeout promise. Essential for network
 * operations that may not have built-in timeouts.
 *
 * @param {Promise} promise - The promise to wrap with timeout
 * @param {number} timeoutMs - Timeout duration in milliseconds (default: 5000)
 * @param {string} operationName - Name of operation for error messages (default: 'Operation')
 * @returns {Promise} - Resolves/rejects based on whichever happens first
 *
 * @example
 * // Basic usage
 * const data = await fetchWithTimeout(
 *   supabase.from('profiles').select('*'),
 *   5000,
 *   'Load profiles'
 * );
 *
 * @example
 * // With error handling
 * try {
 *   const marriages = await fetchWithTimeout(
 *     profilesService.getPersonMarriages(personId),
 *     5000,
 *     'Load marriages'
 *   );
 * } catch (error) {
 *   if (error.message.includes('timeout')) {
 *     Alert.alert('بطيء', 'استغرق التحميل وقتاً طويلاً');
 *   }
 * }
 */
export const fetchWithTimeout = (promise, timeoutMs = 5000, operationName = 'Operation') => {
  // Create timeout promise that rejects after specified duration
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    // Note: setTimeout returns a timer ID, not a cleanup function
    // The timer will be cleared when the race completes
  });

  // Race the original promise against the timeout
  // Whichever resolves/rejects first wins
  return Promise.race([promise, timeoutPromise]);
};

/**
 * fetchWithRetry - Wraps a promise with retry logic and timeout
 *
 * Attempts the operation multiple times with exponential backoff before giving up.
 * Useful for network operations that may fail transiently.
 *
 * @param {Function} fn - Function that returns a promise
 * @param {Object} options - Configuration options
 * @param {number} options.retries - Number of retry attempts (default: 1)
 * @param {number} options.timeout - Timeout per attempt in ms (default: 5000)
 * @param {number} options.backoff - Backoff multiplier for retry delay (default: 1.5)
 * @param {string} options.operationName - Name for error messages
 * @returns {Promise} - Result of successful operation
 *
 * @example
 * const data = await fetchWithRetry(
 *   () => profilesService.getPersonMarriages(personId),
 *   { retries: 2, timeout: 5000, operationName: 'Load marriages' }
 * );
 */
export const fetchWithRetry = async (
  fn,
  { retries = 1, timeout = 5000, backoff = 1.5, operationName = 'Operation' } = {}
) => {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Attempt the operation with timeout
      const result = await fetchWithTimeout(fn(), timeout, operationName);
      return result; // Success - return immediately
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt
      if (attempt < retries) {
        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(backoff, attempt), 5000);
        console.log(`[fetchWithRetry] ${operationName} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  console.error(`[fetchWithRetry] ${operationName} failed after ${retries + 1} attempts:`, lastError);
  throw lastError;
};

export default fetchWithTimeout;
