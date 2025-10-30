/**
 * PhotoCropEditor - Professional crop interface using react-native-image-crop-picker
 *
 * Uses battle-tested native crop UI (10k+ stars, production-grade).
 * Returns normalized crop coordinates (0.0-1.0) for database storage.
 *
 * Architecture:
 * - Coordinate-based (NOT file-based) cropping
 * - Original photo unchanged in storage
 * - Crop applied during rendering (ImageNode.tsx via Skia)
 *
 * Features:
 * - Native iOS/Android crop UI
 * - Square aspect ratio (1:1) for profile photos
 * - Built-in gestures (pinch, pan, rotate)
 * - Returns both cropped image AND crop coordinates
 * - Professional overlay and controls
 *
 * Performance:
 * - Uses cached local file:// URIs for instant loading
 * - No network requests during crop
 * - Native performance (no JS bridge overhead)
 *
 * Library: react-native-image-crop-picker
 * Documentation: https://github.com/ivpusic/react-native-image-crop-picker
 * Integrated: January 2025 (replaces react-native-zoom-toolkit)
 */

import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { isValidCrop, clampCropCoordinates } from '../../utils/cropUtils';
import { downloadImageForCrop } from '../../utils/imageCacheUtil';

interface PhotoCropEditorProps {
  visible: boolean;
  photoUrl: string;
  cachedPhotoPath?: string | null; // Pre-downloaded local file:// path for instant opening
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
  saving?: boolean;
}

/**
 * PhotoCropEditor Component
 *
 * Opens native crop UI using react-native-image-crop-picker.
 * No custom React components needed - library handles everything.
 *
 * Pre-download Strategy:
 * - If cachedPhotoPath is provided (file://), use it for INSTANT opening (zero wait)
 * - Otherwise, download image first, then open crop UI
 */
export function PhotoCropEditor({
  visible,
  photoUrl,
  cachedPhotoPath,
  initialCrop = { crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: 0 },
  onSave,
  onCancel,
  saving = false,
}: PhotoCropEditorProps): null {
  /**
   * Open native crop UI when component becomes visible
   */
  useEffect(() => {
    if (!visible || saving) return;

    const openCropUI = async () => {
      try {
        // Strategy 1: Use pre-downloaded cached path (INSTANT ✅)
        let imagePath = cachedPhotoPath;

        // Strategy 2: Download on-demand if no cache
        if (!imagePath) {
          console.log('[PhotoCrop] No cached image, downloading now:', photoUrl);
          imagePath = await downloadImageForCrop(photoUrl);

          if (!imagePath) {
            Alert.alert(
              'تعذر تحميل الصورة',
              'لم نتمكن من تحميل الصورة للقص. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
              [{ text: 'حسناً', onPress: onCancel }]
            );
            return;
          }
        }

        console.log('[PhotoCrop] Opening native crop UI with image:', imagePath);

        // Open native crop UI
        const result = await ImagePicker.openCropper({
          path: imagePath,
          width: 800, // Output resolution (square)
          height: 800,
          cropping: true,
          cropperCircleOverlay: false, // Square crop overlay
          freeStyleCropEnabled: false, // Force square aspect ratio
          includeExif: true, // Get image dimensions
          mediaType: 'photo',

          // Crop area calculation (if we want to apply initialCrop as starting point)
          // Note: react-native-image-crop-picker doesn't support initial crop rect
          // Users will always start with full image visible
        });

        console.log('[PhotoCrop] Crop result:', {
          width: result.width,
          height: result.height,
          cropRect: result.cropRect,
        });

        // Extract crop coordinates from result
        if (!result.cropRect) {
          console.warn('[PhotoCrop] No cropRect in result, using full image');
          onSave({ crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: 0 });
          return;
        }

        const { x, y, width, height } = result.cropRect;
        const imageWidth = result.sourceWidth || result.width;
        const imageHeight = result.sourceHeight || result.height;

        console.log('[PhotoCrop] Source dimensions:', { imageWidth, imageHeight });
        console.log('[PhotoCrop] Crop rect:', { x, y, width, height });

        // Convert pixel coordinates to normalized 0.0-1.0 coordinates
        const crop = {
          crop_left: x / imageWidth,
          crop_top: y / imageHeight,
          crop_right: 1 - ((x + width) / imageWidth),
          crop_bottom: 1 - ((y + height) / imageHeight),
        };

        console.log('[PhotoCrop] Normalized crop coordinates:', crop);

        // Clamp coordinates to prevent floating-point edge cases
        const clampedCrop = clampCropCoordinates(crop);

        // Validate crop
        if (!isValidCrop(clampedCrop)) {
          Alert.alert(
            'خطأ',
            'حجم المنطقة المحصورة صغير جداً. يجب أن تكون المنطقة المرئية على الأقل 10% من الصورة.'
          );
          return;
        }

        console.log('[PhotoCrop] Final clamped crop:', clampedCrop);

        // Save crop coordinates
        onSave(clampedCrop);
      } catch (error: any) {
        console.error('[PhotoCrop] Crop error:', error);

        // User cancelled crop
        if (error.message === 'User cancelled image selection') {
          console.log('[PhotoCrop] User cancelled crop');
          onCancel();
          return;
        }

        // Other errors
        Alert.alert('خطأ', 'حدث خطأ أثناء قص الصورة. يرجى المحاولة مرة أخرى.');
        onCancel();
      }
    };

    openCropUI();
  }, [visible, photoUrl, cachedPhotoPath, onSave, onCancel, saving, initialCrop]);

  // No UI - native crop UI handles everything
  return null;
}
