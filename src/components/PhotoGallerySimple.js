import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import storageService from '../services/storage';
import RobustImage from './ui/RobustImage';
import { toArabicNumerals } from '../utils/dateUtils';

const { width: screenWidth } = Dimensions.get('window');
const STACK_CARD_HEIGHT = 260;
const STACK_GAP = 8;
const CAROUSEL_CARD_WIDTH = 280;
const CAROUSEL_CARD_HEIGHT = 200;
const CAROUSEL_GAP = 12;
const GRID_COLUMNS = 3;
const GRID_GAP = 8;
const SECTION_PADDING = 16;
const MAX_IMAGE_SIZE = 1920;

/**
 * Skeleton Loader Component - iOS Photos Style
 */
const PhotoSkeleton = ({ style }) => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.photoSkeleton, style]}>
      <Animated.View
        style={[
          styles.skeletonShimmer,
          { opacity: pulseAnim },
        ]}
      />
    </View>
  );
};

/**
 * Simplified Photo Gallery - Horizontal Scroll (iOS Photos Style)
 */
const PhotoGallerySimple = ({ profileId, isEditMode = false, onPhotosLoaded = () => {} }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const photoCount = photos.length;

  const layoutType = useMemo(() => {
    if (photoCount === 0) return 'empty';
    if (photoCount <= 2) return 'stack';
    if (photoCount <= 5) return 'carousel';
    return 'grid';
  }, [photoCount]);

  const gridCardWidth = useMemo(() => {
    const totalGap = GRID_GAP * (GRID_COLUMNS - 1);
    return (screenWidth - SECTION_PADDING * 2 - totalGap) / GRID_COLUMNS;
  }, []);

  // Load photos
  const loadPhotos = useCallback(async () => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('profile_photos')
        .select('*')
        .eq('profile_id', profileId)
        .order('display_order', { ascending: true });

      if (!error && data) {
        // Defensive filtering: Skip invalid/orphaned photo records
        // Prevents console errors from broken image URLs
        const validPhotos = data.filter(photo => {
          // Basic validation checks
          if (!photo.photo_url || !photo.storage_path) {
            if (__DEV__) {
              console.warn(`[PhotoGallerySimple] Skipping photo ${photo.id}: missing URL or storage path`);
            }
            return false;
          }

          // Validate URL format
          try {
            new URL(photo.photo_url);
            return true;
          } catch {
            if (__DEV__) {
              console.warn(`[PhotoGallerySimple] Skipping photo ${photo.id}: invalid URL format`);
            }
            return false;
          }
        });

        setPhotos(validPhotos);
        onPhotosLoaded(validPhotos.length);

        // Log if we filtered out orphaned records (helps with debugging)
        if (__DEV__ && validPhotos.length < data.length) {
          console.info(
            `[PhotoGallerySimple] Filtered ${data.length - validPhotos.length} invalid photo records for profile ${profileId}`
          );
        }
      } else if (!error) {
        onPhotosLoaded(0);
      }
    } catch (error) {
      onPhotosLoaded(0);
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId, onPhotosLoaded]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    if (layoutType !== 'carousel') {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((prev) => {
      const maxIndex = Math.max(photoCount - 1, 0);
      return prev > maxIndex ? maxIndex : prev;
    });
  }, [layoutType, photoCount]);

  // Scroll to end after new photo added (prevents drawer jump)
  useEffect(() => {
    if (
      shouldScrollToEnd &&
      scrollViewRef.current &&
      photoCount > 0 &&
      layoutType === 'carousel'
    ) {
      const offset = (photoCount - 1) * (CAROUSEL_CARD_WIDTH + CAROUSEL_GAP);
      setTimeout(() => {
        scrollViewRef.current.scrollTo({ x: offset, animated: true });
        setActiveIndex(Math.max(0, photoCount - 1));
        setShouldScrollToEnd(false);
      }, 150);
    } else if (shouldScrollToEnd) {
      setShouldScrollToEnd(false);
    }
  }, [photoCount, shouldScrollToEnd, layoutType]);

  // Trigger scroll when upload completes
  useEffect(() => {
    if (!uploading && photoCount > 0 && layoutType === 'carousel') {
      setShouldScrollToEnd(true);
    }
  }, [uploading, photoCount, layoutType]);

  // Log image errors for diagnostics (downgraded to warning for filtered records)
  const handleImageError = (photoId, error) => {
    if (__DEV__) {
      console.warn('[PhotoGallerySimple] Image load error:', {
        photoId,
        profileId,
        error: error?.message || 'Unknown error',
      });
    }
  };

  // Compress image
  const compressImage = async (uri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_IMAGE_SIZE } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  };

  // Handle photo selection
  const handleSelectPhotos = async () => {
    if (!isEditMode) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('الإذن مطلوب', 'نحتاج إذن الوصول للصور');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets?.length > 0) {
      await uploadPhotos(result.assets);
    }
  };

  // Upload photos
  const uploadPhotos = async (assets) => {
    try {
      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const compressedUri = await compressImage(asset.uri);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        // CRITICAL FIX: Include profiles/ prefix to match actual storage location
        const storagePath = `profiles/${profileId}/${timestamp}_${random}_${i}.jpg`;

        const { url, error: uploadError } = await storageService.uploadProfilePhoto(
          compressedUri,
          profileId,
          storagePath
        );

        if (uploadError) throw uploadError;

        // Insert to database with correct storage path
        await supabase.from('profile_photos').insert({
          profile_id: profileId,
          photo_url: url,
          storage_path: storagePath,
          display_order: photos.length + i,
        });
      }

      await loadPhotos();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('خطأ', 'فشل رفع الصور');
    } finally {
      setUploading(false);
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId) => {
    if (!isEditMode) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert('تأكيد الحذف', 'هل تريد حذف هذه الصورة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('profile_photos').delete().eq('id', photoId);

            // Reorder remaining photos
            const remaining = photos.filter((p) => p.id !== photoId);
            for (let i = 0; i < remaining.length; i++) {
              await supabase
                .from('profile_photos')
                .update({ display_order: i })
                .eq('id', remaining[i].id);
            }

            await loadPhotos();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('خطأ', 'فشل حذف الصورة');
          }
        },
      },
    ]);
  };

  const renderDeleteButton = (photoId) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDeletePhoto(photoId)}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="حذف الصورة"
    >
      <View style={styles.deleteIconContainer}>
        <Ionicons name="close" size={16} color="#F9F7F3" />
      </View>
    </TouchableOpacity>
  );

  const renderPhotoCard = (photo, layoutKey, extraStyles = null) => {
    if (!photo || !photo.photo_url) return null;

    const containerStyles = [
      styles.photoCard,
      styles[`${layoutKey}Card`],
    ];
    if (extraStyles) {
      containerStyles.push(extraStyles);
    }

    const imageStyles = [
      styles.photoImage,
      styles[`${layoutKey}Image`],
    ].filter(Boolean);

    return (
      <View key={photo.id || photo.photo_url} style={containerStyles}>
        <RobustImage
          source={{ uri: photo.photo_url }}
          style={imageStyles}
          contentFit="cover"
          cachePolicy="memory-disk"
          maxRetries={3}
          showRetryButton={true}
          onError={(error) => handleImageError(photo.id, error)}
          recyclingKey={photo.id || photo.photo_url}
          transition={300}
        />
        {isEditMode ? renderDeleteButton(photo.id) : null}
      </View>
    );
  };

  const renderAddCard = (layoutKey, extraStyles = null) => (
    <TouchableOpacity
      key="add-photo"
      style={[
        styles.addCard,
        styles[`${layoutKey}AddCard`],
        extraStyles,
      ]}
      onPress={handleSelectPhotos}
      activeOpacity={0.85}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel="إضافة صورة جديدة"
    >
      {uploading ? (
        <PhotoSkeleton style={[styles.photoImage, styles[`${layoutKey}Image`]]} />
      ) : (
        <>
          <View style={styles.addIconContainer}>
            <Ionicons name="add" size={28} color="#A13333" />
          </View>
          <Text style={styles.addText}>إضافة</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const renderStackLayout = () => (
    <View style={styles.stackContainer}>
      {photos.map((photo, index) => {
        const isLast = index === photos.length - 1 && !isEditMode;
        return renderPhotoCard(photo, 'stack', isLast ? { marginBottom: 0 } : null);
      })}
      {isEditMode ? renderAddCard('stack') : null}
    </View>
  );

  const renderCarouselLayout = () => (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        decelerationRate="fast"
        snapToInterval={CAROUSEL_CARD_WIDTH + CAROUSEL_GAP}
        snapToAlignment="start"
        onMomentumScrollEnd={(event) => {
          const rawIndex = Math.round(
            event.nativeEvent.contentOffset.x / (CAROUSEL_CARD_WIDTH + CAROUSEL_GAP)
          );
          const clamped = Math.min(photoCount - 1, Math.max(0, rawIndex));
          setActiveIndex(clamped);
        }}
      >
        {photos.map((photo, index) => {
          const isLast = index === photos.length - 1 && !isEditMode;
          return renderPhotoCard(
            photo,
            'carousel',
            isLast ? { marginEnd: 0 } : null,
          );
        })}
        {isEditMode ? renderAddCard('carousel') : null}
      </ScrollView>
      {photoCount > 0 ? (
        <>
          <View style={styles.carouselCounter}>
            <Text style={styles.carouselCounterText}>
              {toArabicNumerals(String(Math.min(activeIndex + 1, photoCount)))} / {toArabicNumerals(String(photoCount))}
            </Text>
          </View>
          <View style={styles.carouselDots}>
            {photos.map((_, index) => {
              const isActive = index === Math.min(activeIndex, photoCount - 1);
              return (
                <View
                  key={`dot-${index}`}
                  style={[styles.carouselDot, isActive && styles.carouselDotActive]}
                />
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );

  const renderGridLayout = () => (
    <View style={styles.gridContainer}>
      {photos.map((photo, index) => {
        const marginRight = (index % GRID_COLUMNS) === GRID_COLUMNS - 1 ? 0 : GRID_GAP;
        return renderPhotoCard(photo, 'grid', {
          width: gridCardWidth,
          marginRight,
          marginBottom: GRID_GAP,
        });
      })}
      {isEditMode
        ? renderAddCard('grid', {
            width: gridCardWidth,
            marginRight: (photos.length % GRID_COLUMNS) === GRID_COLUMNS - 1 ? 0 : GRID_GAP,
            marginBottom: GRID_GAP,
          })
        : null}
    </View>
  );

  const renderEmptyEditState = () => (
    <View style={styles.emptyEditContainer}>
      {renderAddCard('stack')}
    </View>
  );
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#A13333" />
      </View>
    );
  }

  if (photoCount === 0 && !isEditMode) {
    return null;
  }

  if (layoutType === 'empty') {
    return (
      <View style={styles.galleryContainer}>
        {isEditMode ? renderEmptyEditState() : null}
      </View>
    );
  }

  let content = null;
  if (layoutType === 'stack') {
    content = renderStackLayout();
  } else if (layoutType === 'carousel') {
    content = renderCarouselLayout();
  } else {
    content = renderGridLayout();
  }

  return (
    <View style={styles.galleryContainer}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  galleryContainer: {
    marginTop: 8,
  },

  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },

  stackContainer: {
    paddingHorizontal: SECTION_PADDING,
  },

  photoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#D1BBA3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },

  stackCard: {
    width: '100%',
    height: STACK_CARD_HEIGHT,
    marginBottom: STACK_GAP,
  },

  stackImage: {
    width: '100%',
    height: STACK_CARD_HEIGHT,
  },

  photoSkeleton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    height: '100%',
    backgroundColor: '#D1BBA3',
  },

  skeletonShimmer: {
    flex: 1,
    backgroundColor: '#F9F7F3', // Al-Jass White
  },

  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },

  deleteIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#A13333', // Najdi Crimson
    alignItems: 'center',
    justifyContent: 'center',

    // Depth shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  addCard: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1BBA3',
    borderStyle: 'dashed',
    backgroundColor: '#F9F7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stackAddCard: {
    width: '100%',
    height: STACK_CARD_HEIGHT,
    marginBottom: STACK_GAP,
  },

  carouselAddCard: {
    width: CAROUSEL_CARD_WIDTH,
    height: CAROUSEL_CARD_HEIGHT,
    marginEnd: CAROUSEL_GAP,
  },

  gridAddCard: {
    height: 160,
  },

  addIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1BBA320',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#736372',
  },

  photoImage: {
    width: '100%',
    height: '100%',
  },

  carouselContainer: {
    position: 'relative',
    paddingBottom: 32,
  },

  carouselContent: {
    paddingHorizontal: SECTION_PADDING,
    paddingVertical: 4,
    paddingRight: SECTION_PADDING + 80,
  },

  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    height: CAROUSEL_CARD_HEIGHT,
    marginEnd: CAROUSEL_GAP,
  },

  carouselImage: {
    width: '100%',
    height: CAROUSEL_CARD_HEIGHT,
  },

  carouselCounter: {
    position: 'absolute',
    top: 12,
    right: SECTION_PADDING,
    backgroundColor: 'rgba(36,33,33,0.65)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  carouselCounterText: {
    color: '#F9F7F3',
    fontSize: 13,
    fontWeight: '600',
  },

  carouselDots: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1BBA3',
    marginHorizontal: 4,
  },

  carouselDotActive: {
    backgroundColor: '#A13333',
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SECTION_PADDING,
    marginTop: 4,
  },

  gridCard: {
    height: 160,
    marginBottom: GRID_GAP,
  },

  gridImage: {
    width: '100%',
    height: '100%',
  },

  emptyEditContainer: {
    paddingHorizontal: SECTION_PADDING,
  },
});

export default PhotoGallerySimple;
