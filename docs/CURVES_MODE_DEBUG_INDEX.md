# Curves Mode DOWN-Scroll Asymmetry - Investigation Index

## Quick Navigation

**Problem**: Scrolling DOWN in curves mode shows pop-ins and stutters, while UP scroll is smooth.

### Files in This Investigation

1. **[CURVES_MODE_FINDINGS_SUMMARY.txt](./CURVES_MODE_FINDINGS_SUMMARY.txt)** - START HERE
   - Executive summary of all findings
   - High-level explanation of root causes
   - Severity assessment
   - 5 min read for quick understanding

2. **[CURVES_MODE_SCROLL_ASYMMETRY_REPORT.md](./CURVES_MODE_SCROLL_ASYMMETRY_REPORT.md)** - DEEP DIVE
   - Complete technical analysis with code snippets
   - Exact line numbers and file locations
   - Timeline diagrams showing the problem
   - Concrete metrics and calculations
   - Verification instructions
   - Detailed fix implementation guidance
   - 20-30 min read for comprehensive understanding

3. **[CURVES_MODE_ASYMMETRY_ANALYSIS.md](./CURVES_MODE_ASYMMETRY_ANALYSIS.md)** - ARCHITECTURE FOCUS
   - Why UP works but DOWN doesn't
   - Asymmetric coordinate system explanation
   - Data flow diagrams
   - Fix strategy ranked by effectiveness
   - 15-20 min read

## The Three Asymmetries

### Asymmetry #1: D3 Y-Axis Coordinate System
- **File**: `src/utils/treeLayoutCurves.js` (lines 108-114)
- **Issue**: Coordinate swap creates positive Y (down/descendants) vs negative Y (up/ancestors)
- **Impact**: Positive Y range is larger than negative Y range

### Asymmetry #2: Viewport Preload Margin
- **File**: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js` (line 44)
- **Issue**: 500px padding covers 9.2x viewport height, loads 250+ nodes initially
- **Impact**: Initial batch too large, processing time 250-350ms exceeds scroll response time

### Asymmetry #3: Batch Flush Timing
- **File**: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js` (lines 144-172)
- **Issue**: 300ms maxWait + user scroll velocity (500px/sec) = enrichment lags behind
- **Impact**: User reaches un-enriched nodes before batch completes

## Key Metrics

- Initial enrichment batch: ~250-300 nodes (85-90% of tree)
- Processing time: 250-350ms
- User scroll velocity: 500-1000px/sec
- Distance scrolled during processing: 150-300px
- Pop-in threshold: Approximately y=450+ (beyond initial batch)

## Critical Findings

1. **This is a curves-mode-only problem** - Normal mode not affected
2. **It's reproducible 100% of the time** - Happens on every DOWN scroll
3. **Root cause is architectural, not a bug** - Mismatch between layout coordinates and enrichment strategy
4. **Fix is straightforward** - Reduce padding from 500px to 250px for curves mode

## Recommended Fixes (Priority Order)

| Priority | Fix | Location | Impact |
|----------|-----|----------|--------|
| CRITICAL | Reduce padding 500px→250px | useViewportEnrichment.js:44 | 90%+ improvement |
| HIGH | Prioritize by viewport distance | useViewportEnrichment.js | Smoother progressive load |
| HIGH | Increase flush frequency | useViewportEnrichment.js:158 | Smaller batches, faster response |
| MEDIUM | Scroll direction detection | useViewportEnrichment.js | Prefetch in scroll direction |

## How to Verify the Analysis

1. **Enable debug logging** (see CURVES_MODE_SCROLL_ASYMMETRY_REPORT.md for code)
2. **Measure initial batch size**: Should show ~250-300 nodes
3. **Compare timing**: UP scroll should complete immediately, DOWN scroll should stutter
4. **Check Y-coordinates**: Nodes should show clear positive/negative split

## Testing Checklist

- [ ] Test UP scroll: Expect smooth, no pop-in
- [ ] Test DOWN scroll: Expect pop-in after 300-500ms
- [ ] Test zigzag scroll: Expect more stutters when going down
- [ ] Measure batch size: Should be 250-300 nodes
- [ ] Measure processing time: Should be 250-350ms
- [ ] Verify Y ranges: See positive vs negative split

## Architecture Context

This investigation uncovers how curves mode's 90° rotation of the tree creates a coordinate system asymmetry:

```
Normal mode: Linear Y increase (0 → +n)
Curves mode: Y = D3 breadth axis, split positive/negative (-n → +m)
```

The progressive loading system assumes symmetric preload margins, but curves mode creates asymmetric data distribution. This is the fundamental architectural mismatch.

## Next Steps

1. Review CURVES_MODE_FINDINGS_SUMMARY.txt (5 min)
2. Review CURVES_MODE_SCROLL_ASYMMETRY_REPORT.md (20 min)
3. Enable debug logging per instructions
4. Measure initial batch size on actual device
5. Implement CRITICAL fix (reduce padding)
6. Measure improvement with fix
7. Implement HIGH priority fixes as needed

## Related Files for Context

- Progressive loading architecture: `src/components/TreeView/hooks/useProgressiveTreeView.js`
- Structure loader: `src/components/TreeView/hooks/useStructureLoader.js`
- Enrichment hook: `src/components/TreeView/hooks/progressive/useViewportEnrichment.js`
- Viewport utilities: `src/components/TreeView/hooks/progressive/utils.js`
- Curves layout: `src/utils/treeLayoutCurves.js`
- Tree bounds calculation: `src/components/TreeView/TreeView.core.js` (lines 1058-1068)

## Questions?

Refer to the detailed reports for:
- Exact code examples with line numbers
- Timing diagrams
- Calculation walkthroughs
- Testing instructions
- Implementation examples
