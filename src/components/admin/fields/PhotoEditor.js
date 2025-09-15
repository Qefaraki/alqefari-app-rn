import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
  Text,
  Alert,
  Platform,
  ActionSheetIOS,
} from "react-native";
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
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(
    value || currentPhotoUrl || null,
  );

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["إلغاء", "التقاط صورة", "اختيار من المعرض"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          }
        },
      );
    } else {
      // Android
      Alert.alert(
        "اختر مصدر الصورة",
        "",
        [
          { text: "إلغاء", style: "cancel" },
          { text: "التقاط صورة", onPress: takePhoto },
          { text: "اختيار من المعرض", onPress: pickImage },
        ],
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

  return (
    <View style={styles.container}>
      {/* Photo Preview */}
      <TouchableOpacity
        onPress={showPhotoPicker}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading}
        activeOpacity={0.8}
        style={styles.photoSection}
      >
        <Animated.View
          style={[styles.photoCard, { transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.imageContainer}>
            {previewUrl ? (
              <Image
                source={{ uri: previewUrl }}
                style={styles.profileImage}
                resizeMode="cover"
              />
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
  photoSection: {
    width: "100%",
    height: 280,
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
});

export default PhotoEditor;
