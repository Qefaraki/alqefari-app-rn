import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import tokens from './tokens';

const SegmentedControl = ({
  options = [], // [{label, value}]
  value,
  onChange,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.segment, active && styles.activeSegment]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: tokens.radii.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: tokens.radii.md,
  },
  activeSegment: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
  },
  label: {
    fontSize: 15,
    color: tokens.colors.textMuted,
    fontWeight: '600',
  },
  activeLabel: {
    color: tokens.colors.text,
  },
});

export default SegmentedControl;

