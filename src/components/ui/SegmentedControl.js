import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import tokens from './tokens';

/**
 * Standard iOS-style segmented control with pill design
 *
 * Clean, minimal component for tab-like navigation with active state.
 * Matches Najdi Sadu design system with Camel Hair Beige container
 * and white active pills with subtle shadow. Full RTL support.
 *
 * @component
 * @example
 * const options = [
 *   { id: 'pending', label: 'قيد المراجعة' },
 *   { id: 'approved', label: 'مقبولة' },
 *   { id: 'rejected', label: 'مرفوضة' },
 * ];
 *
 * <SegmentedControl
 *   options={options}
 *   value={activeTab}
 *   onChange={setActiveTab}
 * />
 */
const SegmentedControl = ({
  options = [],
  value,
  onChange,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.control}>
        {options.map((option) => {
          const isActive = option.id === value;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.segment,
                isActive && styles.segmentActive,
              ]}
              onPress={() => onChange(option.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={option.label}
            >
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  control: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.najdi.container + '40', // Camel Hair Beige 40%
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: tokens.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
  },
});

export default SegmentedControl;

