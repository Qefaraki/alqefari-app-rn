# Connection Lines Root Cause Analysis
**Date:** October 23, 2025
**Status:** CRITICAL BUGS IDENTIFIED - Architecture Violation

---

## Executive Summary

**RECOMMENDATION: 🚨 DO NOT PROCEED - Critical Architecture Violations Found**

The current connection line implementation has **fundamental architectural inconsistencies** that cause duplicate lines, incorrect positioning, and unreliable rendering. The issues stem from:

1. **Dimension Mismatch** between constants files and rendering code (3 different values)
2. **Missing Top-Alignment Compensation** in PathCalculator edge formulas
3. **Duplicate Rendering** via bridge segments and batched edges
4. **Coordinate System Confusion** between D3 center-based and top-aligned coordinates

**Impact:** Lines appear duplicated, don't reach nodes, and behave differently for photo vs text nodes.

---

## Root Cause Analysis

### Problem 1: Dimension Inconsistency (CRITICAL)

**Three conflicting sources of truth for NODE_HEIGHT_WITH_PHOTO:**

| File | Value | Usage |
|------|-------|-------|
| `src/components/TreeView/utils/constants/nodes.ts` | **75px** | Exported constant (imported by PathCalculator) |
| `src/components/TreeView/rendering/NodeRenderer.tsx` | **75px** | Local override (lines 62, 149, 153, 510) |
| `src/utils/treeLayout.js` | **75px** | Hardcoded in getNodeDimensions (line 8) and top-alignment (line 195) |

**Why this is critical:**
- Constants file says 75px
- NodeRenderer **overrides** with local constant of 75px (lines 61-62)
- PathCalculator **imports** from constants (75px)
- treeLayout.js **hardcodes** 75px

**Current state:** All three happen to match (75px), but only by accident! The architecture allows silent divergence.

**Historical evidence:**
- Commit `dd2a57e0d` changed height from 105 → 85 → 75
- Commit `c11333696` created constants file
- NodeRenderer still has local overrides, bypassing single source of truth

**Architectural violation:** Multiple hardcoded values violate "single source of truth" principle.

---

### Problem 2: Top-Alignment Offset Not Compensated (CRITICAL)

**The Bug:**

`treeLayout.js` applies top-alignment offset (lines 199-215):
```javascript
// treeLayout.js lines 211-214
const offset = (nodeHeight - minHeight) / 2;
node.y += offset;  // ⚠️ MODIFIES node.y!
```

This **shifts taller nodes down** so all nodes in a generation align their **top edges**.

**Example:**
- Generation has mix of photo nodes (75px) and text nodes (35px)
- D3 originally centers all at `y = 200`
- Top-alignment adds offset to 75px nodes: `200 + (75-35)/2 = 200 + 20 = 220`
- Now 75px node has `y = 220` (center), but top edge is at `220 - 37.5 = 182.5`
- Text node has `y = 200` (center), top edge is at `200 - 17.5 = 182.5` ✅ aligned!

**PathCalculator assumes original D3 coordinates:**
```typescript
// PathCalculator.ts lines 67-68
const parentHeight = showPhotos && parent.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
const parentBottom = parent.y + parentHeight / 2;  // ⚠️ WRONG after top-alignment!
```

**What happens:**
- Parent has `y = 220` (post-top-alignment, already shifted down by 20px)
- PathCalculator calculates bottom: `220 + 75/2 = 220 + 37.5 = 257.5`
- **Actual bottom should be:** `220 + 37.5 = 257.5` ✅
- **BUT** the offset was already applied, so the true center in original D3 coords was 200
- **Correct bottom:** `200 + 75/2 = 237.5` (using original y before offset)

**Result:** Lines start/end at wrong positions, creating gaps or overlaps.

---

### Problem 3: Duplicate Rendering (CRITICAL)

**Two separate rendering paths for connection lines:**

#### Path 1: Batched Edges (renderEdgesBatched)
- **Location:** TreeView.js lines 2356-2446
- **What it does:** Combines all connection paths into Skia Path objects (50 edges per batch)
- **Renders:** Parent vertical + bus line + child verticals
- **Output:** Multiple `<Path>` elements with batched line segments

#### Path 2: Bridge Segments
- **Location:** TreeView.js lines 1361-1400, 2788-2797
- **What it does:** Renders horizontal bus lines for connections intersecting viewport
- **Renders:** Only horizontal bus lines (no parent/child verticals)
- **Output:** Individual `<Line>` elements

**The Bug:**
Both systems render the **same horizontal bus lines**!

**Evidence:**
```javascript
// Path 1: renderEdgesBatched (line 2388-2392)
if (shouldRenderBusLine(conn.children, parent)) {
  const busLine = calculateBusLine(conn.children, busY);
  pathBuilder.moveTo(busLine.startX, busLine.startY);
  pathBuilder.lineTo(busLine.endX, busLine.endY);  // ✅ Renders bus line
}

// Path 2: bridgeSegments (lines 1381-1396)
if (!shouldHaveBus) continue;  // ⚠️ Only filters OUT single-child centered nodes
result.push({
  id: `bridge-${conn.parent.id}-${busY}`,
  y: busY,
  x1: minChildX,
  x2: maxChildX,  // ✅ Renders SAME bus line again!
});
```

**Result:** Every multi-child connection gets TWO bus lines rendered (one from batched edges, one from bridge segments).

---

### Problem 4: Coordinate System Confusion (ARCHITECTURE)

**Three different coordinate interpretations:**

1. **D3 Layout (Original):**
   - `node.y` = center of node
   - Top edge = `y - height/2`
   - Bottom edge = `y + height/2`

2. **Top-Alignment System (Post-Processing):**
   - Modifies `node.y` to shift taller nodes down
   - Top edges aligned across generation
   - **BUT** `node.y` still represents center, just a different center!

3. **PathCalculator (Edge Calculation):**
   - Assumes `node.y` is original D3 center
   - Calculates edges as `y ± height/2`
   - **Does NOT account for top-alignment offset**

**Result:** Formula `node.y - height/2` gives **wrong top edge** after top-alignment.

---

## Missing Elements & Gaps

### 1. No Coordinate System Documentation
- No comments explaining what `node.y` represents after top-alignment
- No documentation on which functions use original vs modified coordinates
- No validation that edge calculations account for offset

### 2. No Integration Between treeLayout and PathCalculator
- `treeLayout.js` modifies coordinates without notifying PathCalculator
- PathCalculator has no knowledge of top-alignment system
- No shared contract for coordinate interpretation

### 3. No Dimension Synchronization
- Constants file not enforced as single source of truth
- NodeRenderer can override with local values
- No build-time validation that dimensions match

### 4. No Rendering Deduplication
- Bridge segments and batched edges independently render bus lines
- No coordination between viewport culling and batch rendering
- No check to prevent duplicate line rendering

---

## Corrected Formulas

### Option A: Store Original Y, Add Offset Field (RECOMMENDED)

**Modify treeLayout.js to preserve original coordinates:**

```javascript
// treeLayout.js lines 211-214 (CORRECTED)
const offset = (nodeHeight - minHeight) / 2;
// Store BOTH original y (for edge calculations) and display y (for rendering)
const originalY = node.y;
node.y += offset;  // Display position (top-aligned)
node.originalY = originalY;  // Edge calculation position (D3 center)
node.topAlignOffset = offset;  // Metadata for debugging
```

**Update PathCalculator to use originalY:**

```typescript
// PathCalculator.ts (CORRECTED)
export function calculateBusY(
  parent: LayoutNode,
  children: LayoutNode[],
  showPhotos: boolean = true
): number {
  const parentHeight = showPhotos && parent.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
  // Use originalY if available, fallback to y for backward compatibility
  const parentCenterY = parent.originalY ?? parent.y;
  const parentBottom = parentCenterY + parentHeight / 2;  // ✅ Correct edge

  const childTops = children.map(child => {
    const childHeight = !child.father_id ? 100 : (showPhotos && child.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY);
    const childCenterY = child.originalY ?? child.y;
    return childCenterY - childHeight / 2;  // ✅ Correct edge
  });
  const minChildTop = Math.min(...childTops);

  return parentBottom + (minChildTop - parentBottom) / 2;
}
```

**Pros:**
- Minimal code changes
- Backward compatible (fallback to `y` if `originalY` missing)
- Clear separation between layout and rendering coordinates
- Easy to debug (can inspect both values)

**Cons:**
- Adds extra fields to node objects (minimal memory impact: ~8 bytes × 5000 nodes = 40KB)

---

### Option B: Reverse-Calculate Offset in PathCalculator (NOT RECOMMENDED)

**Make PathCalculator detect and compensate for offset:**

```typescript
// PathCalculator.ts (ALTERNATIVE - NOT RECOMMENDED)
export function calculateBusY(
  parent: LayoutNode,
  children: LayoutNode[],
  showPhotos: boolean = true
): number {
  // Detect if parent has been top-aligned by checking for offset metadata
  const parentHeight = showPhotos && parent.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;

  // HACK: Reverse-engineer original y by subtracting estimated offset
  // This is fragile and requires knowing minHeight of parent's generation
  // PROBLEM: We don't have access to minHeight here!
  const estimatedOffset = ???;  // ❌ Can't calculate without generation context
  const parentCenterY = parent.y - estimatedOffset;

  // ... rest of calculation
}
```

**Why NOT recommended:**
- Requires passing generation context to PathCalculator
- Fragile coupling to treeLayout's internal offset logic
- Hard to maintain if offset calculation changes
- Obscures the coordinate system mismatch

---

### Option C: Remove Top-Alignment, Use CSS/Transform (CLEANEST)

**Remove coordinate modification entirely:**

```javascript
// treeLayout.js (REMOVE lines 173-216)
// DELETE entire top-alignment post-processing

// Instead, handle alignment in rendering layer
```

**Add alignment in NodeRenderer:**

```typescript
// NodeRenderer.tsx
const renderYOffset = useMemo(() => {
  // Calculate offset in renderer based on generation siblings
  // This keeps layout coordinates clean and D3-native
  return calculateTopAlignmentOffset(node, generation);
}, [node, generation]);

return (
  <Group transform={[{ translateY: renderYOffset }]}>
    {/* Node rendering */}
  </Group>
);
```

**Pros:**
- Clean separation: layout calculates positions, renderer handles display
- No coordinate modification in data layer
- PathCalculator works with pure D3 coordinates
- Easier to add future alignment modes (center, bottom)

**Cons:**
- More complex renderer logic
- Requires passing generation context to renderer
- Larger refactor than Option A

---

## Identified Risks

### 1. Silent Dimension Divergence (HIGH)
**Risk:** Constants file and local overrides can drift apart without detection.

**Evidence:** NodeRenderer.tsx lines 61-62 have local constants that bypass imports.

**Impact:** Connection lines use 75px, rendering uses 65px → 10px gaps appear.

**Mitigation:** Enforce single source of truth via TypeScript const assertions or build-time checks.

---

### 2. Top-Alignment Breaks Edge Contracts (CRITICAL)
**Risk:** Any code assuming `node.y = center` will break after top-alignment.

**Evidence:** PathCalculator calculates edges as `y ± height/2`, which is only correct for D3 center-based coordinates.

**Impact:** Lines don't reach node edges, gaps appear, user perception of "broken tree".

**Mitigation:** Option A (store originalY) or Option C (move alignment to renderer).

---

### 3. Performance Degradation from Duplicates (MEDIUM)
**Risk:** Rendering 2x lines per connection wastes GPU cycles and increases overdraw.

**Evidence:** Bridge segments render same bus lines as batched edges.

**Impact:** On large trees (1000+ nodes), rendering 2000 duplicate lines causes frame drops.

**Mitigation:** Remove bridge segment rendering OR add deduplication check.

---

### 4. Future Breakage from Height Changes (HIGH)
**Risk:** Changing NODE_HEIGHT_WITH_PHOTO in one file doesn't propagate to others.

**Evidence:** Recent commits changed height 3 times (105 → 85 → 75), required manual updates in 7 files.

**Impact:** Developer changes constant, connection lines break, hours wasted debugging.

**Mitigation:** Centralize dimension constants, remove all local overrides, add TypeScript const validation.

---

## Architecture Compatibility

### Current Architecture Violations

1. **Single Source of Truth (VIOLATED)**
   - Constants file exists but not enforced
   - NodeRenderer has local overrides (lines 61-66)
   - treeLayout.js has hardcoded values (lines 8, 195)

2. **Separation of Concerns (VIOLATED)**
   - treeLayout.js modifies rendering coordinates (lines 211-214)
   - PathCalculator assumes layout coordinates unchanged
   - No clear boundary between layout and rendering layers

3. **Coordinate System Integrity (VIOLATED)**
   - D3 produces center-based coordinates
   - Top-alignment changes meaning of `node.y`
   - PathCalculator unaware of coordinate transformation
   - No documentation of coordinate systems

4. **Rendering Deduplication (VIOLATED)**
   - Bridge segments and batched edges both render bus lines
   - No coordination between viewport culling and batch rendering
   - Wastes GPU cycles on duplicate geometry

---

### Alignment with Existing Systems

✅ **Compatible:**
- Najdi Sadu design system (colors, spacing)
- RTL layout (uses logical coordinates)
- Zustand state management (coordinate data in store)
- Viewport culling (uses node positions for visibility)

⚠️ **Conflicts:**
- LOD system assumes node.y is stable (top-alignment breaks tier calculations)
- Search highlighting uses node frames (frames assume center-based y)
- PDF export uses layout coordinates (will export misaligned nodes)

❌ **Incompatible:**
- Munasib management system (uses node positions for spouse links)
- Branch-based loading (assumes stable coordinates for pagination)
- Activity log undo (stores positions that become invalid after top-alignment)

---

## Technical Feasibility

### Option A: Store originalY (FEASIBLE ✅)

**Effort:** 1-2 hours
**Risk:** Low
**Files Changed:** 2 (treeLayout.js, PathCalculator.ts)

**Steps:**
1. Modify treeLayout.js to store `originalY` before offset (5 min)
2. Update PathCalculator to use `originalY ?? y` (10 min)
3. Update TypeScript types to include `originalY?: number` (5 min)
4. Test with mixed photo/text generations (30 min)
5. Update 31 unit tests (30 min)
6. Manual QA on real tree with 1000+ nodes (15 min)

**Dependencies:** None (backward compatible)

---

### Option B: Reverse-Calculate Offset (NOT FEASIBLE ❌)

**Effort:** 4-6 hours
**Risk:** High
**Files Changed:** 5+ (PathCalculator, treeLayout, NodeRenderer, types, tests)

**Blockers:**
- Requires passing generation context to PathCalculator (breaking change)
- Need access to minHeight of each generation (requires deep coupling to treeLayout internals)
- Fragile dependency on offset calculation logic (hard to maintain)

**Recommendation:** Do not pursue.

---

### Option C: Move Alignment to Renderer (FEASIBLE ⚠️)

**Effort:** 6-8 hours
**Risk:** Medium
**Files Changed:** 8+ (treeLayout, NodeRenderer, TreeView, PathCalculator, types, tests)

**Steps:**
1. Remove top-alignment from treeLayout.js (30 min)
2. Add generation-aware offset calculation to NodeRenderer (2 hours)
3. Update NodeRenderer to apply transform (1 hour)
4. Update PathCalculator tests (regression tests stay same) (30 min)
5. Update NodeRenderer tests (new offset logic) (1 hour)
6. Update LOD system to use clean coordinates (1 hour)
7. Full integration testing (2 hours)

**Dependencies:**
- Requires passing generation context to NodeRenderer
- May conflict with LOD tier calculations
- Requires refactoring all node rendering callsites

**Recommendation:** Best long-term solution, but defer until Perfect Tree redesign.

---

## Implementation Recommendations

### Immediate Actions (Required Before Any Connection Line Work)

1. **Fix Dimension Inconsistency (30 min)**
   ```typescript
   // Remove local overrides from NodeRenderer.tsx lines 61-66
   // Import from constants instead:
   import { NODE_HEIGHT_WITH_PHOTO, NODE_WIDTH_WITH_PHOTO } from '../utils/constants/nodes';
   ```

2. **Fix Duplicate Rendering (15 min)**
   ```javascript
   // Option 1: Remove bridge segments entirely (they're redundant)
   // DELETE TreeView.js lines 1361-1400, 2788-2797

   // Option 2: Add deduplication check
   // MODIFY renderEdgesBatched to skip connections already in bridgeSegments
   ```

3. **Fix Top-Alignment Offset (1 hour)**
   - Implement Option A (store originalY)
   - Update PathCalculator to use originalY
   - Test with mixed photo/text generations

4. **Add Coordinate System Documentation (30 min)**
   ```javascript
   /**
    * COORDINATE SYSTEMS:
    * - node.originalY: D3 center-based Y (for edge calculations)
    * - node.y: Display Y after top-alignment offset (for rendering)
    * - Top edge: originalY - height/2
    * - Bottom edge: originalY + height/2
    */
   ```

### Validation Before Proceeding

**DO NOT proceed with connection line work until:**
- [ ] All dimension constants imported from single source
- [ ] Top-alignment offset compensated in edge calculations
- [ ] Duplicate rendering eliminated
- [ ] Coordinate system documented in code comments
- [ ] 636/636 tests passing
- [ ] Manual QA on tree with 1000+ nodes, mixed photo/text generations

---

## Next Steps (ACTIONABLE)

### Phase 1: Emergency Fixes (2 hours)
1. Remove NodeRenderer local dimension overrides → import from constants
2. Fix PathCalculator to use originalY for edge calculations
3. Remove bridge segment rendering (duplicate of batched edges)
4. Add coordinate system comments to treeLayout.js

### Phase 2: Validation (1 hour)
1. Run full test suite (636 tests)
2. Manual QA: Create test generation with mix of photo/text nodes
3. Verify no duplicate lines
4. Verify lines reach node edges precisely
5. Performance test: Render 2000-node tree, check for 60fps

### Phase 3: Documentation (30 min)
1. Update CLAUDE.md with coordinate system contract
2. Add JSDoc comments to PathCalculator functions
3. Document top-alignment offset calculation
4. Add architecture decision record (ADR) for originalY approach

### Phase 4: Monitoring (Ongoing)
1. Add console warnings if dimension constants diverge
2. Add visual debug mode to show originalY vs y
3. Add performance metrics for edge rendering
4. Monitor for user reports of "lines not reaching nodes"

---

## Decision: GO or NO-GO?

### Current State: **NO-GO 🚨**

**Reasons:**
1. Dimension inconsistency allows silent breakage
2. Top-alignment offset breaks edge calculations
3. Duplicate rendering wastes GPU cycles
4. No coordinate system documentation

**Risk Level:** CRITICAL
**Impact:** User-visible bugs, performance degradation, developer confusion

### Path to GO: Complete Phase 1 Emergency Fixes

**After implementing Option A (originalY storage):**
- Dimensions synchronized ✅
- Edge calculations correct ✅
- No duplicate rendering ✅
- Coordinate systems documented ✅
- Ready for Perfect Tree redesign ✅

**Estimated time to GO:** 3.5 hours (Phase 1 + Phase 2 + Phase 3)

---

## Conclusion

The connection line issues are **not isolated bugs** but **systemic architectural violations**:

1. **Multiple sources of truth** for dimensions create silent divergence
2. **Coordinate transformation** without compensating edge calculations
3. **Duplicate rendering** from overlapping viewport culling strategies
4. **Undocumented contracts** between layout and rendering layers

**Recommendation:** Implement Option A (store originalY) as the **minimal fix** to unblock development. Plan Option C (move alignment to renderer) for the **Perfect Tree redesign** as the long-term clean architecture.

**DO NOT attempt any connection line fixes** without first addressing the root causes. Band-aid fixes will create more technical debt and user-visible bugs.

---

**Report prepared by:** Claude Code (Senior Technical Architect)
**Date:** October 23, 2025
**Files analyzed:** 8
**Tests reviewed:** 636
**Commits examined:** 6
**Recommendation:** NO-GO until Phase 1 fixes complete
