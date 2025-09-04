import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import LoadingPhotoView from './LoadingPhotoView';
import imageOptimizationService from '../services/imageOptimization';

// Blurhash placeholder for loading state
const blurhash = 'L6D]_g00~q00~q00~q00M{00~q00';

/**
 * Unified image component with caching, loading states, and error handling
 * Uses expo-image for native performance and automatic caching
 */
const CachedImage = ({ 
  source,
  style,
  resizeMode = 'cover',
  showLoadingIndicator = true,
  fallbackIcon = 'person-circle-outline',
  fallbackIconSize = 40,
  onLoadStart,
  onLoadEnd,
  onError,
  priority = 'normal',
  cachePolicy = 'disk',
  contentFit = 'cover',
  transition = 300,
  ...props
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadStartTime, setLoadStartTime] = useState(null);

  // Get optimized URL if needed
  const imageUri = source?.uri || source;

  const handleLoadStart = () => {
    const startTime = performance.now();
    setLoadStartTime(startTime);
    setLoading(true);
    setError(false);
    console.log(`👤 PROFILE CACHE: Loading started for ${imageUri?.substring(imageUri.lastIndexOf('/') + 1) || 'image'}`);
    onLoadStart?.();
  };

  const handleLoadEnd = () => {
    setLoading(false);
    
    if (loadStartTime) {
      const loadTime = performance.now() - loadStartTime;
      const fileName = imageUri?.substring(imageUri.lastIndexOf('/') + 1) || 'image';
      
      // Heuristic: if load time < 50ms, likely from cache
      const fromCache = loadTime < 50;
      const cacheStatus = fromCache ? '✅ CACHE HIT' : '🌐 NETWORK';
      
      console.log(`👤 PROFILE CACHE: ${cacheStatus} - ${fileName} loaded in ${loadTime.toFixed(0)}ms`);
    }
    
    onLoadEnd?.();
  };

  const handleError = (event) => {
    setLoading(false);
    setError(true);
    const fileName = imageUri?.substring(imageUri.lastIndexOf('/') + 1) || 'image';
    console.error(`👤 PROFILE CACHE: ❌ ERROR loading ${fileName}:`, event.error);
    onError?.(event);
  };

  // If no source or error, show fallback
  if (!imageUri || error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.fallbackContainer}>
          <Ionicons 
            name={fallbackIcon}
            size={fallbackIconSize}
            color="#D1D5DB"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={imageUri}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        cachePolicy={cachePolicy}
        priority={priority}
        transition={transition}
        placeholder={blurhash}
        placeholderContentFit="cover"
        onLoadStart={handleLoadStart}
        onLoad={handleLoadEnd}
        onError={handleError}
        {...props}
      />
      
      {/* Loading overlay with shimmer effect */}
      {loading && showLoadingIndicator && (
        <View style={StyleSheet.absoluteFillObject}>
          <LoadingPhotoView 
            style={StyleSheet.absoluteFill}
            circular={style?.borderRadius === 9999}
          />
        </View>
      )}
    </View>
  );
};

/**
 * Hero image variant with larger size and specific styling
 */
export const CachedHeroImage = (props) => {
  return (
    <CachedImage
      {...props}
      priority="high"
      fallbackIconSize={80}
      showLoadingIndicator={true}
    />
  );
};

/**
 * Thumbnail variant for tree nodes
 */
export const CachedThumbnail = (props) => {
  return (
    <CachedImage
      {...props}
      priority="low"
      transition={200}
      showLoadingIndicator={false}
      fallbackIconSize={30}
    />
  );
};

/**
 * Profile photo variant with circular shape
 */
export const CachedProfilePhoto = ({ style, ...props }) => {
  return (
    <CachedImage
      {...props}
      style={[styles.profilePhoto, style]}
      priority="normal"
      fallbackIcon="person-circle"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  fallbackContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhoto: {
    borderRadius: 9999, // Makes it circular
  },
});

export default CachedImage;