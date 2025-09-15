import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import storageService from "../services/storage";

const { width: screenWidth } = Dimensions.get("window");
const THUMBNAIL_SIZE = 80; // Small square thumbnails
const PREVIEW_HEIGHT = 280; // Fixed height for main preview

const PhotoGalleryMaps = ({
  profileId,
  isEditMode = false,
  forceAdminMode = false,
  onPrimaryPhotoChange,
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const isAdmin = forceAdminMode || isEditMode;

  // Load photos from database
  const loadPhotos = useCallback(async () => {
    try {
      const { data: photosData, error: photosError } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("profile_id", profileId)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true });

      if (!photosError && photosData) {
        setPhotos(photosData);
        // Find primary photo index
        const primaryIndex = photosData.findIndex((p) => p.is_primary);
        setSelectedPhotoIndex(primaryIndex >= 0 ? primaryIndex : 0);
      } else {
        setPhotos([]);
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

  // Handle photo selection - MULTIPLE photos
  const handleSelectPhotos = async () => {
    if (!isAdmin) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول للصور لإضافة صور جديدة");
      return;
    }

    // Allow multiple selection
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10, // Max 10 photos at once
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadMultiplePhotos(result.assets);
    }
  };

  // Upload multiple photos
  const uploadMultiplePhotos = async (assets) => {
    try {
      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const uploadPromises = assets.map(async (asset, index) => {
        const { url, error: uploadError } =
          await storageService.uploadProfilePhoto(asset.uri, profileId);

        if (uploadError) throw uploadError;

        const isPrimary = photos.length === 0 && index === 0; // First photo becomes primary

        // Try RPC first, then direct insert
        const { error } = await supabase.rpc("admin_add_profile_photo", {
          p_profile_id: profileId,
          p_photo_url: url,
          p_storage_path: `${profileId}/${Date.now()}_${index}.jpg`,
          p_is_primary: isPrimary,
        });

        if (error) {
          // Fallback to direct insert
          await supabase.from("profile_photos").insert({
            profile_id: profileId,
            photo_url: url,
            storage_path: `${profileId}/${Date.now()}_${index}.jpg`,
            is_primary: isPrimary,
            display_order: photos.length + index,
          });
        }

        if (isPrimary && onPrimaryPhotoChange) {
          onPrimaryPhotoChange(url);
        }

        return url;
      });

      await Promise.all(uploadPromises);
      await loadPhotos();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("نجح", `تم إضافة ${assets.length} صور بنجاح`);
    } catch (error) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "فشل رفع بعض الصور");
    } finally {
      setUploading(false);
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId, isPrimary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_delete_profile_photo",
        {
          p_photo_id: photoId,
        },
      );

      if (rpcError) {
        await supabase.from("profile_photos").delete().eq("id", photoId);
      }

      // If it was primary, make the next photo primary
      if (isPrimary) {
        const remainingPhotos = photos.filter((p) => p.id !== photoId);
        if (remainingPhotos.length > 0) {
          const newPrimary = remainingPhotos[0];
          await supabase
            .from("profile_photos")
            .update({ is_primary: true })
            .eq("id", newPrimary.id);

          await supabase
            .from("profiles")
            .update({ photo_url: newPrimary.photo_url })
            .eq("id", profileId);

          if (onPrimaryPhotoChange) {
            onPrimaryPhotoChange(newPrimary.photo_url);
          }
        } else {
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
  };

  // Set as primary photo
  const handleSetPrimary = async (photo) => {
    if (!isAdmin || photo.is_primary) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await supabase
        .from("profile_photos")
        .update({ is_primary: false })
        .eq("profile_id", profileId);

      await supabase
        .from("profile_photos")
        .update({ is_primary: true })
        .eq("id", photo.id);

      await supabase
        .from("profiles")
        .update({ photo_url: photo.photo_url })
        .eq("id", profileId);

      if (onPrimaryPhotoChange) {
        onPrimaryPhotoChange(photo.photo_url);
      }

      await loadPhotos();
    } catch (error) {
      console.error("Error setting primary:", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    );
  }

  const currentPhoto = photos[selectedPhotoIndex];

  return (
    <View style={styles.container}>
      {/* Main Preview Photo - Contained within margins */}
      {currentPhoto ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: currentPhoto.photo_url }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        </View>
      ) : (
        isAdmin && (
          <TouchableOpacity
            style={styles.emptyPreview}
            onPress={handleSelectPhotos}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <>
                <Ionicons name="images-outline" size={40} color="#9ca3af" />
                <Text style={styles.emptyText}>إضافة صور</Text>
              </>
            )}
          </TouchableOpacity>
        )
      )}

      {/* Horizontal Thumbnail Strip */}
      {(photos.length > 0 || isAdmin) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailStrip}
          style={styles.thumbnailScroll}
        >
          {photos.map((photo, index) => (
            <TouchableOpacity
              key={photo.id}
              onPress={() => setSelectedPhotoIndex(index)}
              activeOpacity={0.7}
              style={styles.thumbnailWrapper}
            >
              <Image
                source={{ uri: photo.photo_url }}
                style={[
                  styles.thumbnail,
                  selectedPhotoIndex === index && styles.thumbnailSelected,
                ]}
              />

              {/* Primary star badge */}
              {photo.is_primary && (
                <View style={styles.primaryBadge}>
                  <Ionicons name="star" size={10} color="#fff" />
                </View>
              )}

              {/* Delete button - black, top-right */}
              {isAdmin && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePhoto(photo.id, photo.is_primary)}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}

          {/* Add button */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleSelectPhotos}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Ionicons name="add" size={30} color="#6366f1" />
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Actions for selected photo */}
      {isAdmin && currentPhoto && !currentPhoto.is_primary && (
        <TouchableOpacity
          style={styles.setPrimaryButton}
          onPress={() => handleSetPrimary(currentPhoto)}
        >
          <Text style={styles.setPrimaryText}>تعيين كصورة أساسية</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
  },
  previewContainer: {
    marginHorizontal: 16,
    height: PREVIEW_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f3f4f6",
    marginBottom: 12,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  emptyPreview: {
    marginHorizontal: 16,
    height: PREVIEW_HEIGHT,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    marginBottom: 12,
  },
  emptyText: {
    color: "#9ca3af",
    marginTop: 8,
    fontSize: 14,
  },
  thumbnailScroll: {
    marginBottom: 12,
    overflow: "visible", // Allow overflow for delete buttons
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    paddingVertical: 8, // Add vertical padding to prevent cropping
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnailWrapper: {
    position: "relative",
    marginRight: 8,
    marginTop: 6, // Add top margin to prevent delete button from being cropped
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailSelected: {
    borderColor: "#6366f1",
  },
  primaryBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "#10b981",
    borderRadius: 6,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  setPrimaryButton: {
    marginHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#6366f1",
    borderRadius: 8,
    alignItems: "center",
  },
  setPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default PhotoGalleryMaps;
