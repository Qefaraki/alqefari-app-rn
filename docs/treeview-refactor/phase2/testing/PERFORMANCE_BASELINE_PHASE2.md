# Phase 2 Performance Baseline

**Generated:** 2025-10-23T12:16:44.912Z
**Device:** To be measured on iPhone XR
**Fixture:** 2392 profiles, 1022 marriages

## Baseline Metrics

| Metric | Value | Max Allowed (5% tolerance) | Notes |
|--------|-------|----------------------------|-------|
| **Profiles** | 2392 | - | Production count |
| **Layout Time** | 826ms (estimated) | 867ms | Extrapolated from Phase 1 |
| **Memory (Tree Data)** | 1.34MB | 1.41MB | JSON.stringify() size |
| **FPS (Pan/Zoom)** | 60fps (target) | 57fps | React Native default |
| **Marriages** | 1022 | - | |

## Profile Distribution

- **Males:** 1199 (50.1%)
- **Females:** 1193 (49.9%)
- **With Photos:** 1064 (44.5%)
- **Deceased:** 402 (16.8%)
- **Munasib:** 1021 (42.7%)

## Generation Distribution

- **Gen 1:** 2 profiles (0.1%)
- **Gen 2:** 8 profiles (0.3%)
- **Gen 3:** 41 profiles (1.7%)
- **Gen 4:** 195 profiles (8.2%)
- **Gen 5:** 919 profiles (38.4%)
- **Gen 6:** 1227 profiles (51.3%)

## Validation Criteria

After each day of component extraction:

1. ✅ **Layout time** must be ≤ 867ms
2. ✅ **Memory usage** must be ≤ 1.41MB
3. ✅ **FPS** must be ≥ 57fps during pan/zoom
4. ✅ **Visual regression** - Tree must look identical

If any metric fails validation, use Day 13 buffer for optimization.

## Notes

- **Estimated layout time** is based on Phase 1 extrapolation (56 profiles = 92.5ms)
- **Viewport culling** limits actual render to ~500 visible nodes
- **Actual measurements** should be taken on physical iPhone XR
- **5% tolerance** accounts for normal variance and minor refactoring overhead

---

**Status:** Day 0 Complete - Ready for Component Extraction
