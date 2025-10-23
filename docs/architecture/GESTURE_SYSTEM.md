# 🎯 Gesture System Architecture

**Status**: ✅ Complete (October 2025) - Fully extracted and tested

The TreeView gesture system has been refactored into a modular, testable architecture using extracted components and callback patterns.

## Gesture Flow

```
User Touch → GestureHandler → Callbacks → Business Logic
                     ↓
              HitDetection (coordinate mapping)
                     ↓
              TreeView (state updates, UI changes)
```

## Core Modules

### `src/components/TreeView/interaction/GestureHandler.ts`
Exports gesture creation functions with callback pattern:
- `createPanGesture(sharedValues, callbacks, config)` - Pan with momentum decay
- `createPinchGesture(sharedValues, callbacks, config)` - Pinch with anchored zoom
- `createTapGesture(callbacks, config)` - Tap selection with thresholds
- `createLongPressGesture(callbacks, config)` - Long-press admin actions
- `createComposedGesture(sharedValues, callbacks, config)` - Combined gestures

**Key Features:**
- Momentum decay: 0.998 deceleration rate
- Zoom limits: min 0.3, max 8.0
- Tap thresholds: 10px max distance, 250ms max duration
- Long press: 500ms min duration

### `src/components/TreeView/interaction/HitDetection.ts`
Coordinate-to-node mapping with LOD support:
- `detectChipTap(x, y, context, aggregationEnabled)` - T3 mode chip detection
- `detectNodeTap(x, y, context, dimensions)` - T1/T2 mode node detection
- `detectTap(x, y, context, aggregationEnabled, dimensions)` - Combined detection

**Key Features:**
- Screen-to-canvas coordinate transformation
- T3 chip priority over nodes (aggregation mode)
- Dynamic node dimensions (root: 120x100, photo: 85x90, text: 60x35)
- Root chip scaling (1.3x vs 1.0x normal)

## Usage in TreeView.js

```javascript
// 1. Create shared values object
const gestureSharedValues = {
  scale, translateX, translateY,
  savedScale, savedTranslateX, savedTranslateY,
  isPinching, initialFocalX, initialFocalY,
};

// 2. Create callbacks object (memoized for performance)
const gestureCallbacks = useMemo(() => ({
  onGestureEnd: () => {
    syncTransformAndBounds();
  },
  onTap: (x, y) => {
    syncTransformAndBounds();
    const result = detectTap(x, y, gestureStateRef.current, ...);
    if (result?.type === 'chip') handleChipTap(result.hero);
    else if (result?.type === 'node') handleNodeTap(result.nodeId);
  },
  onLongPress: (x, y) => {
    // Admin permission check + QuickAdd logic
  },
}), [dependencies]);

// 3. Create config object
const gestureConfig = {
  decelerationRate: 0.995,
  minZoom: 0.3,
  maxZoom: 8.0,
};

// 4. Create composed gesture
const composed = createComposedGesture(
  gestureSharedValues,
  gestureCallbacks,
  gestureConfig
);

// 5. Apply to GestureDetector
<GestureDetector gesture={composed}>
  {/* Tree content */}
</GestureDetector>
```

## Test Coverage

**134 comprehensive tests** across 3 test files:
- `GestureHandler.test.js` - 33 tests (pan, pinch, tap, longPress, composed)
- `SelectionHandler.test.js` - 38 tests (node selection, chip selection, admin mode)
- `HitDetection.test.js` - 63 tests (chip detection, node detection, coordinates)

**Pass Rate**: 100% (134/134)

## Critical Patterns

1. **Transform Synchronization**: Always call `syncTransformAndBounds()` BEFORE hit detection
2. **Callback Memoization**: Wrap `gestureCallbacks` in `useMemo` with dependencies
3. **Coordinate Transformation**: Screen → Canvas via `(x - translateX) / scale`
4. **Chip Priority**: In T3 mode, check chips first before nodes
5. **Admin Permissions**: Long-press only for admin/super_admin/moderator roles

## Performance Optimizations

- ✅ Memoized callbacks (prevents gesture recreation on render)
- ✅ Worklet optimization (gesture handlers run on UI thread)
- ✅ Momentum decay (smooth pan deceleration)
- ✅ Animation cancellation (prevents value drift)
- ✅ Focal point anchoring (stable zoom center)

## Source Files

**Source:**
- `src/components/TreeView/interaction/GestureHandler.ts` (9.5KB)
- `src/components/TreeView/interaction/HitDetection.ts` (7.9KB)
- `src/components/TreeView/interaction/SelectionHandler.ts` (7.4KB)

**Tests:**
- `tests/components/TreeView/interaction/GestureHandler.test.js`
- `tests/components/TreeView/interaction/HitDetection.test.js`
- `tests/components/TreeView/interaction/SelectionHandler.test.js`

## Recent Refactoring (October 2025)

**5-Phase Extraction:**
- Phase 0: Infrastructure (FontProvider, ParagraphCacheProvider)
- Phase 1: Hit Detection Extraction
- Phase 2: Pan/Pinch Replacement
- Phase 3: Tap Gesture Replacement
- Phase 4: Long Press Replacement
- Phase 5: Composed Gesture Replacement

**Critical Fixes:**
- Signature mismatch in createComposedGesture
- useMemo optimization for gestureCallbacks
- React Hooks order compliance (FontProvider)

**Impact:**
- Reduced TreeView.js by ~290 lines
- Improved testability (134 tests vs 0 before)
- Zero regressions maintained
- Production-ready ✅
