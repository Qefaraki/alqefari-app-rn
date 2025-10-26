import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Path, G } from "react-native-svg";

const NavigateToRootButton = ({ nodes, viewport, sharedValues, focusPersonId, onNavigate }) => {
  const [targetNode, setTargetNode] = useState(null);

  // Find and cache the target node when nodes change
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      // First try to find user's profile if focusPersonId provided
      if (focusPersonId) {
        const focused = nodes.find((n) => n.id === focusPersonId);
        if (focused) {
          setTargetNode(focused);
          return;
        }
      }

      // Fallback to root node (node without father_id)
      const root = nodes.find((n) => !n.father_id);
      if (root) {
        setTargetNode(root);
      }
    }
  }, [nodes, focusPersonId]);

  const iconScale = useSharedValue(1);
  const iconRotate = useSharedValue(0);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotate.value}deg` },
    ],
  }));

  const handleNavigateToCenter = () => {
    if (!targetNode) {
      // console.warn('NavigateToRootButton: Target node not ready yet');
      return;
    }

    if (!onNavigate) {
      console.warn('NavigateToRootButton: No onNavigate callback provided');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Tap animation
    iconScale.value = withSequence(
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 160, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
    );
    iconRotate.value = withSequence(
      withTiming(-8, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );

    // Use the same navigation function as search results
    // This will trigger the camera movement + node selection + enrichment
    onNavigate(targetNode.id);
  };

  // Always render the button, but disable if target not found
  const isDisabled = !targetNode;

  return (
    <View style={styles.container}>
      <View style={styles.shadowWrapper}>
        <Pressable
          onPress={handleNavigateToCenter}
          disabled={isDisabled}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            isDisabled && styles.buttonDisabled,
          ]}
        >
          {/* Pointer icon */}
          <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
            <Svg
              width={30}
              height={30}
              viewBox="0 0 24 24"
              preserveAspectRatio="xMidYMid meet"
              style={{ transform: [{ scaleX: -1 }, { scale: 0.75 }] }}
            >
              <G transform="translate(1.5, 1.5)">
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.3572 3.23397C3.66645 2.97447 4.1014 2.92638 4.45988 3.11204L20.7851 11.567C21.1426 11.7522 21.3542 12.1337 21.322 12.5351C21.2898 12.9364 21.02 13.2793 20.6375 13.405L13.7827 15.6586L10.373 22.0179C10.1828 22.3728 9.79826 22.5789 9.39743 22.541C8.9966 22.503 8.65762 22.2284 8.53735 21.8441L3.04564 4.29872C2.92505 3.91345 3.04794 3.49346 3.3572 3.23397ZM5.67123 5.99173L9.73507 18.9752L12.2091 14.361C12.3304 14.1347 12.5341 13.9637 12.7781 13.8835L17.7518 12.2484L5.67123 5.99173Z"
                  fill="#5F6368"
                />
              </G>
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
    left: 16,  // Move to left side of screen
    bottom: 120,  // Raised higher for better visibility
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
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default NavigateToRootButton;
