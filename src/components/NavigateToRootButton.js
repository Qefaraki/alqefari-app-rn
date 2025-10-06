import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Path, G } from "react-native-svg";
import { useTreeStore } from "../stores/useTreeStore";
import { clampStageToBounds } from "../utils/cameraConstraints";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BUTTON_SIZE = 56;
const ICON_SIZE = 26;

const NavigateToRootButton = ({ nodes, viewport, sharedValues, focusPersonId }) => {
  const [targetNode, setTargetNode] = useState(null);
  const treeBounds = useTreeStore((s) => s.treeBounds);
  const minZoom = useTreeStore((s) => s.minZoom);
  const maxZoom = useTreeStore((s) => s.maxZoom);
  const insets = useSafeAreaInsets();

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
    // DEBUG: Log button click
    console.log('🔘 [NavigateButton] CLICKED - Starting navigation');

    if (!targetNode) {
      console.warn('NavigateToRootButton: Target node not ready yet');
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

    if (!sharedValues) {
      // console.warn('NavigateToRootButton: No shared values provided');
      return;
    }

    if (!viewport || !viewport.width || !viewport.height) {
      console.warn("NavigateToRootButton: Viewport not ready");
      return;
    }

    // Calculate target position to center node in viewport
    // Account for root node being moved up 80px
    const isRoot = !targetNode.father_id;
    const adjustedY = isRoot ? targetNode.y - 80 : targetNode.y;
    const targetScale = 1.0; // Moderate zoom for better overview

    const unclamped = {
      x: viewport.width / 2 - targetNode.x * targetScale,
      y: viewport.height / 2 - adjustedY * targetScale,
      scale: targetScale,
    };

    // DEBUG: Log button navigation
    console.log('🎯 [NavigateButton] Navigating to:', {
      node: { name: targetNode.name, x: Math.round(targetNode.x), y: Math.round(targetNode.y) },
      viewport: { width: viewport.width, height: viewport.height },
      unclamped: { x: Math.round(unclamped.x), y: Math.round(unclamped.y) },
      treeBounds: { minX: Math.round(treeBounds.minX), maxX: Math.round(treeBounds.maxX), width: Math.round(treeBounds.width) }
    });

    const clampedTarget = clampStageToBounds(
      unclamped,
      viewport,
      treeBounds,
      minZoom,
      maxZoom,
    );

    const targetX = clampedTarget.stage.x;
    const targetY = clampedTarget.stage.y;
    const finalScale = clampedTarget.stage.scale;

    // DEBUG: Log if button clamped the position
    if (Math.abs(targetX - unclamped.x) > 1 || Math.abs(targetY - unclamped.y) > 1) {
      console.log('⚠️ [NavigateButton] Position was clamped!', {
        unclamped: { x: Math.round(unclamped.x), y: Math.round(unclamped.y) },
        clamped: { x: Math.round(targetX), y: Math.round(targetY) }
      });
    }

    // DEBUG: Log final animation start
    console.log('▶️ [NavigateButton] Starting withTiming animation to:', {
      target: { x: Math.round(targetX), y: Math.round(targetY), scale: finalScale },
      duration: 600
    });

    // Animate the shared values directly
    sharedValues.translateX.value = withTiming(targetX, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });
    sharedValues.translateY.value = withTiming(targetY, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });
    sharedValues.scale.value = withTiming(finalScale, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });
  };

  // Always render the button, but disable if target not found
  const isDisabled = !targetNode;

  const buttonBottomOffset = insets.bottom > 0 ? insets.bottom + 72 : 96;

  return (
    <View
      style={[
        styles.container,
        {
          bottom: buttonBottomOffset,
        },
      ]}
    >
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
              width={ICON_SIZE}
              height={ICON_SIZE}
              viewBox="0 0 24 24"
              preserveAspectRatio="xMidYMid meet"
              style={{ transform: [{ scaleX: -1 }, { scale: 0.82 }] }}
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
    left: 16, // Left in code = right side in RTL mode
  },
  shadowWrapper: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
  },
  button: {
    position: "absolute",
    top: 0,
    left: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    backgroundColor: "transparent",
    borderRadius: BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
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
