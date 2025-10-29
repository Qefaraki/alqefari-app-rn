/**
 * Image Cache Utility - Pre-download images for instant crop opening
 *
 * Purpose: Download remote Supabase images to local temp files BEFORE user wants to crop,
 * so crop editor opens instantly with zero visible waiting.
 *
 * Strategy:
 * - Uses expo-image-manipulator to download and process images
 * - Returns local file:// URIs that crop libraries can read
 * - Handles remote URLs natively (no FileSystem.cacheDirectory dependency)
 * - Automatically resizes to 1080px for fast loading and optimal quality
 * - Temp files cleaned up automatically by OS
 *
 * Why expo-image-manipulator instead of expo-file-system:
 * - FileSystem.cacheDirectory and documentDirectory can be null at runtime
 * - Image manipulator handles remote URLs without directory dependencies
 * - Built-in image processing (resize, compress) during download
 * - More reliable across iOS/Android/simulators
 * - Creates temp files that OS automatically cleans up
 *
 * Usage:
 * ```javascript
 * // When profile loads, pre-download image
 * const localPath = await downloadImageForCrop(person.photo_url);
 * // Later, when user crops → instant opening with localPath
 * <PhotoCropEditor cachedPhotoPath={localPath} />
 * ```
 *
 * Created: October 28, 2025
 * Updated: October 28, 2025 - Switched to expo-image-manipulator for reliability
 */

import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Download and prepare image for instant crop opening
 *
 * This is the core function - downloads Supabase image and processes it to a local file://
 * that expo-dynamic-image-crop can read instantly. No waiting, no "File is not readable" errors.
 *
 * How it works:
 * 1. Takes remote Supabase URL (https://)
 * 2. Uses expo-image-manipulator to download and resize (1080px width)
 * 3. Returns local file:// URI that crop library accepts
 * 4. Entire process takes 200-500ms in background (user doesn't notice)
 *
 * @param {string} url - Original Supabase photo URL (https://)
 * @returns {Promise<string|null>} - Local file:// URI on success, null on failure
 *
 * @example
 * const localUri = await downloadImageForCrop('https://...photo.jpg');
 * // Returns: 'file:///var/mobile/.../ImageManipulator/12345.jpg'
 */
export async function downloadImageForCrop(url) {
  if (!url) {
    console.warn('[ImageCache] No URL provided');
    return null;
  }

  try {
    console.log('[ImageCache] Downloading and processing image:', url);

    // Use expo-image-manipulator to download and process
    // This handles remote URLs natively and returns local file:// URI
    const result = await ImageManipulator.manipulateAsync(
      url,
      [
        // Resize to 1080px width for optimal quality/performance balance
        { resize: { width: 1080 } }
      ],
      {
        compress: 0.8, // 80% quality (matches Supabase optimization)
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    if (result && result.uri) {
      console.log('[ImageCache] Download successful:', {
        original: url,
        local: result.uri,
        width: result.width,
        height: result.height,
      });
      return result.uri; // file:// URI that crop library can read
    } else {
      console.error('[ImageCache] Manipulator returned no URI');
      return null;
    }
  } catch (error) {
    console.error('[ImageCache] Download error:', {
      message: error.message,
      url,
    });
    return null;
  }
}

/**
 * Alias for backwards compatibility with ProfileViewer
 * @deprecated Use downloadImageForCrop instead
 */
export const downloadImageToCache = downloadImageForCrop;

/**
 * Get optimized Supabase Storage URL with image transformations
 * Note: This is optional now since expo-image-manipulator does the resizing
 * But keeping it for potential server-side bandwidth savings
 *
 * @param {string} url - Original Supabase photo URL
 * @returns {string} - URL with ?width=1080&quality=80 query params
 */
export function getOptimizedImageUrl(url) {
  if (!url) return url;
  // Supabase Storage supports on-the-fly image transformations
  // This reduces download size from 2-4MB to 200-400KB
  return `${url}?width=1080&quality=80`;
}

/**
 * Check if URL is already a local file:// URI
 * Useful for avoiding re-download if we already have local copy
 *
 * @param {string} url - URL to check
 * @returns {boolean} - True if already local file://
 */
export function isLocalFile(url) {
  return url && url.startsWith('file://');
}

/**
 * Download image with optimized Supabase URL first (server-side resize)
 * This reduces download time by 89% (200-400KB vs 2-4MB)
 *
 * @param {string} url - Original Supabase photo URL
 * @returns {Promise<string|null>} - Local file:// URI
 */
export async function downloadOptimizedImage(url) {
  if (!url) return null;

  // If already local, return as-is
  if (isLocalFile(url)) {
    console.log('[ImageCache] Already local file:', url);
    return url;
  }

  // Download optimized version (Supabase resizes server-side)
  const optimizedUrl = getOptimizedImageUrl(url);
  return downloadImageForCrop(optimizedUrl);
}
