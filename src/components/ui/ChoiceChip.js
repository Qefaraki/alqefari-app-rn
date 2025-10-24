import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { Ionicons } from '@expo/vector-icons';
import tokens from './tokens';

const ChoiceChip = ({
  label,
  selected,
  onPress,
  icon,
  style,
  textStyle,
  grow,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        grow && styles.chipGrow,
        selected && styles.chipSelected,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? icon(selected) : null}
      <Text
        style={[
          styles.label,
          selected && styles.labelSelected,
          textStyle,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={tokens.colors.najdi.primary}
        />
      ) : null}
    </TouchableOpacity>
  );
};

ChoiceChip.propTypes = {
  label: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  onPress: PropTypes.func.isRequired,
  icon: PropTypes.func,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  textStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  grow: PropTypes.bool,
};

ChoiceChip.defaultProps = {
  selected: false,
  icon: null,
  style: undefined,
  textStyle: undefined,
  grow: false,
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    minHeight: tokens.touchTarget.minimum,
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '40',
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  chipGrow: {
    flexGrow: 1,
  },
  chipSelected: {
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.najdi.primary + '12',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  labelSelected: {
    color: tokens.colors.najdi.primary,
  },
});

export default ChoiceChip;
