import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import CardSurface from '../../ios/CardSurface';
import { LinearGradient } from 'expo-linear-gradient';
import storageService from '../../../services/storage';

const PhotoEditor = ({ value, onChange, currentPhotoUrl, personName = 'الشخص', profileId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(value || currentPhotoUrl || null);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Request permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'الصلاحيات مطلوبة',
        'نحتاج إلى صلاحية الوصول إلى الكاميرا ومكتبة الصور لتحميل صورة الملف الشخصي.',
        [{ text: 'حسناً', style: 'default' }]
      );
      return false;
    }
    return true;
  };

  // Show photo picker options
  const showPhotoPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['إلغاء', 'التقاط صورة', 'اختيار من المعرض'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            takePhoto();
          } else if (buttonIndex === 2) {
            pickImage();
          }
        }
      );
    } else {
      // Android
      Alert.alert(
        'اختر مصدر الصورة',
        '',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'التقاط صورة', onPress: takePhoto },
          { text: 'اختيار من المعرض', onPress: pickImage },
        ],
        { cancelable: true }
      );
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء التقاط الصورة');
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Picker error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الصورة');
    }
  };

  // Upload image to Supabase
  const uploadImage = async (asset) => {
    try {
      setIsLoading(true);
      setUploadProgress(0);
      
      // Validate image
      storageService.validateImage({ 
        uri: asset.uri, 
        fileSize: asset.fileSize 
      });

      // Animate progress
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: false,
      }).start();

      // Upload to storage
      const { url, error } = await storageService.uploadProfilePhoto(
        asset.uri,
        profileId,
        (progress) => {
          setUploadProgress(progress);
          Animated.timing(progressAnim, {
            toValue: progress,
            duration: 100,
            useNativeDriver: false,
          }).start();
        }
      );

      if (error) {
        throw error;
      }

      // Update preview and notify parent
      setPreviewUrl(url);
      onChange(url);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'خطأ في التحميل',
        error.message || 'حدث خطأ أثناء تحميل الصورة',
        [{ text: 'حسناً', style: 'default' }]
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
      'إزالة الصورة',
      `هل تريد إزالة صورة ${personName}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إزالة',
          style: 'destructive',
          onPress: async () => {
            // If it's a Supabase URL, delete from storage
            if (previewUrl && previewUrl.includes('supabase')) {
              await storageService.deleteProfilePhoto(previewUrl);
            }
            
            setPreviewUrl(null);
            onChange('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      {/* Photo Preview */}
      <View style={styles.photoSection}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            onPress={showPhotoPicker}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <CardSurface style={styles.photoCard}>
              <View style={styles.imageContainer}>
                {previewUrl ? (
                  <Image
                    source={{ uri: previewUrl }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.noPhotoContainer}>
                    <Ionicons 
                      name="person-circle-outline" 
                      size={80} 
                      color="#D1D5DB" 
                    />
                  </View>
                )}
                
                {/* Loading overlay */}
                {isLoading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#059669" />
                    {uploadProgress > 0 && (
                      <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
                    )}
                  </View>
                )}
                
                {/* Camera icon overlay */}
                {!isLoading && (
                  <View style={styles.cameraOverlay}>
                    <LinearGradient
                      colors={['rgba(5, 150, 105, 0.9)', 'rgba(16, 185, 129, 0.9)']}
                      style={styles.cameraButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="camera" size={24} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                )}
              </View>
              
              {/* Remove button */}
              {previewUrl && !isLoading && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={handleRemovePhoto}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.removeButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </CardSurface>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>
        اضغط على الصورة لتغييرها
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
  },
  photoSection: {
    alignItems: 'center',
  },
  photoCard: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  noPhotoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  removeButtonGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  instructions: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    textAlign: 'center',
  },
});

export default PhotoEditor;