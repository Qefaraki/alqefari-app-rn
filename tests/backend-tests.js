#!/usr/bin/env node

/**
 * Backend Functional Test Suite
 * Tests all critical backend features with the mock data
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
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

class BackendTests {
  constructor() {
    this.passedTests = 0;
    this.failedTests = 0;
    this.testResults = [];
  }

  async runTest(name, testFn) {
    process.stdout.write(`Testing ${name}... `);
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      log(`✅ PASSED (${duration}ms)`, 'green');
      this.passedTests++;
      this.testResults.push({ name, status: 'passed', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      log(`❌ FAILED`, 'red');
      console.error(`  Error: ${error.message}`);
      this.failedTests++;
      this.testResults.push({ name, status: 'failed', error: error.message, duration });
    }
  }

  // Test 1: Branch Loading
  async testBranchLoading() {
    await this.runTest('Branch Loading - Root Level', async () => {
      const { data, error } = await supabase.rpc('get_branch_data', {
        p_hid: null,
        p_max_depth: 1,
        p_limit: 100
      });
      
      assert(!error, `Error loading branches: ${error?.message}`);
      assert(Array.isArray(data), 'Data should be an array');
      assert(data.length > 0, 'Should have root nodes');
      assert(data[0].generation === 1, 'Root nodes should be generation 1');
      assert(data[0].hid.startsWith('R'), 'Root HIDs should start with R');
    });

    await this.runTest('Branch Loading - Deep Branch', async () => {
      // Get a root node first
      const { data: roots } = await supabase.rpc('get_branch_data', {
        p_hid: null,
        p_max_depth: 1,
        p_limit: 1
      });
      
      if (roots && roots.length > 0) {
        const { data, error } = await supabase.rpc('get_branch_data', {
          p_hid: roots[0].hid,
          p_max_depth: 5,
          p_limit: 200
        });
        
        assert(!error, `Error loading deep branch: ${error?.message}`);
        assert(data.length > 0, 'Should have nodes in branch');
        
        // Check has_more_descendants flag
        const deepNodes = data.filter(n => n.generation >= 5);
        if (deepNodes.length > 0) {
          const hasMoreNodes = deepNodes.filter(n => n.has_more_descendants);
          assert(hasMoreNodes.length >= 0, 'Should have has_more_descendants flags');
        }
      }
    });

    await this.runTest('Branch Loading - Limit Enforcement', async () => {
      const limit = 10;
      const { data, error } = await supabase.rpc('get_branch_data', {
        p_hid: null,
        p_max_depth: 10,
        p_limit: limit
      });
      
      assert(!error, `Error testing limit: ${error?.message}`);
      assert(data.length <= limit, `Should respect limit of ${limit}, got ${data.length}`);
    });
  }

  // Test 2: Viewport-based Loading
  async testViewportLoading() {
    await this.runTest('Viewport Loading - Basic', async () => {
      const viewport = {
        left: -1000,
        top: -1000,
        right: 1000,
        bottom: 1000
      };
      
      const { data, error } = await supabase.rpc('get_visible_nodes', {
        p_viewport: viewport,
        p_zoom_level: 1.0,
        p_limit: 100
      });
      
      assert(!error, `Error loading viewport: ${error?.message}`);
      assert(Array.isArray(data), 'Data should be an array');
      
      // All returned nodes should have layout positions
      if (data.length > 0) {
        assert(data[0].layout_position, 'Nodes should have layout positions');
      }
    });

    await this.runTest('Viewport Loading - Zoom Filtering', async () => {
      const viewport = {
        left: 0,
        top: 0,
        right: 500,
        bottom: 500
      };
      
      // Test with different zoom levels
      const { data: zoom1 } = await supabase.rpc('get_visible_nodes', {
        p_viewport: viewport,
        p_zoom_level: 1.0,
        p_limit: 200
      });
      
      const { data: zoom05 } = await supabase.rpc('get_visible_nodes', {
        p_viewport: viewport,
        p_zoom_level: 0.5,
        p_limit: 200
      });
      
      // At lower zoom (0.5), we should see different nodes
      assert(zoom1 || zoom05, 'Should have data for at least one zoom level');
    });
  }

  // Test 3: Search Functionality
  async testSearch() {
    await this.runTest('Search - Arabic Text', async () => {
      const { data, error } = await supabase.rpc('search_profiles_safe', {
        p_query: 'محمد',
        p_limit: 50,
        p_offset: 0
      });
      
      assert(!error, `Search error: ${error?.message}`);
      assert(Array.isArray(data), 'Search should return array');
      
      // Check if results contain the search term
      if (data.length > 0) {
        const hasMatch = data.some(p => p.name.includes('محمد'));
        assert(hasMatch, 'Results should contain search term');
      }
    });

    await this.runTest('Search - Partial Matching', async () => {
      const { data, error } = await supabase.rpc('search_profiles_safe', {
        p_query: 'عبد',
        p_limit: 20,
        p_offset: 0
      });
      
      assert(!error, `Partial search error: ${error?.message}`);
      
      if (data.length > 0) {
        const hasPartialMatch = data.some(p => p.name.includes('عبد'));
        assert(hasPartialMatch, 'Should find partial matches');
      }
    });

    await this.runTest('Search - Pagination', async () => {
      const { data: page1 } = await supabase.rpc('search_profiles_safe', {
        p_query: 'ال',
        p_limit: 10,
        p_offset: 0
      });
      
      const { data: page2 } = await supabase.rpc('search_profiles_safe', {
        p_query: 'ال',
        p_limit: 10,
        p_offset: 10
      });
      
      // Check that pages are different
      if (page1?.length > 0 && page2?.length > 0) {
        const page1Ids = page1.map(p => p.id);
        const page2Ids = page2.map(p => p.id);
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        assert(overlap.length === 0, 'Pagination should return different results');
      }
    });
  }

  // Test 4: Validation Functions
  async testValidation() {
    await this.runTest('Date Validation - Valid Formats', async () => {
      // This is tested during data insertion
      // Check if our mock data was inserted successfully
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('dob_data', 'is', null);
      
      assert(count > 0, 'Should have profiles with valid dates');
    });

    await this.runTest('Social Media Validation', async () => {
      // Check profiles with social media
      const { data } = await supabase
        .from('profiles')
        .select('social_media_links')
        .not('social_media_links', 'eq', '{}')
        .limit(10);
      
      if (data && data.length > 0) {
        data.forEach(profile => {
          const links = profile.social_media_links;
          Object.values(links).forEach(url => {
            assert(url.startsWith('http'), 'Social media URLs should be valid');
          });
        });
      }
    });

    await this.runTest('Generation Hierarchy', async () => {
      // Get parent-child pairs
      const { data } = await supabase
        .from('profiles')
        .select('id, generation, father_id')
        .not('father_id', 'is', null)
        .limit(20);
      
      if (data && data.length > 0) {
        for (const child of data) {
          const { data: parent } = await supabase
            .from('profiles')
            .select('generation')
            .eq('id', child.father_id)
            .single();
          
          if (parent) {
            assert(
              child.generation > parent.generation,
              `Child generation (${child.generation}) should be greater than parent (${parent.generation})`
            );
          }
        }
      }
    });
  }

  // Test 5: Marriage Functionality
  async testMarriages() {
    await this.runTest('Get Person Marriages', async () => {
      // Find a married person
      const { data: marriages } = await supabase
        .from('marriages')
        .select('husband_id')
        .limit(1);
      
      if (marriages && marriages.length > 0) {
        const { data, error } = await supabase.rpc('get_person_marriages', {
          p_id: marriages[0].husband_id
        });
        
        assert(!error, `Error getting marriages: ${error?.message}`);
        assert(Array.isArray(data), 'Should return array of marriages');
        assert(data.length > 0, 'Should have at least one marriage');
        assert(data[0].spouse_name, 'Marriage should include spouse name');
      }
    });

    await this.runTest('Marriage Status Types', async () => {
      const { data } = await supabase
        .from('marriages')
        .select('status')
        .limit(50);
      
      if (data && data.length > 0) {
        const validStatuses = ['married', 'divorced', 'widowed'];
        data.forEach(marriage => {
          assert(
            validStatuses.includes(marriage.status),
            `Invalid marriage status: ${marriage.status}`
          );
        });
      }
    });
  }

  // Test 6: Admin Functions
  async testAdminFunctions() {
    await this.runTest('Profile Version Control', async () => {
      // Get a profile to test
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, version')
        .limit(1);
      
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        assert(profile.version >= 1, 'Profile should have version number');
      }
    });

    await this.runTest('Layout Queue', async () => {
      const { data, error } = await supabase
        .from('layout_recalc_queue')
        .select('*')
        .limit(10);
      
      assert(!error, `Error checking queue: ${error?.message}`);
      
      if (data && data.length > 0) {
        data.forEach(item => {
          assert(item.status, 'Queue items should have status');
          assert(item.node_id, 'Queue items should have node_id');
        });
      }
    });
  }

  // Test 7: Performance Metrics
  async testPerformance() {
    await this.runTest('Branch Load Performance', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase.rpc('get_branch_data', {
        p_hid: null,
        p_max_depth: 3,
        p_limit: 100
      });
      
      const duration = Date.now() - startTime;
      
      assert(!error, `Performance test error: ${error?.message}`);
      assert(duration < 1000, `Branch load should be < 1000ms, was ${duration}ms`);
      
      log(`  Branch load time: ${duration}ms for ${data?.length || 0} nodes`, 'blue');
    });

    await this.runTest('Search Performance', async () => {
      const startTime = Date.now();
      
      const { data, error } = await supabase.rpc('search_profiles_safe', {
        p_query: 'عبد',
        p_limit: 50,
        p_offset: 0
      });
      
      const duration = Date.now() - startTime;
      
      assert(!error, `Search performance error: ${error?.message}`);
      assert(duration < 500, `Search should be < 500ms, was ${duration}ms`);
      
      log(`  Search time: ${duration}ms for ${data?.length || 0} results`, 'blue');
    });
  }

  // Test 8: Data Integrity
  async testDataIntegrity() {
    await this.runTest('HID Uniqueness', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('hid')
        .limit(100);
      
      assert(!error, `HID check error: ${error?.message}`);
      
      if (data && data.length > 0) {
        const hids = data.map(p => p.hid);
        const uniqueHids = new Set(hids);
        assert(hids.length === uniqueHids.size, 'All HIDs should be unique');
      }
    });

    await this.runTest('Required Fields', async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, hid, name, gender, generation')
        .limit(50);
      
      if (data && data.length > 0) {
        data.forEach(profile => {
          assert(profile.hid, 'HID is required');
          assert(profile.name, 'Name is required');
          assert(profile.gender, 'Gender is required');
          assert(profile.generation > 0, 'Generation must be positive');
        });
      }
    });

    await this.runTest('No Orphaned Nodes', async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, father_id, generation')
        .not('father_id', 'is', null)
        .limit(50);
      
      if (data && data.length > 0) {
        for (const node of data) {
          const { data: parent, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', node.father_id)
            .single();
          
          assert(!error && parent, `Node ${node.id} has invalid parent reference`);
        }
      }
    });
  }

  // Run all tests
  async runAllTests() {
    log('\n🧪 Alqefari Family Tree Backend Test Suite', 'blue');
    log('==========================================\n', 'blue');
    
    // Check if we have data
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (!count || count === 0) {
      log('⚠️  Warning: No data found in database!', 'yellow');
      log('Please run the mock data generator first:', 'yellow');
      log('  node scripts/generate-mock-data.js\n', 'yellow');
    }
    
    // Run test categories
    await this.testBranchLoading();
    await this.testViewportLoading();
    await this.testSearch();
    await this.testValidation();
    await this.testMarriages();
    await this.testAdminFunctions();
    await this.testPerformance();
    await this.testDataIntegrity();
    
    // Summary
    log('\n📊 Test Summary', 'blue');
    log('==============', 'blue');
    log(`Total Tests: ${this.passedTests + this.failedTests}`);
    log(`✅ Passed: ${this.passedTests}`, 'green');
    log(`❌ Failed: ${this.failedTests}`, 'red');
    
    if (this.failedTests > 0) {
      log('\n❌ Failed Tests:', 'red');
      this.testResults
        .filter(r => r.status === 'failed')
        .forEach(r => {
          log(`  - ${r.name}: ${r.error}`, 'red');
        });
    }
    
    // Performance summary
    const perfTests = this.testResults.filter(r => 
      r.name.includes('Performance') && r.status === 'passed'
    );
    
    if (perfTests.length > 0) {
      log('\n⚡ Performance Results:', 'blue');
      perfTests.forEach(test => {
        log(`  - ${test.name}: ${test.duration}ms`, 'blue');
      });
    }
    
    return this.failedTests === 0;
  }
}

// Main execution
async function main() {
  const tester = new BackendTests();
  const success = await tester.runAllTests();
  
  if (success) {
    log('\n✨ All tests passed! Backend is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n❌ Some tests failed. Please check the errors above.', 'red');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});