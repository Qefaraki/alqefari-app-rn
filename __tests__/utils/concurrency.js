/**
 * Concurrency Test Utilities
 *
 * Helpers for testing concurrent operations, race conditions, and deadlocks.
 */

/**
 * Execute functions concurrently and return results
 * @param {Array<Function>} operations - Array of async functions
 * @returns {Promise<Array>} Array of results in same order
 */
async function runConcurrently(operations) {
  return Promise.all(operations.map((op) => op()));
}

/**
 * Execute functions concurrently and return settled results (success + failures)
 * @param {Array<Function>} operations - Array of async functions
 * @returns {Promise<Array>} Array of {status, value/reason}
 */
async function runConcurrentlySettled(operations) {
  return Promise.allSettled(operations.map((op) => op()));
}

/**
 * Run two operations concurrently and check if both succeed or one fails
 * Useful for testing race conditions
 */
async function runRaceCondition(operation1, operation2) {
  const results = await runConcurrentlySettled([operation1, operation2]);

  const successes = results.filter((r) => r.status === 'fulfilled');
  const failures = results.filter((r) => r.status === 'rejected');

  return {
    bothSucceeded: successes.length === 2,
    oneSucceeded: successes.length === 1,
    bothFailed: failures.length === 2,
    results,
    successes,
    failures,
  };
}

/**
 * Simulate N concurrent users performing the same operation
 * @param {number} userCount - Number of concurrent users
 * @param {Function} operation - Async operation to perform
 * @returns {Promise<Object>} Results summary
 */
async function simulateConcurrentUsers(userCount, operation) {
  const operations = Array(userCount).fill(null).map(() => operation);
  const results = await runConcurrentlySettled(operations);

  const successful = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  return {
    total: userCount,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length / userCount) * 100,
    results,
    successfulResults: successful.map((r) => r.value),
    failureReasons: failed.map((r) => r.reason),
  };
}

/**
 * Test optimistic locking by simulating concurrent updates with same version
 * @param {Function} updateOperation - Operation that requires version
 * @param {number} concurrentCount - Number of concurrent attempts
 * @returns {Promise<Object>} Results with exactly-one-success validation
 */
async function testOptimisticLocking(updateOperation, concurrentCount = 5) {
  const results = await simulateConcurrentUsers(concurrentCount, updateOperation);

  return {
    ...results,
    exactlyOneSucceeded: results.successful === 1,
    allButOneFailed: results.failed === concurrentCount - 1,
    isValidOptimisticLock: results.successful === 1 && results.failed === concurrentCount - 1,
  };
}

/**
 * Create a delayed operation (for timing-based race conditions)
 * @param {Function} operation - Async operation
 * @param {number} delayMs - Delay before executing
 */
function delayedOperation(operation, delayMs) {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return operation();
  };
}

/**
 * Test TOCTOU (Time-Of-Check-Time-Of-Use) vulnerability
 * @param {Function} checkOperation - Check operation
 * @param {Function} useOperation - Use operation (happens after check)
 * @param {Function} conflictingOperation - Operation that runs between check and use
 */
async function testTOCTOU(checkOperation, useOperation, conflictingOperation) {
  const checkResult = await checkOperation();

  // Execute conflicting operation while "use" is about to happen
  const usePromise = useOperation();
  const conflictPromise = conflictingOperation();

  const [useResult, conflictResult] = await Promise.allSettled([
    usePromise,
    conflictPromise,
  ]);

  return {
    checkResult,
    useResult,
    conflictResult,
    tocTouPrevented: useResult.status === 'rejected', // Should fail if TOCTOU prevented
  };
}

/**
 * Measure operation execution time
 * @param {Function} operation - Async operation to measure
 * @returns {Promise<{result, durationMs}>}
 */
async function measureExecutionTime(operation) {
  const startTime = Date.now();
  let result;
  let error;

  try {
    result = await operation();
  } catch (err) {
    error = err;
  }

  const durationMs = Date.now() - startTime;

  if (error) {
    throw error;
  }

  return { result, durationMs };
}

/**
 * Test deadlock detection (two operations waiting on each other's locks)
 * @param {Function} operation1 - First operation that acquires locks
 * @param {Function} operation2 - Second operation that acquires locks in different order
 * @param {number} timeoutMs - Max time to wait before considering deadlock
 */
async function testDeadlock(operation1, operation2, timeoutMs = 5000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Deadlock timeout')), timeoutMs)
  );

  try {
    await Promise.race([
      runConcurrently([operation1, operation2]),
      timeout,
    ]);
    return { deadlockOccurred: false };
  } catch (error) {
    return {
      deadlockOccurred: error.message === 'Deadlock timeout',
      error,
    };
  }
}

/**
 * Test idempotency - running the same operation multiple times should be safe
 * @param {Function} operation - Operation to test
 * @param {number} repeatCount - Number of times to repeat
 */
async function testIdempotency(operation, repeatCount = 3) {
  const results = [];

  for (let i = 0; i < repeatCount; i++) {
    try {
      const result = await operation();
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error });
    }
  }

  const allSucceeded = results.every((r) => r.success);
  const firstSuccessRestFailed = results[0].success && results.slice(1).every((r) => !r.success);

  return {
    results,
    allSucceeded, // True if operation is fully idempotent
    firstSuccessRestFailed, // True if operation is protected against duplicates
    isIdempotent: allSucceeded || firstSuccessRestFailed,
  };
}

/**
 * Batch operation with concurrency limit
 * @param {Array<Function>} operations - Operations to execute
 * @param {number} concurrencyLimit - Max concurrent operations
 */
async function batchWithLimit(operations, concurrencyLimit = 5) {
  const results = [];

  for (let i = 0; i < operations.length; i += concurrencyLimit) {
    const batch = operations.slice(i, i + concurrencyLimit);
    const batchResults = await runConcurrentlySettled(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Retry operation on lock failure
 * @param {Function} operation - Operation that might fail due to locks
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} retryDelayMs - Delay between retries
 */
async function retryOnLockFailure(operation, maxRetries = 3, retryDelayMs = 100) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLockError = error.message.includes('could not obtain lock') ||
                          error.message.includes('عملية أخرى قيد التنفيذ') ||
                          error.code === '55P03'; // PostgreSQL lock_not_available

      if (!isLockError || attempt === maxRetries - 1) {
        throw error;
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
    }
  }
}

module.exports = {
  runConcurrently,
  runConcurrentlySettled,
  runRaceCondition,
  simulateConcurrentUsers,
  testOptimisticLocking,
  delayedOperation,
  testTOCTOU,
  measureExecutionTime,
  testDeadlock,
  testIdempotency,
  batchWithLimit,
  retryOnLockFailure,
};
