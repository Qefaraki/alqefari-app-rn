import React from "react";
import { View, StyleSheet, Dimensions, Image } from "react-native";

const { width: screenWidth } = Dimensions.get("window");

const SaduPattern = () => {
  // Original PNG dimensions (same as SVG)
  const originalWidth = 1548;
  const originalHeight = 286;

  // Scale to fit screen width while maintaining aspect ratio - MUCH smaller
  const patternHeight = 20; // Much smaller height for the pattern
  const patternWidth = (originalWidth * patternHeight) / originalHeight;

  // Calculate how many times to repeat the pattern - will be many more now
  const repetitions = Math.ceil(screenWidth / patternWidth) + 1; // +1 for seamless tiling

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.patternWrapper}>
        <View style={styles.patternRow}>
          {Array.from({ length: repetitions }).map((_, index) => (
            <Image
              key={index}
              source={require("../../assets/sadu style.png")}
              style={[
                styles.pattern,
                { width: patternWidth, height: patternHeight },
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    overflow: "hidden",
    zIndex: 1, // Below buttons but above background
  },
  patternWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    opacity: 1.0, // Full opacity
  },
  patternRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  pattern: {
    // Each pattern piece
  },
});

export default SaduPattern;
