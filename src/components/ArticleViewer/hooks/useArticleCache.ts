import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewsArticle } from '../../../services/news';

const CACHE_DIR = `${FileSystem.cacheDirectory}article-cache/`;
const CACHE_INDEX_KEY = '@article_cache_index';
const MAX_CACHED_ARTICLES = 20;
const CACHE_EXPIRY_HOURS = 24;

interface CacheEntry {
  id: number;
  timestamp: number;
  article: NewsArticle;
  imagePaths: string[];
}

export function useArticleCache() {
  const [isLoading, setIsLoading] = useState(false);

  // Ensure cache directory exists
  const ensureCacheDir = async () => {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  };

  // Get cache index from AsyncStorage
  const getCacheIndex = async (): Promise<CacheEntry[]> => {
    try {
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      return indexStr ? JSON.parse(indexStr) : [];
    } catch (error) {
      console.error('Error reading cache index:', error);
      return [];
    }
  };

  // Save cache index to AsyncStorage
  const saveCacheIndex = async (index: CacheEntry[]) => {
    try {
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.error('Error saving cache index:', error);
    }
  };

  // Cache an article and its images
  const cacheArticle = useCallback(async (article: NewsArticle, images?: string[]) => {
    setIsLoading(true);
    try {
      await ensureCacheDir();

      // Create article directory
      const articleDir = `${CACHE_DIR}${article.id}/`;
      const dirInfo = await FileSystem.getInfoAsync(articleDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(articleDir);
      }

      // Save article data
      const articlePath = `${articleDir}article.json`;
      await FileSystem.writeAsStringAsync(
        articlePath,
        JSON.stringify(article),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      // Cache images if provided
      const imagePaths: string[] = [];
      if (images && images.length > 0) {
        // Limit to first 10 images for cache storage
        const imagesToCache = images.slice(0, 10);

        for (let i = 0; i < imagesToCache.length; i++) {
          try {
            const imageUrl = imagesToCache[i];
            const extension = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
            const imagePath = `${articleDir}image_${i}.${extension}`;

            // Download and save image
            const downloadResult = await FileSystem.downloadAsync(imageUrl, imagePath);
            if (downloadResult.status === 200) {
              imagePaths.push(imagePath);
            }
          } catch (error) {
            console.error(`Error caching image ${i}:`, error);
          }
        }
      }

      // Update cache index
      const cacheIndex = await getCacheIndex();
      const existingIndex = cacheIndex.findIndex(entry => entry.id === article.id);

      const newEntry: CacheEntry = {
        id: article.id,
        timestamp: Date.now(),
        article,
        imagePaths,
      };

      if (existingIndex !== -1) {
        cacheIndex[existingIndex] = newEntry;
      } else {
        cacheIndex.unshift(newEntry);
      }

      // Limit cache size
      if (cacheIndex.length > MAX_CACHED_ARTICLES) {
        const toRemove = cacheIndex.slice(MAX_CACHED_ARTICLES);

        // Delete old cached articles
        for (const entry of toRemove) {
          try {
            await FileSystem.deleteAsync(`${CACHE_DIR}${entry.id}/`, { idempotent: true });
          } catch (error) {
            console.error('Error deleting old cache:', error);
          }
        }

        cacheIndex.length = MAX_CACHED_ARTICLES;
      }

      await saveCacheIndex(cacheIndex);
    } catch (error) {
      console.error('Error caching article:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get cached article
  const getCachedArticle = useCallback(async (articleId: number): Promise<{
    article: NewsArticle | null;
    images: string[];
  }> => {
    try {
      const cacheIndex = await getCacheIndex();
      const entry = cacheIndex.find(e => e.id === articleId);

      if (!entry) {
        return { article: null, images: [] };
      }

      // Check if cache is expired
      const hoursOld = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
      if (hoursOld > CACHE_EXPIRY_HOURS) {
        return { article: null, images: [] };
      }

      // Read article data
      const articlePath = `${CACHE_DIR}${articleId}/article.json`;
      const articleInfo = await FileSystem.getInfoAsync(articlePath);

      if (articleInfo.exists) {
        const articleStr = await FileSystem.readAsStringAsync(articlePath);
        const article = JSON.parse(articleStr) as NewsArticle;

        // Verify cached images still exist
        const validImages: string[] = [];
        for (const imagePath of entry.imagePaths) {
          const imageInfo = await FileSystem.getInfoAsync(imagePath);
          if (imageInfo.exists) {
            validImages.push(imagePath);
          }
        }

        return { article, images: validImages };
      }
    } catch (error) {
      console.error('Error getting cached article:', error);
    }

    return { article: null, images: [] };
  }, []);

  // Clear old cache entries
  const clearOldCache = useCallback(async () => {
    try {
      const cacheIndex = await getCacheIndex();
      const now = Date.now();
      const validEntries: CacheEntry[] = [];

      for (const entry of cacheIndex) {
        const hoursOld = (now - entry.timestamp) / (1000 * 60 * 60);

        if (hoursOld > CACHE_EXPIRY_HOURS * 7) {
          // Delete very old entries (1 week)
          try {
            await FileSystem.deleteAsync(`${CACHE_DIR}${entry.id}/`, { idempotent: true });
          } catch (error) {
            console.error('Error deleting old cache entry:', error);
          }
        } else {
          validEntries.push(entry);
        }
      }

      if (validEntries.length !== cacheIndex.length) {
        await saveCacheIndex(validEntries);
      }
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }, []);

  // Clear all cache
  const clearAllCache = useCallback(async () => {
    try {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await AsyncStorage.removeItem(CACHE_INDEX_KEY);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }, []);

  // Get cache size
  const getCacheSize = useCallback(async (): Promise<number> => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        // This would need recursive size calculation
        // For now, return estimated size based on cache index
        const cacheIndex = await getCacheIndex();
        return cacheIndex.length * 0.5; // Estimate 0.5MB per article
      }
    } catch (error) {
      console.error('Error getting cache size:', error);
    }
    return 0;
  }, []);

  return {
    cacheArticle,
    getCachedArticle,
    clearOldCache,
    clearAllCache,
    getCacheSize,
    isLoading,
  };
}