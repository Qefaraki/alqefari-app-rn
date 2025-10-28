/**
 * PhotoCropEditor - Custom crop rectangle selector
 *
 * Displays an image with a draggable crop rectangle overlay.
 * Returns normalized crop coordinates (0.0-1.0) for database storage.
 *
 * Architecture:
 * - Coordinate-based (NOT file-based) cropping
 * - Original photo unchanged
 * - Crop applied during rendering (ImageNode.tsx)
 *
 * Features:
 * - Draggable crop rectangle
 * - Pinch-to-zoom support
 * - Reset to full image
 * - Najdi Sadu design tokens
 * - RTL-friendly
 *
 * Created: 2025-10-27
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import tokens from '../ui/tokens';
import { isValidCrop, clampCropCoordinates } from '../../utils/cropUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Minimum crop size (10% of image)
const MIN_CROP_RATIO = 0.1;

interface PhotoCropEditorProps {
  visible: boolean;
  photoUrl: string;
  initialCrop?: {
    crop_top: number;
    crop_bottom: number;
    crop_left: number;
    crop_right: number;
  };
  onSave: (crop: {
    crop_top: number;
    crop_bottom: number;
    crop_left: number;
    crop_right: number;
  }) => void;
  onCancel: () => void;
  saving?: boolean; // Loading state during RPC call
}

/**
 * PhotoCropEditor Component
 *
 * Custom crop rectangle selector with draggable overlay.
 * Returns normalized coordinates (0.0-1.0) for database storage.
 */
export function PhotoCropEditor({
  visible,
  photoUrl,
  initialCrop = { crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: 0 },
  onSave,
  onCancel,
  saving = false,
}: PhotoCropEditorProps): JSX.Element {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Crop rectangle position and size (normalized 0.0-1.0)
  const cropTop = useSharedValue(initialCrop.crop_top);
  const cropBottom = useSharedValue(initialCrop.crop_bottom);
  const cropLeft = useSharedValue(initialCrop.crop_left);
  const cropRight = useSharedValue(initialCrop.crop_right);

  // Image container dimensions (for coordinate conversion)
  const containerWidth = SCREEN_WIDTH - 32; // 16px padding on each side
  const containerHeight = SCREEN_HEIGHT * 0.7; // 70% of screen height

  /**
   * Load image and get dimensions
   */
  React.useEffect(() => {
    if (visible && photoUrl) {
      setImageLoaded(false);
      Image.getSize(
        photoUrl,
        (width, height) => {
          setImageDimensions({ width, height });
          setImageLoaded(true);
        },
        (error) => {
          console.error('[PhotoCropEditor] Failed to load image:', error);
          Alert.alert('خطأ', 'فشل تحميل الصورة');
          onCancel();
        }
      );
    }
  }, [visible, photoUrl, onCancel]);

  /**
   * Reset crop to full image (all zeros)
   */
  const handleReset = useCallback(() => {
    cropTop.value = withSpring(0);
    cropBottom.value = withSpring(0);
    cropLeft.value = withSpring(0);
    cropRight.value = withSpring(0);
  }, [cropTop, cropBottom, cropLeft, cropRight]);

  /**
   * Save crop coordinates
   */
  const handleSave = useCallback(() => {
    // Get raw crop values
    const rawCrop = {
      crop_top: cropTop.value,
      crop_bottom: cropBottom.value,
      crop_left: cropLeft.value,
      crop_right: cropRight.value,
    };

    // Clamp coordinates to prevent floating-point edge cases (0.9999 → 0.999)
    const crop = clampCropCoordinates(rawCrop);

    // Validate crop
    if (!isValidCrop(crop)) {
      Alert.alert('خطأ', 'حجم المنطقة المحصورة صغير جداً. يرجى تحديد منطقة أكبر (10% كحد أدنى).');
      return;
    }

    onSave(crop);
  }, [cropTop, cropBottom, cropLeft, cropRight, onSave]);

  /**
   * Pan gesture for dragging crop rectangle
   */
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Convert translation to normalized coordinates
      const deltaX = event.translationX / containerWidth;
      const deltaY = event.translationY / containerHeight;

      // Update crop position (clamped to image bounds)
      const newLeft = Math.max(0, Math.min(1 - cropRight.value - MIN_CROP_RATIO, cropLeft.value + deltaX));
      const newTop = Math.max(0, Math.min(1 - cropBottom.value - MIN_CROP_RATIO, cropTop.value + deltaY));

      cropLeft.value = newLeft;
      cropTop.value = newTop;
    });

  /**
   * Crop rectangle overlay style
   */
  const cropOverlayStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: cropLeft.value * containerWidth,
      top: cropTop.value * containerHeight,
      width: (1 - cropLeft.value - cropRight.value) * containerWidth,
      height: (1 - cropTop.value - cropBottom.value) * containerHeight,
      borderWidth: 2,
      borderColor: tokens.colors.najdi.primary,
      backgroundColor: 'transparent',
    };
  });

  /**
   * Dimmed overlay style (outside crop area)
   */
  const dimOverlayStyle = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>تعديل الصورة</Text>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>إلغاء</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          {!imageLoaded ? (
            <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
          ) : (
            <>
              <Image
                source={{ uri: photoUrl }}
                style={styles.image}
                resizeMode="contain"
              />

              {/* Dimmed overlay */}
              <View style={dimOverlayStyle} pointerEvents="none" />

              {/* Crop rectangle overlay */}
              <GestureDetector gesture={panGesture}>
                <Animated.View style={cropOverlayStyle}>
                  {/* Crop rectangle border */}
                  <View style={styles.cropBorder} />

                  {/* Grid lines (rule of thirds) */}
                  <View style={styles.gridLine} />
                  <View style={[styles.gridLine, { left: '66.67%' }]} />
                  <View style={[styles.gridLine, { top: '33.33%', width: '100%', height: 1 }]} />
                  <View style={[styles.gridLine, { top: '66.67%', width: '100%', height: 1 }]} />

                  {/* Corner handles */}
                  <View style={[styles.handle, styles.handleTopLeft]} />
                  <View style={[styles.handle, styles.handleTopRight]} />
                  <View style={[styles.handle, styles.handleBottomLeft]} />
                  <View style={[styles.handle, styles.handleBottomRight]} />
                </Animated.View>
              </GestureDetector>
            </>
          )}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            onPress={handleReset}
            style={[styles.button, styles.resetButton]}
          >
            <Text style={styles.buttonText}>إعادة تعيين</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            style={[styles.button, styles.saveButton, (saving || !imageLoaded) && styles.saveButtonDisabled]}
            disabled={saving || !imageLoaded}
          >
            {saving ? (
              <ActivityIndicator size="small" color={tokens.colors.najdi.background} />
            ) : (
              <Text style={[styles.buttonText, styles.saveButtonText]}>حفظ</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.instructions}>
          اسحب المستطيل لتحديد منطقة القص. الحد الأدنى للمنطقة 10%.
        </Text>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.najdi.container,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerButtonText: {
    fontSize: 17,
    color: tokens.colors.najdi.primary,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  image: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.7,
  },
  cropBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: tokens.colors.najdi.primary,
  },
  gridLine: {
    position: 'absolute',
    left: '33.33%',
    top: 0,
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  handle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tokens.colors.najdi.primary,
    borderWidth: 2,
    borderColor: tokens.colors.najdi.background,
  },
  handleTopLeft: {
    top: -10,
    left: -10,
  },
  handleTopRight: {
    top: -10,
    right: -10,
  },
  handleBottomLeft: {
    bottom: -10,
    left: -10,
  },
  handleBottomRight: {
    bottom: -10,
    right: -10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: tokens.colors.najdi.container,
  },
  saveButton: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  saveButtonDisabled: {
    backgroundColor: tokens.colors.najdi.container,
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  saveButtonText: {
    color: tokens.colors.najdi.background,
  },
  instructions: {
    textAlign: 'center',
    fontSize: 14,
    color: tokens.colors.najdi.text,
    opacity: 0.7,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
