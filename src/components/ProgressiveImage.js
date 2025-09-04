import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import imageOptimizationService from '../services/imageOptimization';

const ProgressiveImage = ({
  source,
  style,
  placeholder = 'person',
  placeholderSize = 40,
  placeholderColor = '#D1D5DB',
  showLoadingIndicator = false,
  resizeMode = 'cover',
  onError,
  onLoad,
  ...props
}) => {
  const [imageState, setImageState] = useState('loading');
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const thumbnailFadeAnim = useRef(new Animated.Value(0)).current;

  // Get optimized URLs if it's a Supabase URL
  const urls = source?.uri 
    ? imageOptimizationService.getOptimizedUrls(source.uri)
    : null;

  useEffect(() => {
    // Reset state when source changes
    setImageState('loading');
    setThumbnailLoaded(false);
    fadeAnim.setValue(0);
    thumbnailFadeAnim.setValue(0);
  }, [source?.uri]);

  const handleThumbnailLoad = () => {
    setThumbnailLoaded(true);
    Animated.timing(thumbnailFadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleImageLoad = (e) => {
    setImageState('loaded');
    
    // Fade in the main image
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Hide thumbnail after main image loads
      Animated.timing(thumbnailFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    if (onLoad) onLoad(e);
  };

  const handleImageError = (e) => {
    setImageState('error');
    if (onError) onError(e);
  };

  // No source provided
  if (!source?.uri) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.placeholder, { backgroundColor: '#F9FAFB' }]}>
          <Ionicons 
            name={`${placeholder}-circle-outline`} 
            size={placeholderSize} 
            color={placeholderColor} 
          />
        </View>
      </View>
    );
  }

  // Error state
  if (imageState === 'error') {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.placeholder, { backgroundColor: '#FEF2F2' }]}>
          <Ionicons name="alert-circle-outline" size={placeholderSize} color="#EF4444" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Thumbnail (blurred) - loads first */}
      {urls?.thumbnail && !thumbnailLoaded && (
        <Animated.Image
          source={{ uri: urls.thumbnail }}
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: thumbnailFadeAnim },
            styles.thumbnail,
          ]}
          resizeMode={resizeMode}
          blurRadius={20}
          onLoad={handleThumbnailLoad}
        />
      )}

      {/* Loading indicator */}
      {showLoadingIndicator && imageState === 'loading' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#059669" />
        </View>
      )}

      {/* Main image */}
      <Animated.Image
        {...props}
        source={{ uri: urls?.preview || source.uri }}
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: fadeAnim },
        ]}
        resizeMode={resizeMode}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </View>
  );
};

/**
 * Hero variant for large profile images
 */
export const ProgressiveHeroImage = ({ source, style, ...props }) => {
  const urls = source?.uri 
    ? imageOptimizationService.getOptimizedUrls(source.uri)
    : null;

  return (
    <ProgressiveImage
      source={urls ? { uri: urls.full } : source}
      style={style}
      placeholder="person"
      placeholderSize={120}
      showLoadingIndicator={true}
      {...props}
    />
  );
};

/**
 * Thumbnail variant for lists
 */
export const ProgressiveThumbnail = ({ source, style, size = 48, ...props }) => {
  const urls = source?.uri 
    ? imageOptimizationService.getOptimizedUrls(source.uri)
    : null;

  return (
    <ProgressiveImage
      source={urls ? { uri: urls.thumbnail } : source}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      placeholder="person"
      placeholderSize={size * 0.5}
      showLoadingIndicator={false}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  thumbnail: {
    transform: [{ scale: 1.1 }], // Slight scale to hide blur edges
  },
});

export default ProgressiveImage;