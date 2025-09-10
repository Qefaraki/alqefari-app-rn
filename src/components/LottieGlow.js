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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Fade in, scale up, and pulse
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Fade out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  // Add padding for the glow effect
  const padding = 10;
  const glowWidth = width + padding * 2;
  const glowHeight = height + padding * 2;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: x - glowWidth / 2,
          top: y - glowHeight / 2,
          width: glowWidth,
          height: glowHeight,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.glowWrapper}>
        {/* Animated border that matches exact node size */}
        <Animated.View
          style={[
            styles.glowBorder,
            {
              width: width,
              height: height,
              borderColor: "#FFB800",
              borderWidth: 1, // Match node border width
              borderRadius: borderRadius,
              opacity: fadeAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Subtle shadow behind */}
        <Animated.View
          style={[
            styles.glowShadow,
            {
              width: width,
              height: height,
              borderRadius: borderRadius,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15],
              }),
              transform: [{ scale: 1.05 }],
            },
          ]}
        />
      </View>

      {/* Keep Lottie for timing control */}
      <LottieView
        source={glowAnimation}
        autoPlay={true}
        loop={false}
        speed={1.2}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
        onAnimationFinish={() => {
          if (onAnimationFinish) {
            setTimeout(onAnimationFinish, 500);
          }
        }}
      />
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
