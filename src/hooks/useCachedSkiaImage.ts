import { useEffect, useState, useRef } from "react";
import type { SkImage } from "@shopify/react-native-skia";
import skiaImageCache from "../services/skiaImageCache";

/**
 * Hook to load and cache Skia images
 * @param url - The image URL to load
 * @param bucket - The size bucket (default 256)
 * @returns SkImage or null
 */
export function useCachedSkiaImage(
  url: string | null,
  bucket = 256,
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

    // Generate final URL for this bucket size
    const finalUrl = skiaImageCache.urlForBucket(url, bucket);

    // Try cache first (synchronous)
    const cached = skiaImageCache.get(finalUrl);
    if (cached) {
      setImage(cached);
      return;
    }

    // Load if not cached
    skiaImageCache
      .getOrLoad(url, bucket)
      .then((img) => {
        if (mounted.current) {
          setImage(img);
        }
      })
      .catch((error) => {
        // Silently handle missing images (common when photos are deleted)
        if (mounted.current) {
          setImage(null);
        }
      });
  }, [url, bucket]); // Only re-run when url or bucket changes

  return image;
}
