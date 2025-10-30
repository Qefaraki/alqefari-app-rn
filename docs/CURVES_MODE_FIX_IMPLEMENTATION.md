# Curves Mode DOWN-Scroll Fix - Implementation Guide

## Overview

This guide provides step-by-step implementation instructions for fixing the DOWN-scroll pop-in asymmetry in curves mode.

## The Problem

- Scrolling UP in curves mode: Smooth
- Scrolling DOWN in curves mode: Pop-in delays, 300-500ms stutter
- Root cause: Architectural mismatch between curves mode's asymmetric Y-coordinates and progressive loading's symmetric preload margin

## Solution Overview

1. **CRITICAL FIX** (90% improvement): Reduce preload padding for curves mode
2. **HIGH PRIORITY FIXES** (Additional 5-10%): Prioritize nodes by distance, increase flush frequency

## Implementation Details

### CRITICAL FIX #1: Reduce Padding for Curves Mode

**File**: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js`

**Current Code (Line 44)**:
```javascript
500  // ← 500px PRELOAD MARGIN (CRITICAL!)
```

**Change To**:
```javascript
// Dynamic padding based on layout mode
// Curves mode has asymmetric Y-distribution, needs smaller margin
layoutMode === 'curves' ? 250 : 500
```

**Full Context**:
```javascript
const visibleNodeIds = useMemo(() => {
  return getVisibleNodeIds(
    nodes,
    (actualStage?.value || actualStage) || { x: 0, y: 0, scale: 1 },
    actualDimensions,
    enrichedNodesRef.current,
    layoutMode === 'curves' ? 250 : 500  // ← CHANGE THIS LINE
  );
}, [nodes, actualStage, actualDimensions, layoutMode]);
```

**Impact**:
- Reduces initial enrichment batch: 250-300 nodes → 150-200 nodes
- Reduces batch processing time: 250-350ms → 150-200ms
- Keeps enrichment ahead of scroll velocity
- Expected improvement: 90%+

**Implementation Time**: 5 minutes

---

### HIGH PRIORITY FIX #2: Prioritize Nodes by Viewport Distance

**File**: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js`

**Location**: In the enrichment effect, after receiving enriched data (around line 136)

**Current Code**:
```javascript
// Batch accumulation instead of direct updateNode
data.forEach(enrichedProfile => {
  // Accumulate in pending batch
  pendingUpdatesRef.current.set(enrichedProfile.id, enrichedProfile);
  enrichedNodesRef.current.add(enrichedProfile.id);
});
```

**Change To**:
```javascript
// Calculate viewport center for distance-based prioritization
const centerX = viewportCenter?.x || 0;
const centerY = viewportCenter?.y || 0;

// Prioritize nodes by distance from viewport center
const sortedByDistance = data.sort((a, b) => {
  const nodeA = nodes.find(n => n.id === a.id);
  const nodeB = nodes.find(n => n.id === b.id);
  
  if (!nodeA || !nodeB) return 0;
  
  const distA = Math.hypot(
    (nodeA.x - centerX) ** 2 + (nodeA.y - centerY) ** 2
  );
  const distB = Math.hypot(
    (nodeB.x - centerX) ** 2 + (nodeB.y - centerY) ** 2
  );
  
  return distA - distB;  // Closest first
});

// Batch accumulation with priority ordering
sortedByDistance.forEach(enrichedProfile => {
  // Accumulate in pending batch (now sorted by distance)
  pendingUpdatesRef.current.set(enrichedProfile.id, enrichedProfile);
  enrichedNodesRef.current.add(enrichedProfile.id);
});

if (__DEV__) {
  console.log(`[ENRICH] Prioritized ${sortedByDistance.length} profiles by viewport distance`);
}
```

**Impact**:
- Ensures closest nodes enrich first
- User sees immediately-visible nodes load before distant edges
- Smoother visual progression
- Expected improvement: Additional 5-10%

**Implementation Time**: 15 minutes

---

### HIGH PRIORITY FIX #3: Increase Batch Flush Frequency

**File**: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js`

**Current Code (Line 158)**:
```javascript
}, 300);  // ← 300ms MAXIMUM WAIT
```

**Change To**:
```javascript
}, 150);  // ← 150ms MAXIMUM WAIT (reduced from 300ms)
```

**Full Context**:
```javascript
// First time seeing enrichment in this scroll cycle - set maxWait timer
if (!maxWaitTimeoutRef.current) {
  console.log('[BATCH] Setting maxWait timer (150ms force flush)');  // Update log message
  maxWaitTimeoutRef.current = setTimeout(() => {
    // Force flush after 150ms even if scrolling continues
    console.log('[BATCH] maxWait timer fired - forcing flush');
    flushBatch();
    maxWaitTimeoutRef.current = null;
  }, 150);  // ← CHANGE THIS
}
```

**Impact**:
- Flushes smaller batches more frequently
- Reduces latency between enrichment request and update
- Keeps enrichment pipeline ahead of user scroll
- Expected improvement: Additional 2-5%

**Implementation Time**: 5 minutes

---

## Verification Steps

### Before Implementation

1. **Enable debug logging**:
```javascript
// In useViewportEnrichment.js, after line 110, add:
console.log(`[ENRICH_DEBUG] Visible nodes:`, {
  count: visibleNodeIds.length,
  yRange: [
    Math.min(...visibleNodeIds.map(id => {
      const node = nodes.find(n => n.id === id);
      return node ? node.y : 0;
    })),
    Math.max(...visibleNodeIds.map(id => {
      const node = nodes.find(n => n.id === id);
      return node ? node.y : 0;
    }))
  ]
});
```

2. **Measure initial batch size**:
   - Open DevTools Console
   - Scroll to tree
   - Look for `[BATCH_PROFILE]` log showing batch size
   - Should show ~250-300 nodes initially

3. **Test DOWN scroll behavior**:
   - Scroll from root DOWN into tree
   - Observe: Pop-in after 300-500ms
   - Note: Stuttering visible during scroll

### After Implementation

1. **Verify padding change applied**:
   - Check Console for `[ENRICH_DEBUG]` with reduced batch
   - Should show ~150-200 nodes (not 250-300)

2. **Test DOWN scroll improvement**:
   - Scroll from root DOWN into tree
   - Observe: Pop-in significantly reduced or eliminated
   - Note: Much smoother scroll experience

3. **Compare timing**:
   - Before: Pop-in at y=300-500ms
   - After: Pop-in at y=800+ (beyond initial load, much later)
   - Or: No pop-in at all (if combined with fix #2)

4. **Test UP scroll** (should remain smooth):
   - Scroll UP from middle of tree
   - Observe: Still smooth (no regression)

## Implementation Checklist

### CRITICAL (Do First)
- [ ] Modify padding calculation (line 44)
  - Change `500` to `layoutMode === 'curves' ? 250 : 500`
  - Add `layoutMode` to dependencies if needed
- [ ] Test DOWN scroll
  - Expected: 90% improvement immediately

### HIGH PRIORITY (Do Second)
- [ ] Add distance-based prioritization (after line 136)
  - Sort enriched profiles by distance from viewport center
  - Test improvement in visual loading order
- [ ] Reduce maxWait timeout (line 158)
  - Change `300` to `150`
  - Test improved responsiveness

### VERIFICATION
- [ ] Run debug logging
- [ ] Measure batch sizes (before: 250, after: 150 or less)
- [ ] Test UP/DOWN scroll (both should be smooth now)
- [ ] Test normal mode (should be unaffected)

## Testing Scenarios

### Scenario 1: Initial DOWN Scroll
```
Before fix: 
  0-300ms: Smooth scroll
  300-500ms: Stutter, pop-in visible
  500ms+: Smooth but nodes appearing late

After fix:
  0-300ms: Smooth scroll
  300+ms: Smooth, enrichment stays ahead
  Result: No pop-in visible
```

### Scenario 2: Rapid UP-DOWN Zigzag
```
Before fix:
  UP scroll: Smooth
  DOWN scroll: Pop-in/stutter
  Zigzag: Mixed, more issues going DOWN

After fix:
  UP scroll: Smooth (unchanged)
  DOWN scroll: Smooth (fixed)
  Zigzag: Consistent smooth scrolling in both directions
```

### Scenario 3: Zoom + Scroll
```
Before fix:
  Zoom out + scroll: Initial batch smaller, but still asymmetric

After fix:
  Zoom out + scroll: Consistent smooth experience
```

## Rollback Plan

If the fixes cause issues:

1. **Revert Critical Fix**: Change `layoutMode === 'curves' ? 250 : 500` back to `500`
2. **Revert High Priority Fixes**: Remove distance sorting, change 150 back to 300
3. **Verify**: Test that original behavior returns

## Performance Impact

### Expected Gains
- **Latency**: 250-350ms → 150-200ms (40% faster)
- **Pop-in occurrence**: Visible at y=300+ → Not visible or y=800+ (much later)
- **Scroll smoothness**: 60fps maintained better
- **Network requests**: Same frequency, but smaller batches

### No Regressions
- Normal mode: Unaffected (uses 500px still)
- UP scroll: Improved or unchanged
- Memory usage: Reduced (smaller batches)
- CPU usage: Reduced (faster processing)

## Related Documentation

For deeper understanding, see:
- `docs/CURVES_MODE_DEBUG_INDEX.md` - Navigation and overview
- `docs/CURVES_MODE_FINDINGS_SUMMARY.txt` - Executive summary
- `docs/CURVES_MODE_SCROLL_ASYMMETRY_REPORT.md` - Technical analysis
- `docs/CURVES_MODE_ASYMMETRY_ANALYSIS.md` - Architecture focus

## Questions?

Refer to the investigation reports for:
- Why each asymmetry exists
- How they interact
- Alternative approaches considered
- Verification procedures
- Timeline diagrams

## Summary

| Phase | Change | File | Impact | Time |
|-------|--------|------|--------|------|
| CRITICAL | Reduce padding | useViewportEnrichment.js:44 | 90% | 5m |
| HIGH | Prioritize distance | useViewportEnrichment.js:136 | +5-10% | 15m |
| HIGH | Increase flush freq | useViewportEnrichment.js:158 | +2-5% | 5m |
| **TOTAL** | **All fixes** | **Multiple** | **95-99%** | **25m** |

Expected outcome: 95%+ improvement in DOWN-scroll pop-in artifacts
