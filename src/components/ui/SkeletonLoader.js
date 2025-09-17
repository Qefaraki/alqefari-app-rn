import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

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

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
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
    backgroundColor: "#e5e7eb",
  },
  textContainer: {
    width: "100%",
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statBox: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    width: "48%",
    marginBottom: 10,
  },
});

export default SkeletonLoader;
