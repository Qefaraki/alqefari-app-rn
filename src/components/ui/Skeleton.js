import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

// Najdi Sadu colors
const colors = {
  background: "#F9F7F3",
  shimmer: "#FFFFFF",
  skeleton: "#E0E0E0",
};

/**
 * Skeleton Component
 *
 * Animated skeleton loading placeholder with shimmer effect.
 * Used to improve perceived performance during data loading.
 *
 * Props:
 * - width: number | string - Width of skeleton (default: "100%")
 * - height: number - Height of skeleton (default: 20)
 * - borderRadius: number - Border radius (default: 8)
 * - style: ViewStyle - Additional custom styles
 */
const Skeleton = ({ width = "100%", height = 20, borderRadius = 8, style }) => {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
      shimmerValue.stopAnimation();
    };
  }, []);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, { width, height, borderRadius }, style]}>
      <Animated.View style={[styles.shimmer, { opacity, borderRadius }]} />
    </View>
  );
};

/**
 * SkeletonUserCard Component
 *
 * Pre-built skeleton for user card in PermissionManager.
 */
export const SkeletonUserCard = () => {
  return (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        {/* Name */}
        <Skeleton width="60%" height={18} style={{ marginBottom: 8 }} />
        {/* Chain */}
        <Skeleton width="80%" height={12} style={{ marginBottom: 12 }} />
        {/* Badges */}
        <View style={styles.badgeRow}>
          <Skeleton width={80} height={24} borderRadius={8} />
          <Skeleton width={100} height={24} borderRadius={8} />
        </View>
      </View>
      {/* Action buttons */}
      <View style={styles.actions}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <Skeleton width={44} height={44} borderRadius={22} />
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>
    </View>
  );
};

/**
 * SkeletonBranchCard Component
 *
 * Pre-built skeleton for branch card in BranchSelector.
 */
export const SkeletonBranchCard = () => {
  return (
    <View style={styles.branchCard}>
      <View style={styles.depthIndicator} />
      <View style={styles.branchInfo}>
        {/* Branch name and HID badge */}
        <View style={styles.branchHeader}>
          <Skeleton width="50%" height={17} style={{ marginRight: 8 }} />
          <Skeleton width={60} height={18} borderRadius={8} />
        </View>
        {/* Meta info */}
        <Skeleton width="40%" height={13} style={{ marginTop: 8 }} />
      </View>
      {/* Chevron */}
      <Skeleton width={20} height={20} borderRadius={10} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.skeleton,
    overflow: "hidden",
  },
  shimmer: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.shimmer,
  },

  // User Card Skeleton
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.background,
  },
  userInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },

  // Branch Card Skeleton
  branchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.background,
  },
  depthIndicator: {
    width: 24,
    height: "100%",
    borderRightWidth: 2,
    borderRightColor: colors.skeleton,
    marginRight: 12,
  },
  branchInfo: {
    flex: 1,
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

export default Skeleton;
