# Phase 1 Architecture

## Module Structure

```
src/components/TreeView/
├── utils/                    # Extracted utilities
│   ├── constants/
│   │   ├── viewport.ts      # Viewport & culling (7 constants)
│   │   ├── nodes.ts         # Node dimensions & styling (16 constants)
│   │   ├── performance.ts   # Animation & gestures (6 constants)
│   │   └── index.ts         # Central export
│   ├── colorUtils.ts        # Color manipulation (4 functions)
│   ├── performanceMonitor.ts # Performance tracking (singleton)
│   └── index.ts             # Central export point
├── types/                    # TypeScript definitions
│   ├── node.ts              # Profile, LayoutNode, RenderedNode (5 interfaces)
│   ├── viewport.ts          # Camera, Transform, Bounds (8 interfaces)
│   ├── theme.ts             # Design tokens (8 interfaces)
│   └── index.ts             # Central export + re-exports
└── theme/                    # Reserved for Phase 3
```

## Design Decisions

### 1. Single Source of Truth

**Problem:** TreeView.js had duplicate constants scattered throughout 3,817 lines.

**Solution:** Centralized all constants in `utils/constants/` with clear semantic grouping.

**Benefits:**
- Changes propagate automatically
- No synchronization issues
- Easy to find and update values

**Example:**
```javascript
// Before: Inline constant (appeared 3 times)
const NODE_WIDTH = 85;

// After: Imported from single source
import { NODE_WIDTH_WITH_PHOTO } from './TreeView/utils';
```

### 2. Modular Organization

**Grouping Strategy:**
- **viewport.ts** - Viewport culling & LOD thresholds
- **nodes.ts** - Node dimensions, styling, spacing
- **performance.ts** - Animation durations, gesture constants

**Rationale:** Group by concern, not by type. Makes it easier to find related constants.

### 3. Type Safety via TypeScript

**Approach:** Use TypeScript for new code, gradually migrate TreeView.js in Phase 2.

**Key Decision:** Import Profile/Marriage types from canonical `supabase.ts` instead of duplicating.

**Benefits:**
- Single source of truth for database schema
- Automatic sync when schema changes
- No field name mismatches

**Example:**
```typescript
// ✅ Correct: Import from canonical source
import type { Profile, Marriage } from '../../../types/supabase';
export type { Profile, Marriage };

// ❌ Wrong: Duplicate type definitions
export interface Profile { ... } // Gets out of sync
```

### 4. Reanimated SharedValue Types

**Problem:** RenderedNode needs animated values, but plain `number` type doesn't capture Reanimated usage.

**Solution:** Use `SharedValue<number>` for animated properties.

**Example:**
```typescript
export interface RenderedNode extends LayoutNode {
  animatedX: SharedValue<number>;  // ✅ Type-safe
  animatedY: SharedValue<number>;
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
}
```

### 5. Performance Monitor Singleton

**Pattern:** Class-based singleton with instance methods.

**Rationale:**
- Simple to use (`performanceMonitor.logLayoutTime()`)
- Maintains state across calls (metrics snapshot)
- Can add features without breaking API

**Alternative Considered:** Hooks-based approach (`usePerformanceMonitor()`)
- **Rejected:** Overkill for Phase 1, can migrate in Phase 2

### 6. Color Utilities (Functional)

**Pattern:** Pure functions without side effects.

**Rationale:**
- Testable (18 tests)
- Composable (can chain operations)
- No state management needed

**Example:**
```javascript
const dimmed = hexToRgba(NAJDI_CRIMSON, 0.5);
const grayscale = createGrayscaleMatrix();
```

### 7. Central Exports (index.ts)

**Pattern:** Each folder has `index.ts` that re-exports everything.

**Benefits:**
- Clean import paths (`from './TreeView/utils'` not `from './TreeView/utils/constants/viewport'`)
- Easy to add new exports
- Encapsulation (can change internal structure without breaking imports)

**Example:**
```typescript
// utils/index.ts
export * from './constants';
export * from './colorUtils';
export { default as performanceMonitor } from './performanceMonitor';

// Consumer code
import { NODE_WIDTH_WITH_PHOTO, hexToRgba, performanceMonitor } from './TreeView/utils';
```

## Import Strategy

### TreeView.js Imports (Day 4a)
```javascript
import {
  // Constants (29 total)
  VIEWPORT_MARGIN_X,
  NODE_WIDTH_WITH_PHOTO,
  ANIMATION_DURATION_SHORT,
  // ... etc

  // Utilities (4 functions)
  hexToRgba,
  createDimMatrix,
  createGrayscaleMatrix,
  interpolateColor,

  // Performance monitor
  performanceMonitor,
} from './TreeView/utils';
```

### Future Phase 2+ Imports
```typescript
import type {
  Profile,
  LayoutNode,
  RenderedNode,
  Camera,
  ThemeTokens,
} from './TreeView/types';
```

## Atomic Commit Strategy

### Why 4 Commits for Day 4?

**Day 4a:** Import-only (46 additions, 0 deletions)
- Zero risk - nothing breaks
- Can revert independently

**Day 4b:** Remove constants (12 additions, 22 deletions)
- Depends on Day 4a
- Can revert independently
- Easy to review (just deletions)

**Day 4c:** Color conversion (deferred)
- No existing code to convert
- Utilities ready for Phase 2

**Day 4d:** Performance logging (7 additions, 0 deletions)
- Depends on Day 4a
- Can revert independently
- Easy to review (just additions)

**Benefit:** Any step can be reverted without breaking the others.

## Scalability

### Phase 2 Readiness

**Component Extraction:**
- Types ready (LayoutNode, RenderedNode)
- Constants available (NODE_WIDTH_WITH_PHOTO, etc.)
- Utilities available (hexToRgba for colors)

**Layout Algorithm:**
- LayoutNode interface defined
- Performance monitoring integrated
- Constants centralized (easy to tune)

**Design Tokens:**
- ThemeTokens architecture ready
- Three-tier system (Reference → Semantic → Component)
- Color utilities ready for dark mode

### Adding New Constants

**Process:**
1. Add to appropriate file in `utils/constants/`
2. Export from `constants/index.ts`
3. Add unit test if complex logic
4. Import in TreeView.js

**Example:**
```typescript
// utils/constants/nodes.ts
export const NODE_BORDER_WIDTH = 1;

// utils/constants/index.ts
export * from './nodes';

// TreeView.js
import { NODE_BORDER_WIDTH } from './TreeView/utils';
```

### Adding New Utilities

**Process:**
1. Create file in `utils/` (e.g., `geometryUtils.ts`)
2. Export functions
3. Add to `utils/index.ts`
4. Create test file `tests/utils/geometryUtils.test.js`
5. Import in consumers

## Performance Considerations

### Bundle Size Impact

**Added:** ~2KB (utilities + types)
- Minified and gzipped: ~0.8KB
- Tree-shakeable (unused exports removed)

**Impact:** ~0.1% increase (negligible)

### Runtime Overhead

**PerformanceMonitor:**
- `logLayoutTime()`: ~0.5ms (negligible)
- Only runs during layout (not every frame)
- Can disable in production with `if (__DEV__)`

**Import overhead:**
- Constants: Zero (compile-time inlined)
- Functions: Minimal (<0.1ms total)

## Maintenance

### When to Update

**Constants:** When design system changes (rare)
**Utilities:** When adding new features (Phase 2+)
**Types:** When database schema changes (use supabase.ts)

### Deprecation Strategy

**Don't delete, deprecate:**
```typescript
/**
 * @deprecated Use NEW_CONSTANT_NAME instead
 */
export const OLD_CONSTANT_NAME = 100;
```

**Remove after:** 1 major version or 6 months

---

**Next:** See [IMPORTS.md](IMPORTS.md) for usage examples
