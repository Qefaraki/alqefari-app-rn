# Phase 3: Perfect Tree Redesign Plan

**Status**: Planning
**Created**: October 24, 2025
**Context**: Post Phase 1 & 2 refactoring (TreeView.js: 9,610 → 2,651 lines, -72.4%)

---

## 📋 Executive Summary

### What is Phase 3?

Phase 3 is the **Perfect Tree Redesign** - a comprehensive upgrade to the family tree visualization system that transforms the current basic implementation into a world-class, production-ready experience capable of handling 10,000+ nodes at 60fps with advanced features.

This phase focuses on **enabling deferred features** and **fixing known issues** that were intentionally postponed during Phase 1 and Phase 2 refactoring.

### Why is it Needed?

**Current State** (Post-Phase 2):
- ✅ Modular architecture (21 extracted components, 1 hook)
- ✅ Clean codebase (2,651 lines orchestrator)
- ✅ 60fps performance (56 profiles in production)
- ❌ LOD system disabled (known bugs - size jumping, tier thrashing)
- ❌ No progressive loading (loads all 56 profiles at once)
- ❌ Missing advanced features (minimap, focus modes, branch collapse)
- ❌ No theme system (hardcoded Najdi Sadu colors)

**Target State** (Post-Phase 3):
- ✅ LOD system working correctly (smooth tier transitions)
- ✅ Progressive loading enabled (viewport-based queries)
- ✅ Advanced navigation (minimap, quick access, focus modes)
- ✅ Theme system (design tokens, light/dark mode)
- ✅ Enhanced highlighting (ancestry overlay, custom colors)
- ✅ Export capabilities (PNG, PDF with metadata)
- ✅ Ready for 10,000+ nodes at 60fps

### Estimated Effort and Timeline

**Total Effort**: 120-140 hours (17-20 days)

**Timeline Breakdown**:
- **Phase 3A**: LOD System Redesign (30 hours, 4-5 days)
- **Phase 3B**: Progressive Loading (25 hours, 3-4 days)
- **Phase 3C**: Theme System (20 hours, 3 days)
- **Phase 3D**: Advanced Navigation (30 hours, 4-5 days)
- **Phase 3E**: Enhanced Highlighting (15 hours, 2-3 days)
- **Phase 3F**: Testing & Documentation (20 hours, 3 days)

**Risk Level**: MEDIUM (30%)
- Higher than Phase 1/2 due to algorithm changes
- Mitigated by comprehensive testing and incremental rollout

---

## 🗂 Deferred Work Inventory

### From Phase 2 Completion Summary

**Source**: `/PHASE2_HOOK_EXTRACTION_PLAN.md` (lines 370-387)

#### 1. Perfect Tree Redesign (Separate Effort)
- New node layout algorithm
- Viewport-based progressive loading
- Enhanced LOD system

#### 2. Rendering Optimization (If Needed)
- Further optimize edge batching
- Implement connection line pooling

#### 3. State Management (If Complexity Grows)
- Consider Zustand for more state
- Extract complex derived state to selectors

### From Phase 2 Plan - Explicitly Deferred Items

**Source**: `/docs/treeview-refactor/phase2/PHASE2_PLAN.md` (lines 54-82)

#### LOD System Bugs (CRITICAL - Phase 3A)
**Lines 56-60**:
- Size jumping during zoom (T1 ↔ T2 transitions)
- Hysteresis not preventing thrashing
- Scale quantum calculations inconsistent
- **Current Status**: LOD disabled (TEMP comments in TreeView.js:851, 2253, 2290)

#### Layout Algorithm Refactoring (MEDIUM - Phase 3B)
**Lines 62-66**:
- D3 hierarchy complexity in `src/utils/treeLayout.js`
- Collision detection and sibling spacing
- **Current Status**: Works but not optimized for 10K+ nodes

#### Design Token Migration (MEDIUM - Phase 3C)
**Lines 68-70**:
- Hardcoded colors → ThemeTokens system
- Component-specific tokens
- **Current Status**: Using Phase 1 constants

#### Performance Optimization (LOW - Phase 3F)
**Lines 72-75**:
- Memoization of expensive calculations
- Layout algorithm optimization
- Spatial grid tuning
- **Current Status**: Acceptable performance at current scale

#### Ancestry Overlay Feature (HIGH - Phase 3E)
**Lines 77-82**:
- Highlight lineage paths
- Integration points documented
- NodeSizeProvider abstraction ready (Phase 2 Day 3.5)
- **Current Status**: Infrastructure ready, feature not implemented

### From TreeView.js - TEMP Comments

**Source**: `/src/components/TreeView.js`

#### Line 851: LOD Tier Calculation Disabled
```javascript
// TEMP: Disabled LOD tier calculation until Perfect Tree redesign
// const newTier = calculateLODTier(current.scale, tierState.current);
// setTier(newTier);
frameStatsRef.current.tier = 1;
```
**Priority**: CRITICAL
**Phase**: 3A

#### Line 874: Viewport-Based Loading Not Implemented
```javascript
// TODO: Implement viewport-based loading when backend supports it
// This would call profilesService.getVisibleNodes(visibleBounds, scale.value)
```
**Priority**: HIGH
**Phase**: 3B
**Note**: Backend RPC `get_visible_nodes` ALREADY EXISTS (profiles.js:35)

#### Lines 2253-2295: Always Render Tier 1
```javascript
// TEMP: Always T1 until Perfect Tree redesign
const [tier, setTier] = useState(1);
// ...
// TEMP: Always render T1 until Perfect Tree redesign
const renderNodeWithTier = useCallback((node) => {
  // TEMP: Always T1, no tier switching
  const modifiedNode = { ...node, _tier: 1, ... };
```
**Priority**: CRITICAL
**Phase**: 3A

### From Perfect Tree Specification

**Source**: `/docs/PERFECT_TREE_SPECIFICATION.md`

#### Must-Have Features NOT Implemented (Lines 38-76)

**User-Controlled Settings** (Phase 3C):
- ❌ Sibling spacing control (slider: 80-200px)
- ❌ Generation spacing control (slider: 120-240px)
- ❌ Orientation switching (vertical ↔ horizontal)
- ❌ Node shape variations (circle, rounded rect, hexagon)
- ❌ Layout density presets (ultra-compact, normal, spacious)

**Navigation System** (Phase 3D):
- ❌ Minimap (160px overview, tap-to-navigate)
- ❌ Quick access pills (root + 2 main G2 branches)
- ❌ Focus modes (dim, blur, hide non-selected branches)
- ❌ Branch collapse (animated expand/collapse)

**Highlighting System** (Phase 3E):
- ❌ Arbitrary connection highlighting
- ❌ Custom colors per connection
- ❌ Visual effects (glow layers, dashed lines, gradients)
- ❌ Multiple simultaneous highlights (1000+)
- ❌ Preset patterns (ancestry, descendants, siblings)

**Export Capabilities** (Phase 3F - Optional):
- ❌ PNG export with quality presets
- ❌ PDF export with searchable text
- ❌ Scope options (full tree, viewport, selected branch)
- ❌ Content control (with/without photos)

### From LODCalculator.ts - Known Issues

**Source**: `/src/components/TreeView/lod/LODCalculator.ts` (lines 13-18)

```typescript
/**
 * KNOWN ISSUES (Deferred to Phase 3):
 * - Size jumping during zoom (hysteresis not preventing thrashing)
 * - Scale quantum calculations inconsistent
 * - Visual flicker when transitioning between tiers
 *
 * Phase 2 Strategy: Extract AS-IS, preserve bugs, fix in Phase 3
 */
```

**Root Causes Identified**:
1. Hysteresis boundaries too narrow (±15%)
2. Scale quantum too coarse (0.05 = 5% steps)
3. No smooth interpolation between tiers
4. Physical pixel calculation doesn't account for device DPI variations

---

## 📊 Deferred Work Categorization

### CRITICAL Priority (Must Fix in Phase 3)

| Item | Lines Affected | Estimated Effort | Blocker For |
|------|---------------|------------------|-------------|
| LOD System Bugs | TreeView.js:851, 2253, 2290<br>LODCalculator.ts:14-17 | 20 hours | Progressive loading, 10K+ nodes |
| Progressive Loading Backend Integration | TreeView.js:874 | 15 hours | Scaling beyond 1,000 nodes |

**Total**: 35 hours (5 days)

### HIGH Priority (Important for Production)

| Item | Source | Estimated Effort | User Impact |
|------|--------|------------------|-------------|
| Minimap Navigation | Perfect Tree Spec:58 | 12 hours | Major UX improvement |
| Quick Access Pills | Perfect Tree Spec:59 | 8 hours | Major UX improvement |
| Ancestry Overlay Highlighting | Phase2 Plan:77-82 | 10 hours | Key feature request |
| Theme System (Design Tokens) | Phase2 Plan:68-70 | 15 hours | Dark mode support |

**Total**: 45 hours (6-7 days)

### MEDIUM Priority (Nice to Have)

| Item | Source | Estimated Effort | Benefit |
|------|--------|------------------|---------|
| Layout Algorithm Optimization | Phase2 Plan:62-66 | 20 hours | Performance at 10K+ nodes |
| Focus Modes (Dim/Blur/Hide) | Perfect Tree Spec:61 | 10 hours | Visual polish |
| Branch Collapse | Perfect Tree Spec:62 | 12 hours | Large tree navigation |
| User-Controlled Spacing | Perfect Tree Spec:41-42 | 8 hours | Customization |

**Total**: 50 hours (7 days)

### LOW Priority (Future Enhancements)

| Item | Source | Estimated Effort | Reason for Low Priority |
|------|--------|------------------|------------------------|
| Export to PNG/PDF | Perfect Tree Spec:72-76 | 25 hours | Can use screenshots for now |
| Node Shape Variations | Perfect Tree Spec:45 | 15 hours | Design consistency preferred |
| Orientation Switching | Perfect Tree Spec:43 | 20 hours | Vertical layout works well |
| Custom Colors Per Connection | Perfect Tree Spec:66 | 10 hours | Current highlighting sufficient |

**Total**: 70 hours (10 days) - **DEFERRED to Phase 4**

---

## 🏗 Proposed Work Breakdown

### Phase 3A: LOD System Redesign (CRITICAL - 30 hours)

**Goal**: Fix tier thrashing, size jumping, and enable smooth LOD transitions.

#### Problems to Solve
1. **Tier Thrashing**: Hysteresis boundaries too narrow (±15%)
2. **Size Jumping**: Instant tier switches cause visual jarring
3. **Inconsistent Scale Quantum**: 5% steps miss optimal tier boundaries
4. **No Interpolation**: Nodes snap between sizes instead of animating

#### Proposed Solutions

**Solution 1: Widen Hysteresis Boundaries**
```typescript
// Current (LODCalculator.ts:27)
const HYSTERESIS = 0.15; // ±15% hysteresis

// Proposed
const HYSTERESIS = 0.25; // ±25% hysteresis (wider deadzone)
```
**Effort**: 2 hours (update constant, test tier transitions)

**Solution 2: Smoother Scale Quantization**
```typescript
// Current (LODCalculator.ts:26)
const SCALE_QUANTUM = 0.05; // 5% quantization steps

// Proposed
const SCALE_QUANTUM = 0.02; // 2% quantization (finer granularity)
```
**Effort**: 2 hours (update constant, verify no performance regression)

**Solution 3: Animated Tier Transitions**
```typescript
// New utility: src/components/TreeView/lod/TierTransitionAnimator.ts
import { withTiming } from 'react-native-reanimated';

export function animateTierTransition(
  currentTier: LODTier,
  targetTier: LODTier,
  duration: number = 300
): AnimatedValue<LODTier> {
  // Smooth interpolation between tiers
  return withTiming(targetTier, { duration, easing: Easing.inOut(Easing.ease) });
}
```
**Effort**: 12 hours (implement animator, integrate with NodeRenderer, test)

**Solution 4: Tiered Rendering with Opacity Crossfade**
```typescript
// Render both tiers during transition, crossfade opacity
// T1 → T2: T1 opacity 1.0 → 0.0, T2 opacity 0.0 → 1.0 over 300ms
```
**Effort**: 8 hours (implement crossfade, integrate with rendering pipeline)

**Solution 5: Device-Aware Physical Pixel Calculation**
```typescript
// Current (LODCalculator.ts:69)
const nodePx = NODE_WIDTH_WITH_PHOTO * PixelRatio.get() * scale;

// Proposed: Account for device-specific DPI scaling
const deviceScale = Platform.select({
  ios: PixelRatio.get(),
  android: PixelRatio.getFontScale() * PixelRatio.get(),
});
const nodePx = NODE_WIDTH_WITH_PHOTO * deviceScale * scale;
```
**Effort**: 4 hours (test on multiple devices)

**Testing**: 2 hours (verify smooth transitions on iPhone XR, iPad, Android)

**Total Phase 3A**: 30 hours

#### Deliverables
- ✅ LOD tier transitions smooth (no visual jarring)
- ✅ Hysteresis prevents thrashing
- ✅ Scale quantum provides fine-grained control
- ✅ Animated crossfade between tiers
- ✅ TEMP comments removed from TreeView.js (lines 851, 2253, 2290)

---

### Phase 3B: Progressive Loading (HIGH - 25 hours)

**Goal**: Enable viewport-based loading to support 10,000+ nodes without memory issues.

#### Current State
- **Frontend**: All profiles loaded on mount (`loadTreeData()` in useTreeDataLoader.js)
- **Backend**: `get_visible_nodes()` RPC EXISTS (profiles.js:35) but NOT USED
- **TreeView.js:874**: TODO comment for viewport-based loading

#### Backend RPC Analysis
**Source**: `/src/services/profiles.js:33-46`
```javascript
async getVisibleNodes(viewport, zoomLevel = 1.0, limit = 200) {
  const { data, error } = await supabase.rpc("get_visible_nodes", {
    p_viewport: viewport,
    p_zoom_level: zoomLevel,
    p_limit: limit,
  });
  return { data, error: null };
}
```

**Status**: ✅ Backend READY, just needs frontend integration

#### Implementation Plan

**Step 1: Verify Backend RPC** (3 hours)
- Test `get_visible_nodes()` with sample viewport bounds
- Verify returns correct profiles within viewport
- Benchmark query performance (target: <100ms)
- Check pagination works correctly (limit parameter)

**Step 2: Add Viewport Loading Hook** (6 hours)
```typescript
// New hook: src/components/TreeView/hooks/useViewportLoader.ts
export function useViewportLoader({
  visibleBounds,
  currentScale,
  enabled,
}) {
  const [loadedProfiles, setLoadedProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const loadViewport = async () => {
      const { data } = await profilesService.getVisibleNodes(
        visibleBounds,
        currentScale,
        500 // load 500 nodes at a time
      );
      setLoadedProfiles(data);
    };

    loadViewport();
  }, [visibleBounds, currentScale, enabled]);

  return { loadedProfiles, isLoading };
}
```

**Step 3: Integrate with TreeView** (8 hours)
- Add feature flag: `PROGRESSIVE_LOADING_ENABLED` (default: false)
- Modify `loadTreeData()` to conditionally use progressive loading
- Update `syncTransformAndBounds()` to trigger viewport queries
- Debounce viewport changes (500ms) to avoid query spam
- Cache loaded profiles to avoid re-fetching

**Step 4: Handle Edge Cases** (5 hours)
- **Zoom out**: Load parent nodes when viewport expands
- **Zoom in**: Load child nodes when viewport contracts
- **Pan**: Load adjacent nodes before they enter viewport (predictive loading)
- **Initial load**: Load root + 2 generations regardless of viewport

**Step 5: Testing** (3 hours)
- Test with 1,000, 5,000, 10,000 node datasets
- Verify no memory leaks (profile cleanup when out of viewport)
- Verify smooth loading (no visible loading flash)
- Test on slow network (3G simulation)

**Total Phase 3B**: 25 hours

#### Deliverables
- ✅ Progressive loading working with backend RPC
- ✅ Memory usage scales with viewport size (not total tree size)
- ✅ Smooth loading (no UI jank)
- ✅ TODO comment removed from TreeView.js:874
- ✅ Feature flag for gradual rollout

---

### Phase 3C: Theme System (MEDIUM - 20 hours)

**Goal**: Replace hardcoded Najdi Sadu colors with theme tokens, enable dark mode.

#### Current State
- **Colors**: Hardcoded in components (e.g., `#F9F7F3`, `#D1BBA3`)
- **Design System**: Documented in `DESIGN_SYSTEM.md`
- **Theme Folder**: Reserved but empty (`src/components/TreeView/theme/`)

#### Implementation Plan

**Step 1: Create Design Token Registry** (6 hours)
```typescript
// src/components/TreeView/theme/tokens.ts
export const lightTheme = {
  background: {
    primary: '#F9F7F3', // Al-Jass White
    secondary: '#D1BBA3', // Camel Hair Beige
  },
  text: {
    primary: '#242121', // Sadu Night
    secondary: '#A13333', // Najdi Crimson
  },
  tree: {
    nodeFill: '#F9F7F3',
    nodeStroke: '#D1BBA3',
    lineConnection: '#D1BBA3',
    lineHighlight: '#D58C4A', // Desert Ochre
  },
};

export const darkTheme = {
  background: {
    primary: '#1A1918', // Inverted Al-Jass
    secondary: '#3E362E', // Darkened Camel Hair
  },
  text: {
    primary: '#F9F7F3', // Inverted Sadu Night
    secondary: '#E57373', // Lightened Najdi Crimson
  },
  tree: {
    nodeFill: '#2A2725',
    nodeStroke: '#4E4640',
    lineConnection: '#4E4640',
    lineHighlight: '#E5A364', // Lightened Desert Ochre
  },
};
```

**Step 2: Create Theme Store** (4 hours)
```typescript
// src/components/TreeView/theme/useTheme.ts
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

export const useTheme = create((set) => ({
  mode: storage.getString('theme_mode') || 'light',
  tokens: lightTheme,

  setMode: (mode) => {
    storage.set('theme_mode', mode);
    set({ mode, tokens: mode === 'dark' ? darkTheme : lightTheme });
  },
}));
```

**Step 3: Migrate Components to Use Tokens** (8 hours)
- Update NodeRenderer to use `tokens.tree.nodeFill`
- Update ConnectionRenderer to use `tokens.tree.lineConnection`
- Update ShadowRenderer to use `tokens.tree.nodeStroke`
- Update all hardcoded colors in 21 components
- Test visual parity (no visual changes in light mode)

**Step 4: Add Theme Toggle UI** (2 hours)
- Add theme toggle button to TreeNavigation
- Animate theme switch (300ms crossfade)
- Persist user preference

**Total Phase 3C**: 20 hours

#### Deliverables
- ✅ Theme token system working
- ✅ Light and dark mode themes
- ✅ All components use tokens (no hardcoded colors)
- ✅ User can toggle themes
- ✅ Theme preference persisted

---

### Phase 3D: Advanced Navigation (HIGH - 30 hours)

**Goal**: Add minimap, quick access pills, and focus modes for easier navigation.

#### Component Breakdown

**Component 1: Minimap** (12 hours)
```typescript
// src/components/TreeView/navigation/Minimap.tsx
// 160x160px overview of entire tree
// Shows current viewport as rectangle
// Tap to navigate to that area
```
**Features**:
- Renders simplified tree (dots instead of full nodes)
- Shows viewport indicator (draggable)
- Updates in real-time as user pans/zooms
- Positioned in bottom-right corner (iOS style)

**Component 2: Quick Access Pills** (8 hours)
```typescript
// src/components/TreeView/navigation/QuickAccess.tsx
// Shows: Root + 2 main G2 branches as persistent pills
// Tap pill → navigate to that branch
```
**Features**:
- Auto-detect 2 most populated G2 branches
- Pill shows HID + name + descendant count
- Positioned at top of screen (horizontal scroll)
- Animated entrance/exit

**Component 3: Focus Mode** (10 hours)
```typescript
// src/components/TreeView/navigation/FocusMode.tsx
// Modes: Dim, Blur, Hide non-selected branches
```
**Features**:
- **Dim**: Reduce opacity of non-selected nodes to 0.3
- **Blur**: Apply blur filter to non-selected nodes (iOS only)
- **Hide**: Remove non-selected nodes from render
- Toggle via UI button or gesture (3-finger tap)

**Total Phase 3D**: 30 hours

#### Deliverables
- ✅ Minimap with tap-to-navigate
- ✅ Quick access pills for root + G2 branches
- ✅ 3 focus modes (dim, blur, hide)
- ✅ Smooth animations for all features

---

### Phase 3E: Enhanced Highlighting (MEDIUM - 15 hours)

**Goal**: Implement ancestry overlay and advanced highlighting patterns.

#### Implementation Plan

**Step 1: Ancestry Path Calculation** (5 hours)
```typescript
// src/components/TreeView/highlighting/AncestryPathCalculator.ts
export function calculateAncestryPath(
  targetNodeId: string,
  nodesMap: Map<string, LayoutNode>
): string[] {
  // Walk up parent chain to root
  const path = [];
  let current = nodesMap.get(targetNodeId);
  while (current) {
    path.push(current.id);
    current = current.fatherId ? nodesMap.get(current.fatherId) : null;
  }
  return path.reverse();
}
```

**Step 2: Highlight Renderer Enhancement** (6 hours)
- Update HighlightRenderer to support multiple paths
- Add glow effect (3 layers: outer, middle, inner)
- Support custom colors per path
- Animate highlight (pulse effect)

**Step 3: Integration with NodeSizeProvider** (2 hours)
- Use NodeSizeProvider abstraction (created in Phase 2 Day 3.5)
- Enable root prominence (larger root node)
- Enable VIP highlighting (future feature)

**Step 4: UI Controls** (2 hours)
- Add "Show Ancestry" button to profile sheet
- Color picker for custom highlight colors
- Clear highlights button

**Total Phase 3E**: 15 hours

#### Deliverables
- ✅ Ancestry overlay working
- ✅ Multiple simultaneous highlights
- ✅ Custom colors per path
- ✅ Glow effects and animations
- ✅ NodeSizeProvider integration complete

---

### Phase 3F: Testing & Documentation (CRITICAL - 20 hours)

**Goal**: Comprehensive testing and documentation for all Phase 3 work.

#### Testing Plan (12 hours)

**Unit Tests** (4 hours):
- LOD tier calculation with new hysteresis
- Viewport loading pagination
- Theme token retrieval
- Ancestry path calculation

**Integration Tests** (4 hours):
- LOD transitions smooth on physical device
- Progressive loading with 5,000 node dataset
- Theme switching no visual glitches
- Minimap navigation accuracy

**Performance Tests** (4 hours):
- 10,000 node tree renders at 60fps
- Memory usage <50MB with progressive loading
- Viewport query <100ms response time
- Theme switch <16ms (60fps)

#### Documentation (8 hours)

**Documents to Create**:
1. **PHASE3_OVERVIEW.md** (2 hours)
   - What was built, why, and how
   - Design decisions and trade-offs
   - Performance benchmarks

2. **LOD_SYSTEM_V2.md** (2 hours)
   - How the redesigned LOD system works
   - Tier thresholds and hysteresis values
   - Troubleshooting tier thrashing

3. **PROGRESSIVE_LOADING.md** (2 hours)
   - How viewport-based loading works
   - Backend RPC integration
   - Performance characteristics

4. **THEME_SYSTEM.md** (1 hour)
   - Design token architecture
   - How to add new themes
   - How to customize colors

5. **Update CLAUDE.md** (1 hour)
   - Add Phase 3 summary
   - Update TreeView section
   - Add quick reference for new features

**Total Phase 3F**: 20 hours

---

## 🧩 Dependencies & Blockers

### Backend Dependencies

| Feature | Backend Status | Action Required |
|---------|---------------|------------------|
| Progressive Loading | ✅ `get_visible_nodes()` EXISTS | None - just integrate |
| Ancestry Path Highlighting | ✅ Can calculate client-side | None |
| Theme Persistence | ✅ MMKV ready | None |
| Export to PDF | ❌ No backend support | Backend work needed (Phase 4) |

**Blocker Assessment**: ✅ NO BLOCKERS for Phase 3A-E

### Breaking Changes

#### Potential Breaking Changes

1. **LOD System Re-enable**
   - **Impact**: Users will see tier transitions (currently disabled)
   - **Mitigation**: Feature flag for gradual rollout
   - **Rollback**: Set `LOD_ENABLED = false`

2. **Progressive Loading**
   - **Impact**: Initial tree load behavior changes
   - **Mitigation**: Feature flag, load root + 2 generations always
   - **Rollback**: Disable `PROGRESSIVE_LOADING_ENABLED`

3. **Theme System**
   - **Impact**: Color values change if components not updated correctly
   - **Mitigation**: Comprehensive visual regression testing
   - **Rollback**: Revert to hardcoded colors

#### Non-Breaking Changes
- Minimap (additive feature)
- Quick access pills (additive feature)
- Focus modes (additive feature)
- Enhanced highlighting (additive feature)

### Testing Requirements

#### Required Test Devices
- iPhone XR (primary test device)
- iPad Pro 11" (large screen testing)
- Android phone (cross-platform verification)

#### Required Test Datasets
- 56 profiles (current production)
- 1,000 profiles (realistic growth)
- 5,000 profiles (target capacity)
- 10,000 profiles (stress test)

#### Performance Benchmarks
- Layout time <200ms for 5K nodes
- Memory usage <50MB for 10K nodes
- FPS >57fps during pan/zoom (5% tolerance from 60fps)
- Viewport query <100ms response time

---

## ⚠️ Risk Assessment

### What Could Go Wrong?

#### Risk 1: LOD Tier Transitions Still Janky (30% probability)
**Impact**: HIGH - Users complain about visual artifacts
**Mitigation**:
- Test on multiple devices (iPhone, Android)
- Adjust hysteresis/quantum values iteratively
- Add feature flag to disable if critical issues arise
**Rollback**: Disable LOD system (set `LOD_ENABLED = false`)

#### Risk 2: Progressive Loading Memory Leaks (20% probability)
**Impact**: CRITICAL - App crashes on large trees
**Mitigation**:
- Comprehensive memory profiling with React DevTools
- Test with 10K node dataset
- Implement profile cleanup when out of viewport
**Rollback**: Disable progressive loading, revert to full tree load

#### Risk 3: Theme System Color Mismatches (15% probability)
**Impact**: MEDIUM - UI looks broken in dark mode
**Mitigation**:
- Visual regression testing (screenshot comparison)
- Manual review of all 21 components
- Start with light mode only, add dark mode after validation
**Rollback**: Revert to hardcoded colors

#### Risk 4: Backend RPC Performance Issues (10% probability)
**Impact**: HIGH - Viewport queries take >500ms
**Mitigation**:
- Benchmark `get_visible_nodes()` before integration
- Add query timeout (500ms max)
- Cache viewport results client-side
**Rollback**: Disable progressive loading

#### Risk 5: Advanced Navigation UX Confusion (25% probability)
**Impact**: LOW - Users don't understand new features
**Mitigation**:
- Add onboarding tooltips
- Create video tutorial
- A/B test with admin team before public rollout
**Rollback**: Hide advanced navigation features

### Overall Risk Score: 30% (MEDIUM)

**Mitigation Summary**:
- ✅ Feature flags for all major changes
- ✅ Comprehensive testing on multiple devices
- ✅ Rollback plan for each feature
- ✅ Incremental rollout (admin team → public)
- ✅ Performance monitoring with clear thresholds

---

## 🎯 Recommendation

### Should Phase 3 Be Started Now?

**YES** - Start Phase 3A and 3B now, defer 3C-E to later.

**Reasoning**:
1. **LOD system bugs** are blocking scaling beyond 1,000 nodes
2. **Progressive loading** is critical for production (family growing)
3. **Backend RPC ready** - no blockers for implementation
4. **Clean architecture** from Phase 1/2 makes integration safe
5. **Theme system and advanced navigation** can wait (nice-to-have)

### If Started, What's the Recommended Sequence?

#### Week 1-2: Critical Path (Phase 3A + 3B)
**Days 1-5**: Phase 3A - LOD System Redesign (30 hours)
- Fix tier thrashing and size jumping
- Enable smooth LOD transitions
- Remove TEMP comments from TreeView.js

**Days 6-9**: Phase 3B - Progressive Loading (25 hours)
- Integrate `get_visible_nodes()` backend RPC
- Add viewport loading hook
- Test with 5,000 and 10,000 node datasets

**Milestone**: Tree supports 10,000+ nodes at 60fps

#### Week 3: High Priority Features (Phase 3D + 3E)
**Days 10-13**: Phase 3D - Advanced Navigation (30 hours)
- Implement minimap
- Add quick access pills
- Add focus modes

**Days 14-15**: Phase 3E - Enhanced Highlighting (15 hours)
- Implement ancestry overlay
- Add custom highlight colors

**Milestone**: Production-ready UX for large trees

#### Week 4: Polish & Testing (Phase 3C + 3F)
**Days 16-18**: Phase 3C - Theme System (20 hours)
- Create design token registry
- Implement dark mode
- Migrate all components to use tokens

**Days 19-21**: Phase 3F - Testing & Documentation (20 hours)
- Comprehensive testing (unit, integration, performance)
- Write documentation (5 markdown files)
- Update CLAUDE.md

**Milestone**: Phase 3 complete, ready for production

### If Deferred, What Are the Criteria for Starting?

**Defer Phase 3 if**:
- Current tree size remains <500 nodes (progressive loading not needed)
- No user complaints about LOD bugs (low priority)
- Team busy with higher-priority features (permission system, etc.)

**Start Phase 3 when**:
1. **Tree size exceeds 500 nodes** (progressive loading becomes necessary)
2. **Users complain about performance** (LOD bugs causing issues)
3. **Admin team requests dark mode** (theme system becomes priority)
4. **Large families join** (10,000+ node support needed)

**Trigger Metrics**:
- Tree load time >3 seconds (currently <1 second)
- Memory usage >100MB (currently ~15MB)
- User complaints about "jumpy zoom"
- Request for dark mode from 5+ users

---

## 📈 Success Criteria

### Phase 3A: LOD System Redesign
- [ ] Tier transitions smooth (no size jumping)
- [ ] Hysteresis prevents thrashing (no rapid tier switching)
- [ ] Visual regression test passes (nodes look identical)
- [ ] Performance: Tier calculation <5ms
- [ ] TEMP comments removed from TreeView.js

### Phase 3B: Progressive Loading
- [ ] Viewport loading working with backend RPC
- [ ] Memory usage <50MB for 10,000 nodes
- [ ] Viewport query <100ms response time
- [ ] Smooth loading (no UI jank)
- [ ] TODO comment removed from TreeView.js:874

### Phase 3C: Theme System
- [ ] Light and dark mode themes implemented
- [ ] All 21 components use design tokens
- [ ] Theme toggle working with 300ms animation
- [ ] No visual regressions in light mode
- [ ] Theme preference persisted

### Phase 3D: Advanced Navigation
- [ ] Minimap shows entire tree with viewport indicator
- [ ] Quick access pills navigate to root + G2 branches
- [ ] 3 focus modes working (dim, blur, hide)
- [ ] All animations smooth (60fps)

### Phase 3E: Enhanced Highlighting
- [ ] Ancestry overlay highlights path to root
- [ ] Multiple simultaneous highlights supported
- [ ] Custom colors per highlight
- [ ] Glow effects render correctly
- [ ] NodeSizeProvider integration complete

### Phase 3F: Testing & Documentation
- [ ] All unit tests pass (30+ new tests)
- [ ] Integration tests pass on physical devices
- [ ] Performance benchmarks met (60fps, <50MB memory)
- [ ] 5 documentation files created
- [ ] CLAUDE.md updated with Phase 3 summary

---

## 🔄 Rollback Strategy

### Per-Feature Rollback

| Feature | Rollback Method | Estimated Time |
|---------|----------------|----------------|
| LOD System | Set `LOD_ENABLED = false` in LODCalculator.ts | 5 minutes |
| Progressive Loading | Set `PROGRESSIVE_LOADING_ENABLED = false` | 5 minutes |
| Theme System | Revert to hardcoded colors in components | 2 hours |
| Advanced Navigation | Hide components via feature flags | 10 minutes |
| Enhanced Highlighting | Disable rendering via feature flag | 5 minutes |

### Full Phase 3 Rollback

**If Phase 3 causes critical issues**:
1. Revert to Phase 2 git tag: `checkpoint/phase2-complete`
2. Restore TreeView.js from Phase 2 (2,651 lines)
3. Disable all Phase 3 feature flags
4. Notify users of temporary rollback

**Estimated Rollback Time**: 30 minutes

---

## 📚 Appendix

### Related Documentation

- [Perfect Tree Specification](/docs/PERFECT_TREE_SPECIFICATION.md)
- [Phase 2 Hook Extraction Plan](/PHASE2_HOOK_EXTRACTION_PLAN.md)
- [Phase 2 Plan](/docs/treeview-refactor/phase2/PHASE2_PLAN.md)
- [Design System](/docs/DESIGN_SYSTEM.md)
- [Backend Summary](/docs/backend/backend-summary.md)

### Code References

**LOD System**:
- `/src/components/TreeView/lod/LODCalculator.ts` (lines 13-18: known issues)
- `/src/components/TreeView.js` (lines 851, 2253, 2290: TEMP comments)

**Progressive Loading**:
- `/src/services/profiles.js` (lines 33-46: `getVisibleNodes()`)
- `/src/components/TreeView.js` (line 874: TODO comment)

**Theme System**:
- `/docs/DESIGN_SYSTEM.md` (Najdi Sadu color palette)
- `/src/components/TreeView/theme/` (reserved folder, empty)

**Advanced Navigation**:
- `/docs/PERFECT_TREE_SPECIFICATION.md` (lines 57-62: navigation features)

**Backend RPC**:
- `/docs/backend/backend-summary.md` (lines 45-46: `get_visible_nodes()`)

### Metrics Tracking

**Before Phase 3** (Current State):
- TreeView.js: 2,651 lines
- Tree load time: ~800ms (56 profiles)
- Memory usage: ~15MB
- FPS: 60fps sustained
- LOD system: Disabled

**After Phase 3** (Target State):
- TreeView.js: ~2,800 lines (slight increase for new features)
- Tree load time: ~1,500ms (5,000 profiles), ~2,000ms (10,000 profiles)
- Memory usage: ~50MB max (with progressive loading)
- FPS: 60fps sustained (10,000 nodes)
- LOD system: Enabled and smooth

---

**End of Phase 3 Plan**

**Next Steps**:
1. Review this plan with team
2. Prioritize Phase 3A and 3B for immediate start
3. Create detailed day-by-day implementation plan for 3A
4. Begin LOD system redesign

**Questions for Discussion**:
1. Should we start Phase 3A immediately or wait?
2. Is progressive loading critical for current roadmap?
3. Should theme system be prioritized over advanced navigation?
4. What is the target timeline for Phase 3 completion?
