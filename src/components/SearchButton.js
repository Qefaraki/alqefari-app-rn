import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const SearchButton = ({ onPress }) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animation
    scale.value = withSequence(
      withTiming(0.9, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(1.05, { duration: 150, easing: Easing.out(Easing.back(1.5)) }),
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
    );

    rotation.value = withSequence(
      withTiming(-10, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) }),
    );

    // Call the onPress handler
    onPress();
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <Animated.View style={[styles.button, animatedStyle]}>
        <Ionicons name="search" size={24} color="#007AFF" />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 54,
    left: 16,
    zIndex: 1000,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
});

export default SearchButton;
