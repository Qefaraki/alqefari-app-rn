import { useEffect, useState, useRef } from "react";
import type { SkImage } from "@shopify/react-native-skia";
import skiaImageCache from "../services/skiaImageCache";
import imageLoadQueue from "../services/imageLoadQueue";

/**
 * Hook for batched image loading with progressive rendering
 * Phase 2 Performance Optimization
 *
 * Features:
 * - Priority-based batch loading (visible > prefetch)
 * - Progressive loading: thumbnail (64px) → high-res
 * - Reduced state update cascades (batched in groups of 15)
 *
 * @param url - The image URL to load
 * @param bucket - The size bucket (default 256)
 * @param priority - Loading priority ('visible' or 'prefetch')
 * @returns SkImage (best available: highRes > thumbnail > null)
 */
export function useBatchedSkiaImage(
  url: string | null,
  bucket = 256,
  priority: "visible" | "prefetch" = "visible"
): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    // Try cache first for both sizes (synchronous)
    const thumbnailUrl = skiaImageCache.urlForBucket(url, 64);
    const highResUrl = skiaImageCache.urlForBucket(url, bucket);

    const cachedThumbnail = skiaImageCache.get(thumbnailUrl);
    const cachedHighRes = skiaImageCache.get(highResUrl);

    if (cachedHighRes) {
      // High-res already cached - use it immediately
      setImage(cachedHighRes);
      return;
    }

    if (cachedThumbnail) {
      // Thumbnail cached - show it while loading high-res
      setImage(cachedThumbnail);
    }

    // Enqueue loads in priority queue
    // 1. Load thumbnail first (64px, high priority) - for progressive loading
    if (!cachedThumbnail) {
      imageLoadQueue.enqueue(url, 64, priority, (error) => {
        if (!mounted.current || error) return;

        const thumb = skiaImageCache.get(thumbnailUrl);
        if (thumb) {
          setImage(thumb); // Show thumbnail immediately
        }
      });
    }

    // 2. Load high-res in queue (will batch with other images)
    imageLoadQueue.enqueue(url, bucket, priority, (error) => {
      if (!mounted.current || error) return;

      const high = skiaImageCache.get(highResUrl);
      if (high) {
        setImage(high); // Upgrade to high-res when available
      }
    });
  }, [url, bucket, priority]); // Rerun when url or bucket changes

  return image;
}
