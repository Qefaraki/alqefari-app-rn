# Phase 3A: LOD System Redesign

**Status**: 📋 Planned
**Effort**: 30 hours
**Duration**: 4-5 days
**Priority**: 🚨 CRITICAL - Blocking 2,000+ profile scale

## Overview

Fix the disabled LOD (Level of Detail) system to enable smooth tier transitions without size jumping, tier thrashing, or visual flicker.

## Problem Statement

**Current State:** LOD disabled with TEMP comments at lines 851, 2253, 2290 in TreeView.js

**Known Bugs:**
- Tier thrashing (rapid T1 ↔ T2 switching)
- Size jumping (unexpected node size changes)
- Visual flicker (instant tier switches)
- Inconsistent scale quantum (5% steps)

**Root Causes:**
1. Hysteresis too narrow (±15%)
2. Scale quantum too coarse (0.05)
3. No smooth interpolation
4. Missing device DPI handling

## Success Criteria

- [ ] Smooth tier transitions (no size jumping)
- [ ] Hysteresis prevents thrashing (±25% deadzone)
- [ ] Visual parity with Phase 2 at full zoom
- [ ] Performance: <5ms tier calculation, 60fps
- [ ] All TEMP comments removed

## Implementation Plan

### Day 1: Constants & Device DPI (8h)
- Widen hysteresis: ±15% → ±25%
- Refine scale quantum: 5% → 2%
- Add device-aware DPI scaling
- Write unit tests for new boundaries

### Day 2: Animated Transitions (12h)
- Create TierTransitionAnimator.ts
- Add interpolated tier state
- Integrate with NodeRenderer
- Implement opacity crossfade

### Day 3: Integration & Testing (6h)
- Remove TEMP comments from TreeView.js
- Test on physical device (iPhone XR, iPad, Android)
- Performance profiling (tier calc time, FPS, memory)

### Day 4: Polish & Documentation (4h)
- Fix visual regressions
- Add LOD_ENABLED feature flag
- Document new LOD behavior

## Rollback Strategy

**Immediate rollback**: Set `LOD_ENABLED = false` (5 minutes)

## Files Changed

**Modified:**
- `src/components/TreeView/lod/LODCalculator.ts`
- `src/components/TreeView.js`
- `src/components/TreeView/rendering/NodeRenderer.tsx`

**Created:**
- `src/components/TreeView/lod/TierTransitionAnimator.ts`
- `tests/components/TreeView/lod/*.test.ts` (unit tests)

## Success Metrics

| Metric | Target |
|--------|--------|
| Tier calculation time | <5ms |
| Frame rate during transition | >57fps |
| Visual parity | Pixel-perfect |
| Memory stability | ±5MB variance |

---

**Ready to Start**: ✅ All entry criteria met
**See**: [Phase 3 Roadmap](../02-IMPLEMENTATION_ROADMAP.md) for full context
