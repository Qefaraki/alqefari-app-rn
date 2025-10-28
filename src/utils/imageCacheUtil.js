/**
 * Image Cache Utility - Pre-download images for instant crop opening
 *
 * Purpose: Download remote Supabase images to local cache BEFORE user wants to crop,
 * so crop editor opens instantly with zero visible waiting.
 *
 * Strategy:
 * - Downloads happen in background when profile loads
 * - Uses Supabase optimized URLs (?width=1080&quality=80) for fast downloads
 * - Stores in permanent cache directory (survives app restarts)
 * - Uses SHA-256 hash of URL as filename to avoid collisions
 *
 * Usage:
 * ```javascript
 * // When profile loads, pre-download image
 * const cachedPath = await downloadImageToCache(person.photo_url);
 * // Later, when user crops → instant opening with cachedPath
 * <PhotoCropEditor cachedPhotoPath={cachedPath} />
 * ```
 *
 * Created: October 28, 2025
 */

import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const MAX_CACHE_SIZE_MB = 50; // Prevent cache bloat

/**
 * Get cache directory path with lazy evaluation
 * Cannot use constant because FileSystem.cacheDirectory is null at module load time
 * Fallback to documentDirectory if cacheDirectory is unavailable
 *
 * @returns {string} Cache directory path
 */
function getCacheDir() {
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('FileSystem directories unavailable - check expo-file-system installation');
  }
  return `${baseDir}crop-images/`;
}

/**
 * Get optimized Supabase Storage URL with image transformations
 * Appends ?width=1080&quality=80 for fast downloads (200-400KB vs 2-4MB)
 *
 * @param {string} url - Original Supabase photo URL
 * @returns {string} - Optimized URL with query params
 */
export function getOptimizedImageUrl(url) {
  if (!url) return url;
  // Supabase Storage supports on-the-fly image transformations
  return `${url}?width=1080&quality=80`;
}

/**
 * Generate cache filename from URL using SHA-256 hash
 * Prevents collisions and handles special characters in URLs
 *
 * @param {string} url - Image URL to hash
 * @returns {Promise<string>} - Hashed filename with .jpg extension
 */
async function getCacheFilename(url) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url
  );
  return `${hash}.jpg`;
}

/**
 * Get cached image path if it exists locally
 *
 * @param {string} url - Original image URL
 * @returns {Promise<string|null>} - Local file:// path if cached, null otherwise
 */
export async function getCachedImagePath(url) {
  if (!url) return null;

  try {
    const cacheDir = getCacheDir();
    const optimizedUrl = getOptimizedImageUrl(url);
    const filename = await getCacheFilename(optimizedUrl);
    const filePath = `${cacheDir}${filename}`;

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      console.log('[ImageCache] Cache hit:', filePath);
      return filePath;
    }

    return null;
  } catch (error) {
    console.warn('[ImageCache] Error checking cache:', error);
    return null;
  }
}

/**
 * Download image to local cache for instant crop opening
 *
 * This is the core function - downloads Supabase optimized image in background
 * so when user long-presses to crop, file is already local (zero wait).
 *
 * @param {string} url - Original Supabase photo URL
 * @returns {Promise<string|null>} - Local file:// path on success, null on failure
 */
export async function downloadImageToCache(url) {
  if (!url) {
    console.warn('[ImageCache] No URL provided');
    return null;
  }

  try {
    // Get cache directory (lazy evaluation to avoid null at module load)
    const cacheDir = getCacheDir();
    console.log('[ImageCache] Cache directory:', cacheDir);

    // 1. Check if already cached (avoid re-download)
    const cachedPath = await getCachedImagePath(url);
    if (cachedPath) {
      console.log('[ImageCache] Using existing cache:', cachedPath);
      return cachedPath;
    }

    // 2. Ensure cache directory exists
    console.log('[ImageCache] Checking if cache directory exists...');
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    console.log('[ImageCache] Directory info:', dirInfo);

    if (!dirInfo.exists) {
      console.log('[ImageCache] Creating cache directory:', cacheDir);
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      console.log('[ImageCache] Cache directory created successfully');
    }

    // 3. Download optimized image
    const optimizedUrl = getOptimizedImageUrl(url);
    const filename = await getCacheFilename(optimizedUrl);
    const filePath = `${cacheDir}${filename}`;

    console.log('[ImageCache] Starting download...', {
      original: url,
      optimized: optimizedUrl,
      destination: filePath,
    });

    const downloadResult = await FileSystem.downloadAsync(optimizedUrl, filePath);
    console.log('[ImageCache] Download result:', downloadResult);

    if (downloadResult.status === 200) {
      console.log('[ImageCache] Download successful:', filePath);

      // Verify file was actually written
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        console.log('[ImageCache] File verified on disk:', fileInfo);
        return filePath;
      } else {
        console.error('[ImageCache] File not found after download');
        return null;
      }
    } else {
      console.error('[ImageCache] Download failed with status:', downloadResult.status);
      return null;
    }
  } catch (error) {
    console.error('[ImageCache] Download error:', {
      message: error.message,
      stack: error.stack,
      url,
    });
    return null;
  }
}

/**
 * Clear all cached crop images
 * Call on component unmount or when cache size exceeds limit
 *
 * @returns {Promise<void>}
 */
export async function clearImageCache() {
  try {
    const cacheDir = getCacheDir();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
      console.log('[ImageCache] Cache cleared:', cacheDir);
    }
  } catch (error) {
    console.warn('[ImageCache] Error clearing cache:', error);
  }
}

/**
 * Get cache size in MB
 * Useful for monitoring and preventing bloat
 *
 * @returns {Promise<number>} - Cache size in MB
 */
export async function getCacheSizeMB() {
  try {
    const cacheDir = getCacheDir();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) return 0;

    // Read all files in cache directory
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    let totalSize = 0;

    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
      if (fileInfo.exists) {
        totalSize += fileInfo.size || 0;
      }
    }

    const sizeMB = totalSize / (1024 * 1024);
    return sizeMB;
  } catch (error) {
    console.warn('[ImageCache] Error calculating cache size:', error);
    return 0;
  }
}

/**
 * Clear cache if size exceeds limit
 * Prevents cache from growing too large
 *
 * @returns {Promise<void>}
 */
export async function clearCacheIfNeeded() {
  try {
    const sizeMB = await getCacheSizeMB();
    if (sizeMB > MAX_CACHE_SIZE_MB) {
      console.log(`[ImageCache] Cache size ${sizeMB.toFixed(2)}MB exceeds limit, clearing...`);
      await clearImageCache();
    }
  } catch (error) {
    console.warn('[ImageCache] Error checking cache size:', error);
  }
}
