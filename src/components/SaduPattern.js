import React from "react";
import { View, StyleSheet, Dimensions, Image, Text } from "react-native";

const { width: screenWidth } = Dimensions.get("window");

const SaduPattern = () => {
  // pixel_sadu.png dimensions: 2092 x 388
  const originalWidth = 2092;
  const originalHeight = 388;

  // Appropriately sized for pixel art - 30px height
  const patternHeight = 30;
  // Calculate width maintaining aspect ratio
  const patternWidth = (originalWidth * patternHeight) / originalHeight; // ~162px

  // Calculate how many times to repeat the pattern
  const repetitions = Math.ceil(screenWidth / patternWidth) + 1;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.patternWrapper}>
        {Array.from({ length: repetitions }).map((_, index) => (
          <Image
            key={index}
            source={require("../../assets/pixel_sadu.png")}
            style={{
              width: patternWidth,
              height: patternHeight,
            }}
            resizeMode="stretch"
          />
        ))}
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
    zIndex: 9999, // Maximum z-index
    elevation: 9999, // For Android
  },
  patternWrapper: {
    flexDirection: "row",
    height: 30,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
});

export default SaduPattern;
