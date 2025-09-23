import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  inactive: "rgba(249, 247, 243, 0.2)", // Light background for track
  textMuted: "rgba(249, 247, 243, 0.7)", // Muted text
};

const DuolingoProgressBar = ({
  currentStep = 0,
  totalSteps = 5,
  showStepCount = true,
  style,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress on step change
    Animated.parallel([
      Animated.spring(progressAnim, {
        toValue: currentStep / totalSteps,
        tension: 50,
        friction: 10,
        useNativeDriver: false, // Can't use native driver for width
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  return (
    <Animated.View style={[styles.container, style, { opacity: opacityAnim }]}>
      {/* Main progress bar container */}
      <View style={styles.progressWrapper}>
        {/* Background track */}
        <View style={styles.track}>
          {/* Filled progress - positioned absolute with left:0 (becomes right:0 in RTL) */}
          <Animated.View
            style={[
              styles.fill,
              {
                position: "absolute",
                left: 0, // In native RTL, this becomes right: 0 (fills from right)
                top: 0,
                bottom: 0,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          >
            {/* Gradient shine effect on the fill */}
            <View style={styles.shine} />
          </Animated.View>
        </View>

        {/* Step count display */}
        {showStepCount && (
          <View style={styles.stepCountContainer}>
            <Text style={styles.stepCount}>
              {currentStep}/{totalSteps}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    // No extra padding - let parent control spacing
  },
  progressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  track: {
    flex: 1,
    height: 12, // Thicker like Duolingo
    backgroundColor: colors.inactive,
    borderRadius: 6, // Half of height for perfect rounding
    overflow: "hidden",
    // Add subtle inner shadow for depth
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    // Add subtle shadow for depth
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  stepCountContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 36,
    alignItems: "center",
  },
  stepCount: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});

export default DuolingoProgressBar;
