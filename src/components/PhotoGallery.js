import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import storageService from "../services/storage";
import { useAdminMode } from "../contexts/AdminModeContext";

const { width: screenWidth } = Dimensions.get("window");
const PHOTO_SIZE = (screenWidth - 48) / 3; // 3 photos per row with spacing

const PhotoGallery = ({
  profileId,
  profileName,
  isEditMode = false,
  onPrimaryPhotoChange,
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { isAdminMode } = useAdminMode();

  // Load photos from database
  const loadPhotos = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_profile_photos", {
        p_profile_id: profileId,
      });

      if (error) {
        console.error("Error loading photos:", error);
        // If function doesn't exist, just use empty array
        setPhotos([]);
      } else {
        setPhotos(data || []);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (profileId) {
      loadPhotos();
    }
  }, [profileId, loadPhotos]);

  // Handle photo selection
  const handleSelectPhoto = async () => {
    if (!isAdminMode || !isEditMode) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول للصور لإضافة صورة جديدة");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  // Upload photo to storage and save to database
  const uploadPhoto = async (uri) => {
    try {
      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Upload to Supabase storage
      const { url, error: uploadError } =
        await storageService.uploadProfilePhoto(uri, profileId);

      if (uploadError) {
        throw uploadError;
      }

      // Add to database using RPC
      const isPrimary = photos.length === 0; // First photo is primary
      const { data, error } = await supabase.rpc("admin_add_profile_photo", {
        p_profile_id: profileId,
        p_photo_url: url,
        p_storage_path: `${profileId}/${Date.now()}.jpg`,
        p_caption: null,
        p_is_primary: isPrimary,
      });

      if (error) {
        // If RPC doesn't exist, fall back to direct insert
        const { error: insertError } = await supabase
          .from("profile_photos")
          .insert({
            profile_id: profileId,
            photo_url: url,
            storage_path: `${profileId}/${Date.now()}.jpg`,
            is_primary: isPrimary,
            display_order: photos.length,
          });

        if (insertError) throw insertError;
      }

      // If this is the primary photo, update the main profile
      if (isPrimary && onPrimaryPhotoChange) {
        onPrimaryPhotoChange(url);
      }

      // Reload photos
      await loadPhotos();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("نجح", "تم إضافة الصورة بنجاح");
    } catch (error) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  // Set photo as primary
  const handleSetPrimary = async (photoId, photoUrl) => {
    try {
      // Update all photos to not primary
      await supabase
        .from("profile_photos")
        .update({ is_primary: false })
        .eq("profile_id", profileId);

      // Set this photo as primary
      await supabase
        .from("profile_photos")
        .update({ is_primary: true })
        .eq("id", photoId);

      // Update main profile photo
      await supabase
        .from("profiles")
        .update({ photo_url: photoUrl })
        .eq("id", profileId);

      if (onPrimaryPhotoChange) {
        onPrimaryPhotoChange(photoUrl);
      }

      await loadPhotos();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error setting primary photo:", error);
      Alert.alert("خطأ", "فشل تعيين الصورة الرئيسية");
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId, isPrimary) => {
    Alert.alert("حذف الصورة", "هل أنت متأكد من حذف هذه الصورة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            // Try using RPC first
            const { error: rpcError } = await supabase.rpc(
              "admin_delete_profile_photo",
              {
                p_photo_id: photoId,
              },
            );

            if (rpcError) {
              // Fall back to direct delete
              await supabase.from("profile_photos").delete().eq("id", photoId);
            }

            // If it was primary, update profile
            if (isPrimary) {
              const remainingPhotos = photos.filter((p) => p.id !== photoId);
              const newPrimary = remainingPhotos[0];

              if (newPrimary) {
                await handleSetPrimary(newPrimary.id, newPrimary.photo_url);
              } else {
                // No photos left, clear profile photo
                await supabase
                  .from("profiles")
                  .update({ photo_url: null })
                  .eq("id", profileId);

                if (onPrimaryPhotoChange) {
                  onPrimaryPhotoChange(null);
                }
              }
            }

            await loadPhotos();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error("Error deleting photo:", error);
            Alert.alert("خطأ", "فشل حذف الصورة");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>معرض الصور</Text>
        {photos.length > 0 && (
          <Text style={styles.count}>{photos.length} صور</Text>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add photo button - only in edit mode */}
        {isEditMode && isAdminMode && (
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={handleSelectPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={32} color="#6366f1" />
                <Text style={styles.addPhotoText}>إضافة صورة</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Photo grid */}
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoContainer}>
            <TouchableOpacity
              onPress={() => {
                if (isEditMode && !photo.is_primary) {
                  Alert.alert(
                    "خيارات الصورة",
                    "ماذا تريد أن تفعل بهذه الصورة؟",
                    [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "تعيين كرئيسية",
                        onPress: () =>
                          handleSetPrimary(photo.id, photo.photo_url),
                      },
                      {
                        text: "حذف",
                        style: "destructive",
                        onPress: () =>
                          handleDeletePhoto(photo.id, photo.is_primary),
                      },
                    ],
                  );
                }
              }}
              activeOpacity={isEditMode ? 0.7 : 1}
            >
              <Image source={{ uri: photo.photo_url }} style={styles.photo} />

              {/* Primary badge */}
              {photo.is_primary && (
                <View style={styles.primaryBadge}>
                  <Ionicons name="star" size={12} color="#fff" />
                  <Text style={styles.primaryText}>رئيسية</Text>
                </View>
              )}

              {/* Delete button in edit mode */}
              {isEditMode && isAdminMode && !photo.is_primary && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePhoto(photo.id, photo.is_primary)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Caption if exists */}
            {photo.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {photo.caption}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Empty state */}
      {photos.length === 0 && !isEditMode && (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>لا توجد صور</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    fontFamily: "SF Arabic",
  },
  count: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SF Arabic",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addPhotoText: {
    fontSize: 12,
    color: "#6366f1",
    marginTop: 4,
    fontFamily: "SF Arabic",
  },
  photoContainer: {
    marginRight: 12,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  primaryBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10b981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  primaryText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  deleteButton: {
    position: "absolute",
    top: -8,
    left: -8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  caption: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    width: PHOTO_SIZE,
    fontFamily: "SF Arabic",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 8,
    fontFamily: "SF Arabic",
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
  },
});

export default PhotoGallery;
