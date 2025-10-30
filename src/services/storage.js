import { supabase } from "./supabase";
import { useNetworkStore } from "../stores/networkStore";

class StorageService {
  constructor() {
    this.bucketName = "profile-photos";
  }

  /**
   * Uploads a profile photo to Supabase storage with retry logic
   * @param {string} uri - The local URI of the image from ImagePicker
   * @param {string} profileId - The profile ID to associate the photo with
   * @param {string} customPath - Optional custom storage path
   * @param {function} onProgress - Optional callback for upload progress
   * @param {string} forceContentType - Optional content type override (e.g., 'image/jpeg')
   * @param {boolean} isCropUpload - If true, preserves original photo_url (crop variant upload)
   * @returns {Promise<{url: string, error: Error|null}>}
   */
  async uploadProfilePhoto(
    uri,
    profileId,
    customPath = null,
    onProgress = null,
    forceContentType = null,
    isCropUpload = false,
  ) {
    // Pre-flight network check
    const networkState = useNetworkStore.getState();
    if (!networkState.isConnected || networkState.isInternetReachable === false) {
      return {
        url: null,
        error: new Error('لا يوجد اتصال بالإنترنت. تحقق من الاتصال وحاول مرة أخرى.'),
      };
    }

    const maxRetries = 3;
    let lastError = null;
    const startTime = Date.now();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Add exponential backoff for retries
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // OPTIMISTIC LOCKING: Fetch current photo_url to detect concurrent uploads
        const { data: currentProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('photo_url, deleted_at')
          .eq('id', profileId)
          .single();

        if (fetchError) {
          throw new Error(`فشل التحقق من الملف الشخصي: ${fetchError.message}`);
        }

        if (!currentProfile) {
          throw new Error('الملف الشخصي غير موجود');
        }

        if (currentProfile.deleted_at) {
          throw new Error('لا يمكن رفع صورة لملف شخصي محذوف');
        }

        const previousPhotoUrl = currentProfile.photo_url;

        // Fetch the image as a blob
        const response = await fetch(uri);
        const blob = await response.blob();

        // Use custom path if provided, otherwise generate one
        let filePath;
        if (customPath && typeof customPath === "string") {
          // Don't add profiles/ prefix if custom path already has it
          filePath = customPath.startsWith("profiles/")
            ? customPath
            : `profiles/${customPath}`;
        } else {
          // Generate unique filename with timestamp and random string
          const timestamp = new Date().getTime();
          const random = Math.random().toString(36).substring(7);
          const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
          const fileName = `photo_${timestamp}_${random}.${fileExt}`;
          filePath = `profiles/${profileId}/${fileName}`;
        }

        // Convert blob to array buffer
        const arrayBuffer = await new Response(blob).arrayBuffer();

        // LOG: Upload start
        const uploaderAuthId = (await supabase.auth.getUser()).data.user?.id;
        console.log('[STORAGE_UPLOAD_START]', {
          targetProfileId: profileId,
          uploaderAuthId,
          fileSize: blob.size,
          filePath,
          previousPhotoUrl,
          timestamp: new Date().toISOString()
        });

        // Upload to Supabase Storage with timeout (120s)
        // Use upsert: false to detect concurrent uploads (file already exists error)
        const uploadPromise = supabase.storage
          .from(this.bucketName)
          .upload(filePath, arrayBuffer, {
            contentType: forceContentType || blob.type || "image/jpeg",
            upsert: false, // Detect concurrent uploads via "already exists" error
            onUploadProgress: (progress) => {
              if (onProgress) {
                const percentComplete =
                  (progress.loaded / progress.total) * 100;
                onProgress(percentComplete);
              }
            },
          });

        const { data, error } = await Promise.race([
          uploadPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('انتهت مهلة الرفع. تحقق من الاتصال وحاول مرة أخرى.')), 120000)
          )
        ]);

        // Handle "already exists" error (concurrent upload detected)
        if (error && error.message?.includes('already exists')) {
          console.warn('[STORAGE_UPLOAD_CONFLICT]', {
            targetProfileId: profileId,
            filePath,
            message: 'File already exists - checking for concurrent modification'
          });

          // Check if photo_url changed since we started (concurrent admin upload)
          const { data: latestProfile } = await supabase
            .from('profiles')
            .select('photo_url')
            .eq('id', profileId)
            .single();

          if (latestProfile && latestProfile.photo_url !== previousPhotoUrl) {
            throw new Error('تم تحديث الصورة من قبل مستخدم آخر. يرجى تحديث الصفحة وإعادة المحاولة.');
          }

          // Same admin retrying - safe to upsert
          console.log('[STORAGE_UPLOAD_RETRY_UPSERT]', {
            targetProfileId: profileId,
            reason: 'Same user retry detected, using upsert'
          });

          const retryUpload = await supabase.storage
            .from(this.bucketName)
            .upload(filePath, arrayBuffer, {
              contentType: forceContentType || blob.type || "image/jpeg",
              upsert: true, // Now safe to overwrite
              onUploadProgress: (progress) => {
                if (onProgress) {
                  const percentComplete =
                    (progress.loaded / progress.total) * 100;
                  onProgress(percentComplete);
                }
              },
            });

          if (retryUpload.error) {
            throw retryUpload.error;
          }
        } else if (error) {
          throw error;
        }

        // Get the public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(this.bucketName).getPublicUrl(filePath);

        // Verify the URL is actually accessible (critical for reliability)
        const isAccessible = await this.verifyImageUrl(publicUrl);
        if (!isAccessible) {
          // FIXED: Don't delete the file, CDN will catch up
          // The file uploaded successfully, just CDN propagation delayed
          console.warn(`[StorageService] CDN verification delayed for ${publicUrl}. File uploaded successfully, accessible soon.`);
        }

        // Clean up old photos on successful upload
        // For crop uploads, preserve both original and cropped variants
        await this.cleanupOldPhotos(profileId, publicUrl, isCropUpload);

        // LOG: Upload success
        console.log('[STORAGE_UPLOAD_SUCCESS]', {
          targetProfileId: profileId,
          filePath,
          publicUrl,
          duration: Date.now() - startTime,
          cdnVerified: isAccessible
        });

        return { url: publicUrl, error: null };
      } catch (error) {
        console.error(`[STORAGE_UPLOAD_FAILURE] Attempt ${attempt + 1} failed:`, {
          targetProfileId: profileId,
          error: error.message,
          duration: Date.now() - startTime
        });
        lastError = error;

        // Don't retry for client errors
        if (error.statusCode >= 400 && error.statusCode < 500) {
          break;
        }
      }
    }

    return {
      url: null,
      error: lastError || new Error("فشل رفع الصورة بعد عدة محاولات"),
    };
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
        throw new Error("Invalid photo URL");
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
      console.error("Delete error:", error);
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
    const acceptedTypes = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
    const fileExt = file.uri?.split(".").pop()?.toLowerCase();

    if (!fileExt || !acceptedTypes.includes(fileExt)) {
      throw new Error("نوع الملف غير مدعوم. الرجاء استخدام JPG أو PNG");
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
   * Upload spouse photo
   * @param {string} marriageId - The marriage record ID
   * @param {string} photoUri - The photo URI
   * @returns {Promise<string>} The public URL of the uploaded photo
   */
  async uploadSpousePhoto(marriageId, photoUri) {
    try {
      const fileName = `spouse_${marriageId}_${Date.now()}.jpg`;
      const filePath = `spouses/${marriageId}/${fileName}`;

      // Convert URI to blob
      const response = await fetch(photoUri);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-photos").getPublicUrl(filePath);

      // Verify the URL is actually accessible (CRITICAL FIX)
      const isAccessible = await this.verifyImageUrl(publicUrl);
      if (!isAccessible) {
        // FIXED: Don't delete the file, CDN will catch up
        console.warn(`[StorageService] CDN verification delayed for spouse photo ${publicUrl}. File uploaded successfully, accessible soon.`);
      }

      return publicUrl;
    } catch (error) {
      console.error("Error uploading spouse photo:", error);
      throw error;
    }
  }

  /**
   * Fetch with timeout helper
   * @param {string} url - URL to fetch
   * @param {object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>}
   */
  async fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("انتهت مهلة التحميل");
      }
      throw error;
    }
  }

  /**
   * Verifies that an image URL is actually accessible
   * @param {string} url - The image URL to verify
   * @returns {Promise<boolean>}
   */
  async verifyImageUrl(url, maxAttempts = 3) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Add exponential backoff for CDN propagation (0s, 2s, 4s)
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }

        // Use fetchWithTimeout to prevent hanging
        const response = await this.fetchWithTimeout(
          url,
          {
            method: "HEAD", // HEAD request is faster than GET
            cache: "no-cache",
          },
          10000, // 10 second timeout for HEAD request
        );

        if (response.ok && response.status === 200) {
          console.log("[StorageService] ✅ Image URL verified:", url);
          return true;
        }

        console.warn(
          `[StorageService] Image URL check failed (attempt ${attempt + 1}/${maxAttempts}):`,
          response.status,
        );
      } catch (error) {
        console.error(
          `[StorageService] Error verifying image URL (attempt ${attempt + 1}/${maxAttempts}):`,
          error.message,
        );
      }
    }

    console.error("[StorageService] ❌ Image URL verification failed:", url);
    return false;
  }

  /**
   * Cleans up old photos when uploading a new one
   * @param {string} profileId - The profile ID
   * @param {string} currentPhotoUrl - The current photo URL to preserve
   * @param {boolean} isCropUpload - If true, preserves both original and cropped photos
   * @returns {Promise<void>}
   */
  async cleanupOldPhotos(profileId, currentPhotoUrl = null, isCropUpload = false) {
    try {
      const path = this.getProfilePhotoPath(profileId);

      // List all files in the profile's directory
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(path);

      if (error) {
        throw error;
      }

      // Delete strategy depends on upload type
      const filesToDelete = files
        .filter((file) => {
          if (!currentPhotoUrl) return true;

          // For crop uploads: preserve BOTH original (photo_*) AND cropped (*_cropped_*) files
          if (isCropUpload) {
            // Keep the file being uploaded
            if (currentPhotoUrl.includes(file.name)) return false;

            // Keep all photo_* files (original photos)
            if (file.name.startsWith('photo_')) return false;

            // Keep all *_cropped_* files (crop variants)
            if (file.name.includes('_cropped_')) return false;

            // Delete everything else (old temp files, etc.)
            return true;
          }

          // For normal uploads: delete all except the current one (existing behavior)
          return !currentPhotoUrl.includes(file.name);
        })
        .map((file) => `${path}${file.name}`);

      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(this.bucketName)
          .remove(filesToDelete);

        if (deleteError) {
          console.error("Cleanup error:", deleteError);
        }
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }
}

export default new StorageService();
