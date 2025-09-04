# LOD (Level of Detail) Implementation Plan

## Overview
Scale the Alqefari Family Tree to handle 10,000+ nodes smoothly by implementing a 3-tier LOD system with spatial culling and hard performance caps.

## Goals
- Render 10K+ nodes at 60fps on all zoom levels
- Hard cap: Max 350 nodes and 300 edges rendered per frame
- Zero image requests outside Tier 1
- Smooth transitions between LOD tiers with hysteresis

## Constants & Caps

```javascript
// Spatial Grid
const GRID_CELL_SIZE = 512;          // px
const MAX_VISIBLE_NODES = 350;       // hard cap per frame
const MAX_VISIBLE_EDGES = 300;       // hard cap per frame

// LOD Tiers
const SCALE_QUANTUM = 0.05;          // 5% quantization steps
const HYSTERESIS = 0.15;             // ±15% hysteresis
const T1_BASE = 48;                  // Full card threshold (px)
const T2_BASE = 24;                  // Text pill threshold (px)

// Image Buckets (Tier 1 only)
const IMAGE_BUCKETS = [64, 128, 256, 512];
const BUCKET_HYSTERESIS = 0.15;      // ±15%
const BUCKET_DEBOUNCE_MS = 150;      // ms

// Zoom Range
const MIN_SCALE = 0.15;              // Was 0.3 (2x farther out)
const MAX_SCALE = 3.0;               // Unchanged

// Feature Flags
const LOD_ENABLED = true;            // Kill switch
const AGGREGATION_ENABLED = true;    // T3 chips toggle
```

## LOD Tier Rules

### Tier 1: Close Zoom (nodePx ≥ 48)
- Full card with photo + name
- Images loaded with bucket selection
- All edges rendered (up to cap)
- Per-node bucket hysteresis

### Tier 2: Mid Zoom (24 ≤ nodePx < 48)  
- Text pills only (first name)
- NO image loading/decoding
- Edges capped at MAX_VISIBLE_EDGES
- Light borders, no shadows

### Tier 3: Far Zoom (nodePx < 24)
- ONLY 3 chips rendered:
  - Root (larger, centered at subtree centroid)
  - Top 2 Gen-2 nodes with children (by subtreeSize)
- NO individual nodes
- NO edges
- Chips show: name + descendant count

## Core Algorithms

### 1. Index Building (O(N), once per data load)
```javascript
const buildIndices = (nodes) => {
  // Maps
  const idToNode = new Map();
  const parentToChildren = new Map(); // Only truthy father_id
  
  // Computed values
  const depths = {};         // via BFS
  const subtreeSizes = {};   // via post-order
  const centroids = {};      // precomputed for T3
  
  // Heroes = root + top 2 gen-2 with children
  // Gen-2 = depth === 1 (root is depth 0)
}
```

### 2. Spatial Grid Culling
```javascript
// Build grid once
class SpatialGrid {
  constructor(nodes, cellSize = 512) {
    // Map "cellX,cellY" -> Set<nodeId>
  }
  
  getVisibleNodes({x, y, width, height}, scale, idToNode) {
    // World space transform:
    // worldMinX = -x / scale
    // worldMaxX = (-x + width) / scale
    // Return max 350 nodes
  }
}
```

### 3. Tier Calculation with Hysteresis
```javascript
// Use useRef to persist state
const tierState = useRef({ current: 1, lastQuantizedScale: 1 });

// Quantize scale to 5% steps
// Apply ±15% hysteresis boundaries
// Only transition when crossing boundaries
```

### 4. Image Bucket Selection (T1 Only)
```javascript
// Per-node bucket tracking
const nodeBucketsRef = useRef(new Map());

// Select bucket with hysteresis
// Debounce upgrades by 150ms
// Immediate downgrades
// Max 6 concurrent prefetches
```

## Implementation Checkpoints

### Phase 1: Foundation
- [x] Git backup + tag
- [ ] Create this doc
- [ ] Update MIN_SCALE to 0.15 everywhere
- [ ] Build indices with precomputed centroids

### Phase 2: Culling & Tiers
- [ ] Implement spatial grid
- [ ] Add tier calculation with hysteresis
- [ ] Wire up tier state with useRef

### Phase 3: Rendering
- [ ] T3: Render only 3 chips at centroids
- [ ] T2: Simplified pills, no images
- [ ] T1: Full cards with bucket selection

### Phase 4: Polish
- [ ] Edge batching with proper Path cloning
- [ ] Telemetry + cleanup
- [ ] Kill switches
- [ ] CDN safety verification

## Test Plan

1. **Extreme zoom out (scale < 0.2)**
   - Verify only 3 chips visible
   - No node/edge rendering
   - Chips at correct world positions

2. **Mid zoom (scale ~0.5)**
   - Text pills only
   - Zero image requests
   - Edges capped at 300

3. **Close zoom (scale > 1.0)**
   - Full cards with photos
   - Bucket selection working
   - Smooth 60fps with culling

4. **Transitions**
   - No flapping between tiers
   - Hysteresis preventing jitter
   - Memory stays under budget

5. **Performance**
   - frameStats show proper caps
   - No per-frame allocations
   - Cleanup on unmount

## Rollback Plan
1. Set `LOD_ENABLED = false` to disable system
2. Revert to tag: `lod-pre-YYYYMMDD-HHMM`
3. Remove spatial grid if causing issues

## Copy-Paste Recovery Snippets

### Get current tier
```javascript
const tier = calculateLODTier(scale.value);
```

### Check if image should load
```javascript
if (tier === 1 && node.photo_url) {
  // Load image with bucket
}
```

### Render by tier
```javascript
if (tier === 3) return renderTier3(...);
const nodes = tier === 1 ? renderFullNodes() : renderPills();
```

### Performance check
```javascript
console.log(`T${tier} | Nodes: ${nodesDrawn}/${MAX_VISIBLE_NODES}`);
```

## Known Issues & Mitigations
- **Path batching**: Must clone SkPath before pushing (mutable object)
- **Centroid cost**: Precompute during index build, not per frame
- **Timer cleanup**: Clear all bucket timers on unmount
- **Gen-2 depth**: Use depth === 1, not 2 (root is 0)

## Success Metrics
- [ ] 10K nodes render smoothly at all zoom levels
- [ ] Memory usage < 128MB on iOS
- [ ] Zero dropped frames during normal interaction
- [ ] Image cache hit rate > 80% in T1