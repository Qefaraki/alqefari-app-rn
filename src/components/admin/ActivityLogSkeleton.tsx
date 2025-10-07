import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { tokens } from '../ui/tokens';

/**
 * Loading skeleton that matches the ActivityLogDashboard layout exactly
 * Provides visual feedback while data loads
 */
export const ActivityLogSkeleton: React.FC = () => {
  // Shimmer animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBox = ({
    width,
    height,
    style,
  }: {
    width: number | string;
    height: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        styles.skeletonBox,
        { width, height, opacity },
        style,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <SkeletonBox width={48} height={48} style={styles.emblem} />
          <View style={styles.titleSection}>
            <SkeletonBox width={150} height={34} style={{ marginBottom: 4 }} />
            <SkeletonBox width={200} height={15} />
          </View>
        </View>
        <SkeletonBox width={44} height={44} style={styles.refreshButton} />
      </View>

      {/* Stats Widget */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <SkeletonBox width={40} height={22} style={{ marginBottom: 4 }} />
          <SkeletonBox width={50} height={12} />
        </View>
        <View style={styles.statCard}>
          <SkeletonBox width={40} height={22} style={{ marginBottom: 4 }} />
          <SkeletonBox width={50} height={12} />
        </View>
        <View style={styles.statCard}>
          <SkeletonBox width={40} height={22} style={{ marginBottom: 4 }} />
          <SkeletonBox width={50} height={12} />
        </View>
        <View style={styles.statCard}>
          <SkeletonBox width={40} height={22} style={{ marginBottom: 4 }} />
          <SkeletonBox width={50} height={12} />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SkeletonBox width={20} height={20} style={{ marginRight: 8 }} />
        <SkeletonBox width="70%" height={17} />
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {[90, 110, 100, 95, 105, 85].map((width, index) => (
            <SkeletonBox
              key={index}
              width={width}
              height={44}
              style={styles.filterButton}
            />
          ))}
        </View>
      </View>

      {/* Activity Cards */}
      <View style={styles.activitySection}>
        {[1, 2].map((group) => (
          <View key={group} style={styles.dateGroup}>
            <SkeletonBox
              width={80}
              height={17}
              style={{ marginLeft: 16, marginBottom: 8 }}
            />
            <View style={styles.dateCard}>
              {[1, 2, 3].map((item) => (
                <React.Fragment key={item}>
                  <View style={styles.activityRow}>
                    <SkeletonBox width={40} height={40} style={styles.activityIcon} />
                    <View style={styles.activityTextContainer}>
                      <SkeletonBox width="60%" height={17} style={{ marginBottom: 6 }} />
                      <SkeletonBox width="90%" height={15} />
                    </View>
                    <View style={styles.activityMeta}>
                      <SkeletonBox width={60} height={13} style={{ marginBottom: 4 }} />
                      <SkeletonBox width={20} height={20} />
                    </View>
                  </View>
                  {item < 3 && <View style={styles.activityDivider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.aljass,
  },

  skeletonBox: {
    backgroundColor: tokens.colors.najdi.camelHair + '40',
    borderRadius: 8,
  },

  // Header
  header: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  emblem: {
    borderRadius: 12,
    marginRight: 12,
  },

  titleSection: {
    flex: 1,
    alignItems: 'flex-start',
  },

  refreshButton: {
    borderRadius: 22,
  },

  // Stats Widget
  statsContainer: {
    height: 88,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.camelHair + '20',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
  },

  // Search Bar
  searchContainer: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.najdi.camelHair + '20',
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },

  // Filter Buttons
  filterSection: {
    height: 60,
    marginBottom: 8,
    paddingHorizontal: 16,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },

  filterButton: {
    borderRadius: 22,
  },

  // Activity Cards
  activitySection: {
    paddingTop: 8,
  },

  dateGroup: {
    marginBottom: 20,
  },

  dateCard: {
    backgroundColor: tokens.colors.najdi.aljass,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
  },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
  },

  activityIcon: {
    borderRadius: 10,
  },

  activityTextContainer: {
    flex: 1,
  },

  activityMeta: {
    alignItems: 'flex-end',
  },

  activityDivider: {
    height: 1,
    backgroundColor: tokens.colors.najdi.camelHair + '30',
    marginVertical: 12,
  },
});

export default ActivityLogSkeleton;
