// Jest configuration for backend RPC function testing
// Uses REAL Supabase database (not mocks)

module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/backend.setup.js'],
  testTimeout: 30000, // 30s for database operations

  // Only run backend tests
  testMatch: [
    '**/__tests__/rpc/**/*.test.js',
  ],

  // No React Native transformations needed for backend tests
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'supabase/functions/**/*.sql',  // Track SQL coverage (informational)
  ],

  coverageThreshold: {
    global: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
  },

  // Coverage directory
  coverageDirectory: 'coverage/backend',

  // Verbose output for debugging
  verbose: true,

  // Don't transform node_modules except Supabase
  transformIgnorePatterns: [
    'node_modules/(?!(@supabase|expo)/)'
  ],

  // Module name mapper - mock expo modules + path aliases
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/__tests__/__mocks__/expo-env.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  moduleFileExtensions: ['js', 'json', 'node'],

  // Global teardown
  globalTeardown: '<rootDir>/__tests__/backend.teardown.js',
};
