import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Galeria } from '@nandorojo/galeria';
import { FlatGrid } from 'react-native-super-grid';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import storageService from '../services/storage';
import RobustImage from './ui/RobustImage';
import tokens from './ui/tokens';

const GAP = 8;
const MAX_IMAGE_SIZE = 1920;
const palette = tokens.colors.najdi;

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
 * PhotoGallerySimple - 2-Column Grid with FlatGrid
 *
 * Automatically responsive grid layout using react-native-super-grid.
 * Handles 2-column layout, RTL mode, and dynamic photo loading.
 */
const PhotoGallerySimple = ({ profileId, isEditMode = false, onPhotosLoaded = () => {} }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const photoCount = photos.length;

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
        const validPhotos = data.filter(photo => {
          if (!photo.photo_url || !photo.storage_path) {
            if (__DEV__) {
              console.warn(`[PhotoGallerySimple] Skipping photo ${photo.id}: missing URL or storage path`);
            }
            return false;
          }

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

  // Log image errors
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
        const storagePath = `profiles/${profileId}/${timestamp}_${random}_${i}.jpg`;

        const { url, error: uploadError } = await storageService.uploadProfilePhoto(
          compressedUri,
          profileId,
          storagePath
        );

        if (uploadError) throw uploadError;

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
        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );

  // Gallery URLs for Galeria
  const galleryUrls = useMemo(
    () => photos.map((photo) => photo.photo_url).filter(Boolean),
    [photos],
  );

  // Unified render item for both edit and view modes
  const renderItem = ({ item, index }) => {
    // Handle add tile (edit mode only)
    if (item.isAddTile) {
      return (
        <TouchableOpacity
          key="add-photo"
          style={styles.addTile}
          onPress={handleSelectPhotos}
          activeOpacity={0.85}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="إضافة صورة جديدة"
        >
          {uploading ? (
            <PhotoSkeleton style={styles.addSkeleton} />
          ) : (
            <>
              <View style={styles.addIconContainer}>
                <Ionicons name="cloud-upload-outline" size={22} color={palette.text} />
              </View>
              <Text style={styles.addText}>إضافة صور</Text>
              <Text style={styles.addHint}>بإمكانك اختيار عدة صور في آنٍ واحد</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    // Edit mode with delete button
    if (isEditMode) {
      return (
        <View style={styles.photoTile}>
          <RobustImage
            source={{ uri: item.photo_url }}
            style={styles.photoImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            maxRetries={3}
            showRetryButton={false}
            onError={(error) => handleImageError(item.id, error)}
            recyclingKey={item.id}
            transition={180}
          />
          {renderDeleteButton(item.id)}
        </View>
      );
    }

    // View mode with Galeria integration
    return (
      <Galeria.Image index={index} key={item.id}>
        <View style={styles.photoTile}>
          <RobustImage
            source={{ uri: item.photo_url }}
            style={styles.photoImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            maxRetries={3}
            showRetryButton={false}
            onError={(error) => handleImageError(item.id, error)}
            recyclingKey={item.id}
            transition={180}
          />
        </View>
      </Galeria.Image>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={palette.text} />
      </View>
    );
  }

  // Empty state (edit mode shows add tile, view mode shows nothing)
  if (photoCount === 0) {
    return isEditMode ? (
      <View style={styles.galleryContainer}>
        <FlatGrid
          itemDimension={160}
          data={[{ id: 'add-tile', isAddTile: true }]}
          spacing={GAP}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      </View>
    ) : null;
  }

  // Edit mode with FlatGrid
  if (isEditMode) {
    const editData = [...photos, { id: 'add-tile', isAddTile: true }];
    return (
      <View style={styles.galleryContainer}>
        <FlatGrid
          itemDimension={160}
          data={editData}
          spacing={GAP}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      </View>
    );
  }

  // View mode with Galeria integration
  return (
    <View style={styles.galleryContainer}>
      <Galeria urls={galleryUrls}>
        <FlatGrid
          itemDimension={160}
          data={photos}
          spacing={GAP}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      </Galeria>
    </View>
  );
};

const styles = StyleSheet.create({
  galleryContainer: {
    marginTop: 12,
  },
  loadingContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  photoTile: {
    aspectRatio: 1,
    backgroundColor: '#FAFAFC',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    end: 12,
    zIndex: 10,
  },
  deleteIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(17,17,17,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addTile: {
    aspectRatio: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,17,17,0.2)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  addSkeleton: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoSkeleton: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  skeletonShimmer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  addIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(36,33,33,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  addHint: {
    fontSize: 12,
    color: 'rgba(36,33,33,0.6)',
    marginTop: 6,
  },
});

export default PhotoGallerySimple;
