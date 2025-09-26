import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import { LinkType } from '../utils/linkExtractor';

const { width: screenWidth } = Dimensions.get('window');
const PADDING = 8;
const CONTAINER_PADDING = 20;

// Grid layout dimensions
const GRID_WIDTH = screenWidth - (CONTAINER_PADDING * 2);
const SMALL_SIZE = (GRID_WIDTH - PADDING * 2) / 3;
const MEDIUM_SIZE = (GRID_WIDTH - PADDING) / 2;
const LARGE_SIZE = (GRID_WIDTH - PADDING) * 0.66;

interface PhotoGalleryGridProps {
  images: string[];
  totalCount: number;
  externalLink: string;
  linkType: LinkType;
  isNightMode: boolean;
  isLoadingImages?: boolean;
}

const PhotoGalleryGrid: React.FC<PhotoGalleryGridProps> = ({
  images,
  totalCount,
  externalLink,
  linkType,
  isNightMode,
  isLoadingImages = false,
}) => {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  // Determine remaining count for overlay
  const displayedCount = Math.min(images.length, 8);
  const remainingCount = totalCount - displayedCount;

  // Handle external link press
  const handleExternalLink = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await Linking.openURL(externalLink);
    } catch (error) {
      console.error('Failed to open link:', error);
    }
  };

  // Get button text based on link type
  const getButtonText = () => {
    const countText = totalCount > 0 ? ` (${totalCount} صورة)` : '';

    switch(linkType) {
      case 'drive':
        return `فتح في Google Drive${countText}`;
      case 'photos':
        return `فتح في Google Photos${countText}`;
      case 'other':
        return `عرض المعرض الكامل${countText}`;
      case 'article':
      default:
        return `عرض على الموقع${countText}`;
    }
  };

  // Get button icon based on link type
  const getButtonIcon = () => {
    switch(linkType) {
      case 'drive':
        return 'folder-open';
      case 'photos':
        return 'camera';
      case 'other':
        return 'images';
      case 'article':
      default:
        return 'globe-outline';
    }
  };

  if (isLoadingImages) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
          <Text style={[styles.loadingText, isNightMode && styles.loadingTextDark]}>
            جاري تحميل الصور...
          </Text>
        </View>
      </View>
    );
  }

  if (images.length === 0) {
    return null;
  }

  // Render varied grid layout based on image count
  const renderGrid = () => {
    const imagesToShow = images.slice(0, 8);

    // Different layouts based on image count
    if (imagesToShow.length >= 7) {
      // Layout: Large hero + 6 small images in 2 rows + 1 with overlay
      return (
        <View style={styles.gridContainer}>
          {/* Row 1: Large hero image */}
          <View style={styles.gridRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleExternalLink}
              style={[styles.imageWrapper, styles.largeImage]}
            >
              <Image
                source={{ uri: imagesToShow[0] }}
                style={styles.image}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
            </TouchableOpacity>
          </View>

          {/* Row 2: 3 small images */}
          <View style={styles.gridRow}>
            {imagesToShow.slice(1, 4).map((imageUrl, index) => (
              <TouchableOpacity
                key={index + 1}
                activeOpacity={0.9}
                onPress={handleExternalLink}
                style={[styles.imageWrapper, styles.smallImage]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 3: 3 small images */}
          <View style={styles.gridRow}>
            {imagesToShow.slice(4, 7).map((imageUrl, index) => (
              <TouchableOpacity
                key={index + 4}
                activeOpacity={0.9}
                onPress={handleExternalLink}
                style={[styles.imageWrapper, styles.smallImage]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 4: 1 full-width image with overlay if more images exist */}
          {imagesToShow[7] && (
            <View style={styles.gridRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleExternalLink}
                style={[styles.imageWrapper, styles.fullWidthImage]}
              >
                <Image
                  source={{ uri: imagesToShow[7] }}
                  style={styles.image}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
                {remainingCount > 0 && (
                  <View style={styles.overlayContainer}>
                    <Text style={styles.overlayText}>+{remainingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    } else if (imagesToShow.length >= 4) {
      // Layout: 2x2 grid
      return (
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {imagesToShow.slice(0, 2).map((imageUrl, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.9}
                onPress={handleExternalLink}
                style={[styles.imageWrapper, styles.mediumImage]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
                {index === 1 && imagesToShow.length === 4 && remainingCount > 0 && (
                  <View style={styles.overlayContainer}>
                    <Text style={styles.overlayText}>+{remainingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.gridRow}>
            {imagesToShow.slice(2, 4).map((imageUrl, index) => (
              <TouchableOpacity
                key={index + 2}
                activeOpacity={0.9}
                onPress={handleExternalLink}
                style={[styles.imageWrapper, styles.mediumImage]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
                {index === 1 && remainingCount > 0 && (
                  <View style={styles.overlayContainer}>
                    <Text style={styles.overlayText}>+{remainingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    } else {
      // Layout: Single row for 1-3 images
      return (
        <View style={styles.gridContainer}>
          <View style={styles.gridRow}>
            {imagesToShow.map((imageUrl, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.9}
                onPress={handleExternalLink}
                style={[
                  styles.imageWrapper,
                  imagesToShow.length === 1 ? styles.fullWidthImage :
                  imagesToShow.length === 2 ? styles.mediumImage :
                  styles.smallImage
                ]}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                />
                {index === imagesToShow.length - 1 && remainingCount > 0 && (
                  <View style={styles.overlayContainer}>
                    <Text style={styles.overlayText}>+{remainingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Photo Count Badge */}
      <View style={styles.photoCountContainer}>
        <View style={[styles.photoCountBadge, isNightMode && styles.photoCountBadgeDark]}>
          <Ionicons
            name="images"
            size={18}
            color={isNightMode ? '#FFFFFF' : tokens.colors.najdi.text}
          />
          <Text style={[styles.photoCountText, isNightMode && styles.photoCountTextDark]}>
            {totalCount} صورة من الحدث
          </Text>
        </View>
      </View>

      {/* Photo Grid */}
      {renderGrid()}

      {/* External Link Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.externalButton, isNightMode && styles.externalButtonDark]}
          onPress={handleExternalLink}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Ionicons
              name={getButtonIcon()}
              size={20}
              color="#FFFFFF"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>
              {getButtonText()}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>

        {/* Helper text */}
        {linkType === 'drive' && (
          <Text style={[styles.helperText, isNightMode && styles.helperTextDark]}>
            الصور متوفرة بالجودة الكاملة على Google Drive
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  loadingTextDark: {
    color: 'rgba(255,255,255,0.5)',
  },
  photoCountContainer: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingBottom: 16,
    paddingTop: 8,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.najdi.container + '20',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  photoCountBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  photoCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
  },
  photoCountTextDark: {
    color: '#FFFFFF',
  },
  gridContainer: {
    paddingHorizontal: CONTAINER_PADDING,
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: PADDING,
  },
  imageWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: tokens.colors.najdi.container + '10',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  smallImage: {
    width: SMALL_SIZE,
    height: SMALL_SIZE,
    marginRight: PADDING,
  },
  mediumImage: {
    width: MEDIUM_SIZE,
    height: MEDIUM_SIZE,
    marginRight: PADDING,
  },
  largeImage: {
    width: GRID_WIDTH,
    height: GRID_WIDTH * 0.6,
  },
  fullWidthImage: {
    width: GRID_WIDTH,
    height: GRID_WIDTH * 0.5,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
  },
  buttonContainer: {
    paddingHorizontal: CONTAINER_PADDING,
  },
  externalButton: {
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  externalButtonDark: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'SF Arabic',
  },
  helperText: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'SF Arabic',
  },
  helperTextDark: {
    color: 'rgba(255,255,255,0.5)',
  },
});

export default PhotoGalleryGrid;