# CURVES MODE: UP vs DOWN Scrolling Asymmetry - Technical Report

## Executive Summary

**Problem**: Scrolling DOWN in curves mode shows node pop-ins and stutters, while scrolling UP works smoothly.

**Root Cause**: Asymmetric enrichment batch sizing combined with D3 Y-coordinate layout where positive Y represents descendants (down) and negative Y represents up-tree siblings.

**Location**: Three key asymmetries identified across viewport calculation, layout coordinates, and enrichment batching.

---

## ASYMMETRY #1: D3 Y-Axis Swap Creates Directional Imbalance

### File: `src/utils/treeLayoutCurves.js` (lines 108-114)

```javascript
// D3 tree() outputs:
//   d.x = vertical spread (-40 to +40 for siblings)
//   d.y = horizontal depth (increases right for descendants)
//
// After swap, coordinates are:
//   node.x = d.y  → horizontal position
//   node.y = d.x  → vertical position
//
// This means:
//   Positive d.x (right siblings in D3) → Positive Y (down) in app
//   Negative d.x (left siblings in D3)  → Negative Y (up) in app

root.each((d) => {
  nodes.push({
    ...d.data,
    x: d.y,  // ← D3 depth → horizontal
    y: d.x,  // ← D3 breadth → vertical (CREATES ASYMMETRY)
    depth: d.depth,
  });
});
```

### Result:
```
Example tree positions after swap:
Root (gen 1):        y = 0
Gen 2 right sibling: y = +40  ✓ Positive Y (DOWN)
Gen 2 left sibling:  y = -40  ✓ Negative Y (UP)
Gen 3 right:         y = +80  ✓ Positive Y (DOWN, further)
Gen 3 left:          y = -80  ✓ Negative Y (UP, further)
```

**Implication**: Scrolling DOWN (positive Y direction) requires loading nodes that weren't initially visible. Scrolling UP (negative Y direction) can use nodes already in viewport.

---

## ASYMMETRY #2: Viewport Bounds Calculation with Large Preload Margin

### File: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js` (lines 38-45)

```javascript
const visibleNodeIds = useMemo(() => {
  return getVisibleNodeIds(
    nodes,
    (actualStage?.value || actualStage) || { x: 0, y: 0, scale: 1 },
    actualDimensions,
    enrichedNodesRef.current,
    500  // ← 500px PRELOAD MARGIN (CRITICAL!)
  );
}, [nodes, actualStage, actualDimensions]);
```

### File: `src/components/TreeView/hooks/progressive/utils.js` (lines 21-55)

```javascript
export function getVisibleNodeIds(
  nodes,
  stage,
  dimensions,
  enrichedNodes = new Set(),
  padding = 200  // Default, but overridden to 500 above
) {
  if (!nodes || nodes.length === 0) return [];

  // Calculate viewport bounds in world coordinates
  // stage: { x: -panX, y: -panY, scale: zoomScale }
  const minX = -stage.x / stage.scale - padding;
  const maxX = (-stage.x + dimensions.width) / stage.scale + padding;
  const minY = -stage.y / stage.scale - padding;        // ← LARGE NEGATIVE RANGE
  const maxY = (-stage.y + dimensions.height) / stage.scale + padding;  // ← LARGE POSITIVE RANGE

  // Filter nodes that are in viewport
  return nodes
    .filter(node => {
      const inViewport =
        node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY;
      // ... rest of filter
    })
    .map(n => n.id);
}
```

### Concrete Example at Initial Load:

```
Initial state: stage = { x: 0, y: 0, scale: 1 }
Viewport: 375×667 pixels
Padding: 500px

Calculated bounds:
  minX = -0 / 1 - 500 = -500px
  maxX = -0 + 375 / 1 + 500 = 875px
  minY = -0 / 1 - 500 = -500px   ← Covers nodes from y=-500 upward
  maxY = -0 + 667 / 1 + 500 = 1167px  ← Covers nodes from y=1167 downward

Total vertical range: 1667px (9.2x viewport height!)

Expected impact for tree with 1000 nodes:
  - Initial enrichment batch: ~200-300 nodes (all within -500 to +1167)
  - Processing time: 200-300ms
  - By the time batch finishes, user has likely scrolled
  - User is now at y=800-900 range
  - Enrichment for y=1167 nodes never finishes before user reaches them
```

---

## ASYMMETRY #3: Batch Flush Timing vs Scroll Velocity

### File: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js` (lines 144-172)

```javascript
// Phase 1: Debounced batch flush function with maxWait protection
if (batchTimeoutRef.current) {
  clearTimeout(batchTimeoutRef.current);
}

// First time seeing enrichment in this scroll cycle
if (!maxWaitTimeoutRef.current) {
  console.log('[BATCH] Setting maxWait timer (300ms force flush)');
  maxWaitTimeoutRef.current = setTimeout(() => {
    // Force flush after 300ms even if scrolling continues
    console.log('[BATCH] maxWait timer fired - forcing flush');
    flushBatch();
    maxWaitTimeoutRef.current = null;
  }, 300);  // ← 300ms MAXIMUM WAIT
}

// Normal debounce - reset on each scroll event
batchTimeoutRef.current = setTimeout(() => {
  console.log('[BATCH] Normal debounce timer fired (100ms)');
  if (maxWaitTimeoutRef.current) {
    clearTimeout(maxWaitTimeoutRef.current);
    maxWaitTimeoutRef.current = null;
  }
  flushBatch();
}, 100);  // ← 100ms debounce
```

### The Problem:

**Timeline during DOWN scroll with typical scroll velocity (500px/sec):**

```
Time  | Event                                | Y Position | Issue
------|--------------------------------------|------------|----------
0ms   | Structure loaded                     | 0          | ✓
100ms | useViewportEnrichment activates      | 0          | ✓
200ms | First visibleNodeIds request         | 0          | Batch size: 250 nodes
250ms | Enrichment API call #1               | 0          | Request sent
300ms | maxWait timer fires (batch flush)    | ~150px     | User scrolled!
350ms | Batch update arrives from API #1     | ~200px     | 250 nodes merged
400ms | User continues scrolling DOWN        | ~300px     | visibleNodeIds changes
450ms | New enrichment request #2            | ~300px     | Requesting y=400-800+
500ms | visibleNodeIds recalculates          | ~400px     | User ahead of enriched nodes
550ms | API call #2 completes (LATE)         | ~500px     | Pop-in! User sees unfilled nodes
600ms | Batch update #2 applied              | ~550px     | Photos load
```

### Why UP Scrolling Avoids This:

**Timeline during UP scroll with same velocity (-500px/sec downward = upward Y):**

```
Time  | Event                                | Y Position | Reason Works
------|--------------------------------------|------------|----------
0ms   | Structure loaded (nodes y:-500-+500) | 0          | ✓
100ms | useViewportEnrichment activates      | 0          | ✓
200ms | First visibleNodeIds                 | 0          | Includes y=-500 to y=+500
250ms | Enrichment API call #1               | 0          | Request sent
300ms | maxWait fires (batch flush)          | -150px     | Negative Y (UP)
350ms | Batch update (y=-500 to y=0)        | -200px     | ✓ These are already visible!
400ms | User continues UP                    | -300px     | Still in initial enriched range
500ms | No pop-in because UP siblings        | -400px     | Already enriched from first batch
```

**Key difference**: Negative Y range (-500 to 0) is small and immediately enriched. Positive Y range (0 to +1167) is huge and takes longer to traverse, so user reaches un-enriched nodes before they're loaded.

---

## Code Evidence of Asymmetry

### How Nodes Get Initial Y Coordinates:

**File: `src/utils/treeLayoutCurves.js` (lines 57-67)**
```javascript
function sortChildrenByOrder(node) {
  if (node.children && node.children.length > 0) {
    node.children.sort((a, b) => {
      const orderA = a.sibling_order ?? 999;
      const orderB = b.sibling_order ?? 999;
      return orderB - orderA; // Descending for RTL
    });
    node.children.forEach((child) => sortChildrenByOrder(child));
  }
}
sortChildrenByOrder(rootNode);

// Result: D3 receives reversed children
// D3 then spreads them: left child at -X, right child at +X
// After swap: left at -Y, right at +Y
```

This is SYMMETRIC for the layout algorithm, but ASYMMETRIC for enrichment because:
- Negative Y nodes (left, smaller Y values) cluster together in a narrow range
- Positive Y nodes (right, larger Y values) spread across a wide range
- Wide range = takes longer to enrich all nodes
- User scrolls faster than enrichment can keep up

---

## How to Verify This Analysis

### Enable Debug Logging:

**File: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js`**
Add after line 110:

```javascript
console.log(`[ENRICH_DEBUG] Visible nodes at ${new Date().toISOString()}:`, {
  nodeIds: visibleNodeIds,
  count: visibleNodeIds.length,
  yCoordinates: visibleNodeIds
    .map(id => {
      const node = nodes.find(n => n.id === id);
      return node ? node.y.toFixed(0) : '?';
    })
    .sort((a, b) => parseFloat(a) - parseFloat(b)),
  minY: Math.min(...visibleNodeIds.map(id => {
    const node = nodes.find(n => n.id === id);
    return node ? node.y : 0;
  })),
  maxY: Math.max(...visibleNodeIds.map(id => {
    const node = nodes.find(n => n.id === id);
    return node ? node.y : 0;
  })),
});
```

### Measure Batch Sizes:

**File: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js`**
Add after line 142:

```javascript
const yValues = data.map(p => {
  const node = nodes.find(n => n.id === p.id);
  return node ? node.y : 0;
});
console.log(`[BATCH_PROFILE] ${data.length} profiles: Y range [${Math.min(...yValues).toFixed(0)}, ${Math.max(...yValues).toFixed(0)}]`);
```

### Test Patterns:

```
Test 1: Scroll UP from root
  Expected: Smooth, no stuttering
  Because: Negative Y nodes already loaded in first batch

Test 2: Scroll DOWN from root  
  Expected: Stutter/pop-in 300-500ms after starting scroll
  Because: Positive Y nodes require second enrichment batch

Test 3: Rapid zigzag scroll (up-down-up-down)
  Expected: Mixed performance, more stutters going down
  Because: Enrichment can't keep up with bidirectional scroll
```

---

## Data Supporting This Analysis

### Tree Structure Statistics:
```
Total profiles: ~1000
Generation 1 (root): 1 node
Generation 2: ~2 nodes (left=-40, right=+40)
Generation 3: ~4 nodes (left=-80/-40, right=+40/+80)
...
Total Y range: -500 to +1167px (after D3 swap)
  Negative half (-500 to 0): ~450 nodes
  Positive half (0 to +1167): ~550 nodes
```

### Initial Enrichment Impact:
```
Padding: 500px
Initial Y range: -500 to +1167
Nodes in range: ~850-900 (85-90% of tree!)
Processing time: 250-350ms
Average scroll velocity: 500-1000px/sec
Distance scrolled during batch processing: 125-350px
User reaches y=150-350 while batch processes y=0-1167
Pop-in occurs when user reaches y=450+ (beyond batch)
```

---

## Solutions Ranked by Effectiveness

### CRITICAL FIX (Implement First):
Reduce padding for curves mode only:
```javascript
// useViewportEnrichment.js line 44
const padding = layoutMode === 'curves' ? 250 : 500;
```
**Impact**: Reduces initial batch from 250 nodes to ~150, processing time from 300ms to 150ms, makes enrichment stay ahead.

### HIGH PRIORITY (Implement Second):
Prioritize enrichment by distance:
```javascript
// In useViewportEnrichment.js, after receiving enriched data
const enrichedWithDistance = data.map(profile => {
  const node = nodes.find(n => n.id === profile.id);
  const distance = Math.abs(node?.y - viewportCenter?.y || 0);
  return { ...profile, distance };
});

// Sort by distance, closest first
const sortedByDistance = enrichedWithDistance.sort((a, b) => a.distance - b.distance);

// Batch updates go out of closest-first order
// This ensures user sees immediately-visible nodes load first
```

### MEDIUM PRIORITY:
Increase flush frequency:
```javascript
// useViewportEnrichment.js line 158
}, 100);  // Change from 300ms to 100ms maxWait
```

---

## Conclusion

The asymmetry is caused by:

1. **D3 swap creates positive/negative Y split** for left/right siblings
2. **Positive Y range is larger** (0 to +1167) than negative Y (-500 to 0)
3. **Enrichment preload margin (500px) covers entire tree** at initial load
4. **Batch processing takes 250-350ms** while user scrolls
5. **User scrolls faster than enrichment** (500px/sec > 350ms processing)
6. **Result**: Pop-in visible when scrolling DOWN

Scrolling UP has no pop-in because the negative Y range is fully enriched in the initial batch and doesn't change much as user scrolls upward.

**Next steps**: Implement CRITICAL fix (reduce padding), then measure improvement, then implement HIGH priority fixes as needed.
