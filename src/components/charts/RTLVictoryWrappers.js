/**
 * RTL Victory Wrappers
 *
 * Victory Native doesn't have built-in RTL support. These wrappers
 * manually adjust chart elements (labels, legends, axes) for RTL layouts.
 *
 * Usage:
 *   import { RTLVictoryPie, RTLVictoryBar } from '../charts/RTLVictoryWrappers';
 *   <RTLVictoryPie data={myData} />
 */

import React from 'react';
import { I18nManager, useWindowDimensions } from 'react-native';
import {
  VictoryPie,
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryLabel
} from 'victory-native';
import tokens from '../ui/tokens';

/**
 * RTL-aware VictoryPie wrapper
 *
 * RTL Adjustments:
 * - Label placement: 'perpendicular' in RTL (positions labels correctly around circle)
 * - Text anchor: 'end' in RTL (anchors Arabic text to proper side)
 * - Style merging: Respects passed-in label styles while providing RTL-safe defaults
 * - Design tokens: Uses Najdi Sadu color palette instead of hardcoded values
 *
 * @param {Object} props - All VictoryPie props
 * @returns {JSX.Element}
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
          // RTL: anchor to end (right side in RTL becomes proper position)
          // LTR: anchor to start (left side)
          textAnchor: isRTL ? 'end' : 'start',
          fontSize: 16,
          fontFamily: 'SFArabic-Semibold',
          fill: tokens.colors.najdi.text, // Use design token instead of hardcoded
          ...style.labels, // Allow override from parent component
        },
      }}
    />
  );
};

/**
 * RTL-aware VictoryBar wrapper (for horizontal bars)
 *
 * RTL Adjustments:
 * - Padding: Swaps left/right padding for RTL (axis labels on right in RTL)
 * - Axis labels: textAnchor 'end' in RTL (aligns labels to right side)
 * - Bar labels: textAnchor 'end' in RTL with increased dx offset for Arabic numbers
 * - Style merging: Respects passed-in label styles from barProps
 * - Design tokens: Uses Najdi Sadu color palette instead of hardcoded values
 *
 * Critical Fix: The generation counts graph (worst RTL offender) needs:
 *   1. 120px padding on RIGHT (not left) for RTL to fit "الجيل الأول" labels
 *   2. Proper label style inheritance for gradient colors
 *   3. Correct textAnchor for bar count labels
 *
 * @param {Object} props - Configuration props
 * @param {Array} props.data - Chart data
 * @param {Object} props.barProps - Props passed to VictoryBar (including style.labels)
 * @param {Object} props.axisLabelStyle - Style for axis labels
 * @param {boolean} props.horizontal - If true, renders horizontal bars
 * @returns {JSX.Element}
 */
export const RTLVictoryBar = ({
  data,
  horizontal = true,
  barProps = {},
  axisLabelStyle = {},
  height = 400,
  ...chartProps
}) => {
  const isRTL = I18nManager.isRTL;
  const { width: windowWidth } = useWindowDimensions();

  // Extract label styles from barProps to merge with defaults
  const labelStyles = barProps?.style?.labels || {};

  // CRITICAL FIX: Calculate responsive width to prevent overflow
  // Victory Native defaults to 450px width, which is wider than most phone screens!
  // We must explicitly calculate available width based on container layout:
  // - Card margins: tokens.spacing.md (16px) × 2 = 32px
  // - Card padding: tokens.spacing.lg (20px) × 2 = 40px
  // - Total offset: 72px
  // This ensures chart fits within container on all devices (iPhone SE to iPad Pro)
  const spacing = tokens.spacing;
  const cardMargins = spacing.md * 2;  // 32px total (16px each side)
  const cardPadding = spacing.lg * 2;  // 40px total (20px each side)
  const chartWidth = windowWidth - cardMargins - cardPadding;

  return (
    <VictoryChart
      width={chartWidth}  // ✅ EXPLICIT WIDTH - fixes off-screen overflow in RTL
      horizontal={horizontal}
      domainPadding={{ x: 20, y: 10 }}
      // CRITICAL FIX: Swap left/right padding for RTL
      // RTL: 40px left (bars), 120px right (axis labels like "الجيل الأول")
      // LTR: 120px left (axis labels), 40px right (bars)
      padding={{
        top: 20,
        bottom: 40,
        left: isRTL ? 40 : 120,
        right: isRTL ? 120 : 40
      }}
      height={height}
      {...chartProps}
    >
      <VictoryAxis
        style={{
          axis: { stroke: 'transparent' },
          tickLabels: {
            fontSize: 14,
            fontFamily: 'SFArabic-Regular',
            fill: tokens.colors.najdi.text, // Use design token
            // RTL: anchor to end (labels appear on right side)
            // LTR: anchor to start (labels appear on left side)
            textAnchor: isRTL ? 'end' : 'start',
            ...axisLabelStyle, // Allow override from parent
          },
        }}
      />
      <VictoryBar
        data={data}
        labelComponent={
          <VictoryLabel
            // CRITICAL FIX: Increased offset from ±8 to ±12 for better Arabic number spacing
            // RTL: -12 (shift left inside bar)
            // LTR: +12 (shift right inside bar)
            dx={isRTL ? -12 : 12}
            // CRITICAL FIX: Add textAnchor for proper label alignment
            // RTL: 'end' (anchor to right side of number)
            // LTR: 'start' (anchor to left side of number)
            textAnchor={isRTL ? 'end' : 'start'}
            style={{
              fontSize: 13,
              fontFamily: 'SFArabic-Semibold',
              fill: tokens.colors.najdi.text, // Use design token
              // CRITICAL FIX: Merge passed-in label styles (e.g., custom colors, padding)
              // This allows FamilyStatistics.js to pass barProps.style.labels and have them applied
              ...labelStyles,
            }}
          />
        }
        barWidth={25}
        {...barProps}
      />
    </VictoryChart>
  );
};
