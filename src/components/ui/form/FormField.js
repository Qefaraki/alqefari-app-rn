import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import tokens from '../tokens';

/**
 * Lightweight field wrapper for labels, helper text, and errors.
 * Keeps label typography consistent across tabs.
 */
const FormField = ({
  label,
  hint,
  error,
  accessory,
  children,
  spacing = 'sm',
  required = false,
  style,
}) => {
  const spacingValue = spacing === 'md' ? tokens.spacing.md : tokens.spacing.sm;
  const showHint = Boolean(hint) && !error;
  const showError = Boolean(error);

  return (
    <View style={[styles.container, { gap: spacingValue }, style]}>
      {(label || accessory) && (
        <View style={styles.labelRow}>
          {label ? (
            <Text style={styles.label}>
              {label}
              {required ? <Text style={styles.required}> *</Text> : null}
            </Text>
          ) : null}
          {accessory}
        </View>
      )}

      {children}

      {showHint ? <Text style={styles.hint}>{hint}</Text> : null}
      {showError ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

FormField.propTypes = {
  label: PropTypes.string,
  hint: PropTypes.string,
  error: PropTypes.string,
  accessory: PropTypes.node,
  children: PropTypes.node.isRequired,
  spacing: PropTypes.oneOf(['sm', 'md']),
  required: PropTypes.bool,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs,
    marginBottom: tokens.spacing.xxs,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  required: {
    color: tokens.colors.danger,
  },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
  },
  error: {
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.danger,
  },
});

export default FormField;
