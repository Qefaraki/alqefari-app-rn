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
import { I18nManager } from 'react-native';
import {
  VictoryPie,
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryLabel
} from 'victory-native';

/**
 * RTL-aware VictoryPie wrapper
 *
 * Adjusts:
 * - Label text anchor (end in RTL, start in LTR)
 * - Label placement for proper positioning
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
      labelPlacement={isRTL ? 'perpendicular' : 'vertical'}
      style={{
        ...style,
        labels: {
          textAnchor: isRTL ? 'end' : 'start',
          fontSize: 16,
          fontFamily: 'SFArabic-Semibold',
          fill: '#242121',
          ...style.labels,
        },
      }}
    />
  );
};

/**
 * RTL-aware VictoryBar wrapper (for horizontal bars)
 *
 * Adjusts:
 * - Axis label text anchor (end in RTL, start in LTR)
 * - Bar label positioning (dx negative in RTL)
 *
 * @param {Object} props - Configuration props
 * @param {Array} props.data - Chart data
 * @param {Object} props.barProps - Props passed to VictoryBar
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

  return (
    <VictoryChart
      horizontal={horizontal}
      domainPadding={{ x: 20, y: 10 }}
      padding={{ top: 20, bottom: 40, left: 120, right: 40 }}
      height={height}
      {...chartProps}
    >
      <VictoryAxis
        style={{
          axis: { stroke: 'transparent' },
          tickLabels: {
            fontSize: 14,
            fontFamily: 'SFArabic-Regular',
            fill: '#242121',
            textAnchor: isRTL ? 'end' : 'start',
            ...axisLabelStyle,
          },
        }}
      />
      <VictoryBar
        data={data}
        labelComponent={
          <VictoryLabel
            dx={isRTL ? -8 : 8}
            style={{
              fontSize: 13,
              fontFamily: 'SFArabic-Semibold',
              fill: '#242121',
            }}
          />
        }
        barWidth={25}
        {...barProps}
      />
    </VictoryChart>
  );
};
