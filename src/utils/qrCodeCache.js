/**
 * QR Code Caching Utility
 *
 * Caches generated QR codes to improve performance.
 * QR codes are invalidated when profile photo changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QR_CACHE_PREFIX = 'qr_cache_';
const QR_CACHE_VERSION = '1'; // Increment to invalidate all caches

/**
 * Generates cache key for QR code
 * Key format: qr_cache_v1_{hid}_{photoUrl_hash}
 */
export const getQRCacheKey = (hid, photoUrl) => {
  const photoHash = photoUrl ? hashString(photoUrl) : 'no_photo';
  return `${QR_CACHE_PREFIX}${QR_CACHE_VERSION}_${hid}_${photoHash}`;
};

/**
 * Simple string hash for cache key
 */
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

/**
 * Check if QR code is cached
 * @param {string} hid - Profile HID
 * @param {string} photoUrl - Profile photo URL
 * @returns {Promise<object|null>} Cached data or null
 */
export const getCachedQR = async (hid, photoUrl) => {
  try {
    const key = getQRCacheKey(hid, photoUrl);
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const data = JSON.parse(cached);
      console.log('[QRCache] Cache hit for HID:', hid);
      return data;
    }
    return null;
  } catch (error) {
    console.warn('[QRCache] Failed to get cached QR:', error);
    return null;
  }
};

/**
 * Cache QR code data
 * @param {string} hid - Profile HID
 * @param {string} photoUrl - Profile photo URL
 * @param {string} qrData - QR code data to cache
 */
export const cacheQR = async (hid, photoUrl, qrData) => {
  try {
    const key = getQRCacheKey(hid, photoUrl);
    await AsyncStorage.setItem(key, JSON.stringify({
      qrData,
      cachedAt: Date.now(),
    }));
    console.log('[QRCache] Cached QR for HID:', hid);
  } catch (error) {
    console.warn('[QRCache] Failed to cache QR:', error);
  }
};

/**
 * Clear all QR caches for a specific profile
 * Call this when profile photo changes
 * @param {string} hid - Profile HID
 */
export const clearQRCache = async (hid) => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const qrKeys = keys.filter(k => k.startsWith(`${QR_CACHE_PREFIX}${QR_CACHE_VERSION}_${hid}_`));
    if (qrKeys.length > 0) {
      await AsyncStorage.multiRemove(qrKeys);
      console.log(`[QRCache] Cleared ${qrKeys.length} cached QR codes for HID:`, hid);
    }
  } catch (error) {
    console.warn('[QRCache] Failed to clear QR cache:', error);
  }
};

/**
 * Clear all QR caches in the app
 * Use for testing or major version updates
 */
export const clearAllQRCaches = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const qrKeys = keys.filter(k => k.startsWith(QR_CACHE_PREFIX));
    if (qrKeys.length > 0) {
      await AsyncStorage.multiRemove(qrKeys);
      console.log(`[QRCache] Cleared all ${qrKeys.length} cached QR codes`);
    }
  } catch (error) {
    console.warn('[QRCache] Failed to clear all QR caches:', error);
  }
};
