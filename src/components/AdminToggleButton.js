import React, { useState } from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useAdminMode } from "../contexts/AdminModeContext";

const AdminToggleButton = ({ user }) => {
  const { isAdminMode, toggleAdminMode } = useAdminMode();
  // Removed tooltip state - no longer needed

  const iconScale = useSharedValue(1);
  const iconRotate = useSharedValue(0);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Tap animation
    iconScale.value = withSequence(
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 160, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
    );
    iconRotate.value = withSequence(
      withTiming(isAdminMode ? 0 : 360, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );

    toggleAdminMode();

    // Tooltip disabled - no longer showing text on press
  };


  return (
    <View style={styles.container}>
      {/* Button with shadow wrapper like NavigateToRootButton */}
      <View
        style={[
          styles.shadowWrapper,
          isAdminMode && styles.shadowWrapperActive,
        ]}
      >
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          {/* Car Fan icon */}
          <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 12v-9l4.912 1.914a1.7 1.7 0 0 1 .428 2.925z"
                stroke={isAdminMode ? "#007AFF" : "#5F6368"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d="M12 12h9l-1.914 4.912a1.7 1.7 0 0 1 -2.925 .428z"
                stroke={isAdminMode ? "#007AFF" : "#5F6368"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d="M12 12h-9l1.914 -4.912a1.7 1.7 0 0 1 2.925 -.428z"
                stroke={isAdminMode ? "#007AFF" : "#5F6368"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <Path
                d="M12 12v9l-4.912 -1.914a1.7 1.7 0 0 1 -.428 -2.925z"
                stroke={isAdminMode ? "#007AFF" : "#5F6368"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 120, // Positioned above tab bar
    right: 16, // Same side as NavigateToRootButton
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
  shadowWrapperActive: {
    // Slight blue tint when active
    backgroundColor: "#F0F7FF",
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

export default AdminToggleButton;
