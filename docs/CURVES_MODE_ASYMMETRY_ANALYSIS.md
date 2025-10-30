# UP vs DOWN Scrolling Asymmetry - Root Cause Analysis

## Summary of Findings

Found THREE critical asymmetries in curves mode scrolling that explain the DOWN pop-in delays:

---

## ASYMMETRY 1: Y-Axis Coordinate System After D3 Swap (CRITICAL)

### D3 Natural Output:
- D3 tree() produces: `d.x` (vertical spread), `d.y` (horizontal depth)
- After swap in `treeLayoutCurves.js` (lines 110-111):
  - `x: d.y` (becomes horizontal position)
  - `y: d.x` (becomes vertical position)
  
### The Problem:
D3 tree() with `nodeSize([40, dy])` spreads siblings along the X-axis with:
- **Positive values** for right side of tree
- **Negative values** for left side of tree

After swapping to Y-axis:
- **POSITIVE Y = DESCENDANTS (DOWN)** ← Need enrichment LATER
- **NEGATIVE Y = ANCESTORS (UP)** ← Already visible at load

```
Root node: y = 0
Gen 2 right: y = +40  (down, longer to load)
Gen 2 left:  y = -40  (up, immediately visible)
```

### Current visibleBounds Calculation:
```javascript
// TreeView.core.js line 1065-1066
minY: (-currentTransform.y - dynamicMarginY) / currentTransform.scale
maxY: (-currentTransform.y + dimensions.height + dynamicMarginY) / currentTransform.scale
```

**SYMMETRIC** calculation BUT assumes linear Y-axis behavior. When tree is loaded:
- **Initial scroll position**: `currentTransform.y ≈ 0`
- **minY ≈ -margin / scale** (shows negative Y nodes)
- **maxY ≈ +height / scale** (shows positive Y nodes)

### Why DOWN is slow:
1. **Structure load complete** ✓
2. **D3 layout positions all nodes** ✓
3. **visibleBounds includes positive Y range** ✓
4. **BUT visibleNodeIds calculation happens LATER** ✗
   - Enrichment debounces 100ms AFTER structure loads
   - By then, viewport has panned/zoomed
   - Earlier enrichment requests missed the positive Y nodes
   - New enrichment requests come in as user scrolls

---

## ASYMMETRY 2: Enrichment Timing Window

### Phase timing:
```
0ms   | Structure load starts
100ms | ... structure loading
200ms | ✓ Structure loaded + D3 layout complete
      | useViewportEnrichment activates
      | visibleNodeIds = getVisibleNodeIds(nodes, stage, ...)
250ms | Enrichment request #1 sent
350ms | Enrichment request #1 arrives
      | visibleNodeIds has changed (user scrolled)
      | Batch updates applied
```

### The Asymmetry:
**Initial viewport bounds are NOT symmetric for UP vs DOWN:**

When app starts with `stage = { x: 0, y: 0, scale: 1 }`:

```javascript
// Viewport: 375×667, Dynamic margin: 100px
minX = -100 to maxX = 475    (symmetric)
minY = -100 to maxY = 567    (ASYMMETRIC!)
      ↑ negative Y (UP)        ↑ positive Y (DOWN)
```

**Problem**: Tree structure has:
- **Negative Y nodes** (UP): Gen 2 siblings on left (descendant left siblings)
- **Positive Y nodes** (DOWN): Gen 2 siblings on right (descendant right siblings)

Initial enrichment request sees:
- All nodes in `-100 to +567` range
- BUT user hasn't scrolled yet
- So visibleNodeIds includes DISTANT descendants
- Batch flush happens too late

---

## ASYMMETRY 3: Viewport Bounds at Initial Stage

### Initial coordinates:
```
stage.x = 0, stage.y = 0, scale = 1
viewportWidth = 375, viewportHeight = 667
margin = 100
```

### Calculated bounds:
```javascript
minY = (-0 - 100) / 1 = -100   // 100px ABOVE viewport top
maxY = (-0 + 667 + 100) / 1 = 767   // 100px BELOW viewport bottom
```

### Tree structure layout (after D3 swap):
```
Root:      y = 0
Gen 2 left (up):   y < 0  (e.g., y = -40)  ✓ Included in initial minY
Gen 2 right (down): y > 0  (e.g., y = +40)  ✓ Included in initial maxY
Gen 3:             y ranges even further (±80, ±120, etc.)
```

**But here's the critical issue:**

### visibleBounds is calculated with MARGIN:
```javascript
const dynamicMarginY = 100 / scale;  // 100 / 1 = 100px margin
minY = -100, maxY = 567 + 100 = 667
```

### getVisibleNodeIds filters by:
```javascript
node.y >= minY && node.y <= maxY
// -100 <= node.y <= 667
```

This range is **HUGE**! It includes generations down to y = +667, which is far beyond viewport.

**Result**: First enrichment batch tries to load 100+ nodes, causing:
1. Batch becomes too large → slower processing
2. Debounce waits for scrolling to stop → doesn't trigger if user scrolls while loading
3. maxWait timer fires after 300ms → forces flush of partial batch
4. User scrolls to NEW nodes → enrichment request #2 comes in
5. User has now scrolled beyond enriched nodes → pop-in!

---

## Why UP is fast:

1. **Structure loads** with negative Y nodes already in cache
2. **Up siblings** (negative Y) don't require additional enrichment as user scrolls UP
3. **UP scrolling scrolls to SMALLER Y values** → stays in cached negative Y range
4. **Enrichment of negative Y nodes happens immediately** in first batch

## Why DOWN is slow:

1. **Structure loads** with both positive and negative Y nodes
2. **Down siblings** (positive Y) require enrichment
3. **First enrichment batch is TOO LARGE** (includes all y <= 667)
4. **Batch processing is slow** → delayed initial render
5. **User scrolls DOWN** while batch is being processed
6. **Scrolling moves viewport.y to LARGER Y values** → beyond enriched range
7. **New enrichment request comes in too late**
8. **Pop-in visible as user scrolls**

---

## Root Cause: Asymmetric Initial Enrichment Request

The real problem is:

```javascript
// useViewportEnrichment.js line 44
padding = 500  // 500px preload area!
```

With initial `stage = { x: 0, y: 0, scale: 1 }`:

```javascript
minY = -500, maxY = 667 + 500 = 1167
```

This requests enrichment for **ALL nodes** in a 1667px vertical range (9x viewport height)!

When tree structure has 1000+ nodes:
- First enrichment batch = 300-400 nodes?
- Batch processing takes 200-300ms
- By then, user has scrolled
- Enrichment cursor is now BEHIND user's scroll

### Timing Example:
```
0ms    | Structure load starts
200ms  | ✓ Structure loaded
       | visibleNodeIds = [node1, node2, ..., node200]  (all visible + huge margin)
300ms  | Batch flush begins (200 profiles)
400ms  | User scrolls DOWN (saw stutter at 300ms, now scrolls past)
450ms  | Batch flush completes
500ms  | New enrichment request for nodes beyond y=700
600ms  | Network response arrives
       | But user is already at y=800+
       | ❌ Pop-in visible!
```

---

## Fix Strategy (Ordered by Impact)

### CRITICAL (Implement FIRST):
1. **Reduce initial padding for curves mode**
   - Change: `padding = 500` → `padding = 250` for curves mode
   - Reduces initial enrichment batch from 300+ to ~150 nodes
   - Faster batch processing → enrichment stays ahead of scroll

### HIGH (Implement SECOND):
2. **Prioritize visible nodes in enrichment**
   - Sort enrichment by: `Y distance from viewport center`
   - Closest nodes enrich first
   - User sees filled-in tree as they scroll
   - Distant edges can wait

3. **Increase batch flush frequency**
   - Change: `maxWait = 300ms` → `maxWait = 100ms`
   - Flush smaller batches more frequently
   - Reduces processing delay, stays ahead of scroll

### MEDIUM:
4. **Detect scroll direction and prefetch accordingly**
   - If scrolling DOWN → prioritize positive Y nodes
   - If scrolling UP → prioritize negative Y nodes
   - Directional prefetch ahead of scroll

### LOW (Nice-to-have):
5. **Implement viewport intersection observer**
   - Only enrich nodes that are *about to enter* viewport
   - Skip distant nodes beyond 2x viewport margin
   - Further reduce batch size

---

## Verification Checklist

- [ ] Measure initial enrichment batch size (with current padding=500)
- [ ] Measure batch processing time in milliseconds
- [ ] Compare UP scroll timing vs DOWN scroll timing
- [ ] Check if batch flush completes before user scroll happens
- [ ] Verify Y-coordinate ranges for UP vs DOWN siblings
- [ ] Test with curves mode enabled
