import React from 'react';
import { View, StyleSheet } from 'react-native';
import CachedImage, { CachedHeroImage, CachedThumbnail } from './CachedImage';

/**
 * Progressive image component that loads images with blur-up effect
 * Now uses CachedImage internally for automatic caching
 */
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
  // Convert icon name to full icon name
  const fallbackIcon = `${placeholder}-circle-outline`;
  
  return (
    <CachedImage
      source={source}
      style={style}
      contentFit={resizeMode}
      showLoadingIndicator={showLoadingIndicator}
      fallbackIcon={fallbackIcon}
      fallbackIconSize={placeholderSize}
      onError={onError}
      onLoad={onLoad}
      {...props}
    />
  );
};

/**
 * Hero variant for large profile images
 * Now uses CachedHeroImage for better performance
 */
export const ProgressiveHeroImage = ({ source, style, ...props }) => {
  return (
    <CachedHeroImage
      source={source}
      style={style}
      {...props}
    />
  );
};

/**
 * Thumbnail variant for lists
 * Now uses CachedThumbnail for better performance
 */
export const ProgressiveThumbnail = ({ source, style, size = 48, ...props }) => {
  return (
    <CachedThumbnail
      source={source}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  // Styles are now handled by CachedImage
});

export default ProgressiveImage;