/**
 * RPC Logger Utility
 *
 * Comprehensive logging for all Supabase RPC calls.
 * Tracks parameters, timing, responses, and errors with visual indicators.
 */

/**
 * Log RPC call initiation with parameters
 * @param {string} functionName - Name of the RPC function
 * @param {Object} params - Parameters being sent
 */
export function logRPCCall(functionName, params) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔵 RPC CALL: ${functionName}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⏱️  Started at:', new Date().toISOString());
  console.log('📤 Parameters:', JSON.stringify(params, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Log RPC response (success or error)
 * @param {string} functionName - Name of the RPC function
 * @param {Object} response - Supabase response object {data, error}
 * @param {number} duration - Call duration in milliseconds
 */
export function logRPCResponse(functionName, response, duration) {
  const { data, error } = response;

  if (error) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔴 RPC ERROR: ${functionName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏱️  Completed at:', new Date().toISOString());
    console.log(`⏲️  Duration: ${duration}ms`);
    console.log('❌ Error Details:');
    console.log('   Code:', error.code || 'N/A');
    console.log('   Message:', error.message || 'N/A');
    console.log('   Details:', error.details || 'N/A');
    console.log('   Hint:', error.hint || 'N/A');
    console.log('   Full Error:', JSON.stringify(error, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🟢 RPC SUCCESS: ${functionName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏱️  Completed at:', new Date().toISOString());
    console.log(`⏲️  Duration: ${duration}ms`);
    console.log('✅ Response Data:');

    // Handle different data types
    if (data === null || data === undefined) {
      console.log('   (null or undefined)');
    } else if (Array.isArray(data)) {
      console.log(`   Array with ${data.length} items`);
      if (data.length > 0) {
        console.log('   First item:', JSON.stringify(data[0], null, 2));
      }
    } else if (typeof data === 'object') {
      console.log('   Object:', JSON.stringify(data, null, 2));
    } else {
      console.log('   Primitive:', data);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

/**
 * Log RPC timing information
 * @param {string} functionName - Name of the RPC function
 * @param {number} startTime - Performance.now() start timestamp
 * @returns {number} Duration in milliseconds
 */
export function logRPCTiming(functionName, startTime) {
  const duration = Math.round(performance.now() - startTime);
  console.log(`⏲️  [${functionName}] Execution time: ${duration}ms`);
  return duration;
}

/**
 * Create a wrapped RPC function with logging
 * @param {Function} originalRpc - Original supabase.rpc function
 * @returns {Function} Wrapped function with logging
 */
export function wrapRPCWithLogging(originalRpc) {
  return async function wrappedRpc(functionName, params) {
    const startTime = performance.now();

    // Log the call
    logRPCCall(functionName, params);

    // Execute the actual RPC
    const response = await originalRpc.call(this, functionName, params);

    // Calculate duration
    const duration = Math.round(performance.now() - startTime);

    // Log the response
    logRPCResponse(functionName, response, duration);

    return response;
  };
}
