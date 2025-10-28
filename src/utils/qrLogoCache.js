/**
 * QR Logo Caching Utility
 *
 * Caches logo resolution decisions to avoid repeated Image.prefetch calls.
 * Cache invalidates when photo URL changes or after 30 days.
 *
 * @module qrLogoCache
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'qr_logo_';
const CACHE_VERSION = '1';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const EMBLEM_ASSET = 'EMBLEM_ASSET'; // String reference for emblem

/**
 * @typedef {Object} CachedLogoData
 * @property {string|Object} logoSource - 'EMBLEM_ASSET' string or {uri: string} object
 * @property {'photo'|'emblem'|'none'} logoType - Logo source type
 * @property {number} timestamp - Unix timestamp (ms) when cached
 */

/**
 * Simple string hash for cache keys
 * @param {string} str - String to hash
 * @returns {string} Hash in base36 format
 */
function hashString(str) {
  if (!str) return 'no_photo';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached logo decision (with TTL enforcement)
 * @param {string} profileId - Profile ID (not HID - ensures uniqueness for Munasib)
 * @param {string} photoUrl - Profile photo URL
 * @returns {Promise<CachedLogoData|null>}
 */
export async function getCachedLogo(profileId, photoUrl) {
  if (!profileId) {
    console.warn('[QRLogoCache] profileId is required');
    return null;
  }

  try {
    const key = `${CACHE_PREFIX}${CACHE_VERSION}_${profileId}_${hashString(photoUrl)}`;
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    let entry;
    try {
      entry = JSON.parse(cached);

      // Validate structure
      if (!entry || typeof entry !== 'object' ||
          typeof entry.timestamp !== 'number' ||
          !entry.logoType) {
        console.warn('[QRLogoCache] Invalid cache structure, removing');
        await AsyncStorage.removeItem(key);
        return null;
      }
    } catch (parseError) {
      console.warn('[QRLogoCache] JSON parse failed, removing corrupted entry');
      await AsyncStorage.removeItem(key);
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > TTL_MS) {
      console.log('[QRLogoCache] Entry expired, removing');
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry;
  } catch (error) {
    console.warn('[QRLogoCache] Get failed:', error.message);
    return null;
  }
}

/**
 * Cache logo decision (fire-and-forget, doesn't throw)
 * @param {string} profileId - Profile ID (not HID - ensures uniqueness for Munasib)
 * @param {string} photoUrl - Profile photo URL
 * @param {string|Object} logoSource - 'EMBLEM_ASSET' or {uri: string}
 * @param {'photo'|'emblem'|'none'} logoType
 * @returns {Promise<void>}
 */
export async function cacheLogo(profileId, photoUrl, logoSource, logoType) {
  if (!profileId) {
    console.warn('[QRLogoCache] profileId is required');
    return;
  }

  try {
    const key = `${CACHE_PREFIX}${CACHE_VERSION}_${profileId}_${hashString(photoUrl)}`;
    await AsyncStorage.setItem(key, JSON.stringify({
      logoSource,
      logoType,
      timestamp: Date.now(),
    }));
    console.log(`[QRLogoCache] Cached ${logoType} for profileId ${profileId}`);
  } catch (error) {
    console.warn('[QRLogoCache] Cache write failed:', error.message);
  }
}

/**
 * Clear all logo caches for a profile (non-blocking)
 * @param {string} profileId - Profile ID (not HID - ensures uniqueness for Munasib)
 * @returns {Promise<void>}
 */
export async function clearLogoCache(profileId) {
  if (!profileId) {
    console.warn('[QRLogoCache] profileId is required');
    return;
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k =>
      k.startsWith(`${CACHE_PREFIX}${CACHE_VERSION}_${profileId}_`)
    );

    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log(`[QRLogoCache] Cleared ${cacheKeys.length} entries for profileId ${profileId}`);
    }
  } catch (error) {
    console.warn('[QRLogoCache] Clear cache failed:', error.message);
  }
}

/**
 * Get emblem asset constant for caching
 * @returns {string}
 */
export function getEmblemAssetReference() {
  return EMBLEM_ASSET;
}
