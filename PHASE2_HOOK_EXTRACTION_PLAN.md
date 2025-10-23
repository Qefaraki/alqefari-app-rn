# Phase 2: Custom Hook Extraction Plan

**Status**: Phase 1 Complete (2,975 → 2,939 lines)
**Goal**: Extract 5 custom hooks (~530 lines) → Target: ~2,400 lines
**Risk**: MEDIUM (preserve hook order, shared values)

---

## Hook 1: useTreeDataLoader (~200 lines)

**Location**: Lines 614-840 in TreeView.js
**Target File**: `src/components/TreeView/hooks/useTreeDataLoader.js`

### Extracts:
- `loadTreeData()` function (lines 614-796)
- `handleRetry()` function (lines 798-801)
- Related useEffects (lines 804-840)
- Supabase subscription logic (lines 842-910)

### Dependencies (props/state to pass in):
- `setTreeData` (from TreeView state)
- `setIsLoading` (from TreeView state)
- `setNetworkError` (from TreeView state)
- `setShowSkeleton` (from TreeView state)
- `setIsRetrying` (from TreeView state)
- `skeletonFadeAnim` (RNAnimated value)
- `contentFadeAnim` (RNAnimated value)
- `settingsRef` (for calendar preference)
- `treeData` (from Zustand store)

### Returns:
```javascript
{
  loadTreeData: () => Promise<void>,
  handleRetry: () => Promise<void>,
  isLoading: boolean,
  networkError: string | null,
  isRetrying: boolean
}
```

### Implementation:
```javascript
export function useTreeDataLoader({
  setTreeData,
  setIsLoading,
  setNetworkError,
  setShowSkeleton,
  setIsRetrying,
  skeletonFadeAnim,
  contentFadeAnim,
  settingsRef
}) {
  const loadTreeData = async () => {
    // ... existing implementation (lines 614-796)
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await loadTreeData();
  };

  // Load tree on mount
  useEffect(() => {
    loadTreeData();
  }, []);

  // Real-time subscription
  useEffect(() => {
    // ... subscription logic (lines 842-910)
  }, []);

  return { loadTreeData, handleRetry };
}
```

---

## Hook 2: useGestureController (~150 lines)

**Location**: Lines 1996-2150 in TreeView.js
**Target File**: `src/components/TreeView/hooks/useGestureController.js`

### Extracts:
- Gesture callback definitions (lines 1996-2050)
- `createComposedGesture()` logic (lines 2120-2150)
- Pan/pinch/tap gesture setup

### Dependencies:
- `translateX`, `translateY`, `scale` (Reanimated shared values)
- `nodeFramesRef` (hit detection)
- `selectedPersonId` state
- Gesture callbacks (`onNodeTap`, `onBackgroundTap`, etc.)

### Returns:
```javascript
{
  composedGesture: GestureType,
  panGesture: GestureType,
  pinchGesture: GestureType,
  tapGesture: GestureType
}
```

---

## Hook 3: useAdminFeatures (~100 lines)

**Location**: Lines scattered (admin mode logic)
**Target File**: `src/components/TreeView/hooks/useAdminFeatures.js`

### Extracts:
- `quickAddOverlayState` management
- `showRightClickMenu` state
- `rightClickMenuPosition` state
- Admin mode toggle handlers
- Context menu show/hide

### Dependencies:
- `profile` (user profile)
- `isAdminMode` (from TreeView)

### Returns:
```javascript
{
  quickAddOverlayState: object | null,
  setQuickAddOverlayState: (state) => void,
  showRightClickMenu: boolean,
  setShowRightClickMenu: (show) => void,
  rightClickMenuPosition: { x, y },
  setRightClickMenuPosition: (pos) => void
}
```

---

## Hook 4: useSelectionState (~80 lines)

**Location**: Lines with `selectedPersonId` logic
**Target File**: `src/components/TreeView/hooks/useSelectionState.js`

### Extracts:
- `selectedPersonId` state
- `handleNodeSelect` function
- Selection highlight coordination

### Dependencies:
- `onPersonSelect` callback (from props)
- `highlightService` configuration

### Returns:
```javascript
{
  selectedPersonId: string | null,
  handleNodeSelect: (personId) => void,
  clearSelection: () => void
}
```

---

## Hook 5: useViewportCalculations (~100 lines)

**Location**: Lines with viewport/culling logic
**Target File**: `src/components/TreeView/hooks/useViewportCalculations.js`

### Extracts:
- Viewport bounds calculation
- Culling logic coordination with SpatialGrid
- LOD tier management coordination
- Visible nodes filtering

### Dependencies:
- `translateX`, `translateY`, `scale` (Reanimated shared values)
- `{ width, height }` (window dimensions)
- `layout` (calculated tree layout)

### Returns:
```javascript
{
  viewportBounds: { minX, maxX, minY, maxY },
  visibleNodes: LayoutNode[],
  lodTierState: Map<string, number>
}
```

---

## Implementation Order

### Day 10a (2 hours): Extract useTreeDataLoader
1. Create `src/components/TreeView/hooks/useTreeDataLoader.js`
2. Move `loadTreeData` function + useEffects
3. Update TreeView.js to use the hook
4. Test tree loading

### Day 10b (2 hours): Extract useGestureController
1. Create `src/components/TreeView/hooks/useGestureController.js`
2. Move gesture setup logic
3. Update TreeView.js to use the hook
4. Test gestures (pan, pinch, tap)

### Day 11a (1.5 hours): Extract useAdminFeatures
1. Create `src/components/TreeView/hooks/useAdminFeatures.js`
2. Move admin state management
3. Update TreeView.js to use the hook
4. Test admin mode

### Day 11b (1.5 hours): Extract useSelectionState
1. Create `src/components/TreeView/hooks/useSelectionState.js`
2. Move selection logic
3. Update TreeView.js to use the hook
4. Test selection

### Day 12 (2 hours): Extract useViewportCalculations
1. Create `src/components/TreeView/hooks/useViewportCalculations.js`
2. Move viewport/culling logic
3. Update TreeView.js to use the hook
4. Test viewport culling + LOD

---

## Testing Checklist

After each hook extraction:
- [ ] App launches without crashes
- [ ] Tree loads 2,400+ profiles
- [ ] Zoom in/out works (LOD transitions)
- [ ] Pan gesture works
- [ ] Tap to select works
- [ ] Long-press context menu (admin)
- [ ] Search and navigation works
- [ ] Real-time sync works
- [ ] Admin features work
- [ ] No console errors

---

## Commit Strategy

Commit after each hook extraction:
```
feat(tree): Extract useTreeDataLoader hook (200 lines)
feat(tree): Extract useGestureController hook (150 lines)
feat(tree): Extract useAdminFeatures hook (100 lines)
feat(tree): Extract useSelectionState hook (80 lines)
feat(tree): Extract useViewportCalculations hook (100 lines)
```

Final commit:
```
refactor(tree): Phase 2 complete - extract 5 custom hooks

- useTreeDataLoader: Tree loading + Supabase subscriptions
- useGestureController: Pan/pinch/tap gesture management
- useAdminFeatures: Admin mode state + overlays
- useSelectionState: Node selection + highlighting
- useViewportCalculations: Viewport bounds + culling

TreeView.js: 2,939 → ~2,400 lines (-539 lines, -18.3%)

Total extraction: 6,635 lines (modules) + 539 lines (hooks) = 7,174 lines
Remaining TreeView: ~2,400 lines (orchestrator)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Notes for Next Session

**Context**: We're in Phase 2 of Perfect Tree refactoring. We've already extracted 18 rendering/spatial/interaction components (6,635 lines). TreeView.js is currently 2,939 lines after Phase 1 cleanup (removed 36 lines of dead code).

**Current Branch**: `refactor/treeview-cleanup-safe-20251024`

**Next Steps**: Extract the 5 custom hooks listed above to reduce TreeView.js to ~2,400 lines.

**Why This Works**: The components ARE extracted and being used. What remains is the orchestrator logic that USES those components. Extracting custom hooks will further reduce the orchestration code while maintaining the same functionality.

**Estimated Time**: 8-10 hours total for all 5 hooks + testing
