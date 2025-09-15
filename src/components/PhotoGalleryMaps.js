import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import storageService from "../services/storage";

const { width: screenWidth } = Dimensions.get("window");
const GRID_PHOTO_SIZE = (screenWidth - 6) / 3; // 3 photos per row with spacing

const PhotoGalleryMaps = ({
  profileId,
  isEditMode = false,
  forceAdminMode = false,
  onPrimaryPhotoChange,
}) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedForReorder, setSelectedForReorder] = useState(null);
  const isAdmin = forceAdminMode || isEditMode;

  // Load photos from database
  const loadPhotos = useCallback(async () => {
    try {
      // Try to load from profile_photos table directly
      const { data: photosData, error: photosError } = await supabase
        .from("profile_photos")
        .select("*")
        .eq("profile_id", profileId)
        .order("is_primary", { ascending: false })
        .order("display_order", { ascending: true });

      if (!photosError && photosData) {
        setPhotos(photosData);
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

  // Handle photo selection
  const handleSelectPhoto = async () => {
    if (!isAdmin) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول للصور لإضافة صورة جديدة");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  // Upload photo
  const uploadPhoto = async (uri) => {
    try {
      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { url, error: uploadError } =
        await storageService.uploadProfilePhoto(uri, profileId);

      if (uploadError) throw uploadError;

      const isPrimary = photos.length === 0;

      // Try RPC first, then direct insert
      const { error } = await supabase.rpc("admin_add_profile_photo", {
        p_profile_id: profileId,
        p_photo_url: url,
        p_storage_path: `${profileId}/${Date.now()}.jpg`,
        p_is_primary: isPrimary,
      });

      if (error) {
        // Fallback to direct insert
        await supabase.from("profile_photos").insert({
          profile_id: profileId,
          photo_url: url,
          storage_path: `${profileId}/${Date.now()}.jpg`,
          is_primary: isPrimary,
          display_order: photos.length,
        });
      }

      if (isPrimary && onPrimaryPhotoChange) {
        onPrimaryPhotoChange(url);
      }

      await loadPhotos();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId, isPrimary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Try RPC first
      const { error: rpcError } = await supabase.rpc(
        "admin_delete_profile_photo",
        {
          p_photo_id: photoId,
        },
      );

      if (rpcError) {
        // Fallback to direct delete
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
          // No photos left
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

  // Handle photo tap - set as primary
  const handlePhotoTap = async (photo) => {
    if (!isAdmin || photo.is_primary) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Unset all primary
      await supabase
        .from("profile_photos")
        .update({ is_primary: false })
        .eq("profile_id", profileId);

      // Set new primary
      await supabase
        .from("profile_photos")
        .update({ is_primary: true })
        .eq("id", photo.id);

      // Update profile
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

  // Handle long press for reorder
  const handleLongPress = (photo) => {
    if (!isAdmin || photo.is_primary) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (selectedForReorder?.id === photo.id) {
      setSelectedForReorder(null);
    } else if (selectedForReorder) {
      // Swap positions
      swapPhotos(selectedForReorder, photo);
      setSelectedForReorder(null);
    } else {
      setSelectedForReorder(photo);
    }
  };

  // Swap two photos
  const swapPhotos = async (photo1, photo2) => {
    try {
      const order1 = photo1.display_order;
      const order2 = photo2.display_order;

      await supabase
        .from("profile_photos")
        .update({ display_order: order2 })
        .eq("id", photo1.id);

      await supabase
        .from("profile_photos")
        .update({ display_order: order1 })
        .eq("id", photo2.id);

      await loadPhotos();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error swapping photos:", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    );
  }

  const primaryPhoto = photos.find((p) => p.is_primary) || photos[0];
  const otherPhotos = photos.filter((p) => !p.is_primary);

  return (
    <View style={styles.container}>
      {/* Main/Primary Photo - Full width */}
      {primaryPhoto ? (
        <View style={styles.mainPhotoContainer}>
          <Image
            source={{ uri: primaryPhoto.photo_url }}
            style={styles.mainPhoto}
          />
          {isAdmin && (
            <TouchableOpacity
              style={styles.mainDeleteButton}
              onPress={() => handleDeletePhoto(primaryPhoto.id, true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.deleteButtonBg}>
                <Ionicons name="close" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      ) : isAdmin ? (
        // Show add photo placeholder when no main photo in edit mode
        <TouchableOpacity
          style={styles.mainPhotoPlaceholder}
          onPress={handleSelectPhoto}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="large" color="#6366f1" />
          ) : (
            <Ionicons name="camera-outline" size={64} color="#9ca3af" />
          )}
        </TouchableOpacity>
      ) : null}

      {/* Grid of other photos + add button */}
      {(otherPhotos.length > 0 || isAdmin) && (
        <View style={styles.gridContainer}>
          {otherPhotos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => handlePhotoTap(photo)}
              onLongPress={() => handleLongPress(photo)}
              style={[
                styles.gridPhoto,
                selectedForReorder?.id === photo.id && styles.selectedPhoto,
              ]}
            >
              <Image
                source={{ uri: photo.photo_url }}
                style={styles.gridImage}
              />
              {isAdmin && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePhoto(photo.id, false)}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <View style={styles.deleteButtonBg}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </Pressable>
          ))}

          {/* Add button inline with grid */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleSelectPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Ionicons name="add" size={36} color="#9ca3af" />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* If no photos at all, show add button prominently */}
      {photos.length === 0 && isAdmin && (
        <TouchableOpacity
          style={styles.emptyAddButton}
          onPress={handleSelectPhoto}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="large" color="#6366f1" />
          ) : (
            <Ionicons name="camera-outline" size={64} color="#9ca3af" />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
  },
  mainPhotoContainer: {
    width: screenWidth,
    height: screenWidth,
    marginBottom: 2,
    position: "relative",
  },
  mainPhoto: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f3f4f6",
  },
  mainPhotoPlaceholder: {
    width: screenWidth,
    height: screenWidth,
    marginBottom: 2,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  mainDeleteButton: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  deleteButton: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  deleteButtonBg: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 1,
  },
  gridPhoto: {
    width: GRID_PHOTO_SIZE,
    height: GRID_PHOTO_SIZE,
    padding: 1,
    position: "relative",
  },
  selectedPhoto: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f3f4f6",
  },
  addButton: {
    width: GRID_PHOTO_SIZE,
    height: GRID_PHOTO_SIZE,
    padding: 1,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAddButton: {
    width: screenWidth - 32,
    height: 240,
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default PhotoGalleryMaps;
