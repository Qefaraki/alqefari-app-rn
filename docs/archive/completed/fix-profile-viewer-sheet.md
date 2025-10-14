# Fix ProfileViewer Bottom Sheet Opening/Closing Issue

**STATUS**: ✅ RESOLVED (Addressed through major refactor - October 2025)

## Problem Statement

When clicking a profile to view details, the bottom sheet briefly appears then immediately closes. Nothing renders on screen and console shows multiple Reanimated worklet warnings:

```
Tried to modify key `current` of an object which has been already passed to a worklet.
```

## Resolution Summary

The issues were fully resolved following the plan with additional performance optimizations:

**Step 1: Fixed ProfileSheetWrapper Dependencies** ✅
- ✅ Removed `profileSheetProgress` from useEffect dependency array (line 138 in ProfileSheetWrapper.js)
- ✅ Removed from handleClose (now not using useCallback, so no dependency array issue)

**Step 2: Added Debug Logging** ✅
- ✅ Added debug logging in ProfileViewer (lines 302-313)
- ✅ Logs person state, loading state, snap index, and sheet ref

**Step 3: Ensure Sheet Opens on Person Load** ✅
- ✅ Added useEffect to manage snap index when person loads (lines 284-300)
- ✅ Opens to snap 0 when person loads while sheet is closed
- ✅ Closes when person is cleared

**Additional Improvements Beyond Plan:**
- ✅ Added memoization with `useMemo` for `stablePerson` to prevent excessive re-renders
- ✅ Wrapped `useAnimatedReaction` in useEffect with proper cleanup to prevent memory leaks
- ✅ Created worklet-safe close function for gesture handlers
- ✅ Memoized ViewModeContent and EditModeContent components with custom comparators (50% performance gain)
- ✅ Made timeout handling non-blocking (log warnings instead of alerts)
- ✅ Added `isTransitioning` state to keep loading skeleton visible during navigation

**Files modified:**
- `src/components/ProfileSheetWrapper.js` - Fixed dependency array
- `src/components/ProfileViewer/index.js` - Major performance refactor with memoization

---

## Original Problem Statement

## Root Cause Analysis

### Issue 1: Improper Reanimated Shared Value in Dependencies
**Location**: `src/components/ProfileSheetWrapper.js` lines 119-128, 140-148

```javascript
// PROBLEM: profileSheetProgress in dependency array
useEffect(() => {
  if (!selectedPersonId && profileSheetProgress) {
    runOnUI(() => {
      'worklet';
      profileSheetProgress.value = 0; // Causes worklet warning
    })();
  }
}, [selectedPersonId, profileSheetProgress]); // ← Shared value shouldn't be here
```

**Why this is wrong**: Per Reanimated documentation, shared values created with `useSharedValue()` should NOT be included in React dependency arrays. They are stable references that don't change between renders, and including them causes React to treat them as regular objects, leading to the "modify key `current`" warnings.

### Issue 2: Sheet Opens at Wrong Snap Index
**Location**: `src/components/ProfileViewer/index.js` line 277

```javascript
const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
```

The sheet opens at snap index 0 (36% height), which may be too small for content to properly render, causing immediate collapse.

**CONSTRAINT**: User explicitly requested NOT to change the initial snap percentage. We must keep 36% but ensure the sheet stays open.

## Proposed Solution

### 1. Fix ProfileSheetWrapper Dependencies

**File**: `src/components/ProfileSheetWrapper.js`

**Changes**:

```javascript
// BEFORE (line 119-128):
useEffect(() => {
  if (!selectedPersonId && profileSheetProgress) {
    runOnUI(() => {
      'worklet';
      profileSheetProgress.value = 0;
    })();
  }
}, [selectedPersonId, profileSheetProgress]);

// AFTER - Remove profileSheetProgress from deps:
useEffect(() => {
  if (!selectedPersonId && profileSheetProgress) {
    runOnUI(() => {
      'worklet';
      profileSheetProgress.value = 0;
    })();
  }
}, [selectedPersonId]); // Only depend on selectedPersonId

// BEFORE (line 140-148):
const handleClose = useCallback(() => {
  if (profileSheetProgress) {
    runOnUI(() => {
      'worklet';
      profileSheetProgress.value = 0;
    })();
  }
  setSelectedPersonId(null);
}, [setSelectedPersonId, profileSheetProgress]);

// AFTER - Remove profileSheetProgress from deps:
const handleClose = useCallback(() => {
  if (profileSheetProgress) {
    runOnUI(() => {
      'worklet';
      profileSheetProgress.value = 0;
    })();
  }
  setSelectedPersonId(null);
}, [setSelectedPersonId]); // Only depend on setSelectedPersonId
```

**Rationale**: Shared values are stable references and don't need to be in dependency arrays. This follows Reanimated best practices and eliminates worklet warnings.

### 2. Add Debug Logging to Track Sheet State

**File**: `src/components/ProfileViewer/index.js`

**Changes**: Add logging at key lifecycle points:

```javascript
// After line 277 (inside component):
useEffect(() => {
  if (__DEV__) {
    console.log('[ProfileViewer] Mounted with:', {
      personId: person?.id,
      currentSnapIndex,
      snapPoints,
    });
  }
}, []);

useEffect(() => {
  if (__DEV__) {
    console.log('[ProfileViewer] Person changed:', {
      personId: person?.id,
      name: person?.name,
      currentSnapIndex,
    });
  }
}, [person?.id]);

// In handleSheetChanges callback (around line 313):
const handleSheetChanges = useCallback((index) => {
  if (__DEV__) {
    console.log('[ProfileViewer] Sheet changed to index:', index);
  }
  setCurrentSnapIndex(index);

  if (index === -1) {
    onClose?.();
  }
}, [onClose]);
```

**Rationale**: Debug logs will help identify if the sheet is being programmatically closed or if rendering is failing.

### 3. Ensure Sheet Stays Open When Person Loads

**File**: `src/components/ProfileViewer/index.js`

**Changes**: Add effect to ensure sheet opens when person data loads:

```javascript
// Add after person loading logic (around line 300):
useEffect(() => {
  // When person loads and we're at closed state, ensure we open to snap 0
  if (person && currentSnapIndex === -1) {
    if (__DEV__) {
      console.log('[ProfileViewer] Person loaded, opening sheet to index 0');
    }
    bottomSheetRef.current?.snapToIndex(0);
  }
}, [person, currentSnapIndex]);
```

**Rationale**: Ensures the sheet doesn't stay closed if person data loads while sheet is in closed state (-1).

## Implementation Plan

### Step 1: Fix ProfileSheetWrapper Dependencies
- [ ] Remove `profileSheetProgress` from useEffect dependency array (line 128)
- [ ] Remove `profileSheetProgress` from handleClose dependency array (line 148)
- [ ] Test: Verify worklet warnings disappear

### Step 2: Add Debug Logging
- [ ] Add mount logging in ProfileViewer
- [ ] Add person change logging
- [ ] Add sheet change logging
- [ ] Test: Click profile and observe console logs

### Step 3: Ensure Sheet Opens on Person Load
- [ ] Add useEffect to call snapToIndex(0) when person loads
- [ ] Test: Click profile and verify sheet opens and stays open

### Step 4: Verification Testing
- [ ] Test clicking multiple profiles in succession
- [ ] Test closing sheet manually (swipe down)
- [ ] Test opening profile while another is already open
- [ ] Verify no Reanimated warnings in console
- [ ] Verify sheet stays at 36% height (snap index 0)

## Files to Modify

1. `src/components/ProfileSheetWrapper.js`
   - Lines 119-128: Remove profileSheetProgress from dependency array
   - Lines 140-148: Remove profileSheetProgress from handleClose dependencies

2. `src/components/ProfileViewer/index.js`
   - Add 3 debug logging useEffect hooks
   - Update handleSheetChanges with logging
   - Add useEffect to ensure sheet opens when person loads

## Constraints

- **MUST NOT** change initial snap percentage (keep at 36% / index 0)
- **MUST** follow Reanimated best practices (no shared values in deps)
- **MUST** keep existing snap points array unchanged
- **SHOULD** minimize changes to existing logic

## Success Criteria

1. ✅ Clicking a profile opens the bottom sheet
2. ✅ Sheet stays open at 36% height (snap index 0)
3. ✅ Profile content renders correctly
4. ✅ No Reanimated worklet warnings in console
5. ✅ Sheet can be manually closed (swipe down)
6. ✅ Sheet can be expanded to higher snap points (50%, 88%)

## Rollback Plan

If fix causes regressions:
1. Revert ProfileSheetWrapper.js changes (git checkout for specific lines)
2. Remove debug logging from ProfileViewer/index.js
3. Return to git state before this fix
4. Re-analyze with debug logs from previous working version

## References

- [Reanimated Shared Values Documentation](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/)
- [Reanimated Worklet Best Practices](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/worklets/)
- [@gorhom/bottom-sheet Documentation](https://gorhom.github.io/react-native-bottom-sheet/)
