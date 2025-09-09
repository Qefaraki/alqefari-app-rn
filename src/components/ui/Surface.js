import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import tokens from "./tokens";

// Minimal native surface: white background, subtle border + shadow
const Surface = ({
  children,
  radius = tokens.radii.lg,
  style,
  contentStyle,
}) => {
  const shadowStyle =
    Platform.OS === "ios" ? tokens.shadow.ios : tokens.shadow.android;

  return (
    <View
      style={[
        styles.wrapper,
        Platform.OS === "ios" ? tokens.shadow.ios : tokens.shadow.android,
        style,
        { borderRadius: radius },
      ]}
    >
      <View style={[styles.card, { borderRadius: radius }]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    // Shadow styles applied dynamically in render
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.outline,
    overflow: "hidden",
  },
  content: {
    position: "relative",
  },
});

export default Surface;
