# Phase 3: Performance Optimization

**Status**: 📋 Phase 3 Preliminary Complete ✅ | Phase 3B Ready to Start 🚀
**Estimated Duration**: 85-100 hours (12-15 days) - Reduced from 120-140 after LOD postponement
**Priority**: CRITICAL for 2,000+ profiles

## Overview

Phase 3 focuses on performance optimization to support 10,000+ profiles with 60fps rendering. Organized into independent sub-phases that can proceed in parallel.

**Phase 3 Preliminary (Complete)**:
- ✅ Fixed connection line lag (50ms → 2ms, 96% faster)
- ✅ Fixed disappearing lines (Skia clipping hierarchy)
- ✅ Fixed missing bottom-row lines (MAX_VISIBLE_EDGES: 300 → 10,000)

## Documentation Index

- **[01-PLAN.md](./01-PLAN.md)** - Comprehensive Phase 3 master plan (full details)
- **[02-IMPLEMENTATION_ROADMAP.md](./02-IMPLEMENTATION_ROADMAP.md)** - Actionable implementation roadmap (how to execute)
- **[lod-system/](./lod-system/)** - Phase 3A: LOD System Redesign (30h, 4-5 days) - **POSTPONED**
- **[progressive-loading/](./progressive-loading/)** - Phase 3B: Progressive Loading (25h, 3-4 days) - **CRITICAL - NEXT PRIORITY** 🚀
- **[theme-system/](./theme-system/)** - Phase 3C: Theme System (20h, 3 days)
- **[advanced-navigation/](./advanced-navigation/)** - Phase 3D: Advanced Navigation (30h, 4-5 days)
- **[enhanced-highlighting/](./enhanced-highlighting/)** - Phase 3E: Enhanced Highlighting (15h, 2-3 days)

## Critical Work (Next)

### Phase 3B: Progressive Loading (25 hours) - **NEXT PRIORITY** 🚀
**Status**: ✅ Backend Ready - `get_visible_nodes()` RPC EXISTS

**Problem**: Currently loading all 2,000+ profiles on mount
- Slow initial load (~800ms for 56 profiles, will be worse at scale)
- High memory usage
- Won't scale to 10,000+ profiles

**Solution**: Load only visible viewport nodes using existing backend RPC
- Memory usage: <50MB for 10,000 profiles
- Viewport query: <100ms response
- Supports 10,000+ profile capacity

## Medium Priority (Can Run in Parallel)

- **Phase 3A**: LOD System Redesign (30h) - **POSTPONED** (photos now UI-controlled, not as critical)
- **Phase 3C**: Theme System (20h) - Design tokens, dark mode
- **Phase 3D**: Advanced Navigation (30h) - Minimap, quick access
- **Phase 3E**: Enhanced Highlighting (15h) - Ancestry overlay

## Recommendation

**START 3B NOW** - Critical for scaling to 10,000+ profiles ✅
**DEFER 3A** - LOD postponed indefinitely, not blocking anything
**DEFER 3C-E** - Nice-to-have features, can run in parallel after 3B

## Prerequisites

Phase 1 & 2 complete ✅ - Clean architecture ready for Phase 3
Phase 3 Preliminary complete ✅ - Rendering fixes committed
Backend RPC exists ✅ - `get_visible_nodes()` ready to use
