import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Shimmer effect component
 */
const ShimmerEffect = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      <LinearGradient
        colors={['#E5E7EB', '#F3F4F6', '#E5E7EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
};

/**
 * Unified loading state component for photos
 * Shows a shimmer effect while loading
 */
const LoadingPhotoView = ({ 
  style, 
  circular = false,
  size,
  width,
  height,
}) => {
  // Calculate dimensions
  const viewWidth = size || width || 80;
  const viewHeight = size || height || 80;
  const borderRadius = circular ? viewWidth / 2 : 8;

  return (
    <View 
      style={[
        styles.container,
        {
          width: viewWidth,
          height: viewHeight,
          borderRadius,
        },
        style,
      ]}
    >
      <ShimmerEffect />
    </View>
  );
};

/**
 * Hero image loading variant
 */
export const LoadingHeroImage = ({ style }) => {
  return (
    <LoadingPhotoView
      style={style}
      circular={false}
      width={200}
      height={200}
    />
  );
};

/**
 * Profile photo loading variant
 */
export const LoadingProfilePhoto = ({ style, size = 160 }) => {
  return (
    <LoadingPhotoView
      style={style}
      circular={true}
      size={size}
    />
  );
};

/**
 * Thumbnail loading variant
 */
export const LoadingThumbnail = ({ style, size = 48 }) => {
  return (
    <LoadingPhotoView
      style={style}
      circular={true}
      size={size}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
});

export default LoadingPhotoView;