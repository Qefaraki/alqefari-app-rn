# Phase 2: TreeView Component Extraction Plan

## Executive Summary

**Goal**: Extract ~1,800 lines of rendering, interaction, and navigation logic from TreeView.js into 30 modular, testable components while maintaining zero regressions on 2,400-profile production tree.

**Timeline**: 12-13 days (85-92 hours)
**Risk Level**: LOW (10% - same as Phase 1)
**Status**: Ready for validation

## Critical Baseline Corrections

1. **Production Tree Size**: ~2,400 profiles (NOT 56 from Phase 1 test data)
2. **TreeSkeleton Status**: Broken watermark placeholder - will be replaced with simple Najdi spinner
3. **Timeline**: 12-13 days (includes Day 0 baseline + Day 3.5 NodeSizeProvider)
4. **Architecture Future-Proofing**: NodeSizeProvider enables root prominence & VIP features (Phase 4+)

## Phase 2 Scope

### Components to Extract (30 total)

**Rendering Logic (~800 lines):**
- NodeRenderer (card layout, photos, badges, shadows)
- ConnectionRenderer (parent-child lines, marriage lines)
- PhotoRenderer (avatar with grayscale/dimming)
- BadgeRenderer (status indicators)
- ShadowRenderer (Najdi subtle shadows)
- TextPillRenderer (LOD Tier 2 rendering)
- LODCalculator (tier assignment: T1 full cards, T2 text pills, T3 aggregation)
- ArabicTextRenderer + ParagraphCache
- HighlightRenderer (search/selection states)
- SaduIcon (Najdi pattern rendering)

**Interaction Logic (~400 lines):**
- GestureHandler (pan, pinch, tap)
- SelectionHandler
- NavigationHandler (focus profile, center camera)
- SearchHandler (name chain filtering)
- CameraController (viewport transformation)
- EffectHandlers (URL params, subscriptions, keyboard)

**Spatial & Performance (~600 lines):**
- SpatialGrid (viewport culling)
- ImageBuckets (40/60/80/120/256px selection)
- PathCalculator (connection line geometry)
- BoundsCalculator (visible node culling)
- TransformUtilities (matrix math)
- DebugOverlay (performance metrics display)

**UI Components:**
- TreeNavigation (focus, center, zoom controls)
- SimpleTreeSkeleton (Najdi spinner + loading text - replaces broken watermark)

### Explicitly Deferred to Phase 3+

**LOD System Bugs** (Known Issues):
- Size jumping during zoom (T1 ↔ T2 transitions)
- Hysteresis not preventing thrashing
- Scale quantum calculations inconsistent
- **Phase 2 Strategy**: Extract AS-IS, preserve bugs, fix in Phase 3

**Layout Algorithm Refactoring**:
- D3 hierarchy complexity in `src/utils/treeLayout.js`
- Collision detection and sibling spacing
- **Phase 2 Strategy**: Do NOT touch layout algorithm, just extract renderers

**Design Token Migration**:
- Hardcoded colors → ThemeTokens system
- Component-specific tokens
- **Phase 2 Strategy**: Use Phase 1 constants, migrate in Phase 3

**Performance Optimization**:
- Memoization of expensive calculations
- Layout algorithm optimization
- Spatial grid tuning
- **Phase 2 Strategy**: Measure baseline, optimize only if regressions occur (Day 13 buffer)

**Ancestry Overlay Feature** (Future):
- Highlight lineage paths
- Integration points documented in architecture
- **Phase 2 Strategy**: Add NodeSizeProvider abstraction (Day 3.5) to enable future implementation

---

## Day-by-Day Implementation Plan

### Day 0: Establish 2,400-Profile Baseline (4 hours)

**NEW - Critical for Validation**

**Objective**: Measure actual production performance as validation target for all subsequent days.

**Tasks**:

1. **Create Test Fixture Generator** (90 minutes)
   - File: `tests/fixtures/generate2400Profiles.js`
   - Generate realistic 2,400-profile tree structure
   - Include actual family patterns (siblings, children, marriages)
   - Export JSON fixture for consistent testing
   - Verify tree structure validity (no orphans, valid relationships)

2. **Measure Layout Time** (45 minutes)
   - Add instrumentation to `calculateTreeLayout()` (line ~1180)
   - Log total layout duration
   - Expected: ~950ms (extrapolated from Phase 1: 56 profiles = 85-100ms)
   - Record actual measurement in baseline doc

3. **Measure Memory Usage** (30 minutes)
   - `JSON.stringify(treeData).length / (1024 * 1024)` for tree data size
   - Expected: ~9MB (56 profiles = 0.5MB, scales linearly)
   - Log to console and document

4. **Measure FPS During Gestures** (45 minutes)
   - Use React DevTools Profiler
   - Pan across tree for 10 seconds
   - Zoom in/out 5 times
   - Target: 60fps (no frame drops)
   - Record actual FPS (P50, P95, P99)

5. **Document Baseline** (30 minutes)
   - Create `docs/treeview-refactor/phase2/testing/PERFORMANCE_BASELINE_PHASE2.md`
   - Record all measurements
   - Set 5% tolerance thresholds for validation
   - **Example Format**:
     ```markdown
     ## Baseline Metrics (2,400 Profiles, iPhone XR)

     | Metric | Value | Max Allowed (5% tolerance) |
     |--------|-------|----------------------------|
     | Layout Time | 950ms | 998ms |
     | Memory (Tree Data) | 9MB | 9.45MB |
     | FPS (Pan) | 60fps | 57fps |
     | FPS (Zoom) | 60fps | 57fps |
     | Cold Start | 2.8s | 2.94s |
     ```

**Deliverables**:
- ✅ 2,400-profile test fixture (`tests/fixtures/tree2400.json`)
- ✅ Baseline metrics document
- ✅ Performance tolerance thresholds
- ✅ Console logging instrumentation

**Git Tag**: `checkpoint/phase2-day0`

**Acceptance Criteria**:
- [ ] Fixture generates consistently (same tree structure every time)
- [ ] Layout time measured with performance.now()
- [ ] Memory usage logged to console
- [ ] FPS recorded from React DevTools
- [ ] All metrics documented in markdown file

---

### Day 1-2: Extract Spatial & Utility Components (12 hours)

**Objective**: Extract components with zero/minimal dependencies - safest extractions first.

#### Day 1 (6 hours)

**Components (4)**:

1. **SpatialGrid** (90 minutes)
   - File: `src/components/TreeView/spatial/SpatialGrid.ts`
   - Extract grid-based viewport culling logic (lines ~480-558)
   - Interface:
     ```typescript
     class SpatialGrid {
       constructor(cellSize: number);
       insert(node: LayoutNode): void;
       queryBounds(bounds: Bounds): LayoutNode[];
       clear(): void;
     }
     ```
   - Tests: Insert 100 nodes, query visible subset, verify correct results
   - **Deferred**: Grid size optimization (use current 500px cells)

2. **LODCalculator** (90 minutes)
   - File: `src/components/TreeView/lod/LODCalculator.ts`
   - Extract tier assignment logic (lines ~1270-1320)
   - Interface:
     ```typescript
     function calculateLODTier(scale: number, nodeSize: number): 'T1' | 'T2' | 'T3';
     ```
   - **Deferred**: Bug fixes (size jumping during zoom) - extract AS-IS
   - Tests: Verify tier thresholds (T1: scale > 0.48, T2: scale > 0.24, T3: else)

3. **PathCalculator** (90 minutes)
   - File: `src/components/TreeView/spatial/PathCalculator.ts`
   - Extract connection line geometry (lines ~2280-2420)
   - Functions:
     ```typescript
     function calculateParentChildPath(parent: LayoutNode, child: LayoutNode): string;
     function calculateMarriagePath(spouse1: LayoutNode, spouse2: LayoutNode): string;
     ```
   - Uses Skia `Path` API
   - Tests: Verify SVG path strings for vertical/horizontal connections

4. **ImageBuckets** (90 minutes)
   - File: `src/components/TreeView/images/ImageBuckets.ts`
   - Extract bucket selection logic (lines ~341-370)
   - Function:
     ```typescript
     function selectImageBucket(displaySize: number): number; // Returns 40, 60, 80, 120, or 256
     ```
   - Uses BUCKET_HYSTERESIS (0.15) to prevent thrashing
   - Tests: Verify bucket selection at boundaries (e.g., 65px → 80, 75px → 80, 85px → 120)

**Validation (End of Day 1)**:
- [ ] All 4 components compile without errors
- [ ] Unit tests pass (12 tests total)
- [ ] TreeView.js still renders (import new modules, verify no visual changes)
- [ ] Performance: Layout time within 5% of baseline

**Git Tag**: `checkpoint/phase2-day1`

#### Day 2 (6 hours)

**Components (4)**:

5. **SaduIcon** (90 minutes)
   - File: `src/components/TreeView/components/SaduIcon.tsx`
   - Extract Najdi pattern rendering (lines ~2750-2820)
   - Skia-based geometric pattern
   - Props: `size: number, color: string, opacity: number`
   - Tests: Visual snapshot test

6. **ArabicTextRenderer** (120 minutes)
   - File: `src/components/TreeView/text/ArabicTextRenderer.ts`
   - Extract `createArabicParagraph()` function (lines 238-299)
   - Handles Arabic text shaping with Skia Paragraph
   - **Critical**: Preserve font fallback logic (SF Arabic → Geeza Pro → Damascus)
   - Tests: Verify RTL rendering, text truncation with ellipsis

7. **ParagraphCache** (90 minutes)
   - File: `src/components/TreeView/text/ParagraphCache.ts`
   - Extract text measurement caching (lines ~305-340)
   - Simple Map-based cache with size limits
   - Interface:
     ```typescript
     class ParagraphCache {
       get(key: string): Paragraph | null;
       set(key: string, paragraph: Paragraph): void;
       clear(): void;
     }
     ```
   - Tests: Verify cache hits/misses, size limit enforcement

8. **HighlightRenderer** (90 minutes)
   - File: `src/components/TreeView/rendering/HighlightRenderer.tsx`
   - Extract search/selection highlight rendering (lines ~1680-1740)
   - Skia-based golden glow effect using Reanimated
   - Props: `nodeId: string, opacity: SharedValue<number>`
   - Tests: Visual snapshot, animation timing

**Validation (End of Day 2)**:
- [ ] All 8 components total compile
- [ ] Unit tests pass (24 tests total)
- [ ] TreeView.js still renders identically
- [ ] Performance: Layout time + Memory within 5% of baseline
- [ ] Text rendering works (Arabic characters, RTL, truncation)

**Git Tag**: `checkpoint/phase2-day2`

---

### Day 3-4: Extract Renderers (CRITICAL PATH) (14 hours)

**Objective**: Extract core rendering components - highest risk for visual regressions.

**Risk Mitigation**:
- Screenshot comparison before/after extraction
- Test all LOD tiers (T1/T2/T3)
- Test on physical device (not just simulator)
- Incremental extraction (one component per hour, validate immediately)

#### Day 3 (7 hours)

**Components (3)**:

9. **NodeRenderer** (180 minutes)
   - File: `src/components/TreeView/rendering/NodeRenderer.tsx`
   - Extract full card rendering (lines ~2540-2680)
   - Renders: RoundedRect background, photo, name text, badges, shadows
   - Props:
     ```typescript
     interface NodeRendererProps {
       node: RenderedNode;
       showPhoto: boolean;
       isDarkMode: boolean;
       isDeceased: boolean;
       isHighlighted: boolean;
       lodTier: 'T1' | 'T2' | 'T3';
     }
     ```
   - **Critical**: Preserve exact dimensions (NODE_WIDTH_WITH_PHOTO: 85, NODE_HEIGHT_WITH_PHOTO: 90)
   - Tests: Visual snapshot for each state (normal, highlighted, deceased, dark mode)

10. **ConnectionRenderer** (150 minutes)
    - File: `src/components/TreeView/rendering/ConnectionRenderer.tsx`
    - Extract all connection line rendering (lines ~2280-2480)
    - Renders: Parent-child vertical lines, marriage horizontal lines, sibling connectors
    - Uses PathCalculator for geometry
    - Props:
      ```typescript
      interface ConnectionRendererProps {
        connections: Connection[];
        highlightedPath: string[] | null; // For ancestry overlay (future)
      }
      ```
    - **Deferred**: Ancestry overlay highlighting (Phase 4)
    - Tests: Visual snapshot, verify line positioning

11. **PhotoRenderer** (150 minutes)
    - File: `src/components/TreeView/rendering/PhotoRenderer.tsx`
    - Extract photo rendering with filters (lines ~2580-2650)
    - Applies grayscale matrix for deceased profiles
    - Applies dim matrix for dark mode
    - Uses image bucket system (40/60/80/120/256px)
    - Props:
      ```typescript
      interface PhotoRendererProps {
        photoUrl: string;
        size: number;
        x: number;
        y: number;
        isDeceased: boolean;
        isDarkMode: boolean;
        imageBucket: number;
      }
      ```
    - Uses Phase 1 utilities: `createGrayscaleMatrix()`, `createDimMatrix()`
    - Tests: Visual snapshot (normal, deceased, dark mode, all bucket sizes)

**Validation (End of Day 3)**:
- [ ] Visual regression test: Compare screenshots before/after
- [ ] All LOD tiers render correctly (T1 full cards visible)
- [ ] Photos load and render with correct filters
- [ ] Connection lines positioned accurately
- [ ] Performance: Frame rate 60fps during pan/zoom

**Git Tag**: `checkpoint/phase2-day3`

#### Day 4 (7 hours)

**Components (3)**:

12. **BadgeRenderer** (120 minutes)
    - File: `src/components/TreeView/rendering/BadgeRenderer.tsx`
    - Extract status badge rendering (lines ~2650-2700)
    - Renders: Alive/deceased indicators, admin badges, VIP badges
    - Props:
      ```typescript
      interface BadgeRendererProps {
        status: 'alive' | 'deceased';
        isAdmin: boolean;
        isVIP: boolean; // For future VIP highlighting feature
        x: number;
        y: number;
      }
      ```
    - **Future-proofing**: Add isVIP prop (unused in Phase 2, enables Phase 4 feature)
    - Tests: Visual snapshot for each badge type

13. **ShadowRenderer** (90 minutes)
    - File: `src/components/TreeView/rendering/ShadowRenderer.tsx`
    - Extract subtle shadow rendering (lines ~2560-2580)
    - Najdi design: Max 0.08 opacity
    - Props:
      ```typescript
      interface ShadowRendererProps {
        x: number;
        y: number;
        width: number;
        height: number;
        opacity: number; // Max 0.08
      }
      ```
    - Uses Phase 1 constants: SHADOW_OPACITY (0.05), SHADOW_RADIUS (8), SHADOW_OFFSET_Y (2)
    - Tests: Verify opacity never exceeds 0.08

14. **TextPillRenderer** (120 minutes)
    - File: `src/components/TreeView/rendering/TextPillRenderer.tsx`
    - Extract LOD Tier 2 rendering (lines ~2720-2780)
    - Renders: Small text-only pills (no photos)
    - Props:
      ```typescript
      interface TextPillRendererProps {
        node: RenderedNode;
        scale: number;
      }
      ```
    - **Deferred**: Size jumping bug fix (extract AS-IS)
    - Tests: Visual snapshot at various scales

**Validation (End of Day 4)**:
- [ ] All renderers work together (full card rendering pipeline)
- [ ] Visual regression test passes
- [ ] RTL layout correct (Arabic text, mirrored connections)
- [ ] Performance: No frame drops during rendering
- [ ] Test on physical device: Shadows render correctly, photos sharp

**Git Tag**: `checkpoint/phase2-day4`

---

### Day 3.5: Create NodeSizeProvider Abstraction (4 hours)

**NEW - Architecture Future-Proofing**

**Objective**: Enable future root prominence and VIP highlighting without refactoring.

**Why Now**: Extracting NodeRenderer is the perfect time to add this abstraction layer.

**Implementation**:

**File**: `src/components/TreeView/providers/NodeSizeProvider.ts`

```typescript
import { Profile } from '../types';
import { NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO } from '../utils';

export interface NodeSize {
  width: number;
  height: number;
}

/**
 * Central authority for node dimensions.
 *
 * Phase 2: Always returns standard size (85×90)
 * Phase 4+: Can return larger sizes for root (120×120) or VIPs (100×100)
 *
 * Future features enabled:
 * - Root prominence (larger root node)
 * - VIP highlighting (larger VIP nodes)
 * - Dynamic sizing based on zoom level
 * - Badge size variations
 */
export function getNodeSize(profile: Profile, context?: NodeSizeContext): NodeSize {
  // Phase 2: Standard size for all nodes
  return {
    width: NODE_WIDTH_WITH_PHOTO,
    height: NODE_HEIGHT_WITH_PHOTO,
  };

  // Phase 4+ example (commented out):
  // if (isRootProfile(profile)) return { width: 120, height: 120 };
  // if (isVIP(profile)) return { width: 100, height: 100 };
  // return { width: 85, height: 90 };
}

/**
 * Context for node size calculations (future use)
 */
export interface NodeSizeContext {
  zoomLevel?: number;
  lodTier?: 'T1' | 'T2' | 'T3';
  isHighlighted?: boolean;
}

/**
 * Utility: Check if profile is root (future implementation)
 */
function isRootProfile(profile: Profile): boolean {
  // Phase 4: Implement root detection logic
  return false;
}

/**
 * Utility: Check if profile is VIP (future implementation)
 */
function isVIP(profile: Profile): boolean {
  // Phase 4: Check profile metadata for VIP status
  return false;
}
```

**Integration Points**:

1. **NodeRenderer** (use getNodeSize() for dimensions)
2. **Layout Algorithm** (future: use getNodeSize() for collision detection)
3. **BadgeRenderer** (future: adjust badge size based on node size)

**Benefits**:
- ✅ Root prominence feature: Just update getNodeSize() logic (no refactoring)
- ✅ VIP highlighting: Add badge size variations
- ✅ Zero refactoring needed in Phase 4
- ✅ Single source of truth for node dimensions
- ✅ Easy to add dynamic sizing (zoom-based, context-based)

**Tests** (60 minutes):
- Verify returns standard size in Phase 2
- Verify isRootProfile() returns false (placeholder)
- Verify isVIP() returns false (placeholder)
- Document future implementation in comments

**Documentation** (60 minutes):
- Add to `docs/treeview-refactor/phase2/architecture/FUTURE_PROOFING.md`
- Explain root prominence integration
- Explain VIP highlighting integration
- Provide implementation examples for Phase 4

**Git Tag**: `checkpoint/phase2-day3.5`

**Acceptance Criteria**:
- [ ] getNodeSize() returns 85×90 for all profiles
- [ ] NodeRenderer uses getNodeSize() instead of hardcoded constants
- [ ] Comments explain future Phase 4 implementation
- [ ] Documentation updated with integration examples

---

### Day 5-6: Extract Interaction Handlers (12 hours)

**Objective**: Extract gesture and interaction logic without breaking UX.

#### Day 5 (6 hours)

**Components (3)**:

15. **GestureHandler** (150 minutes)
    - File: `src/components/TreeView/interaction/GestureHandler.ts`
    - Extract pan, pinch, tap gestures (lines ~1830-2020)
    - Uses react-native-gesture-handler + Reanimated
    - Interface:
      ```typescript
      interface GestureHandlerProps {
        translateX: SharedValue<number>;
        translateY: SharedValue<number>;
        scale: SharedValue<number>;
        onNodeTap: (nodeId: string) => void;
      }
      ```
    - **Critical**: Preserve gesture deceleration (0.998), rubber band factor (0.6)
    - Tests: Simulate gestures, verify camera updates

16. **SelectionHandler** (90 minutes)
    - File: `src/components/TreeView/interaction/SelectionHandler.ts`
    - Extract profile selection logic (lines ~1760-1820)
    - Manages selected node state
    - Interface:
      ```typescript
      function handleNodeSelection(nodeId: string, onSelect: (node: LayoutNode) => void): void;
      ```
    - Tests: Verify selection state updates, deselection logic

17. **NavigationHandler** (150 minutes)
    - File: `src/components/TreeView/navigation/NavigationHandler.ts`
    - Extract focus/center camera logic (lines ~2100-2250)
    - Animates camera to center on specific profile
    - Interface:
      ```typescript
      function navigateToNode(
        nodeId: string,
        nodes: LayoutNode[],
        viewport: Viewport,
        sharedValues: CameraSharedValues
      ): void;
      ```
    - Uses withTiming() animations (400ms duration)
    - Tests: Verify camera centering on target node

**Validation (End of Day 5)**:
- [ ] Pan gestures work (smooth scrolling, deceleration)
- [ ] Pinch zoom works (min 0.5x, max 3.0x)
- [ ] Tap selection works (highlights node)
- [ ] Navigation centers on target node
- [ ] No gesture lag or jank (60fps)

**Git Tag**: `checkpoint/phase2-day5`

#### Day 6 (6 hours)

**Components (3)**:

18. **SearchHandler** (120 minutes)
    - File: `src/components/TreeView/search/SearchHandler.ts`
    - Extract name chain filtering (lines ~1420-1520)
    - Filters nodes by Arabic name search
    - Interface:
      ```typescript
      function filterNodesBySearch(
        nodes: LayoutNode[],
        searchQuery: string
      ): LayoutNode[];
      ```
    - **Critical**: Preserve Arabic text normalization
    - Tests: Search "محمد", verify matching nodes returned

19. **EffectHandlers** (150 minutes)
    - File: `src/components/TreeView/effects/EffectHandlers.ts`
    - Extract useEffect hooks (lines ~1550-1680)
    - Handles: URL params, Supabase subscriptions, keyboard events
    - Functions:
      ```typescript
      function useUrlParamEffects(focusOnProfile: boolean, highlightProfileId: string): void;
      function useSubscriptionEffects(treeData: Profile[]): void;
      function useKeyboardEffects(navigateToNode: Function): void;
      ```
    - Tests: Mock URL params, verify navigation triggered

20. **CameraController** (120 minutes)
    - File: `src/components/TreeView/camera/CameraController.ts`
    - Extract viewport transformation logic (lines ~2020-2150)
    - Manages camera state (translateX, translateY, scale)
    - Interface:
      ```typescript
      class CameraController {
        setPosition(x: number, y: number): void;
        setZoom(scale: number): void;
        centerOn(node: LayoutNode, viewport: Viewport): void;
      }
      ```
    - Tests: Verify bounds clamping, zoom limits

**Validation (End of Day 6)**:
- [ ] Search filters nodes correctly
- [ ] URL params trigger navigation
- [ ] Subscriptions receive real-time updates
- [ ] Keyboard shortcuts work (arrow keys, zoom)
- [ ] Camera state synchronized with gestures

**Git Tag**: `checkpoint/phase2-day6`

---

### Day 7-8: Extract Navigation & Utilities (10 hours)

**Objective**: Extract remaining utility components and navigation features.

#### Day 7 (5 hours)

**Components (2)**:

21. **TreeNavigation** (180 minutes)
    - File: `src/components/TreeView/components/TreeNavigation.tsx`
    - Extract navigation UI (focus, center, zoom controls)
    - Wraps NavigationHandler with UI buttons
    - Props:
      ```typescript
      interface TreeNavigationProps {
        onFocusNode: (nodeId: string) => void;
        onCenterCamera: () => void;
        onZoomIn: () => void;
        onZoomOut: () => void;
      }
      ```
    - Tests: Button taps trigger correct actions

22. **BoundsCalculator** (120 minutes)
    - File: `src/components/TreeView/spatial/BoundsCalculator.ts`
    - Extract visible node culling logic (lines ~520-580)
    - Calculates viewport bounds with margins
    - Interface:
      ```typescript
      function calculateVisibleBounds(
        camera: Camera,
        viewport: Viewport
      ): VisibleBounds;
      ```
    - Uses VIEWPORT_MARGIN_X (3000), VIEWPORT_MARGIN_Y (1200)
    - Tests: Verify bounds calculation at various zoom levels

**Validation (End of Day 7)**:
- [ ] Navigation buttons work (focus, center, zoom)
- [ ] Bounds calculation correct (nodes outside viewport culled)
- [ ] No memory leaks (component cleanup)

**Git Tag**: `checkpoint/phase2-day7`

#### Day 8 (5 hours)

**Components (2)**:

23. **TransformUtilities** (120 minutes)
    - File: `src/components/TreeView/utils/TransformUtilities.ts`
    - Extract matrix math utilities (lines ~2150-2220)
    - Functions:
      ```typescript
      function screenToCanvas(screenX: number, screenY: number, camera: Camera): Point;
      function canvasToScreen(canvasX: number, canvasY: number, camera: Camera): Point;
      ```
    - Tests: Verify coordinate transformations

24. **DebugOverlay** (180 minutes)
    - File: `src/components/TreeView/components/DebugOverlay.tsx`
    - Extract performance metrics display (lines ~3680-3750)
    - Shows: FPS, node count, visible nodes, memory usage
    - Props:
      ```typescript
      interface DebugOverlayProps {
        metrics: PerformanceMetrics;
        visible: boolean;
      }
      ```
    - Uses performanceMonitor.getMetrics()
    - Tests: Verify metrics display updates

**Validation (End of Day 8)**:
- [ ] Coordinate transforms accurate (tap on node centers correctly)
- [ ] Debug overlay displays current metrics
- [ ] All 24 components extracted and working

**Git Tag**: `checkpoint/phase2-day8`

---

### Day 9: Replace Broken Skeleton with Najdi Spinner (30 minutes)

**REVISED - Simplified Approach**

**Objective**: Remove broken watermark skeleton, add simple loading spinner in Najdi Sadu colors.

**Tasks**:

1. **Delete Broken Skeleton** (5 minutes)
   - Remove lines 3405-3584 in TreeView.js (180 lines of broken code)
   - Removes hardcoded static boxes/lines

2. **Create SimpleTreeSkeleton Component** (15 minutes)
   - File: Create inline component (no separate file needed)
   - Replace with:
     ```javascript
     const TreeSkeleton = () => (
       <View style={{
         flex: 1,
         backgroundColor: '#F9F7F3', // Al-Jass White
         alignItems: 'center',
         justifyContent: 'center',
       }}>
         <ActivityIndicator
           size="large"
           color="#D1BBA3" // Camel Hair Beige
         />
         <Text style={{
           marginTop: 16,
           fontSize: 17,
           color: '#242121', // Sadu Night
           fontFamily: 'SF-Arabic',
         }}>
           جارٍ تحميل شجرة العائلة...
         </Text>
       </View>
     );
     ```

3. **Verify Rendering** (10 minutes)
   - Clear AsyncStorage to test cold cache
   - Launch app → Verify spinner appears
   - Wait for tree to load → Verify smooth fade transition
   - No changes to fade animation logic (lines 1024-1040)

**Deliverables**:
- ✅ 180 lines of broken code removed
- ✅ Simple Najdi spinner with Arabic loading text
- ✅ Matches design system colors
- ✅ Works with existing fade transitions

**Git Tag**: `checkpoint/phase2-day9`

**Acceptance Criteria**:
- [ ] Old skeleton code deleted (lines 3405-3584)
- [ ] New spinner renders in Najdi Sadu colors
- [ ] Arabic text displays correctly
- [ ] Fade transition smooth (no flash)
- [ ] Total implementation time: <30 minutes

**Deferred to Later**:
- Branded skeleton with Alqefari emblem
- Najdi Sadu geometric pattern background
- Cache detection optimization (instant render on warm cache)
- **Reason**: Not a priority, simple spinner sufficient for Phase 2

---

### Day 10-11: Comprehensive Testing (14 hours)

**Objective**: Validate all 30 components work together with 2,400-profile tree.

#### Day 10 (7 hours)

**Unit Testing**:

1. **Run All Unit Tests** (60 minutes)
   - Expected: 80+ tests (each component has 2-4 tests)
   - Use `npm test tests/components/TreeView/`
   - Target: 100% pass rate
   - Fix any failures immediately

2. **Integration Testing with 2,400-Profile Fixture** (120 minutes)
   - Load `tests/fixtures/tree2400.json`
   - Render full tree
   - Test all LOD tiers visible
   - Test pan/zoom gestures
   - Test search filtering
   - Test node selection
   - Test navigation (center on profile)

3. **Visual Regression Testing** (90 minutes)
   - Take screenshots before/after component extraction
   - Compare pixel-by-pixel (use Maestro or manual comparison)
   - Verify:
     - Node cards render identically
     - Connection lines positioned correctly
     - Photos have correct filters (grayscale for deceased)
     - Shadows render subtly (max 0.08 opacity)
     - Arabic text renders with proper shaping

4. **Performance Validation Against Baseline** (90 minutes)
   - Measure layout time: Should be ≤ 998ms (5% tolerance of 950ms)
   - Measure memory usage: Should be ≤ 9.45MB (5% tolerance of 9MB)
   - Measure FPS during pan: Should be ≥ 57fps (5% tolerance of 60fps)
   - Measure FPS during zoom: Should be ≥ 57fps
   - **If any metric fails**: Investigate and optimize (use Day 13 buffer)

**Validation (End of Day 10)**:
- [ ] All unit tests pass
- [ ] 2,400-profile tree renders
- [ ] Visual regression test passes
- [ ] Performance within 5% of baseline

**Git Tag**: `checkpoint/phase2-day10`

#### Day 11 (7 hours)

**Edge Case Testing**:

5. **RTL Layout Correctness** (90 minutes)
   - Verify Arabic text renders right-to-left
   - Verify connection lines mirrored correctly
   - Verify gesture directions correct (pan right = move tree left)
   - Test on physical device (simulator RTL bugs)

6. **LOD System Testing** (120 minutes)
   - Zoom in slowly from 0.5x → 3.0x
   - Verify tier transitions (T3 → T2 → T1)
   - **Known bug**: Size jumping during zoom (document as expected behavior)
   - Verify aggregation chips appear at T3 (very zoomed out)
   - Verify text pills at T2 (medium zoom)
   - Verify full cards at T1 (zoomed in)

7. **Gesture Responsiveness** (90 minutes)
   - Test on physical iPhone XR
   - Pan across tree rapidly → Verify 60fps
   - Pinch zoom in/out rapidly → Verify smooth animation
   - Tap nodes → Verify immediate selection highlight
   - Test overscroll rubber banding (GESTURE_RUBBER_BAND_FACTOR: 0.6)
   - Test deceleration after fast pan (GESTURE_DECELERATION: 0.998)

8. **Search & Navigation** (60 minutes)
   - Search "محمد" → Verify matching nodes highlighted
   - Tap search result → Verify camera centers on node
   - Clear search → Verify highlights removed
   - Test keyboard shortcuts (if implemented)

9. **Real-time Updates** (60 minutes)
   - Edit profile in admin panel
   - Verify tree updates via Supabase subscription
   - Delete profile → Verify node disappears
   - Add new profile → Verify node appears

**Validation (End of Day 11)**:
- [ ] RTL layout correct (no visual artifacts)
- [ ] LOD system works (with known bugs documented)
- [ ] Gestures responsive (60fps on physical device)
- [ ] Search and navigation work
- [ ] Real-time subscriptions work

**Git Tag**: `checkpoint/phase2-day10-11`

**Acceptance Criteria**:
- [ ] Zero breaking changes (all existing features work)
- [ ] Zero visual regressions (tree looks identical)
- [ ] Performance within 5% tolerance (950ms → 998ms max)
- [ ] All 80+ unit tests pass
- [ ] Physical device testing completed

---

### Day 12: Documentation (6 hours)

**Objective**: Document Phase 2 work comprehensively for maintainability.

**Documents to Create**:

1. **Main Index** (30 minutes)
   - File: `docs/treeview-refactor/phase2/README.md`
   - Links to all Phase 2 documentation
   - Quick reference for imports and usage

2. **Overview** (60 minutes)
   - File: `docs/treeview-refactor/phase2/OVERVIEW.md`
   - Phase 2 goals and results
   - What was extracted vs what was deferred
   - Summary of 30 components

3. **Deliverables Breakdown** (90 minutes)
   - File: `docs/treeview-refactor/phase2/deliverables/DELIVERABLES.md`
   - Day-by-day breakdown of work completed
   - Component list with file paths and line counts
   - Git commit history and tags

4. **Architecture Documentation** (120 minutes)
   - File: `docs/treeview-refactor/phase2/architecture/ARCHITECTURE.md`
   - Design decisions for each component
   - Dependency graph (which components depend on which)
   - Integration points (how components connect)

5. **Component Map** (60 minutes)
   - File: `docs/treeview-refactor/phase2/architecture/COMPONENT_MAP.md`
   - All 30 components documented:
     - Purpose
     - File path
     - Interface/props
     - Dependencies
     - Usage examples

6. **Future-Proofing Documentation** (45 minutes)
   - File: `docs/treeview-refactor/phase2/architecture/FUTURE_PROOFING.md`
   - NodeSizeProvider integration for root prominence
   - Ancestry overlay integration points
   - VIP highlighting implementation guide
   - Phase 3+ preparation notes

7. **Testing Documentation** (60 minutes)
   - File: `docs/treeview-refactor/phase2/testing/TESTING.md`
   - Test coverage report (80+ tests)
   - Performance validation results
   - Visual regression test results
   - Edge cases tested

8. **Update CLAUDE.md** (15 minutes)
   - Add Phase 2 summary to project documentation
   - Update TreeView section with new architecture
   - Add quick reference for Phase 2 components

**Deliverables**:
- ✅ 8 documentation files created
- ✅ Component usage examples
- ✅ Architecture diagrams (text-based)
- ✅ Future implementation guides

**Git Tag**: `checkpoint/phase2-complete`

**Acceptance Criteria**:
- [ ] All documentation files created
- [ ] Code examples compile and run
- [ ] Future implementation guides clear
- [ ] CLAUDE.md updated with Phase 2 summary

---

### Day 13 (Optional): Performance Optimization (6 hours)

**ONLY IF BASELINE VALIDATION FAILS**

**Trigger Condition**: Any metric exceeds 5% tolerance:
- Layout time > 998ms
- Memory > 9.45MB
- FPS < 57fps

**Potential Optimizations**:

1. **Memoize Expensive Calculations** (120 minutes)
   - Wrap color utilities in useMemo()
   - Cache paragraph measurements
   - Memoize LOD tier calculations

2. **Optimize Viewport Culling** (90 minutes)
   - Reduce grid cell size (500px → 400px)
   - Add hysteresis to prevent thrashing
   - Profile with React DevTools

3. **Reduce Re-renders** (120 minutes)
   - Add React.memo() to components
   - Use useCallback() for event handlers
   - Optimize Reanimated SharedValue dependencies

4. **Profile and Fix Bottlenecks** (90 minutes)
   - Use React DevTools Profiler
   - Identify slow components
   - Optimize hot paths

**Success Criteria**:
- [ ] Layout time back within 5% tolerance
- [ ] Memory usage back within 5% tolerance
- [ ] FPS back to 60fps

**Git Tag**: `checkpoint/phase2-optimized`

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Components Extracted** | 30 |
| **Files Created** | 32 (30 components + 2 utilities) |
| **Lines Extracted** | ~1,800 |
| **Lines Removed from TreeView.js** | ~1,980 (extraction + skeleton deletion) |
| **Net Change in TreeView.js** | ~-180 lines |
| **Unit Tests Created** | 80+ |
| **Documentation Files** | 8 |
| **Git Tags** | 8 checkpoints |
| **Total Time** | 85-92 hours (12-13 days) |

---

## Risk Assessment

**Overall Risk**: LOW (10%)

**Mitigations**:
- ✅ Phase 1 success (98/100 audit score, zero regressions)
- ✅ Atomic commits (each component independently revertible)
- ✅ 8 git checkpoint tags for safe rollback
- ✅ Day 0 baseline with 2,400-profile validation
- ✅ Comprehensive testing on Days 10-11
- ✅ Day 13 buffer for performance optimization if needed

**Known Issues** (Deferred to Phase 3):
- LOD system bugs (size jumping during zoom)
- Layout algorithm complexity
- Design token migration
- Performance optimization beyond baseline

---

## Acceptance Criteria

### ✅ **Functionality**
- [ ] All 30 components extracted and working
- [ ] TreeView.js reduced by ~180 lines net
- [ ] Zero breaking changes (all features work)
- [ ] 80+ unit tests pass (100% pass rate)

### ✅ **Performance**
- [ ] Layout time ≤ 998ms (5% tolerance)
- [ ] Memory usage ≤ 9.45MB (5% tolerance)
- [ ] FPS ≥ 57fps during pan/zoom (5% tolerance)
- [ ] No visual regressions (screenshot comparison)

### ✅ **Code Quality**
- [ ] All components follow Phase 1 patterns
- [ ] TypeScript types for all new code
- [ ] Inline comments explain design decisions
- [ ] No magic numbers (all constants named)

### ✅ **Documentation**
- [ ] 8 documentation files created
- [ ] Component map with usage examples
- [ ] Architecture decisions documented
- [ ] Future-proofing guides written

---

## Next Steps After Phase 2

**Phase 3 Preview** (Future Work):
1. Fix LOD system bugs (size jumping, hysteresis)
2. Migrate hardcoded colors to ThemeTokens
3. Optimize layout algorithm
4. Add ancestry overlay feature (using NodeSizeProvider)
5. Implement root prominence (larger root node)
6. Add VIP highlighting

**Phase 4 Preview** (Future Work):
1. Root prominence feature (120×120 root node)
2. VIP highlighting (100×100 VIP nodes)
3. Enhanced branded skeleton (Alqefari emblem + Sadu pattern)
4. Cache detection optimization (instant render on warm cache)

---

**Plan Status**: Ready for validation
**Next Action**: Run through plan-validator agent
**Expected Outcome**: 90%+ approval with minor refinements
