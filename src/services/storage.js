import { supabase } from './supabase';

class StorageService {
  constructor() {
    this.bucketName = 'profile-photos';
  }

  /**
   * Uploads a profile photo to Supabase storage
   * @param {string} uri - The local URI of the image from ImagePicker
   * @param {string} profileId - The profile ID to associate the photo with
   * @param {function} onProgress - Optional callback for upload progress
   * @returns {Promise<{url: string, error: Error|null}>}
   */
  async uploadProfilePhoto(uri, profileId, onProgress = null) {
    try {
      // Fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate unique filename with timestamp
      const timestamp = new Date().getTime();
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `photo_${timestamp}.${fileExt}`;
      const filePath = `profiles/${profileId}/${fileName}`;

      // Convert blob to array buffer
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, arrayBuffer, {
          contentType: blob.type || 'image/jpeg',
          upsert: false, // Don't overwrite existing files
          onUploadProgress: (progress) => {
            if (onProgress) {
              const percentComplete = (progress.loaded / progress.total) * 100;
              onProgress(percentComplete);
            }
          }
        });

      if (error) {
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return { url: publicUrl, error: null };
    } catch (error) {
      console.error('Upload error:', error);
      return { url: null, error };
    }
  }

  /**
   * Deletes a profile photo from storage
   * @param {string} photoUrl - The full URL of the photo to delete
   * @returns {Promise<{success: boolean, error: Error|null}>}
   */
  async deleteProfilePhoto(photoUrl) {
    try {
      // Extract the file path from the URL
      const urlParts = photoUrl.split(`/${this.bucketName}/`);
      if (urlParts.length !== 2) {
        throw new Error('Invalid photo URL');
      }

      const filePath = urlParts[1];

      // Delete from storage
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        throw error;
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Delete error:', error);
      return { success: false, error };
    }
  }

  /**
   * Validates if a file is an acceptable image
   * @param {object} file - The file object from ImagePicker
   * @returns {boolean}
   */
  validateImage(file) {
    const maxSizeInMB = 5;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    // Check file size
    if (file.fileSize && file.fileSize > maxSizeInBytes) {
      throw new Error(`حجم الصورة يجب أن يكون أقل من ${maxSizeInMB} ميجابايت`);
    }

    // Check file type
    const acceptedTypes = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    const fileExt = file.uri?.split('.').pop()?.toLowerCase();
    
    if (!fileExt || !acceptedTypes.includes(fileExt)) {
      throw new Error('نوع الملف غير مدعوم. الرجاء استخدام JPG أو PNG');
    }

    return true;
  }

  /**
   * Gets the storage path for a profile
   * @param {string} profileId - The profile ID
   * @returns {string}
   */
  getProfilePhotoPath(profileId) {
    return `profiles/${profileId}/`;
  }

  /**
   * Cleans up old photos when uploading a new one
   * @param {string} profileId - The profile ID
   * @param {string} currentPhotoUrl - The current photo URL to preserve
   * @returns {Promise<void>}
   */
  async cleanupOldPhotos(profileId, currentPhotoUrl = null) {
    try {
      const path = this.getProfilePhotoPath(profileId);
      
      // List all files in the profile's directory
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(path);

      if (error) {
        throw error;
      }

      // Delete all photos except the current one
      const filesToDelete = files
        .filter(file => {
          if (!currentPhotoUrl) return true;
          return !currentPhotoUrl.includes(file.name);
        })
        .map(file => `${path}${file.name}`);

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(this.bucketName)
          .remove(filesToDelete);

        if (deleteError) {
          console.error('Cleanup error:', deleteError);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

export default new StorageService();