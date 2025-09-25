import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import tokens from '../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');

interface ArticleSkeletonLoaderProps {
  isNightMode: boolean;
  hasImage?: boolean;
}

const ArticleSkeletonLoader: React.FC<ArticleSkeletonLoaderProps> = ({
  isNightMode,
  hasImage = true,
}) => {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const shimmerStyle = {
    opacity: shimmerAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    }),
  };

  const baseColor = isNightMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const highlightColor = isNightMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';

  return (
    <View style={[styles.container, isNightMode && styles.containerDark]}>
      {/* Image Skeleton */}
      {hasImage && (
        <Animated.View
          style={[
            styles.imageSkeleton,
            { backgroundColor: baseColor },
            shimmerStyle
          ]}
        />
      )}

      {/* Title Skeleton */}
      <View style={styles.titleContainer}>
        <Animated.View
          style={[
            styles.titleLine,
            { backgroundColor: baseColor, width: '90%' },
            shimmerStyle
          ]}
        />
        <Animated.View
          style={[
            styles.titleLine,
            { backgroundColor: baseColor, width: '60%' },
            shimmerStyle
          ]}
        />
      </View>

      {/* Actions Bar Skeleton */}
      <View style={styles.actionsBar}>
        <View style={styles.actionsGroup}>
          <Animated.View
            style={[
              styles.actionButton,
              { backgroundColor: baseColor },
              shimmerStyle
            ]}
          />
          <Animated.View
            style={[
              styles.actionButton,
              { backgroundColor: baseColor },
              shimmerStyle
            ]}
          />
        </View>
        <View style={styles.actionsGroup}>
          <Animated.View
            style={[
              styles.actionButton,
              { backgroundColor: baseColor },
              shimmerStyle
            ]}
          />
          <Animated.View
            style={[
              styles.actionButton,
              { backgroundColor: baseColor },
              shimmerStyle
            ]}
          />
        </View>
      </View>

      {/* Content Lines Skeleton */}
      <View style={styles.contentContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.contentLine,
              {
                backgroundColor: baseColor,
                width: index % 3 === 0 ? '85%' : index % 2 === 0 ? '95%' : '100%'
              },
              shimmerStyle
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  imageSkeleton: {
    width: screenWidth,
    height: screenWidth * 0.56,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
  },
  titleLine: {
    height: 28,
    borderRadius: 6,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  contentLine: {
    height: 16,
    borderRadius: 4,
  },
});

export default ArticleSkeletonLoader;