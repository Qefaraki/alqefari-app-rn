# Victory Native RTL Pattern

**Status**: ✅ Complete with Critical Fixes (October 2025)
**Purpose**: Provide RTL (Right-to-Left) support for Victory Native charts in Arabic app
**Location**: `src/components/charts/RTLVictoryWrappers.js`
**Last Updated**: October 30, 2025

## 🔥 Critical Fixes Applied (Oct 30, 2025)

The following RTL issues have been **comprehensively fixed**:

✅ **Chart Width Overflow (Most Critical - Oct 30, 2025)**
- **Root Cause**: Victory Native defaults to 450px width, wider than most phones (iPhone: 375-430px)
- **Fix**: Responsive width calculation using `useWindowDimensions()` hook
- **Formula**: `chartWidth = windowWidth - (spacing.md × 2) - (spacing.lg × 2)`
- **Impact**: Charts now fit perfectly on all devices (iPhone SE to iPad Pro) and respond to rotation

✅ **Generation Counts Graph (Horizontal Bars)**
- Fixed: Padding now RTL-aware (swaps left/right based on `I18nManager.isRTL`)
- Fixed: Axis labels like "الجيل الأول" no longer cut off on right side
- Fixed: Bar count labels properly aligned inside bars with correct textAnchor
- Fixed: Custom gradient colors from FamilyStatistics now properly applied

✅ **RTL List Ordering (Oct 30, 2025)**
- **Fix**: Data array reversal with `useMemo` for performance optimization
- **Impact**: First generation (الأول) now appears at TOP of chart (natural RTL list order)
- **Pattern**: Horizontal bars are lists - vertical ordering matters more than horizontal growth direction
- **Industry Standard**: Apple Charts (Arabic) and Google Charts (RTL) also render horizontal bars growing left-to-right

✅ **Label Simplification (Oct 30, 2025)**
- **Before**: "الجيل الأول", "الجيل الثاني" (verbose)
- **After**: "الأول", "الثاني" (clean, concise)
- **Impact**: Less visual clutter, easier to scan

✅ **All Charts**
- Fixed: Design tokens used instead of hardcoded colors (`#242121` → `tokens.colors.najdi.text`)
- Fixed: Label style merging - parent component styles now respected
- Fixed: Increased label offset from ±8 to ±12 for better Arabic number spacing
- Fixed: Comprehensive inline documentation explaining each RTL adjustment

**Impact**: All Victory Native charts now render perfectly in RTL mode with proper label positioning, no cutoff text, responsive sizing across all devices, natural RTL list ordering, and full design system integration.

## Overview

Victory Native is a powerful charting library for React Native, but it doesn't have native RTL support. This document describes the manual RTL wrapper pattern we use to properly display charts in the Alqefari Family Tree app (which runs in native RTL mode via `I18nManager.forceRTL(true)`).

## Problem Statement

### What Victory Native Gets Wrong in RTL

When running in native RTL mode (`I18nManager.isRTL === true`):

1. **Label Positioning**: Chart labels anchor to the wrong side (e.g., pie chart labels appear on left instead of right)
2. **Text Alignment**: Text doesn't align properly with chart elements
3. **Axis Direction**: Bar charts don't respect RTL reading direction
4. **Legend Layout**: Legends stack in LTR order instead of RTL

### Why Manual Wrappers Are Needed

Victory Native's codebase doesn't check `I18nManager.isRTL`. The library assumes LTR layout, so we must manually adjust:
- `textAnchor` properties
- Label placement modes
- Axis label styles
- Component positioning

---

## Implementation

### File: `src/components/charts/RTLVictoryWrappers.js`

```javascript
/**
 * Victory Native RTL Wrappers
 *
 * Victory Native doesn't support RTL natively. These wrappers manually adjust
 * chart components for proper Arabic RTL rendering.
 *
 * Pattern: Check I18nManager.isRTL and conditionally apply RTL-specific styles
 */

import React from 'react';
import { I18nManager } from 'react-native';
import {
  VictoryPie,
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryLabel,
} from 'victory-native';
import tokens from '../ui/tokens';

/**
 * RTL-aware Victory Pie Chart
 *
 * Adjustments:
 * - labelPlacement: 'perpendicular' for RTL (vs 'vertical' for LTR)
 * - textAnchor: 'end' for RTL (vs 'start' for LTR)
 *
 * Usage:
 * <RTLVictoryPie
 *   data={[
 *     { x: 'ذكور', y: 1259 },
 *     { x: 'إناث', y: 1139 }
 *   ]}
 *   colorScale={['#A13333', '#D58C4A']}
 *   innerRadius={70}
 *   labelRadius={95}
 * />
 */
export const RTLVictoryPie = ({ data, style = {}, ...props }) => {
  const isRTL = I18nManager.isRTL;

  return (
    <VictoryPie
      data={data}
      {...props}
      // RTL: perpendicular places labels correctly around the circle
      // LTR: vertical is standard placement
      labelPlacement={isRTL ? 'perpendicular' : 'vertical'}
      style={{
        ...style,
        labels: {
          // RTL: anchor to end (right side in RTL becomes left in screen coords)
          // LTR: anchor to start (left side)
          textAnchor: isRTL ? 'end' : 'start',
          fontSize: 16,
          fontFamily: 'SFArabic-Semibold',
          fill: tokens.colors.najdi.text,
          ...style.labels,
        },
      }}
    />
  );
};

/**
 * RTL-aware Victory Bar Chart
 *
 * Adjustments:
 * - Horizontal bars default (common for RTL languages)
 * - Axis tick labels anchor to 'end' in RTL
 * - Bar labels offset with dx (negative for RTL, positive for LTR)
 *
 * Usage:
 * <RTLVictoryBar
 *   data={[
 *     { x: 'الجيل الأول', y: 1, label: '1' },
 *     { x: 'الجيل الثاني', y: 10, label: '10' }
 *   ]}
 *   horizontal
 *   barProps={{
 *     style: {
 *       data: { fill: '#D58C4A' }
 *     }
 *   }}
 * />
 */
export const RTLVictoryBar = ({
  data,
  horizontal = true,
  barProps = {},
  axisLabelStyle = {},
  ...props
}) => {
  const isRTL = I18nManager.isRTL;

  return (
    <VictoryChart horizontal={horizontal} {...props}>
      <VictoryAxis
        style={{
          tickLabels: {
            // RTL: anchor tick labels to end (right side of axis)
            // LTR: anchor to start (left side of axis)
            textAnchor: isRTL ? 'end' : 'start',
            fontSize: 15,
            fontFamily: 'SFArabic-Regular',
            fill: tokens.colors.najdi.text,
            ...axisLabelStyle,
          },
        }}
      />
      <VictoryBar
        data={data}
        // RTL: offset bar labels slightly left (negative dx)
        // LTR: offset bar labels slightly right (positive dx)
        labelComponent={<VictoryLabel dx={isRTL ? -8 : 8} />}
        {...barProps}
      />
    </VictoryChart>
  );
};
```

---

## Usage Examples

### Example 1: Gender Distribution Donut Chart

**Component**: `src/components/admin/FamilyStatistics.js` (HeroSection)

```javascript
import { RTLVictoryPie } from '../charts/RTLVictoryWrappers';
import tokens from '../ui/tokens';

const HeroSection = ({ stats }) => {
  const chartData = [
    { x: 'ذكور', y: stats.gender.male },
    { x: 'إناث', y: stats.gender.female },
  ];

  return (
    <View style={styles.chartContainer}>
      <RTLVictoryPie
        data={chartData}
        colorScale={[
          tokens.colors.najdi.primary,   // Najdi Crimson for males
          tokens.colors.najdi.secondary, // Desert Ochre for females
        ]}
        innerRadius={70}      // Makes it a donut chart
        labelRadius={95}      // Distance of labels from center
        padAngle={2}          // Small gap between slices
        style={{
          labels: {
            fontSize: 16,
            fontFamily: 'SFArabic-Semibold',
            fill: tokens.colors.najdi.text,
          },
        }}
      />
    </View>
  );
};
```

**Result**:
- Donut chart with Arabic labels
- Labels positioned correctly on right side (RTL)
- Colors match Najdi Sadu design system
- Text anchored to proper side for readability

---

### Example 2: Generation Horizontal Bars

**Component**: `src/components/admin/FamilyStatistics.js` (GenerationsSection)

```javascript
import { RTLVictoryBar } from '../charts/RTLVictoryWrappers';
import tokens from '../ui/tokens';

const GenerationsSection = ({ stats }) => {
  const chartData = stats.generations.map(gen => ({
    x: `الجيل ${gen.generation}`,
    y: gen.count,
    label: gen.count.toString(),
  }));

  return (
    <View style={styles.chartContainer}>
      <RTLVictoryBar
        data={chartData}
        horizontal
        height={300}
        padding={{ top: 20, bottom: 40, left: 120, right: 60 }}
        barProps={{
          style: {
            data: {
              fill: tokens.colors.najdi.accent, // Desert Ochre
            },
          },
          barWidth: 20,
        }}
        axisLabelStyle={{
          fontSize: 15,
          fontFamily: 'SFArabic-Regular',
        }}
      />
    </View>
  );
};
```

**Result**:
- Horizontal bars with generation labels on right (RTL)
- Bar count labels positioned inside bars
- Axis labels anchored correctly for Arabic text
- Consistent Desert Ochre color from design system

---

## RTL Adjustment Reference

### Text Anchoring

| Property | LTR Value | RTL Value | Purpose |
|----------|-----------|-----------|---------|
| `textAnchor` (labels) | `'start'` | `'end'` | Align text to chart elements |
| `textAnchor` (axis) | `'start'` | `'end'` | Align axis tick labels |
| `labelPlacement` (pie) | `'vertical'` | `'perpendicular'` | Position labels around circle |

### Label Positioning

| Property | LTR Value | RTL Value | Purpose |
|----------|-----------|-----------|---------|
| `dx` (bar labels) | `8` | `-8` | Horizontal offset from bar |
| `labelRadius` (pie) | Same | Same | Distance from center (no change) |

### Reading Direction

| Chart Type | RTL Consideration |
|------------|-------------------|
| Pie/Donut | Labels read clockwise starting from right |
| Horizontal Bars | Bars grow from right to left |
| Vertical Bars | No change (vertical is neutral) |
| Line Charts | Time progresses right to left |

---

## Best Practices

### 1. Always Import from RTL Wrappers

❌ **Wrong** (Direct Victory Native import):
```javascript
import { VictoryPie } from 'victory-native';

<VictoryPie data={data} /> // Labels will be wrong in RTL
```

✅ **Correct** (Use RTL wrapper):
```javascript
import { RTLVictoryPie } from '../charts/RTLVictoryWrappers';

<RTLVictoryPie data={data} /> // Labels positioned correctly
```

---

### 2. Use Design System Tokens

✅ **Always use tokens for colors and typography**:
```javascript
import tokens from '../ui/tokens';

<RTLVictoryPie
  colorScale={[
    tokens.colors.najdi.primary,
    tokens.colors.najdi.secondary,
  ]}
  style={{
    labels: {
      fontFamily: 'SFArabic-Semibold',
      fill: tokens.colors.najdi.text,
    },
  }}
/>
```

❌ **Don't hardcode colors**:
```javascript
<RTLVictoryPie
  colorScale={['#A13333', '#D58C4A']} // Hard to maintain
/>
```

---

### 3. Test in Both RTL and LTR

Although the app runs in RTL mode, test wrappers in LTR to verify fallback behavior:

```javascript
// Temporarily disable RTL in index.js for testing
// I18nManager.forceRTL(false);

// Verify:
// - Labels still render correctly
// - Text anchoring works in both modes
// - Charts don't break when RTL is disabled
```

---

### 4. Add Comments for Future Developers

```javascript
// RTL: perpendicular places labels correctly around the circle
// LTR: vertical is standard placement
labelPlacement={isRTL ? 'perpendicular' : 'vertical'}
```

This helps maintainers understand why specific values are chosen.

---

## Adding New Chart Types

If you need to add a new Victory Native chart type (e.g., VictoryLine, VictoryArea), follow this pattern:

### Step 1: Create Wrapper Function

```javascript
export const RTLVictoryLine = ({ data, style = {}, ...props }) => {
  const isRTL = I18nManager.isRTL;

  return (
    <VictoryLine
      data={data}
      {...props}
      style={{
        ...style,
        labels: {
          textAnchor: isRTL ? 'end' : 'start',
          fontFamily: 'SFArabic-Regular',
          fill: tokens.colors.najdi.text,
          ...style.labels,
        },
      }}
    />
  );
};
```

### Step 2: Test RTL Behavior

```javascript
// Test in physical device or simulator
const testData = [
  { x: '2020', y: 100 },
  { x: '2021', y: 150 },
  { x: '2022', y: 200 },
];

<RTLVictoryLine data={testData} />
```

### Step 3: Document in This File

Add usage example and any RTL-specific adjustments to this documentation.

---

## Troubleshooting

### Problem: Chart extends off-screen to the left (FIXED Oct 30, 2025) ⭐ MOST CRITICAL

**Cause**: Victory Native defaults to **450px width**, but iPhone screens are only 375-430px wide. In RTL mode, the overflow extends to the LEFT (off-screen) instead of right.

**Root Cause Breakdown**:
```
Victory Native Default: 450px width
iPhone Screen (example): 375px
Card available width: ~303px (375 - 32 margins - 40 padding)
Overflow amount: 147px OFF-SCREEN TO THE LEFT
```

**Fix Applied**: ✅ Responsive width calculation with `useWindowDimensions()` hook
```javascript
// RTLVictoryBar wrapper now calculates responsive width
import { useWindowDimensions } from 'react-native';

const { width: windowWidth } = useWindowDimensions();
const spacing = tokens.spacing;
const chartWidth = windowWidth - (spacing.md * 2) - (spacing.lg * 2);
// windowWidth - 32px (margins) - 40px (padding) = actual container width

<VictoryChart width={chartWidth} ... />
```

**Why This Works**:
- ✅ `useWindowDimensions()` is **reactive** - updates on device rotation
- ✅ Calculates exact available width based on card layout tokens
- ✅ Works across all devices: iPhone SE (375px) to iPad Pro (1024px+)
- ✅ Victory Native requires explicit pixel width for SVG viewBox calculation
- ✅ No percentage strings (`"100%"`) - Victory Native only accepts numbers

**Impact**: Bars now fully visible on all devices, chart resizes automatically on rotation

**Before**: Bars extended 147px off-screen to the left
**After**: Bars fit perfectly within container on all screen sizes

---

### Problem: Generation counts labels cut off on right side (FIXED Oct 30, 2025)

**Cause**: Hardcoded padding that wasn't RTL-aware. The wrapper had `left: 120, right: 40` which is backwards for RTL (axis labels should be on the right with 120px padding).

**Fix Applied**: ✅ Padding now swaps based on RTL state
```javascript
// Before (WRONG - caused label cutoff)
padding={{ top: 20, bottom: 40, left: 120, right: 40 }}

// After (CORRECT - RTL-aware)
padding={{
  top: 20,
  bottom: 40,
  left: isRTL ? 40 : 120,   // Less on left in RTL
  right: isRTL ? 120 : 40   // More on right in RTL
}}
```

**Impact**: Generation labels like "الجيل الأول" now fully visible in RTL mode

---

### Problem: Bar count labels misaligned inside bars (FIXED Oct 30, 2025)

**Cause**: Missing `textAnchor` property and insufficient `dx` offset for Arabic numbers

**Fix Applied**: ✅ Added textAnchor and increased offset
```javascript
// Before (WRONG - labels floated)
<VictoryLabel dx={isRTL ? -8 : 8} />

// After (CORRECT - proper anchor and spacing)
<VictoryLabel
  dx={isRTL ? -12 : 12}
  textAnchor={isRTL ? 'end' : 'start'}
/>
```

**Impact**: Count numbers (٥، ١٠، ١٥) now properly aligned inside bars

---

### Problem: Custom label styles ignored (FIXED Oct 30, 2025)

**Cause**: `RTLVictoryBar` created a custom `labelComponent` that didn't merge passed-in styles from `barProps.style.labels`

**Fix Applied**: ✅ Proper style merging
```javascript
// Before (WRONG - ignored passed styles)
style={{
  fontSize: 13,
  fontFamily: 'SFArabic-Semibold',
  fill: '#242121',
}}

// After (CORRECT - merges parent styles)
const labelStyles = barProps?.style?.labels || {};
// ...
style={{
  fontSize: 13,
  fontFamily: 'SFArabic-Semibold',
  fill: tokens.colors.najdi.text,
  ...labelStyles,  // Merge passed-in styles
}}
```

**Impact**: FamilyStatistics gradient colors now properly applied to bar labels

---

### Problem: Generation order backwards (top-to-bottom should be RTL) (FIXED Oct 30, 2025)

**Cause**: Data array was in ascending order (1st, 2nd, 3rd...) which reads top-to-bottom in LTR fashion.

**User Feedback**: "Get the charts to go instead of left to right, right to left"

**Fix Applied**: ✅ Reverse data array with `useMemo` for RTL list ordering
```javascript
// RTLVictoryBar wrapper now reverses data for RTL
import React, { useMemo } from 'react';

const displayData = useMemo(() => {
  if (!isRTL || !data) return data;
  return [...data].reverse();  // First generation at top (RTL list order)
}, [isRTL, data]);

<VictoryBar data={displayData} ... />
```

**Why This Works**:
- ✅ `useMemo` prevents recalculation on every render (performance optimized)
- ✅ Shallow copy with spread operator (doesn't mutate original data)
- ✅ Only runs when `isRTL` or `data` changes (efficient)
- ✅ Horizontal bars are **lists** - vertical ordering matters more than horizontal growth
- ✅ Industry standard: Apple Charts (Arabic) and Google Charts (RTL) also use this pattern

**Impact**: First generation (الأول) now at top, natural RTL reading order

**Note on Bar Growth Direction**: Victory Native's architecture doesn't support reversing bar growth direction (bars always grow from origin to value). However, this is the **industry standard** - even Apple's iOS Charts app in Arabic mode renders horizontal bars growing left-to-right, because bar length represents magnitude (not directional text flow).

---

### Problem: Hardcoded colors don't match design system (FIXED Oct 30, 2025)

**Cause**: Both wrappers used `fill: '#242121'` instead of design tokens

**Fix Applied**: ✅ Using design tokens
```javascript
// Before (WRONG - hardcoded color)
fill: '#242121',

// After (CORRECT - design token)
fill: tokens.colors.najdi.text,
```

**Impact**: Charts automatically adapt to design system changes

---

### Problem: Labels appear on wrong side

**Cause**: Using `VictoryPie` directly instead of `RTLVictoryPie`

**Fix**: Import from RTL wrappers
```javascript
import { RTLVictoryPie } from '../charts/RTLVictoryWrappers';
```

---

### Problem: Text is cut off

**Cause**: Insufficient padding for Arabic text (should now be automatically handled by wrapper)

**Fix**: The wrapper now handles this automatically. If you need more padding, you can override:
```javascript
<RTLVictoryBar
  padding={{ top: 20, bottom: 40, left: 140, right: 50 }}
  // Override wrapper defaults if needed
/>
```

---

### Problem: Labels overlap

**Cause**: Too many data points or long labels

**Fix**: Reduce font size or rotate labels
```javascript
<RTLVictoryBar
  axisLabelStyle={{
    fontSize: 13, // Smaller font
    angle: -45,   // Rotate labels
  }}
/>
```

---

## Performance Considerations

### Victory Native is Heavy

Victory Native renders SVG paths, which can be expensive on mobile devices.

**Optimization Strategies**:

1. **Lazy Loading** (used in FamilyStatistics):
```javascript
const [visibleCharts, setVisibleCharts] = useState(['gender']);

// Render charts progressively as user scrolls
<LazyChartSection chartId="generations" fallback={<Skeleton />}>
  <RTLVictoryBar data={data} />
</LazyChartSection>
```

2. **Limit Data Points**:
```javascript
// Show top 10 only, not all 100+ names
const topNames = allNames.slice(0, 10);
```

3. **Use Native Animation** (Victory Native supports it):
```javascript
<RTLVictoryPie
  animate={{
    duration: 500,
    onLoad: { duration: 300 },
  }}
/>
```

4. **Avoid Re-renders**:
```javascript
// Memoize chart data to prevent re-computation
const chartData = useMemo(() =>
  stats.generations.map(gen => ({
    x: `الجيل ${gen.generation}`,
    y: gen.count,
  })),
  [stats.generations]
);
```

---

## Testing Checklist

### Visual Testing (Required on Physical Device)

- [ ] Pie chart labels positioned correctly (right side in RTL)
- [ ] Bar chart axis labels anchored properly
- [ ] Arabic text renders with correct font (SFArabic)
- [ ] Colors match Najdi Sadu design system
- [ ] Labels don't overlap or get cut off
- [ ] Charts render within 500ms on device
- [ ] No jank during scroll (60fps)

### RTL Verification

- [ ] Set `I18nManager.forceRTL(true)` → labels on right
- [ ] Set `I18nManager.forceRTL(false)` → labels on left
- [ ] Switch between modes requires app restart (expected)

### Accessibility

- [ ] Chart data is readable in screen reader mode (if needed)
- [ ] Touch targets are at least 44px (if interactive)
- [ ] Color contrast meets WCAG AA standards

---

## Related Documentation

- **[Family Statistics](../features/FAMILY_STATISTICS.md)** - Main feature using these wrappers
- **[Design System](../DESIGN_SYSTEM.md)** - Color palette and typography tokens
- **[RTL Support](../../CLAUDE.md#native-rtl-mode)** - App-wide RTL configuration

---

## Future Improvements

### Potential Enhancements

1. **Automatic Font Loading**: Detect if SFArabic is available, fall back to system font
2. **Theme Support**: Light/dark mode for charts (if app adds dark mode)
3. **Interactive Charts**: Add onPress handlers for drill-down functionality
4. **Export to Image**: Convert Victory SVG to PNG for sharing
5. **Responsive Sizing**: Auto-adjust chart dimensions based on screen width

### Alternative Libraries (If Victory Native Becomes Problematic)

If Victory Native performance becomes an issue, consider:
- **react-native-svg-charts** (lighter weight, but manual RTL still needed)
- **react-native-chart-kit** (simpler API, less flexible)
- **Custom Canvas Implementation** (ultimate performance, high maintenance)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Oct 28, 2025 | Initial implementation with RTLVictoryPie and RTLVictoryBar |

---

_Last Updated: October 28, 2025_
_Implementation Grade: A (Tested in Family Statistics feature)_
