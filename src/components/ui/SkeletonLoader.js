import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import tokens from './tokens';

const SkeletonLoader = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style = {},
  shimmerSpeed = 1000,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: shimmerSpeed,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: shimmerSpeed,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerAnim, shimmerSpeed]);

  // Enhanced shimmer effect with better visibility
  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 1.0, 0.2], // Much more visible shimmer
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const SkeletonText = ({ lines = 3, style = {} }) => {
  return (
    <View style={[styles.textContainer, style]}>
      {[...Array(lines)].map((_, i) => (
        <SkeletonLoader
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height={12}
          style={{ marginBottom: i < lines - 1 ? 8 : 0 }}
        />
      ))}
    </View>
  );
};

export const SkeletonCard = ({ style = {} }) => {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLoader width="40%" height={20} style={{ marginBottom: 16 }} />
      <SkeletonText lines={2} />
    </View>
  );
};

export const SkeletonStatBox = ({ style = {} }) => {
  return (
    <View style={[styles.statBox, style]}>
      <SkeletonLoader width={60} height={28} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="80%" height={12} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: `${tokens.colors.najdi.container}40`, // Use Najdi Camel Hair Beige at 40%
  },
  textContainer: {
    width: "100%",
  },
  card: {
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container}40`, // Camel Hair Beige 40%
  },
  statBox: {
    backgroundColor: `${tokens.colors.najdi.container}20`, // Camel Hair Beige 20%
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    width: "48%",
    marginBottom: 10,
  },
});

export default SkeletonLoader;
