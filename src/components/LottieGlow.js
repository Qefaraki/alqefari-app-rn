import React, { useRef, useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";

const LottieGlow = ({
  visible,
  x,
  y,
  width = 120,
  height = 40,
  borderRadius = 13, // Default to T2 node radius
  onAnimationFinish,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current; // Start invisible
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;

      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // After fade in completes, wait 1.5 seconds then fade out
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }).start(() => {
            if (onAnimationFinish) {
              onAnimationFinish();
            }
          });
        }, 1500);
      });
    }
  }, []); // Empty deps - only run once

  return (
    <Animated.View
      style={[
        styles.container,
        {
          position: "absolute",
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
});

export default LottieGlow;
