import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const { width: screenWidth } = Dimensions.get('window');
const PHOTO_SIZE = 140; // Larger for better face visibility
const PHOTO_SPACING = 12; // iOS-standard gap
const CONTAINER_PADDING = 16;
const MAX_IMAGE_SIZE = 1920;

/**
 * Skeleton Loader Component - iOS Photos Style
 */
const PhotoSkeleton = () => {
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
    <View style={styles.photoSkeleton}>
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
const PhotoGallerySimple = ({ profileId, isEditMode = false }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const scrollViewRef = useRef(null);
  const [shouldScrollToEnd, setShouldScrollToEnd] = useState(false);

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

        // Log if we filtered out orphaned records (helps with debugging)
        if (__DEV__ && validPhotos.length < data.length) {
          console.info(
            `[PhotoGallerySimple] Filtered ${data.length - validPhotos.length} invalid photo records for profile ${profileId}`
          );
        }
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Scroll to end after new photo added (prevents drawer jump)
  useEffect(() => {
    if (shouldScrollToEnd && scrollViewRef.current && photos.length > 0) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
        setShouldScrollToEnd(false);
      }, 150);
    }
  }, [photos.length, shouldScrollToEnd]);

  // Trigger scroll when upload completes
  useEffect(() => {
    if (!uploading && photos.length > 0) {
      setShouldScrollToEnd(true);
    }
  }, [uploading]);

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
        const storagePath = `${profileId}/${timestamp}_${random}_${i}.jpg`;

        const { url, error: uploadError } = await storageService.uploadProfilePhoto(
          compressedUri,
          profileId,
          storagePath
        );

        if (uploadError) throw uploadError;

        // Insert to database (no primary logic)
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#A13333" />
      </View>
    );
  }

  if (photos.length === 0 && !isEditMode) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={PHOTO_SIZE + PHOTO_SPACING}
        snapToAlignment="start"
      >
        {/* Photos */}
        {photos.map((photo, index) => (
          <View
            key={photo.id}
            style={[
              styles.photoContainer,
              index === photos.length - 1 && !isEditMode && styles.lastPhoto,
            ]}
          >
            {/* RobustImage with error recovery */}
            <RobustImage
              source={{ uri: photo.photo_url }}
              style={styles.photo}
              contentFit="cover"
              cachePolicy="memory-disk"
              maxRetries={3}
              showRetryButton={true}
              onError={(error) => handleImageError(photo.id, error)}
              recyclingKey={photo.id}
              transition={300}
            />

            {/* Delete button (edit mode only) */}
            {isEditMode && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePhoto(photo.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={styles.deleteIconContainer}>
                  <Ionicons name="close" size={16} color="#F9F7F3" />
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add button (edit mode only) */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleSelectPhotos}
            activeOpacity={0.8}
            disabled={uploading}
          >
            {uploading ? (
              <PhotoSkeleton />
            ) : (
              <>
                <View style={styles.addIconContainer}>
                  <Ionicons name="add" size={32} color="#A13333" />
                </View>
                <Text style={styles.addText}>إضافة</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Empty state placeholder */}
        {photos.length === 0 && isEditMode && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={40} color="#736372" />
            <Text style={styles.emptyText}>لا توجد صور</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },

  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },

  scrollContent: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingVertical: 4, // Prevent shadow clipping
  },

  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginEnd: PHOTO_SPACING,
    position: 'relative',
  },

  lastPhoto: {
    marginEnd: 0, // No trailing spacing if no add button
  },

  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    backgroundColor: '#D1BBA3', // Camel Hair Beige placeholder

    // iOS-style subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  photoSkeleton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    backgroundColor: '#D1BBA3', // Camel Hair Beige
    overflow: 'hidden',
  },

  skeletonShimmer: {
    flex: 1,
    backgroundColor: '#F9F7F3', // Al-Jass White
  },

  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
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

  addButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1BBA3', // Camel Hair Beige
    borderStyle: 'dashed',
    backgroundColor: '#F9F7F3', // Al-Jass White
    alignItems: 'center',
    justifyContent: 'center',
  },

  addIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1BBA320', // Camel Hair Beige 20%
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#736372', // Text Muted
    fontFamily: 'SF Arabic',
    textAlign: 'center',
  },

  emptyState: {
    width: PHOTO_SIZE * 2,
    height: PHOTO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#736372',
    fontFamily: 'SF Arabic',
  },
});

export default PhotoGallerySimple;
