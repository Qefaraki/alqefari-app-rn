# Phase 3: Implementation Roadmap

**Status**: Planning → Ready to Start
**Created**: October 24, 2025
**Updated**: October 24, 2025
**Context**: Post Phase 1 & 2 completion (TreeView.js: 2,651 lines, all critical bugs fixed)

---

## 🎯 Executive Summary

### What This Document Is

This is the **ACTIONABLE ROADMAP** for implementing Phase 3 of the Perfect Tree System. It translates the high-level plan into day-by-day tasks with clear entry/exit criteria, dependencies, and rollback strategies.

### Current Situation (October 2025)

**✅ What's Working:**
- Clean architecture from Phase 1 & 2 (2,651 lines, 21 modules extracted)
- 60fps performance with 56 profiles
- Stable build, all critical memory leaks fixed
- Backend RPC `get_visible_nodes()` EXISTS and ready to use

**🚨 What's Broken/Disabled:**
- **LOD System DISABLED** (Lines 851, 2253, 2290 in TreeView.js)
  - Known bugs: tier thrashing, size jumping, visual flicker
  - Currently forcing Tier 1 (full cards) at all zoom levels
- **No Progressive Loading** (Line 874 TODO comment)
  - Loading all profiles on mount (won't scale to 2,000+)
  - Backend RPC exists but not integrated

**⏳ What's Missing:**
- Theme system (hardcoded Najdi Sadu colors)
- Advanced navigation (minimap, quick access, focus modes)
- Enhanced highlighting (ancestry overlay, custom colors)
- Export capabilities (PNG/PDF)

### Critical Path: What MUST Be Done First

**Phase 3A + 3B are CRITICAL** - The app currently has 2,000+ profiles and:
- LOD bugs cause visual issues at scale
- Loading all profiles on mount won't scale beyond 3,000-5,000
- Backend supports progressive loading, just needs integration

**Recommendation**: Start 3A and 3B immediately, defer 3C-E to Phase 4.

---

## 📊 Phase 3 Overview

### Sub-Phases Breakdown

| Phase | Name | Priority | Effort | Duration | Status |
|-------|------|----------|--------|----------|--------|
| **3A** | LOD System Redesign | 🚨 CRITICAL | 30h | 4-5 days | 📋 Planned |
| **3B** | Progressive Loading | 🚨 CRITICAL | 25h | 3-4 days | 📋 Planned |
| **3C** | Theme System | ⚠️ HIGH | 20h | 3 days | 📋 Planned |
| **3D** | Advanced Navigation | ⚠️ HIGH | 30h | 4-5 days | 📋 Planned |
| **3E** | Enhanced Highlighting | 📌 MEDIUM | 15h | 2-3 days | 📋 Planned |
| **3F** | Testing & Documentation | 🎯 CRITICAL | 20h | 3 days | 📋 Planned |

**Total**: 140 hours (20 days)
**Critical Path**: 55 hours (8-9 days) for 3A + 3B

### Dependencies Map

```
Phase 3A (LOD System)
    └─> Phase 3B (Progressive Loading) ⚠️ Depends on working LOD
        └─> Phase 3C (Theme System) - Independent
            └─> Phase 3D (Advanced Navigation) - Independent
                └─> Phase 3E (Enhanced Highlighting) - Independent
                    └─> Phase 3F (Testing & Docs) - Depends on all
```

**Key Insight**: 3C, 3D, 3E can run in parallel AFTER 3A+3B are complete.

---

## 🚀 Phase 3A: LOD System Redesign (CRITICAL)

**Effort**: 30 hours
**Duration**: 4-5 days
**Priority**: 🚨 CRITICAL - Blocking scaling to 2,000+ profiles

### Problem Statement

**Current State:**
- LOD system disabled via TEMP comments (Lines 851, 2253, 2290)
- Known bugs documented in LODCalculator.ts:
  - Tier thrashing (rapid switching between T1 ↔ T2)
  - Size jumping (nodes change size unexpectedly)
  - Visual flicker during zoom transitions
  - Inconsistent scale quantum (5% steps miss optimal boundaries)

**Root Causes:**
1. Hysteresis too narrow (±15%) - doesn't prevent thrashing
2. Scale quantum too coarse (0.05 = 5% steps)
3. No smooth interpolation - instant tier switches
4. Physical pixel calculation doesn't account for device DPI variations

### Success Criteria

- [ ] Smooth tier transitions (no size jumping)
- [ ] Hysteresis prevents thrashing (no rapid tier switching)
- [ ] Visual regression test passes (nodes look identical to Phase 2)
- [ ] Performance: Tier calculation <5ms per frame
- [ ] All TEMP comments removed from TreeView.js

### Implementation Plan

#### Day 1: Widen Hysteresis & Refine Scale Quantum (8 hours)

**Morning (4h):**
1. **Update LODCalculator.ts constants**
   - Change `HYSTERESIS` from 0.15 (±15%) to 0.25 (±25%)
   - Change `SCALE_QUANTUM` from 0.05 (5%) to 0.02 (2%)
   - Document reasoning in code comments
   - **Expected Impact**: Wider deadzone, finer granularity

2. **Test tier calculation logic**
   - Write unit tests for new boundaries
   - Test edge cases (rapid zoom in/out)
   - Verify hysteresis prevents thrashing
   - **Acceptance**: No tier switches within ±25% of boundary

**Afternoon (4h):**
3. **Device-aware physical pixel calculation**
   - Update `calculatePhysicalNodePixels()` to account for device DPI
   - Test on iPhone XR (2x), iPad Pro (2x), Android (varies)
   - Log actual pixel sizes during zoom
   - **Acceptance**: Consistent tier boundaries across devices

**Deliverable**: LODCalculator.ts with updated constants and device DPI support

---

#### Day 2: Animated Tier Transitions (12 hours)

**Morning (4h):**
1. **Create TierTransitionAnimator.ts**
   - New module: `src/components/TreeView/lod/TierTransitionAnimator.ts`
   - Implement smooth interpolation between tiers using Reanimated
   - Use `withTiming()` with 300ms duration
   - Easing: `Easing.inOut(Easing.ease)` for natural feel

2. **Add interpolated tier state**
   - New shared value: `interpolatedTier` (1.0 → 2.0 → 3.0)
   - Animate tier changes instead of instant switches
   - **Example**: Tier 1 → 2 animates from 1.0 → 2.0 over 300ms

**Afternoon (4h):**
3. **Integrate animator with NodeRenderer**
   - Update NodeRenderer to accept interpolated tier value
   - Interpolate node dimensions smoothly
   - **Formula**: `nodeWidth = lerp(T1_WIDTH, T2_WIDTH, tierProgress)`

**Evening (4h):**
4. **Implement opacity crossfade**
   - Render both tiers during transition
   - Crossfade opacity: T1 (1.0 → 0.0), T2 (0.0 → 1.0)
   - Clean up old tier after animation completes
   - **Performance check**: No jank, 60fps sustained

**Deliverable**: Smooth tier transitions with opacity crossfade working

---

#### Day 3: Integration & Testing (6 hours)

**Morning (3h):**
1. **Remove TEMP comments from TreeView.js**
   - Line 851: Re-enable `calculateLODTier()`
   - Line 2253: Remove "Always T1" comment
   - Line 2290: Re-enable tier-based rendering
   - Verify `setTier(newTier)` is called correctly

2. **Update renderNodeWithTier callback**
   - Pass actual tier instead of hardcoded 1
   - Ensure tier info propagates to image loading
   - Test T1, T2, T3 rendering paths

**Afternoon (3h):**
3. **Manual testing on physical device**
   - Test zoom in/out slowly (verify smooth transitions)
   - Test rapid zoom (verify hysteresis prevents thrashing)
   - Test at tier boundaries (0.24, 0.48 scale)
   - Compare to Phase 2 (should look identical at full zoom)

4. **Performance profiling**
   - Measure tier calculation time (target: <5ms)
   - Check frame rate during transitions (target: 60fps)
   - Monitor memory usage (should be stable)

**Deliverable**: LOD system working, TEMP comments removed, visual parity with Phase 2

---

#### Day 4: Polish & Edge Cases (4 hours)

**Tasks:**
1. Fix any visual regressions found during testing
2. Tune animation duration (try 200ms, 300ms, 400ms)
3. Adjust hysteresis if thrashing still occurs
4. Add feature flag `LOD_ENABLED` for easy rollback
5. Document new LOD behavior in code comments

**Deliverable**: Production-ready LOD system

---

### Rollback Strategy

**If LOD causes critical issues:**
1. Set `LOD_ENABLED = false` in LODCalculator.ts (5 minutes)
2. Restore TEMP comments in TreeView.js (10 minutes)
3. Force Tier 1 rendering (revert to Phase 2 behavior)

**Rollback Time**: 15 minutes

---

### Files Changed

**Modified:**
- `src/components/TreeView/lod/LODCalculator.ts` - Update hysteresis, scale quantum, DPI handling
- `src/components/TreeView.js` - Remove TEMP comments (lines 851, 2253, 2290)

**Created:**
- `src/components/TreeView/lod/TierTransitionAnimator.ts` - Smooth tier animations
- `tests/components/TreeView/lod/TierTransitionAnimator.test.ts` - Unit tests

**Total Files**: 2 modified, 2 created

---

## 🔄 Phase 3B: Progressive Loading (CRITICAL)

**Effort**: 25 hours
**Duration**: 3-4 days
**Priority**: 🚨 CRITICAL - Required for 2,000+ profile scale
**Depends On**: Phase 3A (needs working LOD)

### Problem Statement

**Current State:**
- `useTreeDataLoader.js` loads ALL profiles on mount
- Works for 56 profiles, won't scale to 2,000+ or 10,000+
- Backend RPC `get_visible_nodes()` EXISTS (profiles.js:35) but NOT USED
- TreeView.js:874 has TODO comment for viewport-based loading

**Why It Matters:**
- App currently has 2,000+ profiles
- Loading all profiles on mount = slow initial load + high memory
- Need viewport-based queries to scale to 10,000+ profiles

### Success Criteria

- [ ] Viewport loading working with backend RPC
- [ ] Memory usage <50MB for 10,000 nodes
- [ ] Viewport query <100ms response time
- [ ] Smooth loading (no UI jank or loading flash)
- [ ] TODO comment removed from TreeView.js:874

### Implementation Plan

#### Day 1: Backend RPC Validation (3 hours)

**Tasks:**
1. **Test `get_visible_nodes()` manually**
   - Call RPC with sample viewport bounds
   - Verify returns correct profiles within viewport
   - Test pagination (limit parameter)
   - Benchmark query performance (target: <100ms)

2. **Check backend migration**
   - Ensure RPC exists in Supabase
   - Verify RLS policies don't block viewport queries
   - Test with different zoom levels and viewport sizes

**Deliverable**: Confirmed backend RPC works correctly

---

#### Day 2-3: Create useViewportLoader Hook (12 hours)

**Day 2 Morning (4h):**
1. **Create hook skeleton**
   - New file: `src/components/TreeView/hooks/useViewportLoader.ts`
   - Hook signature: `useViewportLoader({ visibleBounds, currentScale, enabled })`
   - State: `loadedProfiles`, `isLoading`, `error`

2. **Implement viewport query logic**
   - Call `profilesService.getVisibleNodes()` on viewport change
   - Debounce calls (500ms) to avoid query spam
   - Handle errors gracefully (fallback to full tree load)

**Day 2 Afternoon (4h):**
3. **Add caching layer**
   - Use Map to cache loaded profiles by ID
   - Avoid re-fetching profiles already loaded
   - Clear cache when tree data changes

4. **Implement predictive loading**
   - Load adjacent nodes BEFORE they enter viewport
   - Add 100px margin around viewport bounds
   - Preload on pan direction (predict user movement)

**Day 3 Morning (4h):**
5. **Edge case handling**
   - **Zoom out**: Load parent nodes when viewport expands
   - **Zoom in**: Load child nodes when viewport contracts
   - **Initial load**: Always load root + 2 generations (regardless of viewport)
   - **Offline mode**: Fallback to cached profiles

**Deliverable**: useViewportLoader hook with caching, debouncing, predictive loading

---

#### Day 3 Afternoon + Day 4: Integration (10 hours)

**Day 3 Afternoon (4h):**
1. **Add feature flag**
   - Add `PROGRESSIVE_LOADING_ENABLED` constant (default: false)
   - Modify `useTreeDataLoader.js` to conditionally use progressive loading
   - Ensure backward compatibility (can toggle on/off)

2. **Update syncTransformAndBounds**
   - Trigger viewport queries on pan/zoom
   - Pass visible bounds to useViewportLoader
   - Merge viewport profiles with cached tree data

**Day 4 Morning (4h):**
3. **Memory management**
   - Implement profile cleanup when out of viewport
   - Keep LRU cache of 1,000 most recent profiles
   - Release memory for profiles far from viewport

4. **Loading states**
   - Show shimmer skeleton for loading nodes
   - Fade in new nodes smoothly (300ms)
   - No loading spinner (skeleton only)

**Day 4 Afternoon (2h):**
5. **Testing with large datasets**
   - Test with 1,000, 5,000, 10,000 node datasets
   - Verify memory stays under 50MB
   - Check viewport query <100ms
   - Test on slow network (3G simulation)

**Deliverable**: Progressive loading integrated, feature flag in place, tested at scale

---

### Rollback Strategy

**If progressive loading causes issues:**
1. Set `PROGRESSIVE_LOADING_ENABLED = false` (5 minutes)
2. Fallback to full tree load (Phase 2 behavior)
3. App continues working normally

**Rollback Time**: 5 minutes

---

### Files Changed

**Created:**
- `src/components/TreeView/hooks/useViewportLoader.ts` - Viewport-based loading hook
- `tests/components/TreeView/hooks/useViewportLoader.test.ts` - Unit tests

**Modified:**
- `src/components/TreeView/hooks/useTreeDataLoader.js` - Add progressive loading flag
- `src/components/TreeView.js` - Remove TODO comment (line 874), integrate viewport loader

**Total Files**: 2 created, 2 modified

---

## 🎨 Phase 3C: Theme System (HIGH)

**Effort**: 20 hours
**Duration**: 3 days
**Priority**: ⚠️ HIGH - Dark mode support
**Depends On**: None (can run in parallel after 3A+3B)

### Problem Statement

**Current State:**
- Hardcoded Najdi Sadu colors in all components (e.g., `#F9F7F3`, `#A13333`)
- No dark mode support
- Design system documented in DESIGN_SYSTEM.md but not implemented as tokens
- Theme folder exists but empty (`src/components/TreeView/theme/`)

### Success Criteria

- [ ] Light and dark mode themes implemented
- [ ] All 21 components use design tokens (no hardcoded colors)
- [ ] Theme toggle working with 300ms animation
- [ ] No visual regressions in light mode (matches Phase 2 exactly)
- [ ] Theme preference persisted in MMKV

### Implementation Plan

#### Day 1: Create Token Registry (8 hours)

**Morning (4h):**
1. **Create tokens.ts**
   - File: `src/components/TreeView/theme/tokens.ts`
   - Define `lightTheme` and `darkTheme` objects
   - Follow structure from 00-SPECIFICATION.md (lines 169-231)
   - Include: background, text, action, tree color tokens

2. **Add semantic token categories**
   - `background`: canvas, card, elevated
   - `text`: primary, secondary
   - `action`: primary, secondary
   - `tree`: nodeFill, nodeStroke, lineConnection, lineHighlight

**Afternoon (4h):**
3. **Create theme store**
   - File: `src/components/TreeView/theme/useTheme.ts`
   - Zustand store with MMKV persistence
   - Methods: `setMode()`, `toggleTheme()`
   - Initial load from MMKV storage

4. **Add photo dimming for dark mode**
   - Define `PHOTO_DIM_MATRIX` color matrix (0.85 brightness)
   - Apply to photos when theme is dark
   - Test on sample profile photos

**Deliverable**: Theme token system with Zustand store

---

#### Day 2: Component Migration (8 hours)

**All Day (8h):**
1. **Update NodeRenderer**
   - Replace hardcoded colors with `tokens.tree.nodeFill`, `tokens.tree.nodeStroke`
   - Test visual parity in light mode
   - Test dark mode appearance

2. **Update ConnectionRenderer**
   - Use `tokens.tree.lineConnection`
   - Use `tokens.tree.lineHighlight` for highlighted connections

3. **Update ShadowRenderer**
   - Use `tokens.tree.nodeStroke` for shadow color

4. **Update all 21 extracted components**
   - Grep for hardcoded hex colors: `#F9F7F3`, `#D1BBA3`, `#A13333`, etc.
   - Replace with token references
   - Test each component in light and dark mode

**Deliverable**: All components using design tokens

---

#### Day 3: UI Toggle & Polish (4 hours)

**Morning (2h):**
1. **Add theme toggle button**
   - Location: TreeNavigation component (top-right)
   - Icon: Sun (light mode) / Moon (dark mode)
   - Animate icon switch (200ms)

2. **Implement theme switch animation**
   - Crossfade between themes (300ms)
   - Use Reanimated for smooth transition
   - No visual flash

**Afternoon (2h):**
3. **Visual regression testing**
   - Take screenshots in light mode (before/after)
   - Ensure pixel-perfect match with Phase 2
   - Test dark mode for contrast issues (WCAG AA compliance)

4. **Persistence testing**
   - Set theme to dark, close app, reopen
   - Verify theme persists
   - Test on iOS and Android

**Deliverable**: Theme toggle UI, animations working, persistence verified

---

### Rollback Strategy

**If theme system causes visual issues:**
1. Revert to hardcoded colors in components (2 hours)
2. Remove theme toggle UI (10 minutes)

**Rollback Time**: 2 hours 10 minutes

---

### Files Changed

**Created:**
- `src/components/TreeView/theme/tokens.ts` - Design token registry
- `src/components/TreeView/theme/useTheme.ts` - Theme Zustand store
- `tests/components/TreeView/theme/useTheme.test.ts` - Unit tests

**Modified:**
- 21 TreeView components (replace hardcoded colors with tokens)
- `src/components/TreeView/navigation/TreeNavigation.tsx` - Add theme toggle button

**Total Files**: 3 created, 22 modified

---

## 🧭 Phase 3D: Advanced Navigation (HIGH)

**Effort**: 30 hours
**Duration**: 4-5 days
**Priority**: ⚠️ HIGH - Major UX improvement
**Depends On**: None (can run in parallel after 3A+3B)

### Brief Overview

Components to build:
1. **Minimap** (12h) - 160x160px overview with tap-to-navigate
2. **Quick Access Pills** (8h) - Root + 2 main G2 branches
3. **Focus Mode** (10h) - Dim/blur/hide non-selected branches

**Note**: Full plan in Phase 3D subfolder README when work begins.

---

## ✨ Phase 3E: Enhanced Highlighting (MEDIUM)

**Effort**: 15 hours
**Duration**: 2-3 days
**Priority**: 📌 MEDIUM - Nice-to-have feature
**Depends On**: None (can run in parallel after 3A+3B)

### Brief Overview

Features to implement:
1. **Ancestry Path Calculation** (5h) - Walk parent chain to root
2. **Highlight Renderer Enhancement** (6h) - Multi-layer glow, custom colors
3. **Integration with NodeSizeProvider** (2h) - Root prominence, VIP highlighting
4. **UI Controls** (2h) - "Show Ancestry" button, color picker

**Note**: Full plan in Phase 3E subfolder README when work begins.

---

## 📝 Phase 3F: Testing & Documentation (CRITICAL)

**Effort**: 20 hours
**Duration**: 3 days
**Priority**: 🎯 CRITICAL - Required before production
**Depends On**: All other phases (3A-E)

### Testing Plan (12 hours)

**Unit Tests** (4h):
- LOD tier calculation with new hysteresis
- Viewport loading pagination
- Theme token retrieval
- Ancestry path calculation

**Integration Tests** (4h):
- LOD transitions smooth on physical device
- Progressive loading with 5,000 node dataset
- Theme switching no visual glitches
- Minimap navigation accuracy

**Performance Tests** (4h):
- 10,000 node tree renders at 60fps
- Memory usage <50MB with progressive loading
- Viewport query <100ms response time
- Theme switch <16ms (60fps)

### Documentation (8 hours)

**Documents to Create**:
1. **PHASE3_OVERVIEW.md** (2h) - What was built, why, how
2. **LOD_SYSTEM_V2.md** (2h) - Redesigned LOD documentation
3. **PROGRESSIVE_LOADING.md** (2h) - Viewport loading guide
4. **THEME_SYSTEM.md** (1h) - Design token architecture
5. **Update CLAUDE.md** (1h) - Add Phase 3 summary

---

## 📅 Recommended Timeline

### Critical Path (Start Immediately)

**Week 1:**
- Mon-Thu: Phase 3A (LOD System Redesign) - 4 days
- Fri: Phase 3B Day 1 (Backend RPC Validation) - 1 day

**Week 2:**
- Mon-Wed: Phase 3B Days 2-4 (Progressive Loading) - 3 days
- Thu-Fri: Phase 3C Days 1-2 (Theme System) - 2 days

**Week 3:**
- Mon: Phase 3C Day 3 (Theme System polish) - 1 day
- Tue-Fri: Phase 3D Days 1-4 (Advanced Navigation) - 4 days

**Week 4:**
- Mon-Tue: Phase 3E Days 1-2 (Enhanced Highlighting) - 2 days
- Wed-Fri: Phase 3F Days 1-3 (Testing & Documentation) - 3 days

**Total**: 4 weeks (20 days)

### Alternative: Critical Work Only

**Just do 3A + 3B + 3F (testing):**
- Week 1: Phase 3A (4-5 days)
- Week 2: Phase 3B (3-4 days)
- Week 3: Phase 3F (3 days)

**Total**: 2-3 weeks, addresses CRITICAL needs

**Defer 3C, 3D, 3E to Phase 4** (future enhancement)

---

## ✅ Entry Criteria (Can We Start?)

Before starting Phase 3, verify:

- [ ] Phase 2 complete and merged to main
- [ ] All critical bugs fixed (memory leaks resolved)
- [ ] Tests passing (538 tests green)
- [ ] App running stable in production (2,000+ profiles)
- [ ] Backend RPC `get_visible_nodes()` exists and tested
- [ ] Development environment ready (Expo, iOS simulator, physical device)

**Status**: ✅ All criteria met - Ready to start

---

## 🚪 Exit Criteria (Are We Done?)

Phase 3 complete when:

**Phase 3A:**
- [ ] LOD tier transitions smooth (no size jumping)
- [ ] All TEMP comments removed from TreeView.js
- [ ] Visual regression test passes
- [ ] Performance: 60fps during tier transitions

**Phase 3B:**
- [ ] Progressive loading working with 5,000+ nodes
- [ ] Memory <50MB for 10,000 nodes
- [ ] Viewport query <100ms
- [ ] TODO comment removed from TreeView.js:874

**Phase 3C:**
- [ ] Light and dark mode working
- [ ] All components use tokens
- [ ] Theme preference persisted
- [ ] No visual regressions

**Phase 3D:**
- [ ] Minimap, quick access pills, focus mode working
- [ ] Animations smooth (60fps)

**Phase 3E:**
- [ ] Ancestry overlay working
- [ ] Custom highlight colors supported

**Phase 3F:**
- [ ] All tests passing (unit, integration, performance)
- [ ] Documentation complete (5 markdown files)
- [ ] CLAUDE.md updated

---

## 🎯 Success Metrics

### Performance Benchmarks (Post-Phase 3)

| Metric | Phase 2 (Current) | Phase 3 Target | How to Measure |
|--------|------------------|----------------|----------------|
| Layout time | ~800ms (56 profiles) | <200ms (5K profiles) | `console.time()` |
| Frame rate | 60fps (56 profiles) | 60fps (10K profiles) | React DevTools |
| Memory | ~15MB (56 profiles) | <50MB (10K profiles) | Xcode Instruments |
| Tree load time | <1s (56 profiles) | <2s (10K profiles) | Performance API |
| Viewport query | N/A | <100ms | RPC logging |

### User Experience Metrics

| Feature | Target |
|---------|--------|
| LOD transitions | Smooth, no visual jarring |
| Theme switch | <300ms animation |
| Navigation speed | <2s to any node |
| Loading feedback | Skeleton shimmer (no spinner) |

---

## 🔄 Risk Management

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| LOD still janky | 30% | HIGH | Feature flag, iterative tuning |
| Progressive loading memory leaks | 20% | CRITICAL | Memory profiling, cleanup logic |
| Theme color mismatches | 15% | MEDIUM | Visual regression tests |
| Backend RPC slow | 10% | HIGH | Query timeout, client-side cache |
| Navigation UX confusion | 25% | LOW | Onboarding tooltips, A/B test |

### Rollback Strategy Summary

| Phase | Rollback Method | Time |
|-------|----------------|------|
| 3A | Set `LOD_ENABLED = false` | 15 min |
| 3B | Set `PROGRESSIVE_LOADING_ENABLED = false` | 5 min |
| 3C | Revert to hardcoded colors | 2h 10min |
| 3D | Hide components via feature flags | 10 min |
| 3E | Disable rendering via feature flag | 5 min |

---

## 📚 Resources

### Code References

**LOD System:**
- `/src/components/TreeView/lod/LODCalculator.ts` (lines 13-18: known issues)
- `/src/components/TreeView.js` (lines 851, 2253, 2290: TEMP comments)

**Progressive Loading:**
- `/src/services/profiles.js` (lines 33-46: `getVisibleNodes()`)
- `/src/components/TreeView.js` (line 874: TODO comment)

**Theme System:**
- `/docs/DESIGN_SYSTEM.md` (Najdi Sadu color palette)
- `/src/components/TreeView/theme/` (reserved folder, empty)

### Documentation

- [Perfect Tree Specification](../00-SPECIFICATION.md) - Full requirements
- [Phase 3 Master Plan](./01-PLAN.md) - High-level overview
- [Phase 2 Summary](../phase2/03-PROGRESS_SUMMARY.md) - What's already done
- [Design System](../../DESIGN_SYSTEM.md) - Najdi Sadu design tokens

---

## 🏁 Next Steps

### Immediate Actions (Today)

1. **Review this roadmap** - Confirm timeline and priorities
2. **Create Phase 3A day-by-day plan** - Break down into 4-5 daily tasks
3. **Set up feature flags** - Add constants for easy rollback
4. **Verify backend RPC** - Test `get_visible_nodes()` manually

### This Week

- **Start Phase 3A** - LOD System Redesign (4-5 days)
- **Daily progress logs** - Document what was done, what's next
- **Daily testing** - Verify no regressions on physical device

### This Month

- **Complete 3A + 3B** - Critical path (8-9 days)
- **Decision point** - Proceed with 3C-E or defer to Phase 4?
- **Testing & documentation** - Phase 3F (3 days)

---

**Document Status**: ✅ Ready for Implementation
**Approved By**: [Pending]
**Start Date**: TBD
**Target Completion**: TBD (20 days after start)

---

*"Phase 3 transforms the Perfect Tree from working to world-class. This roadmap ensures we get there safely, incrementally, and with zero downtime."*
