import React, { useState, useEffect, useCallback, useRef } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import storageService from "../services/storage";

const { width: screenWidth } = Dimensions.get("window");
const THUMBNAIL_SIZE = 80; // Small square thumbnails
const PREVIEW_HEIGHT = 280; // Fixed height for main preview
const MAX_IMAGE_SIZE = 1920; // Max dimension for compressed images

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
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const uploadCancelledRef = useRef(false);
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
        console.log("Loaded photos:", photosData);
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

  // Compress image before upload
  const compressImage = async (uri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_IMAGE_SIZE } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      return result.uri;
    } catch (error) {
      console.error("Error compressing image:", error);
      return uri; // Return original if compression fails
    }
  };

  // Generate unique filename
  const generateUniqueFilename = (profileId, index) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${profileId}/${timestamp}_${random}_${index}.jpg`;
  };

  // Handle photo selection - MULTIPLE photos
  const handleSelectPhotos = async () => {
    if (!isAdmin) return;

    uploadCancelledRef.current = false; // Reset cancel flag

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

  // Upload multiple photos with progress
  const uploadMultiplePhotos = async (assets) => {
    try {
      setUploading(true);
      setUploadProgress({ current: 0, total: assets.length });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Temporary photos to show immediately
      const tempPhotos = assets.map((asset, index) => ({
        id: `temp-${Date.now()}-${index}`,
        photo_url: asset.uri,
        is_primary: photos.length === 0 && index === 0,
        display_order: photos.length + index,
        isTemporary: true,
      }));

      // Show photos immediately for better UX
      setPhotos((prev) => [...prev, ...tempPhotos]);

      const uploadedPhotos = [];

      for (let i = 0; i < assets.length; i++) {
        // Check if cancelled
        if (uploadCancelledRef.current) {
          // Remove temporary photos silently
          setPhotos((prev) => prev.filter((p) => !p.isTemporary));
          return;
        }

        const asset = assets[i];
        setUploadProgress({ current: i + 1, total: assets.length });

        try {
          // Compress image
          const compressedUri = await compressImage(asset.uri);

          // Generate unique filename
          const storagePath = generateUniqueFilename(profileId, i);

          // Upload with unique path
          const { url, error: uploadError } =
            await storageService.uploadProfilePhoto(
              compressedUri,
              profileId,
              storagePath,
            );

          console.log(`Photo ${i + 1} uploaded to: ${url}`);
          if (uploadError) throw uploadError;

          const isPrimary = photos.length === 0 && i === 0;

          // Check if RPC exists, otherwise use direct insert
          const { data: funcData } = await supabase
            .rpc("admin_add_profile_photo", {
              p_profile_id: profileId,
              p_photo_url: url,
              p_storage_path: storagePath,
              p_is_primary: isPrimary,
            })
            .maybeSingle();

          if (!funcData) {
            // Direct insert if RPC doesn't exist or failed
            const { data: insertData } = await supabase
              .from("profile_photos")
              .insert({
                profile_id: profileId,
                photo_url: url,
                storage_path: storagePath,
                is_primary: isPrimary,
                display_order: photos.length + i,
              })
              .select()
              .single();

            uploadedPhotos.push(insertData || { photo_url: url });
            console.log("Inserted photo:", insertData);
          } else {
            uploadedPhotos.push(funcData);
            console.log("RPC photo:", funcData);
          }

          if (isPrimary && onPrimaryPhotoChange) {
            onPrimaryPhotoChange(url);
          }

          // Replace temporary photo with real one
          setPhotos((prev) => {
            const filtered = prev.filter(
              (p) => p.id !== `temp-${Date.now()}-${i}`,
            );
            return filtered;
          });
        } catch (error) {
          console.error(`Error uploading photo ${i + 1}:`, error);
        }
      }

      // Reload to get proper data
      await loadPhotos();

      // Just haptic feedback, no alert - modern UX
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Upload error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Remove temporary photos on error silently
      setPhotos((prev) => prev.filter((p) => !p.isTemporary));
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      uploadCancelledRef.current = false;
    }
  };

  // Cancel upload
  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
  };

  // Delete photo
  const handleDeletePhoto = async (photoId, isPrimary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert("تأكيد الحذف", "هل تريد حذف هذه الصورة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            const { error: rpcError } = await supabase.rpc(
              "admin_delete_profile_photo",
              { p_photo_id: photoId },
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
        },
      },
    ]);
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
            style={[
              styles.previewImage,
              currentPhoto.isTemporary && styles.previewImageLoading,
            ]}
            resizeMode="cover"
          />
          {currentPhoto.isTemporary && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}

          {/* Upload Progress - Subtle inline indicator */}
          {uploading && uploadProgress.total > 0 && (
            <View style={styles.uploadIndicator}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.uploadText}>
                {uploadProgress.current}/{uploadProgress.total}
              </Text>
              <TouchableOpacity onPress={handleCancelUpload}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
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
        <View style={styles.thumbnailContainer}>
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
                    photo.isTemporary && styles.thumbnailLoading,
                  ]}
                />

                {/* Primary star badge */}
                {photo.is_primary && (
                  <View style={styles.primaryBadge}>
                    <Ionicons name="star" size={10} color="#fff" />
                  </View>
                )}

                {/* Delete button - black, top-right */}
                {isAdmin && !photo.isTemporary && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() =>
                      handleDeletePhoto(photo.id, photo.is_primary)
                    }
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                )}

                {/* Loading indicator for temporary photos */}
                {photo.isTemporary && (
                  <View style={styles.thumbnailLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {/* Add button */}
            {isAdmin && !uploading && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleSelectPhotos}
              >
                <Ionicons name="add" size={30} color="#6366f1" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Actions for selected photo */}
      {isAdmin &&
        currentPhoto &&
        !currentPhoto.is_primary &&
        !currentPhoto.isTemporary && (
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
  previewImageLoading: {
    opacity: 0.6,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 8,
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
  uploadIndicator: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  uploadText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  thumbnailContainer: {
    height: THUMBNAIL_SIZE + 20, // Fixed height to prevent overflow
    marginTop: 8,
    marginBottom: 12,
  },
  thumbnailScroll: {
    overflow: "visible", // Allow overflow for delete buttons
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10, // Add vertical padding to prevent cropping
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnailWrapper: {
    position: "relative",
    marginRight: 8,
    marginTop: 6, // Space for delete button
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
  thumbnailLoading: {
    opacity: 0.6,
  },
  thumbnailLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
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
