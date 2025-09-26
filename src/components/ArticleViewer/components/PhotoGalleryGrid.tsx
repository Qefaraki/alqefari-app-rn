import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const GRID_WIDTH = screenWidth - (CONTAINER_PADDING * 2);
const GAP = 8;

interface PhotoGalleryGridProps {
  previewImages: string[];
  totalImageCount: number;
  permalink: string;
  title: string;
  isNightMode: boolean;
  onImagePress?: (imageUrl: string) => void;
}

const PhotoGalleryGrid: React.FC<PhotoGalleryGridProps> = ({
  previewImages,
  totalImageCount,
  permalink,
  title,
  isNightMode,
  onImagePress,
}) => {
  // Don't show if no preview images
  if (previewImages.length === 0) {
    return null;
  }

  // Determine remaining count for overlay
  const remainingCount = Math.max(0, totalImageCount - previewImages.length);

  const handleOpenGallery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(permalink).catch(() => {
      Alert.alert('خطأ', 'لا يمكن فتح الرابط');
    });
  };

  return (
    <View style={styles.container}>
      {/* Image Grid - now without Galeria wrapper */}
      <View style={styles.gridContainer}>

        {/* Row 1: Two images (60% + 40%) */}
        <View style={styles.row}>
          {previewImages[0] && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onImagePress?.(previewImages[0]);
              }}
              activeOpacity={0.95}
            >
              <Image
                source={{ uri: previewImages[0] }}
                style={[styles.image, { width: GRID_WIDTH * 0.6 - GAP/2, height: 200 }]}
              />
            </TouchableOpacity>
          )}
          {previewImages[1] && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onImagePress?.(previewImages[1]);
              }}
              activeOpacity={0.95}
            >
              <Image
                source={{ uri: previewImages[1] }}
                style={[styles.image, { width: GRID_WIDTH * 0.4 - GAP/2, height: 200 }]}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Row 2: Three images (equal width) */}
        <View style={styles.row}>
          {[2, 3, 4].map(index => previewImages[index] && (
            <TouchableOpacity
              key={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onImagePress?.(previewImages[index]);
              }}
              activeOpacity={0.95}
            >
              <Image
                source={{ uri: previewImages[index] }}
                style={[styles.image, styles.threeColumnImage]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Row 3: Show max 3 images with count overlay on last */}
        <View style={styles.row}>
          {[5, 6, 7].map(index => {
            if (!previewImages[index]) return null;

            const isLast = index === 7 || !previewImages[index + 1];
            const showOverlay = isLast && (remainingCount > 0 || previewImages[8]);

            return (
              <TouchableOpacity
                key={index}
                style={styles.imageContainer}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onImagePress?.(previewImages[index]);
                }}
                activeOpacity={0.95}
              >
                <Image
                  source={{ uri: previewImages[index] }}
                  style={[styles.image, styles.threeColumnImage]}
                />
                {showOverlay && (
                  <View style={styles.countOverlay} pointerEvents="none">
                    <Text style={styles.countText}>+{remainingCount + (previewImages[8] ? 1 : 0)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View

      {/* Gallery Link Button */}
      <TouchableOpacity
        style={styles.galleryButton}
        onPress={handleOpenGallery}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        <Text style={styles.galleryButtonText}>عرض جميع الصور</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingVertical: 16,
  },
  gridContainer: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: GAP,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    borderRadius: 12,
    backgroundColor: tokens.colors.najdi.container + '20',
  },
  threeColumnImage: {
    width: (GRID_WIDTH - GAP * 2) / 3,
    height: (GRID_WIDTH - GAP * 2) / 3,
  },
  countOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'System',
  },
  galleryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  galleryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
});

export default PhotoGalleryGrid;