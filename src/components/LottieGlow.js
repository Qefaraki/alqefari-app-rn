import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";
import LottieView from "lottie-react-native";

// Proper radial glow animation
const glowAnimation = require("../../assets/glow-animation.json");

const LottieGlow = ({
  visible,
  x,
  y,
  width = 120,
  height = 40,
  borderRadius = 13, // Default to T2 node radius
  onAnimationFinish,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start at full opacity
  const animationRef = useRef(null);

  useEffect(() => {
    // Start fade out after 2 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        // Call finish callback after fade completes
        if (onAnimationFinish) {
          onAnimationFinish();
        }
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [fadeAnim, onAnimationFinish]);

  // Add padding for the glow effect
  const padding = 10;
  const glowWidth = width + padding * 2;
  const glowHeight = height + padding * 2;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: x - width / 2,
          top: y - height / 2,
          width: width,
          height: height,
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.glowWrapper}>
        {/* Multiple thin rings for smoother gradient effect */}
        {/* Ring 1 - Outermost, very faint */}
        <View
          style={[
            styles.glowRing,
            {
              width: width + 20,
              height: height + 20,
              borderRadius: borderRadius + 10,
              borderWidth: 2,
              borderColor: "#FFB800",
              opacity: 0.03,
            },
          ]}
        />

        {/* Ring 2 */}
        <View
          style={[
            styles.glowRing,
            {
              width: width + 16,
              height: height + 16,
              borderRadius: borderRadius + 8,
              borderWidth: 2,
              borderColor: "#FFB800",
              opacity: 0.05,
            },
          ]}
        />

        {/* Ring 3 */}
        <View
          style={[
            styles.glowRing,
            {
              width: width + 12,
              height: height + 12,
              borderRadius: borderRadius + 6,
              borderWidth: 2,
              borderColor: "#FFB800",
              opacity: 0.08,
            },
          ]}
        />

        {/* Ring 4 */}
        <View
          style={[
            styles.glowRing,
            {
              width: width + 8,
              height: height + 8,
              borderRadius: borderRadius + 4,
              borderWidth: 2,
              borderColor: "#FFB800",
              opacity: 0.12,
            },
          ]}
        />

        {/* Ring 5 */}
        <View
          style={[
            styles.glowRing,
            {
              width: width + 4,
              height: height + 4,
              borderRadius: borderRadius + 2,
              borderWidth: 2,
              borderColor: "#FFB800",
              opacity: 0.18,
            },
          ]}
        />

        {/* Main sharp border */}
        <View
          style={[
            styles.glowBorder,
            {
              width: width,
              height: height,
              borderColor: "#FFB800",
              borderWidth: 1.5,
              borderRadius: borderRadius,
              opacity: 0.9,
            },
          ]}
        />

        {/* Soft inner fill for extra glow */}
        <View
          style={[
            {
              position: "absolute",
              width: width - 4,
              height: height - 4,
              borderRadius: borderRadius - 2,
              backgroundColor: "#FFB800",
              opacity: 0.05,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  glowWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glowBorder: {
    position: "absolute",
    borderStyle: "solid",
  },
  glowRing: {
    position: "absolute",
    borderStyle: "solid",
    backgroundColor: "transparent",
  },
  glowShadow: {
    position: "absolute",
    backgroundColor: "transparent",
    shadowColor: "#FFB800",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  lottie: {
    width: "100%",
    height: "100%",
  },
});

export default LottieGlow;
