import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AnimatedGlow from "react-native-animated-glow/lib/module/AnimatedGlow";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

/**
 * SearchGlowOverlay
 * -----------------
 * Renders a soft golden halo around a highlighted node using Skia so the glow
 * remains crisp even while zooming or panning the tree canvas.
 */
const SearchGlowOverlay = ({ frame, opacity }) => {
  if (!frame) return null;

  const { x, y, width, height, borderRadius } = frame;
  const haloPadding = Math.max(6, Math.min(14, Math.max(width, height) * 0.08));
  const viewWidth = width + haloPadding * 2;
  const viewHeight = height + haloPadding * 2;

  const glowLayers = useMemo(
    () => [
      {
        colors: ["rgba(213, 140, 74, 0.55)", "rgba(213, 140, 74, 0.08)"],
        glowPlacement: "behind",
        opacity: 0.28,
        glowSize: [14, 18, 20],
        speedMultiplier: 0,
      },
      {
        colors: ["rgba(161, 51, 51, 0.4)", "rgba(213, 140, 74, 0.12)"] ,
        glowPlacement: "behind",
        opacity: 0.22,
        glowSize: [5, 9],
        speedMultiplier: 0,
      },
    ],
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        animatedStyle,
        {
          position: "absolute",
          left: x - haloPadding,
          top: y - haloPadding,
          width: viewWidth,
          height: viewHeight,
        },
      ]}
    >
      <AnimatedGlow
        glowLayers={glowLayers}
        cornerRadius={borderRadius + haloPadding}
        outlineWidth={0}
        backgroundColor="transparent"
        animationSpeed={0}
        borderSpeedMultiplier={0}
        isVisible={true}
        style={[
          styles.glowContainer,
          {
            width: viewWidth,
            height: viewHeight,
            borderRadius: borderRadius + haloPadding,
          },
        ]}
      >
        <View
          style={{
            width,
            height,
            borderRadius,
            backgroundColor: "transparent",
          }}
        />
      </AnimatedGlow>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  glowContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
});

export default SearchGlowOverlay;
