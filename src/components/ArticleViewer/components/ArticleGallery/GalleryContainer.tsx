import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import MasonryView from './MasonryView';
import CarouselView from './CarouselView';
import tokens from '../../../ui/tokens';

const { width: screenWidth } = Dimensions.get('window');

export type GalleryViewMode = 'grid' | 'carousel' | 'select';

interface ArticleGalleryProps {
  images: string[];
  articleTitle: string;
  isNightMode: boolean;
}

const ArticleGallery: React.FC<ArticleGalleryProps> = ({
  images,
  articleTitle,
  isNightMode,
}) => {
  const [viewMode, setViewMode] = useState<GalleryViewMode>('grid');
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewMode === 'select') {
      setViewMode('grid');
      setSelectedImages(new Set());
    } else {
      setViewMode('select');
    }
  }, [viewMode]);

  // Toggle image selection
  const toggleImageSelection = useCallback((imageUrl: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageUrl)) {
        newSet.delete(imageUrl);
      } else {
        newSet.add(imageUrl);
      }
      return newSet;
    });
  }, []);

  // Select all images
  const selectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImages(new Set(images));
  }, [images]);

  // Download selected images
  const downloadSelected = useCallback(async () => {
    if (selectedImages.size === 0) {
      Alert.alert('اختر صور', 'الرجاء اختيار صور للتحميل');
      return;
    }

    setIsDownloading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن مطلوب', 'نحتاج إذن للحفظ في معرض الصور');
        setIsDownloading(false);
        return;
      }

      const downloadPromises = Array.from(selectedImages).map(async (imageUrl, index) => {
        try {
          const filename = `alqefari_${Date.now()}_${index}.jpg`;
          const fileUri = `${FileSystem.documentDirectory}${filename}`;

          // Download image
          const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

          if (downloadResult.status === 200) {
            // Save to media library
            await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
            return { success: true, url: imageUrl };
          }
          return { success: false, url: imageUrl };
        } catch (error) {
          console.error(`Error downloading image: ${imageUrl}`, error);
          return { success: false, url: imageUrl };
        }
      });

      const results = await Promise.all(downloadPromises);
      const successCount = results.filter(r => r.success).length;

      if (successCount === selectedImages.size) {
        Alert.alert('نجح', `تم حفظ ${successCount} صور في المعرض`);
      } else {
        Alert.alert('تحذير', `تم حفظ ${successCount} من ${selectedImages.size} صور`);
      }

      // Clear selection
      setSelectedImages(new Set());
      setViewMode('grid');
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحميل الصور');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedImages]);

  // Share selected images
  const shareSelected = useCallback(async () => {
    if (selectedImages.size === 0) {
      Alert.alert('اختر صور', 'الرجاء اختيار صور للمشاركة');
      return;
    }

    try {
      if (selectedImages.size === 1) {
        // Share single image URL
        const imageUrl = Array.from(selectedImages)[0];
        await Share.share({
          message: `صورة من ${articleTitle}\n${imageUrl}`,
          url: imageUrl,
        });
      } else {
        // Share multiple image URLs
        const urls = Array.from(selectedImages).join('\n');
        await Share.share({
          message: `صور من ${articleTitle}\n\n${urls}`,
        });
      }
    } catch (error) {
      Alert.alert('خطأ', 'فشلت مشاركة الصور');
    }
  }, [selectedImages, articleTitle]);

  // Gallery header controls
  const renderHeader = () => (
    <View style={[styles.header, isNightMode && styles.headerDark]}>
      <View style={styles.viewModeControls}>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'grid' && styles.viewModeButtonActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('grid');
            setSelectedImages(new Set());
          }}
        >
          <Ionicons
            name="grid"
            size={18}
            color={viewMode === 'grid' ? '#FFFFFF' : tokens.colors.najdi.text}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === 'grid' && styles.viewModeTextActive,
            ]}
          >
            شبكة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'carousel' && styles.viewModeButtonActive,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode('carousel');
            setSelectedImages(new Set());
          }}
        >
          <Ionicons
            name="albums"
            size={18}
            color={viewMode === 'carousel' ? '#FFFFFF' : tokens.colors.najdi.text}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === 'carousel' && styles.viewModeTextActive,
            ]}
          >
            عرض
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'select' && styles.viewModeButtonActive,
          ]}
          onPress={toggleSelectionMode}
        >
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={viewMode === 'select' ? '#FFFFFF' : tokens.colors.najdi.text}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === 'select' && styles.viewModeTextActive,
            ]}
          >
            تحديد
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'select' && (
        <View style={styles.selectionActions}>
          {selectedImages.size > 0 && (
            <>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={selectAll}
                disabled={selectedImages.size === images.length}
              >
                <Text style={styles.selectionButtonText}>
                  {selectedImages.size === images.length ? `${selectedImages.size} محدد` : 'تحديد الكل'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.selectionButton, styles.primaryButton]}
                onPress={downloadSelected}
                disabled={isDownloading}
              >
                <Ionicons name="download" size={16} color="#FFFFFF" />
                <Text style={[styles.selectionButtonText, styles.primaryButtonText]}>
                  تحميل ({selectedImages.size})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectionButton}
                onPress={shareSelected}
              >
                <Ionicons name="share" size={16} color={tokens.colors.najdi.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, isNightMode && styles.containerDark]}>
      {renderHeader()}

      {viewMode === 'carousel' ? (
        <CarouselView
          images={images}
          isNightMode={isNightMode}
        />
      ) : (
        <MasonryView
          images={images}
          isNightMode={isNightMode}
          isSelectionMode={viewMode === 'select'}
          selectedImages={selectedImages}
          onToggleSelection={toggleImageSelection}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.najdi.background,
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.colors.najdi.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerDark: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  viewModeControls: {
    flexDirection: 'row',
    gap: 8,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  viewModeButtonActive: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  selectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  primaryButton: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.najdi.text,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
});

export default ArticleGallery;