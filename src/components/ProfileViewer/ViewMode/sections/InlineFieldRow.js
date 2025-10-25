/**
 * InlineFieldRow Component - Pattern 3 (Flexible Row with Icon + Text)
 *
 * Core Pattern for data display with maximum Dynamic Type support
 * - Flexible height (grows with content, no fixed heights)
 * - Icon support (left side, optional)
 * - Text supports unlimited line wrapping
 * - Bottom divider for visual hierarchy
 * - Token system for all styling
 *
 * Usage:
 * <InlineFieldRow
 *   icon="location-outline"
 *   label="الموقع"
 *   value="الرياض، المملكة العربية السعودية"
 *   showDivider={true}
 * />
 *
 * Supports:
 * - Dynamic Type text sizing (XS to Accessibility XXL)
 * - Multi-line values with unlimited wrapping
 * - RTL/LTR automatic handling
 * - VoiceOver accessibility
 * - Icon color customization (muted, primary, secondary)
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens, { useAccessibilitySize, hexWithOpacity } from '../../ui/tokens';

const { colors, spacing, profileViewer } = tokens;
const { inlineRow } = profileViewer;

const InlineFieldRow = ({
  icon = null,
  iconColor = colors.najdi.textMuted,
  label = '',
  value = '',
  showDivider = true,
  onLayout = null,
  testID = null,
  accessibilityLabel = null,
}) => {
  const { shouldUseAlternateLayout } = useAccessibilitySize();

  // If in accessibility mode and content is very long, use simplified layout
  const useSimplifiedLayout = shouldUseAlternateLayout && value?.length > 100;

  // Memoize styles to prevent unnecessary recalculation
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          minHeight: inlineRow.minHeight,
          paddingVertical: inlineRow.paddingVertical,
          paddingHorizontal: inlineRow.paddingHorizontal,
          flexDirection: 'row',
          alignItems: 'flex-start',  // Top align for multi-line content
          justifyContent: 'flex-start',
          borderBottomWidth: showDivider ? 1 : 0,
          borderBottomColor: showDivider
            ? hexWithOpacity(colors.najdi.text, inlineRow.borderBottomOpacity)  // ✅ Cleaner, reusable
            : 'transparent',
        },
        iconContainer: {
          width: inlineRow.iconSize,
          height: inlineRow.iconSize,
          marginRight: inlineRow.gapBetweenElements,
          marginTop: 2,  // Slight offset to align with text baseline
          flexShrink: 0,  // Prevent icon from shrinking
          justifyContent: 'center',
          alignItems: 'center',
        },
        textContainer: {
          flex: 1,  // Take remaining space
          justifyContent: 'flex-start',
          minHeight: inlineRow.minHeight - inlineRow.paddingVertical * 2,
        },
        label: {
          fontSize: tokens.typography.footnote.fontSize,
          fontWeight: '600',
          color: colors.najdi.textMuted,
          marginBottom: 4,
        },
        value: {
          fontSize: tokens.typography.body.fontSize,
          fontWeight: '400',
          color: colors.najdi.text,
          lineHeight: 22,
          // Allow unlimited wrapping for multi-line content
          numberOfLines: 0,
        },
        simplifiedValue: {
          // In accessibility mode, use smaller font for better fit
          fontSize: tokens.typography.callout.fontSize,
        },
      }),
    [showDivider]
  );

  // Build accessibility label for VoiceOver
  const builtAccessibilityLabel = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    if (label && value) return `${label}: ${value}`;
    return value || label;
  }, [label, value, accessibilityLabel]);

  // Guard: if no content, don't render
  if (!value && !label) {
    return null;
  }

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      testID={testID}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={builtAccessibilityLabel}
    >
      {/* Icon (optional, left side) */}
      {icon && (
        <View style={styles.iconContainer}>
          <Ionicons
            name={icon}
            size={inlineRow.iconSize}
            color={iconColor}
            accessible={false}  // Icon is decorative, skip in accessibility tree
          />
        </View>
      )}

      {/* Text container (label + value) */}
      <View style={styles.textContainer}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Text
          style={[styles.value, useSimplifiedLayout && styles.simplifiedValue]}
          numberOfLines={0}  // Unlimited wrapping
        >
          {value}
        </Text>
      </View>
    </View>
  );
};

export default React.memo(InlineFieldRow);
