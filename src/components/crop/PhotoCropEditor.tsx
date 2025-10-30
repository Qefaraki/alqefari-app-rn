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
import { downloadImageForCrop } from '../../utils/imageCacheUtil';
import storageService from '../../services/storage';
import { supabase } from '../../services/supabase';

interface PhotoCropEditorProps {
  visible: boolean;
  profileId: string; // Profile UUID for storage path and DB update
  photoUrl: string;
  cachedPhotoPath?: string | null; // Pre-downloaded local file:// path for instant opening
  onSave: () => void; // Called after successful upload and DB update
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
  profileId,
  photoUrl,
  cachedPhotoPath,
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
          path: result.path,
        });

        // Validate user has permission to edit this profile
        console.log('[PhotoCrop] Validating permissions...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
          onCancel();
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !userProfile) {
          console.error('[PhotoCrop] User profile not found:', profileError);
          Alert.alert('خطأ', 'لم يتم العثور على ملفك الشخصي');
          onCancel();
          return;
        }

        const { data: permission, error: permError } = await supabase.rpc(
          'check_family_permission_v4',
          {
            p_user_id: userProfile.id,
            p_target_id: profileId
          }
        );

        if (permError || !['admin', 'moderator', 'inner'].includes(permission)) {
          console.error('[PhotoCrop] Permission denied:', { permission, permError });
          Alert.alert(
            'خطأ',
            'ليس لديك صلاحية لتحرير هذه الصورة. يمكنك فقط تحرير صورك الخاصة أو صور أفراد عائلتك المباشرين.'
          );
          onCancel();
          return;
        }

        console.log('[PhotoCrop] Permission validated:', permission);

        // Upload cropped image file to Supabase Storage
        const croppedFileName = `${profileId}_cropped_${Date.now()}.jpg`;
        console.log('[PhotoCrop] Uploading cropped file:', croppedFileName);

        const { url, error: uploadError } = await storageService.uploadProfilePhoto(
          result.path,  // Cropped image file path (uri)
          profileId,    // Profile ID
          `profiles/${profileId}/${croppedFileName}`,  // Custom storage path
          null,         // No progress callback
          'image/jpeg', // Force JPEG content type (fixes MIME detection for local files)
          true          // isCropUpload: Preserve original photo_url (crop variant upload)
        );

        if (uploadError) {
          console.error('[PhotoCrop] Upload error:', uploadError);
          Alert.alert('خطأ', 'فشل رفع الصورة المقصوصة. يرجى المحاولة مرة أخرى.');
          onCancel();
          return;
        }

        const croppedPhotoUrl = url;
        console.log('[PhotoCrop] Upload successful:', croppedPhotoUrl);

        // Update profile with cropped photo URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            photo_url_cropped: croppedPhotoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', profileId);

        if (updateError) {
          console.error('[PhotoCrop] DB update error:', updateError);

          // CRITICAL FIX: Rollback storage upload to prevent orphaned files
          // Issue: Upload succeeded but DB update failed → file stuck in storage
          // Solution: Delete uploaded file to maintain transactional consistency
          console.log('[PhotoCrop] Rolling back storage upload...');

          try {
            const { success } = await storageService.deleteProfilePhoto(croppedPhotoUrl);

            if (success) {
              console.log('[PhotoCrop] ✅ Rollback successful - deleted orphaned file');
            } else {
              console.error('[PhotoCrop] ❌ Rollback failed - orphaned file remains:', croppedPhotoUrl);
              // TODO: Add to cleanup queue for manual intervention
              // File path: croppedPhotoUrl
              // Reason: DB update failed, storage deletion failed
            }
          } catch (cleanupError) {
            console.error('[PhotoCrop] ❌ Rollback exception:', cleanupError);
            console.error('[PhotoCrop] Orphaned file requires manual cleanup:', croppedPhotoUrl);
            // TODO: Send to error monitoring service (Sentry, etc.)
          }

          Alert.alert('خطأ', 'فشل حفظ الصورة المقصوصة في قاعدة البيانات.');
          onCancel();
          return;
        }

        console.log('[PhotoCrop] Profile updated successfully');

        // Success - trigger tree reload
        onSave();
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
  }, [visible, profileId, photoUrl, cachedPhotoPath, onSave, onCancel, saving]);

  // No UI - native crop UI handles everything
  return null;
}
