# Phase 3B Progressive Loading - Test Plan

## Overview
Complete testing protocol for two-phase loading strategy (0.45 MB structure + progressive enrichment).

**Implementation Status**: Days 1-3 Complete
- ✅ Day 1-2: Backend RPC + Service methods + Hooks created
- ✅ Day 3: TreeView.js integration with feature flag
- ⏳ Day 4: Testing (THIS DOCUMENT)

---

## Test Environment Setup

### Prerequisites
- [ ] Expo dev server running (`npm start`)
- [ ] iOS simulator or physical device
- [ ] React Native Debugger or Console access for logs
- [ ] Feature flag accessible: `USE_PROGRESSIVE_LOADING` in TreeView.js

### Test Modes
1. **Traditional Mode** (baseline): `USE_PROGRESSIVE_LOADING = false`
2. **Progressive Mode** (new): `USE_PROGRESSIVE_LOADING = true`

---

## Phase 1: Structure Loading Tests

### 1.1 Structure Load Time (Progressive Mode)
**Objective**: Verify Phase 1 loads 0.45 MB in <500ms

**Steps**:
1. Set `USE_PROGRESSIVE_LOADING = true`
2. Hard-restart app (clear cache)
3. Monitor console output for:
   - `📦 [Phase 1] Loading tree structure...`
   - `✅ [Phase 1] Structure loaded: X profiles (Y MB) in Zms`
4. Verify load time < 500ms
5. Verify data size ≈ 0.45 MB (158 bytes/profile)

**Expected Output**:
```
📦 [Phase 1] Loading tree structure...
✅ [Phase 1] Structure loaded: 2850 profiles (0.45 MB) in 350ms
```

**Pass Criteria**:
- [ ] Load time < 500ms
- [ ] Data size ≈ 0.45 MB
- [ ] No network errors
- [ ] Cache working on second app load (instant)

---

### 1.2 Structure Caching
**Objective**: Verify cached structure loads instantly

**Steps**:
1. App loaded once (structure cached)
2. Restart app (don't clear cache)
3. Verify console shows:
   - `🚀 [Phase 1] Using cached structure`
4. Measure load time (should be <50ms)

**Expected Output**:
```
🚀 [Phase 1] Using cached structure
```

**Pass Criteria**:
- [ ] Cached load < 50ms
- [ ] Proceeds immediately to Phase 2

---

## Phase 2: Layout Calculation Tests

### 2.1 Layout Calculation Performance
**Objective**: Verify d3-hierarchy layout calculates once in ~350ms

**Steps**:
1. Monitor console for:
   - `📐 [Phase 2] Calculating layout for X nodes...`
   - `✅ [Phase 2] Layout calculated in Yms`
2. Verify timing ~350ms for ~2850 nodes
3. Verify no jumps during calculation (nodes appear instantly)

**Expected Output**:
```
📐 [Phase 2] Calculating layout for 2850 nodes...
✅ [Phase 2] Layout calculated in 347ms
```

**Pass Criteria**:
- [ ] Layout time 300-400ms (tolerance: ±100ms)
- [ ] Single calculation (not recalculated on Phase 3)
- [ ] Deterministic positions (same each time)

---

### 2.2 Layout Stability (No Jumping)
**Objective**: Verify positions don't change when photos load in Phase 3

**Critical Test for Jump Prevention**:
1. Launch app with progressive loading
2. Wait for all phases to complete
3. Scroll tree to see different nodes
4. **Observe**: Do nodes jump/shift position as photos load? NO ✓
5. Repeat scroll multiple times
6. Enable verbose console logging if available

**Pass Criteria**:
- [ ] Zero visual jumping observed
- [ ] Node positions stable throughout app lifetime
- [ ] No collision resolution triggered
- [ ] No separation recalculation

---

## Phase 3: Viewport Enrichment Tests

### 3.1 Visible Nodes Detection
**Objective**: Verify enrichment loads data only for visible nodes

**Steps**:
1. App loaded and displaying tree
2. Scroll to specific region (e.g., center of tree)
3. Monitor console for:
   - `📦 [Phase 3] Enriching N visible nodes...`
   - `✅ [Phase 3] Enriched N nodes in Yms`
4. Verify only visible + padding nodes enriched
5. Scroll to different region, verify different nodes enriched

**Expected Output**:
```
📦 [Phase 3] Enriching 42 visible nodes...
✅ [Phase 3] Enriched 42 nodes in 125ms
```

**Pass Criteria**:
- [ ] Enriching happens after scroll (debounced)
- [ ] Only visible nodes enriched (not entire tree)
- [ ] Padding preload working (200px outside viewport)
- [ ] No duplicate enrichment

---

### 3.2 Data Enrichment Content
**Objective**: Verify enriched data includes photos and metadata

**Steps**:
1. Wait for Phase 3 enrichment to complete
2. Tap on visible node to show profile sheet
3. Verify profile has:
   - [ ] Photo loaded and displaying
   - [ ] Bio field populated
   - [ ] Contact info (phone, email if available)
   - [ ] Professional title
   - [ ] All rich fields present
4. Verify text-only nodes still display (no photos for some)

**Pass Criteria**:
- [ ] Photos display correctly
- [ ] Bio and metadata populated
- [ ] No "loading" states after enrichment
- [ ] Quick response when tapping enriched nodes

---

### 3.3 Progressive Photo Loading
**Objective**: Verify photos load progressively without jumping

**Steps**:
1. Launch app with progressive loading
2. Observe tree rendering:
   - [ ] First: Structure visible (minimal rendering)
   - [ ] Then: Layout calculated (all positions set)
   - [ ] Then: Photos progressively appear as you scroll
3. Note timing for each phase
4. Verify smooth progression (no stuttering)

**Pass Criteria**:
- [ ] Photos load without affecting layout
- [ ] Smooth visual progression
- [ ] No rendering performance degradation
- [ ] Responsive during enrichment

---

## Performance Comparison Tests

### 4.1 Progressive vs Traditional Load Time
**Objective**: Compare overall time to interactive state

**Setup**:
- Test 1: Traditional mode
- Test 2: Progressive mode
- Clear app cache between tests

**Measurement Points**:
```
Traditional Mode:
- Load start → Complete tree loaded → Ready to interact
- Measure: Total time

Progressive Mode:
- Load start → Structure + Layout → Ready to interact
- Measure: Time to Phase 2 complete (layout ready)
- Note: Phase 3 (enrichment) happens in background
```

**Test Steps**:
1. Hard restart app (clear cache)
2. Record wall-clock time from app launch to:
   - Complete layout rendering
   - Ability to scroll/interact
3. Repeat 5 times, average results

**Expected Improvement**:
```
Traditional: ~1.3s to interactive (full tree load + layout)
Progressive: ~0.85s to interactive (structure + layout)
Improvement: ~35% faster to first interaction
```

**Pass Criteria**:
- [ ] Progressive mode faster to interactive state
- [ ] Difference measurable (>10% improvement)
- [ ] Consistent across repeated tests

---

### 4.2 Memory Usage
**Objective**: Verify memory savings with progressive loading

**Steps** (iOS):
1. Open Xcode → Memory Report
2. Traditional mode: Record memory after full tree loaded
3. Progressive mode: Record memory after Phase 2 (layout complete)
4. Compare peak memory usage

**Expected Memory Usage**:
```
Traditional: ~15-20 MB (full tree in memory)
Progressive (Phase 2): ~6-8 MB (structure only)
Progressive (After Phase 3): ~12-15 MB (structure + enriched visible)

Savings: ~25-30% peak memory reduction
```

**Pass Criteria**:
- [ ] Progressive mode uses less peak memory
- [ ] Memory growth matches enrichment (visible nodes)
- [ ] No memory leaks over time

---

### 4.3 Data Transfer Reduction
**Objective**: Verify network bandwidth savings

**Monitoring** (Network tab):
1. Traditional mode: Record total bytes downloaded
2. Progressive mode: Record bytes per phase

**Expected Data Transfer**:
```
Traditional: ~4.26 MB (full tree with all photos)
Progressive Phase 1: ~0.45 MB (structure only)
Progressive Phase 3: ~3.5 MB (enriched visible + photos)

Phase 1 Reduction: 89.4% less initial download
Phase 3 Progressive: Only fetch visible photos
```

**Pass Criteria**:
- [ ] Phase 1 download < 0.5 MB
- [ ] Phase 3 downloads only enriched nodes
- [ ] Total bandwidth similar or better than traditional
- [ ] Faster initial load despite photos loading later

---

## Feature Flag Tests

### 5.1 Traditional Mode Still Works
**Objective**: Verify backward compatibility

**Steps**:
1. Set `USE_PROGRESSIVE_LOADING = false`
2. App launches normally
3. Verify console shows:
   - `useTreeDataLoader` hook running
   - Full tree loading with progress
4. All features work normally:
   - [ ] Search functional
   - [ ] Profile editing works
   - [ ] Real-time updates functional
   - [ ] Admin features work

**Pass Criteria**:
- [ ] No regression in traditional mode
- [ ] All features work as before
- [ ] Timing baseline unchanged

---

### 5.2 Progressive Mode Feature Parity
**Objective**: Verify progressive mode supports all app features

**Steps**:
1. Set `USE_PROGRESSIVE_LOADING = true`
2. Test each feature:
   - [ ] Search profiles (queries local store)
   - [ ] Profile editing (updates enriched nodes)
   - [ ] Real-time updates (subscription still active?)
   - [ ] Admin dashboard
   - [ ] Multi-add children
   - [ ] Marriage editor
   - [ ] Profile sheet

**Note**: Real-time subscriptions may need to be added to useProgressiveTreeView hook

**Pass Criteria**:
- [ ] All features functional in progressive mode
- [ ] No feature degradation
- [ ] Edit/add operations work on enriched nodes

---

## Network Error Tests

### 6.1 Offline Handling (Phase 1)
**Objective**: Verify graceful fallback when offline

**Steps** (Simulator):
1. Toggle airplane mode ON
2. Hard restart app
3. Verify Phase 1 detects offline and shows error
4. Toggle airplane mode OFF
5. Test retry functionality

**Expected Behavior**:
```
⚠️ [Phase 1] Network offline → Show cached data or error
Retry button appears → User can retry when online
```

**Pass Criteria**:
- [ ] Offline detected gracefully
- [ ] Error message shown
- [ ] Retry works when online
- [ ] Cached data used if available

---

### 6.2 Network Error Recovery (Phase 3)
**Objective**: Verify enrichment handles network errors

**Steps**:
1. App running with progressive loading
2. Toggle airplane mode ON (while Phase 3 enriching)
3. Verify Phase 3 fails gracefully
4. Toggle airplane mode OFF
5. Scroll to trigger re-enrichment

**Pass Criteria**:
- [ ] Enrichment failure doesn't crash app
- [ ] Nodes without photos still render
- [ ] Retry works for enrichment
- [ ] No orphaned network requests

---

## Regression Tests

### 7.1 Original PTS Features Still Work
**Objective**: Verify Phase 3B doesn't break existing PTS work

**Steps**:
1. Test LOD system (viewport culling)
   - [ ] Zoom in/out smoothly
   - [ ] Performance maintained
   - [ ] T1/T2/T3 rendering works
2. Test highlighting
   - [ ] Ancestry highlighting functional
   - [ ] Cousin marriage highlighting works
3. Test gestures
   - [ ] Pan, pinch, double-tap work
   - [ ] No latency issues
4. Test searching
   - [ ] Search results instant
   - [ ] Navigation smooth

**Pass Criteria**:
- [ ] All existing PTS features work
- [ ] No performance regression
- [ ] No visual glitches

---

## Documentation Tests

### 8.1 Console Output Documentation
**Objective**: Verify all Phase markers in console match documentation

**Steps**:
1. Run progressive loading
2. Check all console.log statements match expected format:
   - [ ] `📦 [Phase 1]` prefix for structure loading
   - [ ] `📐 [Phase 2]` prefix for layout calculation
   - [ ] `📦 [Phase 3]` prefix for enrichment
3. Verify timing logged correctly
4. Verify success/error markers (✅/❌) consistent

**Pass Criteria**:
- [ ] All Phase output properly formatted
- [ ] Timing information accurate
- [ ] Easy to debug from console

---

## Summary Checklist

### Critical Tests (Must Pass)
- [ ] **No Jumping**: Nodes maintain position during photo load
- [ ] **Phase Timing**: Structure <500ms, Layout ~350ms, Enrichment <200ms
- [ ] **Backward Compatibility**: Traditional mode unchanged
- [ ] **Feature Parity**: Progressive mode supports all features
- [ ] **Memory Savings**: ~30% reduction in peak memory
- [ ] **Bandwidth Savings**: Phase 1 load <500ms with 89.4% less data

### Performance Tests (Should Pass)
- [ ] Structure caching working (<50ms on cache hit)
- [ ] Layout calculation deterministic (same positions each time)
- [ ] Visible nodes enrichment only (not full tree)
- [ ] No duplicate enrichment

### Stability Tests (Must Pass)
- [ ] Offline detection and retry functional
- [ ] Network error handling graceful
- [ ] All admin features work
- [ ] Real-time subscriptions functional
- [ ] Search/filtering work
- [ ] Edit/add operations work

---

## Testing Timeline

**Estimated Duration**: 2-3 hours

1. **Phase 1 Tests** (15 min): Structure loading, caching
2. **Phase 2 Tests** (20 min): Layout calculation, stability
3. **Phase 3 Tests** (30 min): Enrichment, progressive photos
4. **Performance Tests** (30 min): Comparative benchmarks
5. **Feature Tests** (30 min): Feature parity, real-time
6. **Network Tests** (15 min): Error handling
7. **Regression Tests** (15 min): Existing features

**Total**: ~2.5 hours

---

## Deliverables

After testing, document results:
1. Create `PROGRESSIVE_LOADING_TEST_RESULTS.md` with:
   - [ ] Timing measurements
   - [ ] Memory usage data
   - [ ] Screenshots of console output
   - [ ] List of issues found
   - [ ] Recommendations for production

2. If issues found:
   - [ ] Log as GitHub issues
   - [ ] Prioritize by severity
   - [ ] Create followup tasks

3. If successful:
   - [ ] Prepare production rollout plan
   - [ ] Document per-device performance variance
   - [ ] Create user-facing changelog

---

## Notes

- **Jump Prevention Guarantee**: 99.9% (d3 determinism) + fallback positions (35-50h effort)
- **Real-time Subscriptions**: Check if needed in `useProgressiveTreeView` (currently in `useTreeDataLoader`)
- **Reload Functions**: Stub functions in `TreeView.js` - may need enhancement for full reload functionality
- **showPhotos Setting**: Progressive loading uses hardcoded `false` for layout stability; verify rendering respects user setting

---

**Phase 3B Status**: Ready for Day 4 testing ✅
