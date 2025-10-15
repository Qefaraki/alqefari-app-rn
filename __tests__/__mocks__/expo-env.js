/**
 * Mock for expo/virtual/env
 * Prevents ES6 module syntax errors in backend tests
 */

module.exports = {
  env: process.env,
};
