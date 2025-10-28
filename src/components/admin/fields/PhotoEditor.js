/**
 * PhotoEditor - Profile photo upload and management component
 *
 * BACKWARDS COMPATIBILITY:
 * - Supports both OLD system (profiles.photo_url column) and NEW system (profile_photos table)
 * - Accepts `currentPhotoUrl` prop for existing photos from either system
 * - Uses expo-image for consistent loading/caching across all photo components
 * - Automatically uses storage service retry logic (3 attempts with exponential backoff)
 *
 * EXPO-IMAGE FEATURES:
 * - Automatic memory and disk caching (cachePolicy="memory-disk")
 * - Blurhash placeholder during loading
 * - Smooth 300ms transition when image loads
 * - Error retry with cache-busting
 *
 * DATABASE SCHEMA:
 * - OLD: profiles.photo_url (text, nullable) - 9 profiles currently use this
 * - NEW: profile_photos table (id, profile_id, photo_url, is_primary, display_order) - 7 profiles, 13 photos
 *
 * UPLOAD FLOW:
 * 1. Image picker (camera or library)
 * 2. Image optimization (resize, compress, strip EXIF) - 0-30% progress
 * 3. Storage service upload with retry - 30-100% progress
 * 4. URL verification (ensures image is actually accessible)
 * 5. Old photo cleanup (deletes previous uploads)
 *
 * Updated: January 2025 - Migrated from React Native Image to expo-image
 */

import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Text,
  Alert,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import CardSurface from "../../ios/CardSurface";
import { LinearGradient } from "expo-linear-gradient";
import storageService from "../../../services/storage";
import imageOptimizationService from "../../../services/imageOptimization";

const PhotoEditor = ({
  value,
  onChange,
  currentPhotoUrl,
  personName = "الشخص",
  profileId,
  onCropPress,
  version,
  userId,
  accessMode,
  onPhotoDeleted,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(
    value || currentPhotoUrl || null,
  );
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Image load handlers
  const handleImageLoadStart = () => {
    setImageLoading(true);
    setImageError(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = (error) => {
    console.error("Image load error:", error);
    setImageLoading(false);
    setImageError(true);
  };

  const handleRetryImage = () => {
    setImageError(false);
    setImageLoading(true);
    // Force re-render by adding cache-busting timestamp
    if (previewUrl) {
      const separator = previewUrl.includes('?') ? '&' : '?';
      const urlWithCacheBust = `${previewUrl}${separator}_retry=${Date.now()}`;
      setPreviewUrl(urlWithCacheBust);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Handle long-press for crop
  const handleLongPressCrop = () => {
    // Only allow crop if:
    // 1. Photo exists (previewUrl is not null)
    // 2. Not currently loading
    // 3. onCropPress callback is provided
    if (previewUrl && !isLoading && onCropPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onCropPress();
    }
  };

  // Request permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || libraryStatus !== "granted") {
      Alert.alert(
        "الصلاحيات مطلوبة",
        "نحتاج إلى صلاحية الوصول إلى الكاميرا ومكتبة الصور لتحميل صورة الملف الشخصي.",
        [{ text: "حسناً", style: "default" }],
      );
      return false;
    }
    return true;
  };

  // Show photo picker options
  const showPhotoPicker = () => {
    if (Platform.OS === "ios") {
      // Build options array conditionally
      const options = ["إلغاء", "التقاط صورة", "اختيار من المعرض"];
      if (previewUrl) {
        options.push("حذف الصورة");
      }

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: previewUrl ? 3 : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          } else if (buttonIndex === 3 && previewUrl) {
            handleDeletePhoto();
          }
        },
      );
    } else {
      // Android
      const buttons = [
        { text: "إلغاء", style: "cancel" },
        { text: "التقاط صورة", onPress: takePhoto },
        { text: "اختيار من المعرض", onPress: pickImage },
      ];

      if (previewUrl) {
        buttons.push({
          text: "حذف الصورة",
          style: "destructive",
          onPress: handleDeletePhoto,
        });
      }

      Alert.alert(
        "اختر مصدر الصورة",
        "",
        buttons,
        { cancelable: true },
      );
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    // Check if running on simulator
    if (Platform.OS === 'ios' && !Device.isDevice) {
      Alert.alert(
        "الكاميرا غير متاحة",
        "الكاميرا غير متاحة في المحاكي. يرجى اختيار صورة من المعرض.",
        [{ text: "حسناً", onPress: pickImage }]
      );
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء التقاط الصورة");
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Picker error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء اختيار الصورة");
    }
  };

  // Upload image to Supabase
  const uploadImage = async (asset) => {
    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Validate image
      const validation = imageOptimizationService.validateImage(asset);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.log("Image warnings:", validation.warnings);
      }

      // Animate progress
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: false,
      }).start();

      // Update progress for optimization phase (0-30%)
      setUploadProgress(10);

      // Optimize image (compress, resize, strip EXIF)
      const optimizedImage = await imageOptimizationService.optimizeForUpload(
        asset.uri,
        {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.85,
        },
      );

      setUploadProgress(30);

      // Upload to storage (30-100%)
      const { url, error } = await storageService.uploadProfilePhoto(
        optimizedImage.uri,
        profileId,
        (progress) => {
          // Scale progress from 30-100%
          const scaledProgress = 30 + progress * 0.7;
          setUploadProgress(scaledProgress);
          Animated.timing(progressAnim, {
            toValue: scaledProgress,
            duration: 100,
            useNativeDriver: false,
          }).start();
        },
      );

      if (error) {
        throw error;
      }

      // Update preview and notify parent
      setPreviewUrl(url);
      onChange(url);

      // Store thumbnail for future use
      if (optimizedImage.base64Thumbnail) {
        // We can use this for blur-up effect later
        console.log("Thumbnail generated for progressive loading");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert(
        "خطأ في التحميل",
        error.message || "حدث خطأ أثناء تحميل الصورة",
        [{ text: "حسناً", style: "default" }],
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Handle press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      damping: 15,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
  };

  // Handle remove photo
  const handleRemovePhoto = () => {
    Alert.alert(
      "إزالة الصورة",
      `هل تريد إزالة صورة ${personName}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إزالة",
          style: "destructive",
          onPress: async () => {
            // If it's a Supabase URL, delete from storage
            if (previewUrl && previewUrl.includes("supabase")) {
              await storageService.deleteProfilePhoto(previewUrl);
            }

            setPreviewUrl(null);
            onChange("");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      { cancelable: true },
    );
  };

  // Handle delete photo (checks accessMode for direct vs suggestion)
  const handleDeletePhoto = async () => {
    // Check if required props are available
    if (!profileId || !userId) {
      Alert.alert("خطأ", "معلومات الملف غير مكتملة");
      return;
    }

    // CRITICAL: Validate permission before proceeding
    if (!accessMode || accessMode === 'none' || accessMode === 'blocked' || accessMode === 'readonly') {
      Alert.alert("خطأ", "ليس لديك صلاحية لحذف هذه الصورة");
      return;
    }

    // Determine the message based on accessMode
    const isDirectDelete = accessMode === 'direct';
    const confirmMessage = 'هل أنت متأكد من الحذف؟';

    Alert.alert(
      "حذف الصورة",
      confirmMessage,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: isDirectDelete ? "حذف" : "إرسال اقتراح",
          style: "destructive",
          onPress: () => {
            // Update form state - deletion happens atomically on Save button
            // This ensures transactional integrity (all changes or none)
            if (onPhotoDeleted) {
              onPhotoDeleted(null);  // null = no version change yet
            }

            // Update local preview
            setPreviewUrl(null);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (isDirectDelete) {
              Alert.alert("تم التحديد", "سيتم حذف الصورة عند حفظ التغييرات");
            } else {
              Alert.alert("تم التحديد", "سيتم إرسال اقتراح الحذف عند حفظ التغييرات");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      {/* Photo Preview */}
      <TouchableOpacity
        onPress={showPhotoPicker}
        onLongPress={handleLongPressCrop}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading}
        activeOpacity={0.8}
        delayLongPress={500}
        style={styles.photoSection}
      >
        <Animated.View
          style={[styles.photoCard, { transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.imageContainer}>
            {previewUrl ? (
              <>
                <Image
                  source={{ uri: previewUrl }}
                  style={styles.profileImage}
                  contentFit="cover"
                  transition={300}
                  cachePolicy="memory-disk"
                  placeholder={{ blurhash: 'L6D]_g00~q00~q00~q00M{00~q00' }}
                  placeholderContentFit="cover"
                  onLoadStart={handleImageLoadStart}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />

                {/* Image Error State with Retry */}
                {imageError && !isLoading && (
                  <View style={styles.imageErrorOverlay}>
                    <Ionicons name="image-outline" size={48} color="#D1D5DB" />
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={handleRetryImage}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={16} color="#FFFFFF" />
                      <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
                    </TouchableOpacity>
                    <Text style={styles.errorHint}>فشل تحميل الصورة</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noPhotoContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={120}
                  color="#D1D5DB"
                />
              </View>
            )}

            {/* Loading overlay */}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#059669" />
                {uploadProgress > 0 && (
                  <>
                    <Text style={styles.progressText}>
                      {Math.round(uploadProgress)}%
                    </Text>
                    <Text style={styles.progressLabel}>
                      {uploadProgress < 30
                        ? "تحسين الصورة..."
                        : "رفع الصورة..."}
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Modern change button overlay */}
            {!isLoading && (
              <View style={styles.changeButtonOverlay}>
                <View style={styles.changeButton}>
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                  <Text style={styles.changeButtonText}>تغيير</Text>
                </View>
                {/* Crop hint - only show if photo exists and crop handler provided */}
                {previewUrl && onCropPress && (
                  <Text style={styles.cropHint}>
                    <Ionicons name="crop-outline" size={13} color="rgba(255,255,255,0.9)" />
                    {" "}اضغط مطولاً للقص
                  </Text>
                )}
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 280,
  },
  photoSection: {
    width: "100%",
    height: "100%",
  },
  photoCard: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#EEE",
  },

  imageContainer: {
    width: "100%",
    height: "100%",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  noPhotoContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#059669",
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  changeButtonOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
  },
  changeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    backdropFilter: "blur(10px)",
  },
  changeButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  cropHint: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "500",
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  removeButtonGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  instructions: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  imageErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(209, 187, 163, 0.9)", // Camel Hair Beige with opacity
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#A13333", // Najdi Crimson
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  errorHint: {
    fontSize: 12,
    color: "#736372",
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
});

export default PhotoEditor;
