import React from "react";
import { View, StyleSheet, Platform } from "react-native";

// Minimal Apple-style card: white surface, soft shadow, rounded corners
const CardSurface = ({ children, radius = 20, style, contentStyle }) => {
  return (
    <View
      style={[
        styles.wrapper,
        Platform.OS === "ios"
          ? {
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
            }
          : { elevation: 3 },
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
    backgroundColor: "#F9F7F3", // Al-Jass White (Najdi Sadu)
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
    overflow: "hidden",
  },
  content: {
    position: "relative",
  },
});

export default CardSurface;
