import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import storageService from '../services/storage';

const { width: screenWidth } = Dimensions.get('window');
const GRID_SIZE = (screenWidth - 48) / 3; // 3 columns with spacing
const MAX_IMAGE_SIZE = 1920;

/**
 * Simplified Photo Gallery - iOS Photos Style
 *
 * Key Simplifications:
 * - No "primary photo" concept (use Hero for profile photo)
 * - Grid layout only (no preview)
 * - Direct manipulation (tap to delete)
 * - Minimal state management
 */
const PhotoGallerySimple = ({
  profileId,
  isEditMode = false,
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
        setPhotos(data);
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
            const remaining = photos.filter(p => p.id !== photoId);
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

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {/* Photos */}
        {photos.map((photo) => (
          <View key={photo.id} style={styles.gridItem}>
            <Image source={{ uri: photo.photo_url }} style={styles.gridImage} />

            {/* Delete button (edit mode only) */}
            {isEditMode && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePhoto(photo.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add button (edit mode only) */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleSelectPhotos}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#A13333" />
            ) : (
              <Ionicons name="add" size={30} color="#A13333" />
            )}
          </TouchableOpacity>
        )}

        {/* Empty state (view mode only) */}
        {!isEditMode && photos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={40} color="#736372" />
            <Text style={styles.emptyText}>لا توجد صور</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#D1BBA320',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#A13333',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    backgroundColor: '#F9F7F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1BBA3',
    borderStyle: 'dashed',
  },
  emptyState: {
    width: '100%',
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#736372',
  },
});

export default PhotoGallerySimple;
