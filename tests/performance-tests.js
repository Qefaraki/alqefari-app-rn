#!/usr/bin/env node

/**
 * Backend Performance Test Suite
 * Tests performance characteristics and scalability
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ezkioroyhzpavmbfavyn.supabase.co',
  process.env.SUPABASE_ANON_KEY
);

// Test utilities
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

class PerformanceTests {
  constructor() {
    this.results = [];
    this.thresholds = {
      branchLoadSmall: 200,      // ms
      branchLoadMedium: 500,     // ms
      branchLoadLarge: 1000,     // ms
      viewportLoad: 300,         // ms
      search: 100,               // ms
      profileLoad: 50,           // ms
      marriageLoad: 50,          // ms
      bulkUpdate: 2000,          // ms
      concurrentOps: 1000        // ms
    };
  }

  async measureOperation(name, operation, threshold = null) {
    process.stdout.write(`Testing ${name}... `);
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      const passed = !threshold || duration <= threshold;
      const status = passed ? 'PASS' : 'WARN';
      const color = passed ? 'green' : 'yellow';
      
      log(`${status} (${formatTime(duration)}, ${formatBytes(memoryDelta)})`, color);
      
      this.results.push({
        name,
        duration,
        memoryDelta,
        passed,
        threshold,
        dataSize: result?.data?.length || 0,
        error: result?.error || null
      });
      
      return { duration, passed, data: result };
    } catch (error) {
      const duration = Date.now() - startTime;
      log(`FAIL (${formatTime(duration)})`, 'red');
      console.error(`  Error: ${error.message}`);
      
      this.results.push({
        name,
        duration,
        passed: false,
        error: error.message
      });
      
      return { duration, passed: false, error };
    }
  }

  // Test 1: Branch Loading Performance
  async testBranchLoadingPerformance() {
    log('\n🌳 Branch Loading Performance', 'cyan');
    
    // Small branch (1 level deep)
    await this.measureOperation(
      'Small Branch (depth=1)',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: 'R1',
          p_max_depth: 1,
          p_limit: 100
        });
        return { data, error };
      },
      this.thresholds.branchLoadSmall
    );
    
    // Medium branch (3 levels deep)
    await this.measureOperation(
      'Medium Branch (depth=3)',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: 'R1',
          p_max_depth: 3,
          p_limit: 200
        });
        return { data, error };
      },
      this.thresholds.branchLoadMedium
    );
    
    // Large branch (5 levels deep)
    await this.measureOperation(
      'Large Branch (depth=5)',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: 'R1',
          p_max_depth: 5,
          p_limit: 500
        });
        return { data, error };
      },
      this.thresholds.branchLoadLarge
    );
    
    // Multiple root branches
    await this.measureOperation(
      'All Root Branches',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: null,
          p_max_depth: 1,
          p_limit: 100
        });
        return { data, error };
      },
      this.thresholds.branchLoadSmall
    );
  }

  // Test 2: Search Performance
  async testSearchPerformance() {
    log('\n🔍 Search Performance', 'cyan');
    
    // Common name search
    await this.measureOperation(
      'Common Name Search',
      async () => {
        const { data, error } = await supabase.rpc('search_profiles_safe', {
          p_query: 'محمد',
          p_limit: 50,
          p_offset: 0
        });
        return { data, error };
      },
      this.thresholds.search
    );
    
    // Partial match search
    await this.measureOperation(
      'Partial Match Search',
      async () => {
        const { data, error } = await supabase.rpc('search_profiles_safe', {
          p_query: 'عبد',
          p_limit: 50,
          p_offset: 0
        });
        return { data, error };
      },
      this.thresholds.search
    );
    
    // Rare name search
    await this.measureOperation(
      'Rare Name Search',
      async () => {
        const { data, error } = await supabase.rpc('search_profiles_safe', {
          p_query: 'جربوع',
          p_limit: 50,
          p_offset: 0
        });
        return { data, error };
      },
      this.thresholds.search
    );
    
    // Large result set
    await this.measureOperation(
      'Large Result Search',
      async () => {
        const { data, error } = await supabase.rpc('search_profiles_safe', {
          p_query: 'ال',
          p_limit: 200,
          p_offset: 0
        });
        return { data, error };
      },
      this.thresholds.search * 2
    );
  }

  // Test 3: Viewport Performance
  async testViewportPerformance() {
    log('\n📐 Viewport Loading Performance', 'cyan');
    
    // Small viewport
    await this.measureOperation(
      'Small Viewport (500x500)',
      async () => {
        const viewport = {
          left: 0,
          top: 0,
          right: 500,
          bottom: 500
        };
        const { data, error } = await supabase.rpc('get_visible_nodes', {
          p_viewport: viewport,
          p_zoom_level: 1.0,
          p_limit: 100
        });
        return { data, error };
      },
      this.thresholds.viewportLoad
    );
    
    // Large viewport
    await this.measureOperation(
      'Large Viewport (2000x2000)',
      async () => {
        const viewport = {
          left: -1000,
          top: -1000,
          right: 1000,
          bottom: 1000
        };
        const { data, error } = await supabase.rpc('get_visible_nodes', {
          p_viewport: viewport,
          p_zoom_level: 1.0,
          p_limit: 200
        });
        return { data, error };
      },
      this.thresholds.viewportLoad
    );
    
    // Zoomed out viewport
    await this.measureOperation(
      'Zoomed Out (0.5x)',
      async () => {
        const viewport = {
          left: -500,
          top: -500,
          right: 500,
          bottom: 500
        };
        const { data, error } = await supabase.rpc('get_visible_nodes', {
          p_viewport: viewport,
          p_zoom_level: 0.5,
          p_limit: 100
        });
        return { data, error };
      },
      this.thresholds.viewportLoad
    );
    
    // Zoomed in viewport
    await this.measureOperation(
      'Zoomed In (2.0x)',
      async () => {
        const viewport = {
          left: 0,
          top: 0,
          right: 250,
          bottom: 250
        };
        const { data, error } = await supabase.rpc('get_visible_nodes', {
          p_viewport: viewport,
          p_zoom_level: 2.0,
          p_limit: 50
        });
        return { data, error };
      },
      this.thresholds.viewportLoad
    );
  }

  // Test 4: Concurrent Operations
  async testConcurrentOperations() {
    log('\n⚡ Concurrent Operations Performance', 'cyan');
    
    // Multiple branch loads
    await this.measureOperation(
      '5 Concurrent Branch Loads',
      async () => {
        const promises = ['R1', 'R2', 'R3', 'R63', 'R64'].map(hid =>
          supabase.rpc('get_branch_data', {
            p_hid: hid,
            p_max_depth: 2,
            p_limit: 50
          })
        );
        const results = await Promise.all(promises);
        return { data: results, error: null };
      },
      this.thresholds.concurrentOps
    );
    
    // Mixed operations
    await this.measureOperation(
      'Mixed Concurrent Operations',
      async () => {
        const promises = [
          // Branch load
          supabase.rpc('get_branch_data', {
            p_hid: 'R1',
            p_max_depth: 2,
            p_limit: 50
          }),
          // Search
          supabase.rpc('search_profiles_safe', {
            p_query: 'علي',
            p_limit: 20,
            p_offset: 0
          }),
          // Viewport
          supabase.rpc('get_visible_nodes', {
            p_viewport: { left: 0, top: 0, right: 500, bottom: 500 },
            p_zoom_level: 1.0,
            p_limit: 50
          }),
          // Person details
          supabase.rpc('get_person_with_relations', {
            p_id: 'R1'
          })
        ];
        const results = await Promise.all(promises);
        return { data: results, error: null };
      },
      this.thresholds.concurrentOps
    );
  }

  // Test 5: Data Scale Performance
  async testDataScalePerformance() {
    log('\n📊 Data Scale Performance', 'cyan');
    
    // Count total nodes
    const { count: totalNodes } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);
    
    log(`  Total nodes in database: ${totalNodes}`, 'blue');
    
    // Deep hierarchy query
    await this.measureOperation(
      'Deep Hierarchy Query (8 levels)',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: 'R1',
          p_max_depth: 8,
          p_limit: 500
        });
        return { data, error };
      },
      2000 // 2 seconds for deep queries
    );
    
    // Large family branch
    const { data: largestBranches } = await supabase
      .from('profiles')
      .select('hid, descendants_count')
      .order('descendants_count', { ascending: false })
      .limit(1);
    
    if (largestBranches && largestBranches.length > 0) {
      const largestHid = largestBranches[0].hid;
      const descendantCount = largestBranches[0].descendants_count;
      
      await this.measureOperation(
        `Largest Branch (${descendantCount} descendants)`,
        async () => {
          const { data, error } = await supabase.rpc('get_branch_data', {
            p_hid: largestHid,
            p_max_depth: 5,
            p_limit: 500
          });
          return { data, error };
        },
        1500
      );
    }
  }

  // Test 6: Edge Cases Performance
  async testEdgeCasesPerformance() {
    log('\n🔧 Edge Cases Performance', 'cyan');
    
    // Empty search
    await this.measureOperation(
      'Empty Search Result',
      async () => {
        const { data, error } = await supabase.rpc('search_profiles_safe', {
          p_query: 'زززززز', // Unlikely to match
          p_limit: 50,
          p_offset: 0
        });
        return { data, error };
      },
      this.thresholds.search
    );
    
    // Maximum depth
    await this.measureOperation(
      'Maximum Depth (10 levels)',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: 'R1',
          p_max_depth: 10,
          p_limit: 500
        });
        return { data, error };
      },
      3000
    );
    
    // Maximum limit
    await this.measureOperation(
      'Maximum Limit (500 nodes)',
      async () => {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: null,
          p_max_depth: 10,
          p_limit: 500
        });
        return { data, error };
      },
      2000
    );
  }

  // Generate performance report
  generateReport() {
    log('\n📈 Performance Test Report', 'blue');
    log('=========================', 'blue');
    
    // Summary statistics
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const averageTime = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    const maxTime = Math.max(...this.results.map(r => r.duration));
    const minTime = Math.min(...this.results.map(r => r.duration));
    
    log(`\nSummary:`, 'cyan');
    log(`  Total Tests: ${totalTests}`);
    log(`  Passed: ${passedTests} (${((passedTests/totalTests) * 100).toFixed(1)}%)`, passedTests === totalTests ? 'green' : 'yellow');
    log(`  Average Time: ${formatTime(averageTime)}`);
    log(`  Fastest: ${formatTime(minTime)}`);
    log(`  Slowest: ${formatTime(maxTime)}`);
    
    // Performance by category
    const categories = {
      'Branch': this.results.filter(r => r.name.includes('Branch')),
      'Search': this.results.filter(r => r.name.includes('Search')),
      'Viewport': this.results.filter(r => r.name.includes('Viewport')),
      'Concurrent': this.results.filter(r => r.name.includes('Concurrent')),
      'Scale': this.results.filter(r => r.name.includes('Hierarchy') || r.name.includes('descendants')),
      'Edge': this.results.filter(r => r.name.includes('Empty') || r.name.includes('Maximum'))
    };
    
    log(`\nPerformance by Category:`, 'cyan');
    Object.entries(categories).forEach(([category, tests]) => {
      if (tests.length === 0) return;
      const avgTime = tests.reduce((sum, t) => sum + t.duration, 0) / tests.length;
      const passRate = (tests.filter(t => t.passed).length / tests.length) * 100;
      log(`  ${category}: ${formatTime(avgTime)} avg, ${passRate.toFixed(0)}% pass rate`);
    });
    
    // Slowest operations
    const slowest = this.results
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    log(`\n⏱️  Slowest Operations:`, 'yellow');
    slowest.forEach((test, i) => {
      const status = test.passed ? '✓' : '⚠';
      log(`  ${i + 1}. ${test.name}: ${formatTime(test.duration)} ${status}`);
    });
    
    // Memory usage
    const memoryTests = this.results.filter(r => r.memoryDelta !== undefined);
    if (memoryTests.length > 0) {
      const totalMemory = memoryTests.reduce((sum, t) => sum + (t.memoryDelta || 0), 0);
      const avgMemory = totalMemory / memoryTests.length;
      
      log(`\n💾 Memory Usage:`, 'cyan');
      log(`  Average per operation: ${formatBytes(avgMemory)}`);
      log(`  Total used: ${formatBytes(totalMemory)}`);
    }
    
    // Recommendations
    log(`\n💡 Recommendations:`, 'blue');
    
    const failedThresholds = this.results.filter(r => r.threshold && !r.passed);
    if (failedThresholds.length > 0) {
      log(`  ⚠️  ${failedThresholds.length} operations exceeded performance thresholds:`);
      failedThresholds.forEach(test => {
        const exceeded = ((test.duration / test.threshold - 1) * 100).toFixed(0);
        log(`     - ${test.name}: ${exceeded}% over threshold`);
      });
    } else {
      log(`  ✅ All operations within performance thresholds`);
    }
    
    // Check for potential issues
    const verySlowOps = this.results.filter(r => r.duration > 1000);
    if (verySlowOps.length > 0) {
      log(`  ⚠️  ${verySlowOps.length} operations took over 1 second`);
    }
    
    const largDataSets = this.results.filter(r => r.dataSize > 200);
    if (largDataSets.length > 0) {
      log(`  📊 Consider pagination for operations returning 200+ records`);
    }
    
    return passedTests === totalTests;
  }

  // Run all tests
  async runAllTests() {
    log('\n⚡ Alqefari Family Tree Performance Test Suite', 'blue');
    log('============================================\n', 'blue');
    
    // Check if we have data
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (!count || count < 100) {
      log('⚠️  Warning: Limited data in database!', 'yellow');
      log(`Found only ${count || 0} profiles. Performance tests may not be representative.`, 'yellow');
      log('Consider running the mock data generator to create more test data.\n', 'yellow');
    }
    
    // Run test suites
    await this.testBranchLoadingPerformance();
    await this.testSearchPerformance();
    await this.testViewportPerformance();
    await this.testConcurrentOperations();
    await this.testDataScalePerformance();
    await this.testEdgeCasesPerformance();
    
    // Generate report
    const allPassed = this.generateReport();
    
    if (allPassed) {
      log('\n✨ All performance tests completed successfully!', 'green');
      log('The backend is performing within acceptable parameters.', 'green');
    } else {
      log('\n⚠️  Some performance thresholds were not met.', 'yellow');
      log('Consider optimizing the affected operations or adjusting thresholds.', 'yellow');
    }
    
    return allPassed;
  }
}

// Main execution
async function main() {
  const tester = new PerformanceTests();
  const success = await tester.runAllTests();
  
  process.exit(success ? 0 : 1);
}

// Run tests
main().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});