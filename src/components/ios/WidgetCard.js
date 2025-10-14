import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import tokens from "../ui/tokens";

const WidgetCard = ({ children, style, contentStyle }) => {
  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.surface, contentStyle]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: tokens.radii.lg,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
        }
      : { elevation: 4 }),
  },
  surface: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(209, 187, 163, 0.25)",
  },
});

export default WidgetCard;
