import React from "react";
import { StyleSheet, View } from "react-native";
import * as Animatable from "react-native-animatable";

// Define custom animations for the glow effect
const glowAnimations = {
  pulseGlow: {
    0: {
      opacity: 0.4,
      scale: 0.95,
    },
    0.5: {
      opacity: 0.8,
      scale: 1.02,
    },
    1: {
      opacity: 0.4,
      scale: 0.95,
    },
  },
  fadeInGlow: {
    0: {
      opacity: 0,
      scale: 0.8,
    },
    1: {
      opacity: 0.6,
      scale: 1,
    },
  },
  fadeOutGlow: {
    0: {
      opacity: 0.6,
      scale: 1,
    },
    1: {
      opacity: 0,
      scale: 0.8,
    },
  },
};

const GlowEffect = ({ x, y, width, height, isGlowing, nodeId }) => {
  if (!isGlowing) return null;

  return (
    <View
      style={[
        styles.container,
        {
          position: "absolute",
          left: x - 25,
          top: y - 25,
          width: width + 50,
          height: height + 50,
          pointerEvents: "none",
          zIndex: 999,
        },
      ]}
    >
      {/* Outer golden glow */}
      <Animatable.View
        animation={isGlowing ? "fadeInGlow" : "fadeOutGlow"}
        duration={600}
        style={[
          styles.glowLayer,
          {
            backgroundColor: "rgba(255, 215, 0, 0.15)", // Gold with transparency
            shadowColor: "#FFD700",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 25,
            elevation: 10,
          },
        ]}
      />

      {/* Middle amber glow */}
      <Animatable.View
        animation={isGlowing ? "fadeInGlow" : "fadeOutGlow"}
        duration={500}
        delay={100}
        style={[
          styles.glowLayer,
          {
            width: width + 30,
            height: height + 30,
            left: 10,
            top: 10,
            backgroundColor: "rgba(255, 165, 0, 0.2)", // Orange with transparency
            shadowColor: "#FFA500",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 15,
            elevation: 8,
          },
        ]}
      />

      {/* Inner pulsing core */}
      <Animatable.View
        animation={isGlowing ? "pulseGlow" : undefined}
        duration={2000}
        iterationCount="infinite"
        easing="ease-in-out"
        style={[
          styles.glowLayer,
          {
            width: width + 10,
            height: height + 10,
            left: 20,
            top: 20,
            backgroundColor: "rgba(255, 140, 0, 0.25)", // Dark orange with transparency
            shadowColor: "#FF8C00",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 6,
          },
        ]}
      />
    </View>
  );
};

// Register custom animations
Animatable.initializeRegistryWithDefinitions(glowAnimations);

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  glowLayer: {
    position: "absolute",
    borderRadius: 12,
  },
});

export default GlowEffect;
