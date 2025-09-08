import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import tokens from './tokens';

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  keyboardType,
  secureTextEntry,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  style,
  inputStyle,
  testID,
  editable = true,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, !!error && styles.inputError, multiline && styles.multiline, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(0,0,0,0.35)"
        textAlign="right"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        testID={testID}
        editable={editable}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!helperText && <Text style={styles.helper}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: tokens.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.textMuted,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#F7F7FA',
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    fontSize: 16,
    color: tokens.colors.text,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: tokens.colors.danger,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  helper: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xs,
    textAlign: 'right',
  },
  error: {
    fontSize: 12,
    color: tokens.colors.danger,
    marginTop: tokens.spacing.xs,
    textAlign: 'right',
  },
});

export default Field;
