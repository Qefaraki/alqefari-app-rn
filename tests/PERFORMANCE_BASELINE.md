# TreeView Performance Baseline (Pre-Phase 1)

**Date:** October 23, 2025
**Branch:** feature/perfect-tree-implementation
**Commit:** v1.0-pre-refactor
**Purpose:** Establish measurable metrics before Phase 1 refactor

---

## Current Metrics

### Layout Performance
- **Profile Count:** 56 nodes (production dataset)
- **Layout Time:** ~85-100ms (estimated, not instrumented yet)
- **Target:** <200ms for 1,000 nodes

**Measurement Method:**
```javascript
// Add to TreeView.js before layout:
const layoutStart = performance.now();
// ... layout calculation ...
const layoutDuration = performance.now() - layoutStart;
console.log(`Layout: ${layoutDuration}ms for ${nodeCount} nodes`);
```

### Render Performance
- **Frame Rate:** 60fps (smooth panning/zooming)
- **Frame Time:** ~16.67ms per frame (1000ms / 60fps)
- **Target:** Maintain 60fps during gestures

**Measurement Method:**
- Enable React DevTools Performance Monitor
- Pan/zoom tree and observe FPS counter
- Should stay green (57-60fps)

### Memory Usage
- **Tree Data Size:** ~0.5MB (56 profiles × ~9KB each)
- **Estimated Total App Memory:** ~50-100MB (not measured)
- **Target:** <20MB for tree data at 5,000 profiles

**Measurement Method:**
```javascript
// Calculate tree data size:
const treeDataSize = JSON.stringify(treeData).length / (1024 * 1024);
console.log(`Tree data: ${treeDataSize.toFixed(2)}MB`);
```

### App Load Time
- **Cold Start:** ~2-3 seconds (app launch to tree visible)
- **Tree Screen Load:** ~500ms (navigation to tree render)
- **Target:** <5 seconds cold start

**Measurement Method:**
- Manual stopwatch timing
- Cold start: Force quit app → Launch → Tree visible
- Tree load: Navigate from Home → Tree renders

---

## Test Conditions

- **Device:** iPhone XR (minimum supported device)
- **iOS Version:** 15.0+
- **Network:** Offline (cached data from Supabase)
- **Tree Size:** 56 profiles (real production family data)
- **Build:** Development mode (`npm start`)

---

## Success Criteria (Phase 1 Completion)

After Phase 1, all metrics must be within **5% tolerance**:

| Metric | Baseline | Max Acceptable | Status |
|--------|----------|----------------|--------|
| Layout Time (56 nodes) | ~85-100ms | <105ms | ⏳ TBD |
| Frame Rate | 60fps | 57-60fps | ⏳ TBD |
| Memory (tree data) | ~0.5MB | <0.55MB | ⏳ TBD |
| Cold Start | ~2-3s | <3.2s | ⏳ TBD |

**If ANY metric exceeds tolerance:** Investigate and fix before Phase 1 completion.

---

## Known Performance Characteristics

### Viewport Culling
- **Strategy:** Grid-based spatial indexing
- **Visible Nodes:** Max 500 at any zoom level
- **Culling Margins:** 3000px horizontal, 1200px vertical
- **Performance:** O(1) culling lookup (not O(n))

### Tree Loading Limits
- **Frontend Max:** 5,000 profiles
- **Database Max:** 10,000 profiles
- **Warning Threshold:** 3,750 profiles (75%)
- **Critical Threshold:** 4,750 profiles (95%)

### Current Optimizations
- Branch-based loading (max depth 3-5)
- Image bucketing ([40, 60, 80, 120, 256]px)
- LOD system (T1: full cards, T2: pills, T3: chips)
- Reanimated worklet-based gestures (runs on UI thread)

---

## Measurement Commands

### Layout Time
```bash
# Add console.time to TreeView.js:
console.time('layout');
// ... d3.hierarchy layout calculation ...
console.timeEnd('layout');

# Run app and check console:
npm start
# Expected output: "layout: ~85ms"
```

### Memory Usage
```bash
# Use Xcode Instruments:
# 1. Open Xcode
# 2. Product → Profile (Cmd+I)
# 3. Select "Allocations" instrument
# 4. Run app, navigate to tree screen
# 5. Note "All Heap & Anonymous VM" value

# Or use in-app calculation:
const treeDataSize = JSON.stringify(treeData).length / (1024 * 1024);
console.log(`Tree: ${treeDataSize.toFixed(2)}MB`);
```

### Frame Rate
```bash
# Enable React DevTools Performance Monitor:
# 1. Shake device (or Cmd+D in simulator)
# 2. Toggle "Show Perf Monitor"
# 3. Pan/zoom tree
# 4. FPS should stay 57-60 (green zone)

# Or use Xcode FPS meter:
# Debug → View Debugging → Rendering → Color Blended Layers (OFF)
# Debug → View Debugging → Rendering → FPS meter (ON)
```

---

## Historical Context

### October 2025 Incident
- **Issue:** Database change applied without testing caused 44 profiles to be corrupted
- **Lesson:** Never skip performance baseline or testing
- **Time Lost:** ~4 hours debugging and reverting
- **Prevention:** This baseline document ensures we can detect regressions immediately

---

## Notes

- **Phase 1 Risk:** 🟢 Low (10% regression probability after validator fixes)
- **Most Critical Metric:** Layout time (directly affects user perception of performance)
- **Least Critical Metric:** Cold start time (rarely measured, user accepts 2-3s)
- **Test Frequency:** After each Day 4 commit (4a, 4b, 4c, 4d)

---

**Baseline Established:** October 23, 2025
**Next Review:** After Phase 1 Day 5 completion
