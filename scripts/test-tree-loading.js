const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  'https://ezkioroyhzpavmbfavyn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTI2MjAsImV4cCI6MjA3MjA2ODYyMH0.-9bUFjeXEwAcdl1d8fj7dX1ZmHMCpuX5TdzmFTOwO-Q'
);

async function testTreeLoading() {
  // Test 1: Load root nodes (should return single root)
  console.log('Test 1: Loading root nodes...');
  const { data: rootData, error: rootError } = await supabase.rpc('get_branch_data', {
    p_hid: null,
    p_max_depth: 3,
    p_limit: 200
  });
  
  if (rootError) {
    console.error('Root load error:', rootError);
    return;
  }
  
  console.log('Root nodes found:', rootData.length);
  if (rootData.length === 1 && rootData[0].hid === '1') {
    console.log('✅ Single root structure confirmed!');
    console.log('Root:', rootData[0]);
  } else {
    console.log('❌ Expected single root with HID "1"');
  }
  
  // Test 2: Load tree with depth
  console.log('\nTest 2: Loading tree with depth...');
  const { data: treeData, error: treeError } = await supabase.rpc('get_branch_data', {
    p_hid: '1',
    p_max_depth: 3,
    p_limit: 200
  });
  
  if (treeError) {
    console.error('Tree load error:', treeError);
    return;
  }
  
  console.log('Total nodes loaded:', treeData.length);
  
  // Count by generation
  const generations = {};
  treeData.forEach(node => {
    if (!generations[node.generation]) {
      generations[node.generation] = 0;
    }
    generations[node.generation]++;
  });
  
  console.log('\nNodes by generation:');
  Object.entries(generations).sort((a, b) => a[0] - b[0]).forEach(([gen, count]) => {
    console.log(`  Generation ${gen}: ${count} nodes`);
  });
  
  // Sample tree structure
  console.log('\nSample tree structure:');
  treeData.slice(0, 15).forEach(node => {
    const indent = '  '.repeat(node.generation - 1);
    console.log(`${indent}${node.hid} - ${node.name} (Gen ${node.generation})`);
  });
  
  // Test 3: Check calculateTreeLayout compatibility
  console.log('\nTest 3: Checking data structure for calculateTreeLayout...');
  const hasRequiredFields = treeData.every(node => 
    node.id && 
    node.name && 
    node.generation && 
    (node.father_id !== undefined || node.mother_id !== undefined)
  );
  
  if (hasRequiredFields) {
    console.log('✅ Data structure is compatible with calculateTreeLayout');
  } else {
    console.log('❌ Missing required fields for calculateTreeLayout');
  }
}

testTreeLoading().catch(console.error);