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
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress width change
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: currentStep / totalSteps,
        duration: 500,
        useNativeDriver: false, // Can't use native driver for width
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  // Calculate progress percentage
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <Animated.View style={[styles.container, style, { opacity: opacityAnim }]}>
      <View style={styles.progressContainer}>
        {/* Background track */}
        <View style={styles.trackBackground} />

        {/* Filled progress using width percentage */}
        <Animated.View
          style={[
            styles.trackFilled,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />

        {/* Segment dividers */}
        <View style={styles.segmentContainer}>
          {[...Array(totalSteps - 1)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.segmentDivider,
                {
                  left: `${((index + 1) / totalSteps) * 100}%`,
                },
              ]}
            />
          ))}
        </View>

        {/* Current step indicator dot */}
        <Animated.View
          style={[
            styles.currentIndicator,
            {
              left: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
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
            <View key={index} style={[styles.labelWrapper, { flex: 1 }]}>
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

      {/* Step counter */}
      <View style={styles.stepCounter}>
        <Text style={styles.stepCounterText}>
          {currentStep} من {totalSteps}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
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
  trackFilled: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  segmentContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    color: colors.text + "60",
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
  stepCounter: {
    alignItems: "center",
    marginTop: 8,
  },
  stepCounterText: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: colors.text + "80",
  },
});

export default DuolingoProgressBar;
