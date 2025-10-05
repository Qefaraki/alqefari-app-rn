import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../../../ui/tokens';

const FieldRow = ({
  label,
  value,
  icon,
  onPress,
  copyable,
  status,
}) => {
  // Don't render empty values
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const content = (
    <View style={[
      styles.row,
      status ? styles.editedRow : null
    ]}>
      {/* Main content area */}
      <View style={styles.contentContainer}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.value}>{value}</Text>
      </View>

      {/* Right side: Status pill or icon */}
      <View style={styles.rightContainer}>
        {status ? (
          <View style={styles.statusPill}>
            <Ionicons
              name="time-outline"
              size={14}
              color={tokens.colors.najdi.primary}
            />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {icon && !status ? (
          <Ionicons
            name={icon}
            size={20}
            color={tokens.colors.najdi.textMuted}
          />
        ) : null}
      </View>
    </View>
  );

  // Make it touchable if interactive
  if (onPress || copyable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  touchable: {
    borderRadius: tokens.radii.sm, // 10px
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm, // 12px
    paddingVertical: tokens.spacing.xs, // 8px
    minHeight: tokens.touchTarget.minimum, // 44px
  },

  contentContainer: {
    flex: 1,
    gap: tokens.spacing.xxs, // 4px
  },

  label: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },

  value: {
    fontSize: 15, // iOS subheadline
    fontWeight: '600',
    color: tokens.colors.najdi.text, // Sadu Night
    lineHeight: 20,
  },

  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs, // 8px
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens.colors.najdi.primary + '20', // Najdi Crimson 20%
    paddingHorizontal: tokens.spacing.sm, // 12px
    paddingVertical: 6,
    borderRadius: 16,
    minHeight: 28, // Comfortable pill height
  },

  statusText: {
    fontSize: 12, // iOS caption1
    fontWeight: '600',
    color: tokens.colors.najdi.primary, // Najdi Crimson
    lineHeight: 16,
  },

  editedRow: {
    borderLeftWidth: 3, // Note: RTL mode auto-flips this to right
    borderLeftColor: tokens.colors.najdi.primary, // Najdi Crimson accent
    paddingLeft: tokens.spacing.sm, // 12px (auto-flips to right)
    backgroundColor: tokens.colors.najdi.primary + '08', // Very subtle tint
    borderRadius: tokens.radii.sm, // 10px
    paddingHorizontal: tokens.spacing.sm,
  },
});

export default FieldRow;
