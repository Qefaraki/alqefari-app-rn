import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
  Text,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import CardSurface from '../../ios/CardSurface';
import { LinearGradient } from 'expo-linear-gradient';

const PLACEHOLDER_IMAGE = 'https://iamalqefari.com/wp-content/uploads/2023/08/img_2216.jpg?w=1024';
const DEBOUNCE_DELAY = 800;

const PhotoEditor = ({ value, onChange, currentPhotoUrl, personName = 'الشخص' }) => {
  const [localUrl, setLocalUrl] = useState(value || '');
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(value || currentPhotoUrl || PLACEHOLDER_IMAGE);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const imageOpacity = useRef(new Animated.Value(1)).current;
  const debounceTimer = useRef(null);

  // Validate URL format
  const isValidUrl = (url) => {
    if (!url) return true; // Empty is valid (will clear photo)
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Handle URL changes with debounce
  const handleUrlChange = (text) => {
    setLocalUrl(text);
    
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Don't validate while typing
    if (text && !isValidUrl(text)) {
      setImageError(true);
      return;
    }

    setImageError(false);

    // Debounce the preview update
    debounceTimer.current = setTimeout(() => {
      if (text && isValidUrl(text)) {
        setIsLoading(true);
        setPreviewUrl(text);
      } else if (!text) {
        setPreviewUrl(currentPhotoUrl || PLACEHOLDER_IMAGE);
        onChange(''); // Clear the photo URL
      }
    }, DEBOUNCE_DELAY);
  };

  // Handle image load success
  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
    onChange(localUrl);
    
    // Fade in animation
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Handle image load error
  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
    setPreviewUrl(currentPhotoUrl || PLACEHOLDER_IMAGE);
    
    Animated.timing(imageOpacity, {
      toValue: 0.5,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Scale animation
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      damping: 15,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
  };

  // Handle blur
  const handleBlur = () => {
    setIsFocused(false);
    
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
  };

  // Handle paste
  const handlePaste = useCallback(async () => {
    try {
      // React Native doesn't have direct clipboard access like web
      // This would need expo-clipboard or similar
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Paste error:', error);
    }
  }, []);

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
          onPress: () => {
            setLocalUrl('');
            setPreviewUrl(currentPhotoUrl || PLACEHOLDER_IMAGE);
            onChange('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const borderColor = !isFocused 
    ? 'rgba(209, 213, 219, 0.3)' 
    : imageError 
      ? '#EF4444' 
      : '#059669';

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      {/* Photo Preview */}
      <View style={styles.photoSection}>
        <CardSurface style={styles.photoCard}>
          <Animated.View style={[styles.imageContainer, { opacity: imageOpacity }]}>
            <Image
              source={{ uri: previewUrl }}
              style={styles.profileImage}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#059669" />
              </View>
            )}
            {imageError && (
              <View style={styles.errorOverlay}>
                <Ionicons name="image-outline" size={40} color="#9CA3AF" />
                <Text style={styles.errorText}>صورة غير صالحة</Text>
              </View>
            )}
          </Animated.View>
          
          {/* Remove button */}
          {localUrl && (
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
      </View>

      {/* URL Input */}
      <View style={styles.inputSection}>
        <Text style={styles.label}>رابط الصورة</Text>
        <View style={[styles.inputContainer, { borderColor }]}>
          <TextInput
            style={styles.input}
            value={localUrl}
            onChangeText={handleUrlChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="https://example.com/photo.jpg"
            placeholderTextColor="#9CA3AF"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            textAlign="left"
            returnKeyType="done"
          />
          {localUrl.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => handleUrlChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
        {imageError && localUrl && (
          <Text style={styles.errorMessage}>
            الرجاء إدخال رابط صحيح يبدأ بـ https:// أو http://
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
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
    backgroundColor: '#F3F4F6',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(249, 250, 251, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
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
  inputSection: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'System',
  },
  clearButton: {
    marginLeft: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#EF4444',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'System',
    textAlign: 'right',
    marginTop: 4,
  },
});

export default PhotoEditor;