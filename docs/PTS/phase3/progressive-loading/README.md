# Phase 3B: Progressive Loading

**Status**: 📋 Planned
**Effort**: 25 hours
**Duration**: 3-4 days
**Priority**: 🚨 CRITICAL - Required for 2,000+ profile scale
**Depends On**: Phase 3A (LOD System)

## Overview

Implement viewport-based loading to support 10,000+ profiles without memory issues. Backend RPC `get_visible_nodes()` already exists - just needs frontend integration.

## Problem Statement

**Current State:** `useTreeDataLoader.js` loads ALL profiles on mount

**Why It Matters:**
- App has 2,000+ profiles currently
- Loading all on mount = slow initial load + high memory
- Won't scale to 10,000+ target capacity

**Backend Ready:** `get_visible_nodes()` RPC exists (profiles.js:35) but NOT USED

## Success Criteria

- [ ] Viewport loading working with backend RPC
- [ ] Memory usage <50MB for 10,000 nodes
- [ ] Viewport query <100ms response time
- [ ] Smooth loading (no UI jank or loading flash)
- [ ] TODO comment removed from TreeView.js:874

## Implementation Plan

### Day 1: Backend RPC Validation (3h)
- Test `get_visible_nodes()` manually
- Verify returns correct profiles within viewport
- Benchmark query performance (target: <100ms)
- Check RLS policies don't block queries

### Day 2-3: Create useViewportLoader Hook (12h)
**Day 2 AM (4h):**
- Create hook skeleton
- Implement viewport query logic
- Add debouncing (500ms)

**Day 2 PM (4h):**
- Add caching layer (Map by ID)
- Implement predictive loading (100px margin)

**Day 3 AM (4h):**
- Edge case handling:
  - Zoom out → load parents
  - Zoom in → load children
  - Initial load → root + 2 generations
  - Offline → fallback to cache

### Day 3 PM + Day 4: Integration (10h)
**Day 3 PM (4h):**
- Add `PROGRESSIVE_LOADING_ENABLED` feature flag
- Modify `useTreeDataLoader.js` for conditional loading
- Update `syncTransformAndBounds` to trigger viewport queries

**Day 4 AM (4h):**
- Memory management (LRU cache, profile cleanup)
- Loading states (shimmer skeleton, fade-in animations)

**Day 4 PM (2h):**
- Test with 1K, 5K, 10K node datasets
- Verify memory <50MB, queries <100ms
- Test on slow network (3G simulation)

## Rollback Strategy

**Immediate rollback**: Set `PROGRESSIVE_LOADING_ENABLED = false` (5 minutes)

## Files Changed

**Created:**
- `src/components/TreeView/hooks/useViewportLoader.ts`
- `tests/components/TreeView/hooks/useViewportLoader.test.ts`

**Modified:**
- `src/components/TreeView/hooks/useTreeDataLoader.js`
- `src/components/TreeView.js` (remove TODO at line 874)

## Success Metrics

| Metric | Target |
|--------|--------|
| Memory usage (10K nodes) | <50MB |
| Viewport query time | <100ms |
| Initial load time | <2s |
| Loading smoothness | No jank, shimmer only |

---

**Ready to Start**: After Phase 3A complete
**See**: [Phase 3 Roadmap](../02-IMPLEMENTATION_ROADMAP.md) for full context
