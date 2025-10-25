import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

class ImageCacheService {
  constructor() {
    this.cacheDir = `${FileSystem.cacheDirectory}images/`;
    this.cacheMetadataKey = 'IMAGE_CACHE_METADATA';
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB
    this.maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }
      
      // Clean expired cache on startup
      await this.clearExpiredCache();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize image cache:', error);
    }
  }

  /**
   * Preload images for better performance
   * @param {string[]} imageUrls - Array of image URLs to preload
   */
  async preloadImages(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return;
    
    await this.initialize();
    
    // Use expo-image's built-in preloading
    const validUrls = imageUrls.filter(url => url && typeof url === 'string');
    
    try {
      await Image.prefetch(validUrls);
    } catch (error) {
      console.error('Failed to preload images:', error);
    }
  }

  /**
   * Warm up cache for visible nodes
   * @param {Array} visibleNodes - Nodes currently visible in viewport
   */
  async warmCache(visibleNodes) {
    const urls = visibleNodes
      .map(node => node.photo_url)
      .filter(Boolean);
    
    if (urls.length > 0) {
      await this.preloadImages(urls);
    }
  }

  /**
   * Get cache metadata
   * @private
   */
  async getCacheMetadata() {
    try {
      const metadata = await AsyncStorage.getItem(this.cacheMetadataKey);
      return metadata ? JSON.parse(metadata) : {};
    } catch (error) {
      console.error('Failed to get cache metadata:', error);
      return {};
    }
  }

  /**
   * Update cache metadata
   * @private
   */
  async updateCacheMetadata(metadata) {
    try {
      await AsyncStorage.setItem(this.cacheMetadataKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to update cache metadata:', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache() {
    try {
      const metadata = await this.getCacheMetadata();
      const now = Date.now();
      const newMetadata = {};
      
      for (const [url, data] of Object.entries(metadata)) {
        if (now - data.timestamp < this.maxCacheAge) {
          newMetadata[url] = data;
        }
      }
      
      await this.updateCacheMetadata(newMetadata);
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }

  /**
   * Get total cache size
   */
  async getCacheSize() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) return 0;
      
      // Get all files in cache directory
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${this.cacheDir}${file}`);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      // Clear expo-image cache
      await Image.clearDiskCache();
      await Image.clearMemoryCache();
      
      // Clear our file system cache
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }
      
      // Clear metadata
      await AsyncStorage.removeItem(this.cacheMetadataKey);
      
      console.log('Image cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Clear cache if it exceeds size limit
   */
  async enforceSize() {
    try {
      const currentSize = await this.getCacheSize();
      
      if (currentSize > this.maxCacheSize) {
        console.log(`Cache size (${currentSize}) exceeds limit (${this.maxCacheSize}). Clearing...`);
        await this.clearAllCache();
      }
    } catch (error) {
      console.error('Failed to enforce cache size:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const metadata = await this.getCacheMetadata();
      const size = await this.getCacheSize();
      const count = Object.keys(metadata).length;
      
      return {
        size,
        count,
        maxSize: this.maxCacheSize,
        sizeInMB: (size / (1024 * 1024)).toFixed(2),
        maxSizeInMB: (this.maxCacheSize / (1024 * 1024)).toFixed(2),
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        size: 0,
        count: 0,
        maxSize: this.maxCacheSize,
        sizeInMB: '0',
        maxSizeInMB: (this.maxCacheSize / (1024 * 1024)).toFixed(2),
      };
    }
  }
}

export default new ImageCacheService();