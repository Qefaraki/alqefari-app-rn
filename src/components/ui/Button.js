import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  View,
} from "react-native";
import tokens from "./tokens";

const Button = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = "primary", // 'primary' | 'secondary' | 'danger'
  accessibilityLabel,
}) => {
  const isDisabled = disabled || loading;
  const shadowStyle =
    Platform.OS === "ios" ? tokens.shadow.ios : tokens.shadow.android;

  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return {
          button: styles.secondaryButton,
          text: styles.secondaryText,
          spinner: tokens.colors.accent,
        };
      case "danger":
        return {
          button: styles.dangerButton,
          text: styles.primaryText,
          spinner: "#FFFFFF",
        };
      default:
        return {
          button: styles.primaryButton,
          text: styles.primaryText,
          spinner: "#FFFFFF",
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        shadowStyle,
        variantStyles.button,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.spinner} size="small" />
      ) : (
        <Text style={[styles.text, variantStyles.text]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: tokens.radii.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    // Shadow styles applied dynamically in render
  },
  primaryButton: {
    backgroundColor: tokens.colors.accent,
  },
  secondaryButton: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.outline,
  },
  dangerButton: {
    backgroundColor: tokens.colors.danger,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryText: {
    color: tokens.colors.accent,
  },
});

export default Button;
