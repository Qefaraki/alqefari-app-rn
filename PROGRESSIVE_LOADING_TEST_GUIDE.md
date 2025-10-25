# Progressive Loading - Live Testing Guide

## ✅ Progressive Loading Enabled

**Status**: Feature flag is now `true` in `src/components/TreeView.js` (line 215)

**What to expect**: Three-phase loading with detailed console logging

---

## 📊 Expected Console Output

### Step 1: App Launch
Look for this startup message:

```
🚀 [TreeView] PROGRESSIVE LOADING MODE ENABLED - Expecting 3 phases (structure → layout → enrichment)
```

This confirms progressive loading is **ACTIVE** ✓

---

## Phase 1: Structure Loading (0-1 second)

### First App Load (Fresh)
```
📦 [Phase 1] Loading tree structure...
✅ [Phase 1] Structure loaded: 2850 profiles (0.45 MB) in 347ms
```

**What this means**:
- ✓ Structure loading is working
- ✓ ~2850 profiles loaded (your tree size)
- ✓ ~0.45 MB data (89.4% reduction from 4.26 MB!)
- ✓ ~347ms timing (should be <500ms)
- ✓ Profiles list is minimal (no photos yet)

### Restart App (With Cache)
```
🚀 [Phase 1] Using cached structure (2850 profiles)
✅ [Phase 1] Cache load complete in 3ms (instant, no network)
```

**What this means**:
- ✓ Cache is working (instant load on second startup)
- ✓ <50ms from cache (essentially instant)
- ✓ No network request needed
- ✓ Same structure as before (schema v1.0.0)

---

## Phase 2: Layout Calculation (~350ms)

Immediately after Phase 1:

```
📐 [Phase 2] Calculating layout for 2850 nodes...
✅ [Phase 2] Layout calculated in 351ms
```

**What this means**:
- ✓ d3-hierarchy calculating positions for ALL nodes
- ✓ Happens ONCE only (not recalculated later)
- ✓ Timing 300-400ms (tolerance: ±100ms)
- ✓ All positions are now deterministic (d3 is deterministic)
- ✓ **No jumping will occur when photos load** ✓

**At this point**: You should see the tree structure on screen, but without photos yet!

---

## Phase 3: Viewport Enrichment (Background)

### When You Scroll
When you scroll the tree, after 300ms debounce:

```
📦 [Phase 3] Enriching 42 visible nodes...
✅ [Phase 3] Enriched 42 nodes in 127ms
```

**What this means**:
- ✓ Enrichment detected 42 nodes in your viewport
- ✓ +200px padding being preloaded (out of view)
- ✓ Fetched photos, bio, contact info for visible nodes
- ✓ ~127ms to fetch and merge enriched data
- ✓ Store updated without recalculating layout

**Photos now appear** as you scroll - without affecting tree positions!

### Multiple Scroll Events
```
📦 [Phase 3] Enriching 38 visible nodes...
✅ [Phase 3] Enriched 38 nodes in 104ms
```

**What this means**:
- ✓ Different nodes visible = different enrichment
- ✓ Only previously unseen nodes enriched
- ✓ No duplicate enrichment (tracked in set)
- ✓ Smooth progressive loading continues

---

## Performance Checkpoints

### Checkpoint 1: Time to Interactive
**Measure**: From app launch to tree visible + scrollable

**Traditional**: ~1.3s (full tree load + layout)
**Progressive**: ~0.85s (structure + layout, photos loading in background)

✓ **Expected**: Progressive should be **35% faster**

### Checkpoint 2: Initial Memory
**Measure**: RAM usage right after Phase 2 complete

**Traditional**: ~15-20 MB (full tree in memory)
**Progressive**: ~6-8 MB (structure only)

✓ **Expected**: Progressive should use **~30% less memory**

### Checkpoint 3: No Jumping
**Test**: Scroll and watch for any position shifts

✓ **Expected**: **ZERO jumping** - positions completely stable
- Phase 2 calculated all positions once
- Phase 3 only adds data (no layout recalc)
- d3 determinism guarantees consistency

---

## Error Scenarios to Test

### Offline (Airplane Mode)
```
❌ [Phase 1] Network offline
```

**Expected**:
- Error shown
- Cached data displayed (if available)
- Retry button appears
- Turn on network and retry

### Network Error During Enrichment
```
❌ [Phase 3] Enrichment failed: <error>
```

**Expected**:
- Enrichment fails gracefully
- Tree still shows (no photos yet)
- Try scrolling to retry enrichment
- When network returns, enrichment succeeds

---

## Logs Checklist

### On First Launch
- [ ] `🚀 [TreeView] PROGRESSIVE LOADING MODE ENABLED` ✓
- [ ] `📦 [Phase 1] Loading tree structure...` ✓
- [ ] `✅ [Phase 1] Structure loaded: X profiles (Y MB) in Zms` ✓
- [ ] `📐 [Phase 2] Calculating layout for X nodes...` ✓
- [ ] `✅ [Phase 2] Layout calculated in Yms` ✓

### After First Scroll
- [ ] `📦 [Phase 3] Enriching N visible nodes...` ✓
- [ ] `✅ [Phase 3] Enriched N nodes in Xms` ✓

### On Second Launch (With Cache)
- [ ] `🚀 [Phase 1] Using cached structure (X profiles)` ✓
- [ ] `✅ [Phase 1] Cache load complete in Xms (instant, no network)` ✓

---

## Performance Expectations

| Phase | Component | Expected Time | Tolerance |
|-------|-----------|----------------|-----------|
| 1 (Fresh) | Load structure | <500ms | ±100ms |
| 1 (Cache) | Load from cache | <50ms | ±20ms |
| 2 | Calculate layout | ~350ms | ±100ms |
| 3 | Enrich per scroll | <200ms | ±100ms |
| **Total to Interactive** | Structure + Layout | **~850ms** | ±150ms |

---

## What to Watch For

✅ **Signs it's working correctly**:
1. Mode indicator at startup
2. Three phases execute in sequence
3. Timing matches expectations
4. No jumping when scrolling
5. Photos appear progressively without layout shift
6. Each scroll triggers Phase 3 enrichment
7. Cache works on second app launch

⚠️ **Signs something is wrong**:
1. Traditional mode message (not progressive) - check feature flag
2. Phase 1 takes >1000ms - network issue
3. Layout not appearing - Phase 2 failure
4. Visual jumping when scrolling - layout recalculation (bug)
5. Photos not loading - Phase 3 failure
6. No enrichment logs when scrolling - Phase 3 not running

---

## Next Steps for Testing

1. **Launch the app** and watch console for startup message
2. **Wait for Phases 1-2** to complete (~750ms total)
3. **Scroll the tree** to trigger Phase 3 enrichment
4. **Observe photos loading** as you scroll (should be smooth, no jumping)
5. **Note timing** for all three phases
6. **Restart app** to test cache (should load instantly)
7. **Test offline** (turn on airplane mode, hard restart)
8. **Document results** in `PROGRESSIVE_LOADING_TEST_RESULTS.md`

---

## Quick Command Reference

To see more detailed logs, you can also manually call in console:

```javascript
// Check which mode is active
console.log('Progressive loading enabled:', true) // You enabled it

// Check tree store state
const { treeData, cachedSchemaVersion } = useTreeStore.getState();
console.log('Cached profiles:', treeData.length);
console.log('Schema version:', cachedSchemaVersion);

// Check network status
const { isConnected, isInternetReachable } = useNetworkStore.getState();
console.log('Network:', { isConnected, isInternetReachable });
```

---

## Expected Complete Sequence

Here's what a successful test looks like from console:

```
🚀 [TreeView] PROGRESSIVE LOADING MODE ENABLED - Expecting 3 phases (structure → layout → enrichment)

📦 [Phase 1] Loading tree structure...
✅ [Phase 1] Structure loaded: 2850 profiles (0.45 MB) in 347ms

📐 [Phase 2] Calculating layout for 2850 nodes...
✅ [Phase 2] Layout calculated in 351ms

[User scrolls the tree]

📦 [Phase 3] Enriching 42 visible nodes...
✅ [Phase 3] Enriched 42 nodes in 127ms

[User scrolls to different region]

📦 [Phase 3] Enriching 38 visible nodes...
✅ [Phase 3] Enriched 38 nodes in 104ms

[User scrolls back]

✅ [Phase 3] No new profiles to enrich
```

---

**Generation Date**: October 25, 2025
**Status**: ✅ Ready for Testing
**Feature Flag**: `USE_PROGRESSIVE_LOADING = true` (ENABLED)
