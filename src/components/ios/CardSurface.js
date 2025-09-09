import React from "react";
import { View, StyleSheet, Platform } from "react-native";

// Minimal Apple-style card: white surface, soft shadow, rounded corners
const CardSurface = ({ children, radius = 20, style, contentStyle }) => {
  const shadowStyle =
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
        }
      : { elevation: 3 };

  return (
    <View
      style={[styles.wrapper, shadowStyle, style, { borderRadius: radius }]}
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
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.07)",
    overflow: "hidden",
  },
  content: {
    position: "relative",
  },
});

export default CardSurface;
