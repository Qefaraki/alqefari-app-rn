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
import { Image } from 'expo-image';
import { SimpleGrid } from 'react-native-super-grid';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import storageService from '../services/storage';
import RobustImage from './ui/RobustImage';
import tokens from './ui/tokens';
import { clearLogoCache } from '../utils/qrLogoCache';
import { useSettings } from '../contexts/SettingsContext';
import { toArabicNumerals } from '../utils/dateUtils';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import { MAX_GALLERY_PHOTOS } from '../types/photos';

const GAP = 3; // Instagram-style tight spacing
const BORDER_RADIUS = 5; // Slightly softer corners
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
  const [profileHid, setProfileHid] = useState(null);
  const photoCount = photos.length;

  // Settings and network hooks
  const { settings } = useSettings();
  const { isOnline } = useNetworkGuard();

  // Calculate non-primary photos and remaining slots
  const nonPrimaryPhotos = useMemo(() =>
    (photos || []).filter(p => !p.is_primary),
    [photos]
  );

  // Treat any overflow (>6) as exactly 6 for display
  const displayCount = Math.min(nonPrimaryPhotos.length, MAX_GALLERY_PHOTOS);
  const remainingSlots = Math.max(0, MAX_GALLERY_PHOTOS - nonPrimaryPhotos.length);
  const isAtLimit = nonPrimaryPhotos.length >= MAX_GALLERY_PHOTOS;

  // Format counter with user's numeral preference
  const formatCount = useCallback((num) => {
    return settings.arabicNumerals ? toArabicNumerals(num) : num;
  }, [settings.arabicNumerals]);

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

  // Fetch HID for QR cache invalidation
  useEffect(() => {
    async function fetchHid() {
      if (!profileId) return;

      try {
        const { data } = await supabase
          .from('profiles')
          .select('hid')
          .eq('id', profileId)
          .single();
        setProfileHid(data?.hid || null);
      } catch (error) {
        console.warn('[PhotoGallerySimple] Failed to fetch HID:', error.message);
      }
    }

    fetchHid();
  }, [profileId]);

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

    // Offline check
    if (!isOnline) {
      Alert.alert('غير متصل', 'يرجى الاتصال بالإنترنت لإضافة الصور');
      return;
    }

    // Limit check
    if (remainingSlots <= 0) {
      Alert.alert('خطأ', 'لقد وصلت للحد الأقصى (' + formatCount(6) + ' صور)');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('الإذن مطلوب', 'نحتاج إذن الوصول للصور');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remainingSlots, // Dynamic limit based on remaining slots
    });

    if (!result.canceled && result.assets?.length > 0) {
      await uploadPhotos(result.assets);
    }
  };

  // Upload photos
  const uploadPhotos = async (assets) => {
    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let successful = 0;
    let failed = 0;
    let limitReached = false;

    try {
      for (let i = 0; i < assets.length; i++) {
        try {
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

          const { error: insertError } = await supabase.from('profile_photos').insert({
            profile_id: profileId,
            photo_url: url,
            storage_path: storagePath,
            display_order: photos.length + i,
          });

          if (insertError) {
            // Check if limit reached
            if (insertError.message.includes('GALLERY_LIMIT_REACHED')) {
              limitReached = true;
              break; // Stop uploading more
            }
            throw insertError;
          }

          successful++;
        } catch (error) {
          console.error(`Upload error for photo ${i}:`, error);
          failed++;

          if (error.message.includes('GALLERY_LIMIT_REACHED')) {
            limitReached = true;
            break;
          }
        }
      }

      await loadPhotos();

      // Invalidate QR logo cache (fire-and-forget)
      if (profileHid) {
        clearLogoCache(profileHid).catch(console.warn);
      }

      // Show appropriate feedback
      if (limitReached) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'تم الوصول للحد الأقصى',
          successful > 0
            ? `تم رفع ${formatCount(successful)} ${successful === 1 ? 'صورة' : 'صور'} فقط. الحد الأقصى هو ${formatCount(6)} صور.`
            : `لا يمكن إضافة المزيد. الحد الأقصى هو ${formatCount(6)} صور.`
        );
      } else if (failed > 0 && successful > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'رفع جزئي',
          `تم رفع ${formatCount(successful)} من ${formatCount(assets.length)} صور بنجاح.`
        );
      } else if (failed > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('خطأ', 'فشل رفع الصور. يرجى المحاولة مرة أخرى.');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (error.message.includes('GALLERY_LIMIT_REACHED')) {
        Alert.alert('تم الوصول للحد الأقصى', `الحد الأقصى هو ${formatCount(6)} صور للمعرض.`);
        await loadPhotos(); // Refresh to show current state
      } else if (error.message.includes('permission')) {
        Alert.alert('خطأ', 'ليس لديك صلاحية لتعديل هذا الملف الشخصي');
      } else {
        Alert.alert('خطأ', 'فشل رفع الصور');
      }
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

            // Invalidate QR logo cache (fire-and-forget)
            if (profileHid) {
              clearLogoCache(profileHid).catch(console.warn);
            }

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
      // Disabled state when at limit
      if (isAtLimit) {
        return (
          <TouchableOpacity
            key="add-photo-disabled"
            style={[styles.addTile, styles.disabledTile]}
            onPress={() => {
              Alert.alert(
                'تم الوصول للحد الأقصى',
                'لقد أضفت الحد الأقصى من الصور (' + formatCount(6) + ' صور).\n\nيمكنك حذف صورة حالية لإضافة صورة جديدة.',
                [{ text: 'حسناً', style: 'default' }]
              );
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="الحد الأقصى من الصور"
          >
            <View style={styles.addIconContainer}>
              <Ionicons name="images-outline" size={22} color={palette.gray} />
            </View>
            <Text style={styles.disabledText}>
              الحد الأقصى ({formatCount(6)} صور)
            </Text>
            <Text style={styles.disabledHint}>احذف صورة لإضافة أخرى</Text>
          </TouchableOpacity>
        );
      }

      // Active state
      return (
        <TouchableOpacity
          key="add-photo"
          style={styles.addTile}
          onPress={handleSelectPhotos}
          activeOpacity={0.85}
          disabled={uploading || !isOnline}
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
              <Text style={styles.addHint}>
                {isOnline
                  ? `يمكنك إضافة ${formatCount(remainingSlots)} ${remainingSlots === 1 ? 'صورة' : 'صور'}`
                  : 'غير متصل بالإنترنت'
                }
              </Text>
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
    // ✅ Using expo-image directly (not RobustImage wrapper)
    // ✅ Galeria.Image detects the direct Image component
    // ✅ No overlay wrappers that would block Galeria tap detection
    return (
      <View style={styles.photoTile} key={item.id}>
        <Galeria.Image index={index}>
          <Image
            source={{ uri: item.photo_url }}
            style={styles.photoImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={180}
          />
        </Galeria.Image>
      </View>
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
        <SimpleGrid
          itemDimension={140}
          maxItemsPerRow={2}
          data={[{ id: 'add-tile', isAddTile: true }]}
          spacing={GAP}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      </View>
    ) : null;
  }

  // Edit mode with SimpleGrid
  if (isEditMode) {
    const editData = [...photos, { id: 'add-tile', isAddTile: true }];
    const columns = photoCount <= 4 ? 2 : 3;
    const baseItemDimension = columns === 3 ? 100 : 140;

    // Counter color based on photo count
    const counterColor = isAtLimit
      ? palette.crimson // Red at 6/6
      : displayCount >= 5
        ? palette.ochre // Orange at 5/6
        : palette.text; // Normal

    return (
      <View style={styles.galleryContainer}>
        {/* Photo counter */}
        {photoCount > 0 && (
          <View style={styles.counterContainer}>
            <Text style={[styles.counterText, { color: counterColor }]}>
              {formatCount(displayCount)}/{formatCount(MAX_GALLERY_PHOTOS)}
            </Text>
          </View>
        )}
        <SimpleGrid
          itemDimension={baseItemDimension}
          maxItemsPerRow={columns}
          data={editData}
          spacing={GAP}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
        />
      </View>
    );
  }

  // View mode with Galeria integration
  const columns = photoCount <= 4 ? 2 : 3;

  // Use baseline sizing (small enough to fit N+ items)
  // SimpleGrid auto-expands items to fill width with exactly N columns
  // This accounts for all parent padding (ProfileViewer paddingHorizontal: 16)
  const baseItemDimension = columns === 3 ? 100 : 140;

  return (
    <View style={styles.galleryContainer}>
      <Galeria urls={galleryUrls}>
        <SimpleGrid
          itemDimension={baseItemDimension}
          maxItemsPerRow={columns}
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
    borderRadius: BORDER_RADIUS,
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
    borderRadius: BORDER_RADIUS,
  },
  addSkeleton: {
    width: '100%',
    height: '100%',
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  photoSkeleton: {
    borderRadius: BORDER_RADIUS,
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
  counterContainer: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  counterText: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
  disabledTile: {
    backgroundColor: palette.beige,
    borderColor: palette.gray,
    opacity: 0.6,
  },
  disabledText: {
    fontSize: 15,
    color: palette.gray,
    fontWeight: '600',
    marginTop: 8,
  },
  disabledHint: {
    fontSize: 13,
    color: palette.gray,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PhotoGallerySimple;
