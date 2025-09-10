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
          left: x - width / 2,
          top: y - height / 2,
          width: width,
          height: height,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.glowWrapper}>
        {/* Outermost glow ring - very faint and large */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: width + 24,
              height: height + 24,
              borderRadius: borderRadius + 12,
              borderWidth: 8,
              borderColor: "#FFB800",
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.08],
              }),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Middle glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: width + 16,
              height: height + 16,
              borderRadius: borderRadius + 8,
              borderWidth: 6,
              borderColor: "#FFB800",
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.12],
              }),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Inner glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: width + 8,
              height: height + 8,
              borderRadius: borderRadius + 4,
              borderWidth: 4,
              borderColor: "#FFB800",
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.2],
              }),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Main sharp border */}
        <Animated.View
          style={[
            styles.glowBorder,
            {
              width: width,
              height: height,
              borderColor: "#FFB800",
              borderWidth: 1.5,
              borderRadius: borderRadius,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.9],
              }),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Soft inner fill for extra glow */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: width - 4,
              height: height - 4,
              borderRadius: borderRadius - 2,
              backgroundColor: "#FFB800",
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.05],
              }),
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
