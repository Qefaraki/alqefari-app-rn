import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TreeSkeleton = () => {
  // Create animated values for shimmer effect
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Shimmer animation
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmer.start();

    return () => shimmer.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  // Skeleton node component
  const SkeletonNode = ({
    style,
    width = 70,
    height = 35,
    hasPhoto = false,
  }) => (
    <View
      style={[
        styles.skeletonNode,
        { width, height: hasPhoto ? 90 : height },
        style,
      ]}
    >
      {hasPhoto && <View style={[styles.photoSkeleton]} />}
      <View style={[styles.textSkeleton, { width: width * 0.7 }]} />
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );

  // Skeleton connection line
  const SkeletonLine = ({ style }) => (
    <View style={[styles.skeletonLine, style]} />
  );

  return (
    <View style={styles.container}>
      {/* Root ancestor */}
      <View style={styles.row}>
        <SkeletonNode width={80} hasPhoto />
      </View>

      {/* Connection */}
      <SkeletonLine style={{ height: 40, alignSelf: "center" }} />

      {/* Parent */}
      <View style={styles.row}>
        <SkeletonNode width={85} hasPhoto />
      </View>

      {/* Connection */}
      <SkeletonLine style={{ height: 40, alignSelf: "center" }} />

      {/* Focus person with siblings */}
      <View style={styles.row}>
        <SkeletonNode width={60} style={{ opacity: 0.4 }} />
        <SkeletonLine style={{ width: 30, height: 2, marginHorizontal: 10 }} />
        <SkeletonNode width={85} hasPhoto style={styles.focusNode} />
        <SkeletonLine style={{ width: 30, height: 2, marginHorizontal: 10 }} />
        <SkeletonNode width={60} style={{ opacity: 0.4 }} />
      </View>

      {/* Connection */}
      <SkeletonLine style={{ height: 40, alignSelf: "center" }} />

      {/* Children */}
      <View style={styles.row}>
        <SkeletonNode width={70} style={{ marginHorizontal: 8 }} />
        <SkeletonNode width={70} style={{ marginHorizontal: 8 }} />
        <SkeletonNode width={70} style={{ marginHorizontal: 8 }} />
      </View>

      {/* Uncles/Aunts on the side */}
      <View style={[styles.row, { position: "absolute", top: 120, left: 20 }]}>
        <SkeletonNode width={50} height={30} style={{ opacity: 0.3 }} />
      </View>
      <View style={[styles.row, { position: "absolute", top: 120, right: 20 }]}>
        <SkeletonNode width={50} height={30} style={{ opacity: 0.3 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
    backgroundColor: "#F9F7F3",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
  },
  skeletonNode: {
    backgroundColor: "#E8E4DD",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D1BBA340",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  focusNode: {
    borderColor: "#A1333330",
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  photoSkeleton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#D1BBA320",
    marginBottom: 6,
  },
  textSkeleton: {
    height: 12,
    backgroundColor: "#D1BBA320",
    borderRadius: 6,
  },
  skeletonLine: {
    backgroundColor: "#D1BBA340",
    width: 2,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF30",
    transform: [{ skewX: "-20deg" }],
  },
});

export default TreeSkeleton;
