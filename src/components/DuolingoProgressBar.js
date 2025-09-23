import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions, Animated } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  inactive: "rgba(209, 187, 163, 0.3)", // Container 30%
  completed: "#4CAF50", // Success green
};

const DuolingoProgressBar = ({
  currentStep = 0,
  totalSteps = 5,
  steps = [],
  showLabels = false,
  style,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animate progress fill - using transform instead of width for native driver
    Animated.timing(progressAnim, {
      toValue: currentStep / totalSteps,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation on step change
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  // Calculate segment width
  const segmentWidth = (SCREEN_WIDTH - 48) / totalSteps;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.progressContainer}>
        {/* Background track */}
        <View style={styles.trackBackground} />

        {/* Filled progress - using scaleX for native animation */}
        <View style={styles.trackFilledContainer}>
          <Animated.View
            style={[
              styles.trackFilled,
              {
                transform: [
                  {
                    scaleX: progressAnim,
                  },
                ],
              },
            ]}
          />
        </View>

        {/* Segment dividers */}
        {[...Array(totalSteps - 1)].map((_, index) => (
          <View
            key={index}
            style={[
              styles.segmentDivider,
              {
                left: segmentWidth * (index + 1),
              },
            ]}
          />
        ))}

        {/* Current step indicator - using translateX for native animation */}
        <Animated.View
          style={[
            styles.currentIndicator,
            {
              transform: [
                {
                  translateX: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, SCREEN_WIDTH - 48],
                  }),
                },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <View style={styles.indicatorInner} />
        </Animated.View>
      </View>

      {/* Step labels */}
      {showLabels && steps.length > 0 && (
        <View style={styles.labelsContainer}>
          {steps.map((step, index) => (
            <View
              key={index}
              style={[styles.labelWrapper, { width: segmentWidth }]}
            >
              <Text
                style={[
                  styles.labelText,
                  index < currentStep && styles.labelTextCompleted,
                  index === currentStep && styles.labelTextActive,
                ]}
                numberOfLines={1}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
  },
  progressContainer: {
    height: 8,
    backgroundColor: colors.inactive,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  trackBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.inactive,
  },
  trackFilledContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderRadius: 4,
  },
  trackFilled: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  segmentDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.background,
  },
  currentIndicator: {
    position: "absolute",
    top: -6,
    left: 0,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  labelsContainer: {
    flexDirection: "row",
    marginTop: 12,
    paddingHorizontal: 0,
  },
  labelWrapper: {
    alignItems: "center",
  },
  labelText: {
    fontSize: 11,
    fontFamily: "SF Arabic",
    color: colors.inactive,
    textAlign: "center",
  },
  labelTextCompleted: {
    color: colors.completed,
    fontWeight: "600",
  },
  labelTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});

export default DuolingoProgressBar;
