/**
 * Measure baseline performance with 2,392-profile fixture
 *
 * Measures:
 * - Layout calculation time
 * - Memory usage
 * - Tree data size
 */

const fs = require('fs');
const path = require('path');

// Load the fixture
const fixturePath = path.join(__dirname, 'tree2392.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

console.log('📊 Phase 2 Baseline Performance Measurement\n');
console.log(`Fixture: ${fixture.metadata.profile_count} profiles, ${fixture.metadata.marriage_count} marriages\n`);

// 1. Measure Tree Data Size (Memory)
console.log('1️⃣ Measuring Memory Usage...');
const treeDataString = JSON.stringify(fixture.profiles);
const treeDataSizeBytes = Buffer.byteLength(treeDataString, 'utf8');
const treeDataSizeMB = (treeDataSizeBytes / (1024 * 1024)).toFixed(2);

console.log(`   Tree Data Size: ${treeDataSizeMB} MB`);
console.log(`   Raw bytes: ${treeDataSizeBytes.toLocaleString()}`);
console.log(`   5% tolerance: ${(parseFloat(treeDataSizeMB) * 1.05).toFixed(2)} MB\n`);

// 2. Simulate Layout Algorithm Complexity
console.log('2️⃣ Estimating Layout Time...');
console.log('   (Based on Phase 1 extrapolation)');

// Phase 1: 56 profiles = 85-100ms
// Algorithm is O(n log n) due to D3 hierarchy
// But viewport culling limits render to ~500 nodes
const phase1Profiles = 56;
const phase1LayoutTime = 92.5; // Average of 85-100ms
const phase2Profiles = fixture.metadata.profile_count;

// Calculate expected time with viewport culling
const visibleNodeLimit = 500; // MAX_VISIBLE_NODES constant
const renderRatio = Math.min(visibleNodeLimit / phase2Profiles, 1);
const scalingFactor = (phase2Profiles * renderRatio) / phase1Profiles;

const estimatedLayoutTime = Math.round(phase1LayoutTime * scalingFactor);
const tolerance5Percent = Math.round(estimatedLayoutTime * 1.05);

console.log(`   Phase 1 baseline: ${phase1LayoutTime}ms for ${phase1Profiles} profiles`);
console.log(`   Viewport culling: Renders ~${Math.min(visibleNodeLimit, phase2Profiles)} of ${phase2Profiles} nodes`);
console.log(`   Scaling factor: ${scalingFactor.toFixed(2)}x`);
console.log(`   Estimated layout time: ${estimatedLayoutTime}ms`);
console.log(`   5% tolerance: ${tolerance5Percent}ms\n`);

// 3. Profile Distribution Analysis
console.log('3️⃣ Profile Distribution...');
const maleCount = fixture.profiles.filter(p => p.gender === 'male').length;
const femaleCount = fixture.profiles.filter(p => p.gender === 'female').length;
const withPhotos = fixture.profiles.filter(p => p.photo_url).length;
const deceased = fixture.profiles.filter(p => p.status === 'deceased').length;
const munasib = fixture.profiles.filter(p => p.hid === null).length;

console.log(`   Males: ${maleCount} (${((maleCount / phase2Profiles) * 100).toFixed(1)}%)`);
console.log(`   Females: ${femaleCount} (${((femaleCount / phase2Profiles) * 100).toFixed(1)}%)`);
console.log(`   With photos: ${withPhotos} (${((withPhotos / phase2Profiles) * 100).toFixed(1)}%)`);
console.log(`   Deceased: ${deceased} (${((deceased / phase2Profiles) * 100).toFixed(1)}%)`);
console.log(`   Munasib (no HID): ${munasib} (${((munasib / phase2Profiles) * 100).toFixed(1)}%)\n`);

// 4. Generation Distribution
console.log('4️⃣ Generation Distribution...');
const generations = {};
fixture.profiles.forEach(p => {
  generations[p.generation] = (generations[p.generation] || 0) + 1;
});

Object.keys(generations).sort().forEach(gen => {
  const count = generations[gen];
  const percentage = ((count / phase2Profiles) * 100).toFixed(1);
  console.log(`   Gen ${gen}: ${count} profiles (${percentage}%)`);
});

// 5. Create Baseline Summary
console.log('\n📋 Baseline Summary for Phase 2 Validation\n');
console.log('| Metric | Value | Max Allowed (5% tolerance) |');
console.log('|--------|-------|----------------------------|');
console.log(`| Profiles | ${phase2Profiles} | - |`);
console.log(`| Layout Time (estimated) | ${estimatedLayoutTime}ms | ${tolerance5Percent}ms |`);
console.log(`| Memory (Tree Data) | ${treeDataSizeMB}MB | ${(parseFloat(treeDataSizeMB) * 1.05).toFixed(2)}MB |`);
console.log(`| FPS (Target) | 60fps | 57fps |`);
console.log(`| Marriages | ${fixture.metadata.marriage_count} | - |\n`);

console.log('✅ Baseline measurements complete');
console.log('   Note: Actual layout time will be measured on physical device');
console.log('   This is an estimate based on Phase 1 extrapolation\n');

// Write baseline to markdown
const baselineMd = `# Phase 2 Performance Baseline

**Generated:** ${new Date().toISOString()}
**Device:** To be measured on iPhone XR
**Fixture:** ${phase2Profiles} profiles, ${fixture.metadata.marriage_count} marriages

## Baseline Metrics

| Metric | Value | Max Allowed (5% tolerance) | Notes |
|--------|-------|----------------------------|-------|
| **Profiles** | ${phase2Profiles} | - | Production count |
| **Layout Time** | ${estimatedLayoutTime}ms (estimated) | ${tolerance5Percent}ms | Extrapolated from Phase 1 |
| **Memory (Tree Data)** | ${treeDataSizeMB}MB | ${(parseFloat(treeDataSizeMB) * 1.05).toFixed(2)}MB | JSON.stringify() size |
| **FPS (Pan/Zoom)** | 60fps (target) | 57fps | React Native default |
| **Marriages** | ${fixture.metadata.marriage_count} | - | |

## Profile Distribution

- **Males:** ${maleCount} (${((maleCount / phase2Profiles) * 100).toFixed(1)}%)
- **Females:** ${femaleCount} (${((femaleCount / phase2Profiles) * 100).toFixed(1)}%)
- **With Photos:** ${withPhotos} (${((withPhotos / phase2Profiles) * 100).toFixed(1)}%)
- **Deceased:** ${deceased} (${((deceased / phase2Profiles) * 100).toFixed(1)}%)
- **Munasib:** ${munasib} (${((munasib / phase2Profiles) * 100).toFixed(1)}%)

## Generation Distribution

${Object.keys(generations).sort().map(gen => {
  const count = generations[gen];
  const percentage = ((count / phase2Profiles) * 100).toFixed(1);
  return `- **Gen ${gen}:** ${count} profiles (${percentage}%)`;
}).join('\n')}

## Validation Criteria

After each day of component extraction:

1. ✅ **Layout time** must be ≤ ${tolerance5Percent}ms
2. ✅ **Memory usage** must be ≤ ${(parseFloat(treeDataSizeMB) * 1.05).toFixed(2)}MB
3. ✅ **FPS** must be ≥ 57fps during pan/zoom
4. ✅ **Visual regression** - Tree must look identical

If any metric fails validation, use Day 13 buffer for optimization.

## Notes

- **Estimated layout time** is based on Phase 1 extrapolation (56 profiles = 92.5ms)
- **Viewport culling** limits actual render to ~${Math.min(visibleNodeLimit, phase2Profiles)} visible nodes
- **Actual measurements** should be taken on physical iPhone XR
- **5% tolerance** accounts for normal variance and minor refactoring overhead

---

**Status:** Day 0 Complete - Ready for Component Extraction
`;

const baselinePath = path.join(__dirname, '../../docs/treeview-refactor/phase2/testing/PERFORMANCE_BASELINE_PHASE2.md');
const baselineDir = path.dirname(baselinePath);

// Create directory if it doesn't exist
if (!fs.existsSync(baselineDir)) {
  fs.mkdirSync(baselineDir, { recursive: true });
}

fs.writeFileSync(baselinePath, baselineMd);
console.log(`📄 Baseline document created: ${baselinePath}`);
