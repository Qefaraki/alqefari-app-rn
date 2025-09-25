import { useCallback, useRef, useState } from 'react';
import { Image } from 'expo-image';

interface PreloadStatus {
  url: string;
  loaded: boolean;
  error?: string;
}

export function useImagePreloader() {
  const [preloadStatus, setPreloadStatus] = useState<Map<string, PreloadStatus>>(new Map());
  const preloadQueue = useRef<string[]>([]);
  const isPreloading = useRef(false);
  const cancelToken = useRef<boolean>(false);

  // Preload a batch of images
  const preloadImages = useCallback(async (imageUrls: string[]) => {
    if (!imageUrls || imageUrls.length === 0) return;

    // Add to queue
    preloadQueue.current = [...new Set([...preloadQueue.current, ...imageUrls])];

    if (isPreloading.current) return;

    isPreloading.current = true;
    cancelToken.current = false;

    while (preloadQueue.current.length > 0 && !cancelToken.current) {
      const batch = preloadQueue.current.splice(0, 3); // Process 3 at a time

      await Promise.all(
        batch.map(async (url) => {
          if (cancelToken.current) return;

          try {
            // Check if already loaded
            if (preloadStatus.get(url)?.loaded) {
              return;
            }

            // Use expo-image prefetch
            await Image.prefetch(url);

            setPreloadStatus(prev => {
              const newStatus = new Map(prev);
              newStatus.set(url, { url, loaded: true });
              return newStatus;
            });
          } catch (error) {
            console.warn(`Failed to preload image: ${url}`, error);
            setPreloadStatus(prev => {
              const newStatus = new Map(prev);
              newStatus.set(url, {
                url,
                loaded: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              return newStatus;
            });
          }
        })
      );

      // Small delay between batches
      if (!cancelToken.current && preloadQueue.current.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    isPreloading.current = false;
  }, [preloadStatus]);

  // Cancel ongoing preloading
  const cancelPreloading = useCallback(() => {
    cancelToken.current = true;
    preloadQueue.current = [];
  }, []);

  // Check if an image is preloaded
  const isImagePreloaded = useCallback((url: string): boolean => {
    return preloadStatus.get(url)?.loaded || false;
  }, [preloadStatus]);

  // Get preload progress
  const getPreloadProgress = useCallback((): {
    loaded: number;
    total: number;
    percentage: number;
  } => {
    const loaded = Array.from(preloadStatus.values()).filter(s => s.loaded).length;
    const total = preloadStatus.size;
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;

    return { loaded, total, percentage };
  }, [preloadStatus]);

  // Clear preload cache
  const clearPreloadCache = useCallback(() => {
    setPreloadStatus(new Map());
    preloadQueue.current = [];
  }, []);

  // Priority preload - move to front of queue
  const priorityPreload = useCallback(async (url: string) => {
    // Remove from queue if exists
    preloadQueue.current = preloadQueue.current.filter(u => u !== url);

    // Add to front
    preloadQueue.current.unshift(url);

    // Start preloading if not already
    if (!isPreloading.current) {
      preloadImages([url]);
    }
  }, [preloadImages]);

  return {
    preloadImages,
    cancelPreloading,
    isImagePreloaded,
    getPreloadProgress,
    clearPreloadCache,
    priorityPreload,
    preloadStatus: Array.from(preloadStatus.values()),
  };
}