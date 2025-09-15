import React, { useEffect } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const SettingsButton = ({ onPress, isVisible = true }) => {
  const iconScale = useSharedValue(1);
  const iconRotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Handle visibility changes with animation
  useEffect(() => {
    if (isVisible) {
      // Fade in with scale
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });
      containerScale.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.back(1.5)),
      });
    } else {
      // Fade out with scale
      opacity.value = withTiming(0, {
        duration: 250,
        easing: Easing.in(Easing.quad),
      });
      containerScale.value = withTiming(0.8, {
        duration: 250,
        easing: Easing.in(Easing.quad),
      });
    }
  }, [isVisible]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: containerScale.value }],
    // Prevent interaction when invisible
    pointerEvents: opacity.value < 0.1 ? "none" : "auto",
  }));

  const handlePress = () => {
    // Don't respond to presses when not visible
    if (!isVisible) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Tap animation - same as AdminToggleButton
    iconScale.value = withSequence(
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 160, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
    );
    iconRotate.value = withSequence(
      withTiming(360, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );

    onPress();
  };

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      {/* Button with shadow wrapper - exact same as AdminToggleButton */}
      <View style={styles.shadowWrapper}>
        <Pressable
          onPress={handlePress}
          disabled={!isVisible}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
            <Ionicons name="settings-outline" size={24} color="#5F6368" />
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 240, // Above AdminToggleButton (which is at 170)
    right: 16, // Same side as other buttons
  },
  shadowWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    // Shadow properties for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    // Shadow for Android
    elevation: 12,
  },
  button: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    backgroundColor: "transparent",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    backgroundColor: "rgba(0,0,0,0.05)",
    transform: [{ scale: 0.96 }],
  },
});

export default SettingsButton;
