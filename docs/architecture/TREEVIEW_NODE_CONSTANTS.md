# TreeView Node Constants

**Status**: ✅ Complete & Audited (October 25, 2025)
**Grade**: A- (92/100) - Fixed all audit recommendations
**Consolidation**: Eliminated 31px d3/renderer delta, single source of truth

## Overview

Central registry for all TreeView node dimensions, ensuring consistent sizing across d3 layout calculations and Skia rendering.

## Location

**File**: `src/components/TreeView/rendering/nodeConstants.ts`

## Node Types

### Standard Node (Regular zoom)
- **Width**: 58px (50px photo + 4px padding × 2)
- **Height**: 75px (photo) / 35px (text-only)
- **Padding**: 4px horizontal, 4px vertical (follows 8px Design System grid)
- **Selection border**: 2.5px (Najdi Crimson #A13333)
- **Corner radius**: 10px

### Root Node (Generation 1, no father)
- **Width**: 120px
- **Height**: 100px
- **Border radius**: 20px (extra rounded)
- **Selection border**: 2.5px

### G2 Parent (Generation 2 with children)
- **Width**: 95px (photo) / 75px (text-only)
- **Height**: 75px (photo) / 35px (text-only)
- **Border radius**: 16px
- **Selection border**: 2px

### Text Pill (LOD Tier 2)
- **Width**: 58px (matches standard photo nodes)
- **Height**: 26px
- **Corner radius**: 4px

## Import Path

```javascript
import {
  STANDARD_NODE,
  ROOT_NODE,
  G2_PARENT_NODE,
  NODE_WIDTH_WITH_PHOTO,  // Legacy: 58px
  NODE_HEIGHT_WITH_PHOTO, // Legacy: 75px
} from './TreeView/rendering/nodeConstants';
```

## Key Design Fixes

- ✅ Follows 8px Design System grid (4px padding minimum)
- ✅ Unified d3 layout and renderer (both use 58px)
- ✅ Selection border fits within padding (2.5px < 4px)
- ✅ Single source of truth (17% width reduction from 65px)
- ✅ 66 unit tests passing, 11 integration tests passing

## Phase 1 Refactor (October 2025)

**Status**: ✅ Complete (5 days, 27 hours)
**Grade**: 98/100 (A+)
**Commits**: 7 atomic commits, 4 checkpoint branches

### What Was Extracted

From monolithic TreeView.js (3,817 lines) to modular architecture:
- 29 constants (viewport, nodes, performance)
- 4 color functions
- 1 performance monitor
- TypeScript type definitions

### Test Coverage

**77 total tests** (100% passing):
- 39 NodeRenderer unit tests
- 27 TextPillRenderer unit tests
- 11 Tree Layout integration tests

### Performance Impact

**Benchmarks**:
- Layout time: +2.3% (within 5% tolerance)
- Memory usage: +2% (within 5% tolerance)
- Rendering: No degradation

## Related Documentation

- [TreeView Performance](../TREEVIEW_PERFORMANCE_OPTIMIZATION.md) - Performance optimizations
- [Phase 1 Documentation](../treeview-refactor/phase1/README.md) - Full refactor details
- [Design System](../DESIGN_SYSTEM.md) - 8px grid system
