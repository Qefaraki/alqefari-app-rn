import { useEffect, useState, useRef } from "react";
import type { SkImage } from "@shopify/react-native-skia";
import skiaImageCache from "../services/skiaImageCache";
import imageLoadQueue from "../services/imageLoadQueue";

export interface BatchedImageResult {
  /**
   * Current best available image (highRes > lowRes > thumbnail > null)
   */
  image: SkImage | null;

  /**
   * True when high-res image just loaded and is replacing lower res
   * Used to trigger morph/transition animations
   */
  isUpgrading: boolean;

  /**
   * Current bucket size of displayed image
   */
  currentBucket: number | null;
}

/**
 * Hook for batched image loading with progressive rendering and upgrade tracking
 * Phase 2 Performance Optimization - With Morph Transition Support
 *
 * Features:
 * - Priority-based batch loading (visible > prefetch)
 * - Progressive loading: thumbnail (64px) → high-res
 * - Reduced state update cascades (batched in groups of 15)
 * - Tracks image quality upgrades for transition animations
 * - Detects when bucket increases (e.g., 80px → 256px for zoom)
 *
 * @param url - The image URL to load
 * @param bucket - The size bucket (default 120)
 * @param priority - Loading priority ('visible' or 'prefetch')
 * @returns BatchedImageResult with image, upgrade tracking, and bucket info
 */
export function useBatchedSkiaImageWithMorph(
  url: string | null,
  bucket = 120,
  priority: "visible" | "prefetch" = "visible"
): BatchedImageResult {
  const [image, setImage] = useState<SkImage | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [currentBucket, setCurrentBucket] = useState<number | null>(null);
  const mounted = useRef(true);
  const previousBucketRef = useRef<number | null>(null);
  const hookIdRef = useRef(`hook-${Math.random().toString(36).substr(2, 9)}`);
  const imageLoadStartRef = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!url) {
      setImage(null);
      setCurrentBucket(null);
      return;
    }

    const hookId = hookIdRef.current;
    console.log(`[useBatchedSkiaImageWithMorph] ${hookId}: Starting load for bucket=${bucket}px`);

    // Try cache first for both sizes (synchronous)
    const thumbnailUrl = skiaImageCache.urlForBucket(url, 64);
    const highResUrl = skiaImageCache.urlForBucket(url, bucket);

    const cachedThumbnail = skiaImageCache.get(thumbnailUrl);
    const cachedHighRes = skiaImageCache.get(highResUrl);

    if (cachedHighRes) {
      // High-res already cached - use it immediately
      const isUpgrade = previousBucketRef.current && previousBucketRef.current < bucket;
      console.log(
        `[useBatchedSkiaImageWithMorph] ${hookId}: Found cached high-res (${bucket}px), isUpgrade=${isUpgrade} (prev: ${previousBucketRef.current})`
      );
      setImage(cachedHighRes);
      setCurrentBucket(bucket);
      setIsUpgrading(isUpgrade);
      previousBucketRef.current = bucket;
      return;
    }

    if (cachedThumbnail) {
      // Thumbnail cached - show it while loading high-res
      console.log(
        `[useBatchedSkiaImageWithMorph] ${hookId}: Found cached thumbnail (64px), now loading ${bucket}px`
      );
      setImage(cachedThumbnail);
      setCurrentBucket(64);
      setIsUpgrading(false);
    }

    imageLoadStartRef.current = Date.now();

    // Enqueue loads in priority queue
    // 1. Load thumbnail first (64px, high priority) - for progressive loading
    if (!cachedThumbnail) {
      console.log(`[useBatchedSkiaImageWithMorph] ${hookId}: Enqueueing thumbnail (64px)`);
      imageLoadQueue.enqueue(url, 64, priority, (error) => {
        if (!mounted.current || error) {
          console.log(
            `[useBatchedSkiaImageWithMorph] ${hookId}: Thumbnail load error or unmounted`
          );
          return;
        }

        const thumb = skiaImageCache.get(thumbnailUrl);
        if (thumb) {
          console.log(
            `[useBatchedSkiaImageWithMorph] ${hookId}: Thumbnail loaded (64px) in ${Date.now() - (imageLoadStartRef.current || 0)}ms`
          );
          setImage(thumb); // Show thumbnail immediately
          setCurrentBucket(64);
          setIsUpgrading(false);
        }
      });
    }

    // 2. Load high-res in queue (will batch with other images)
    console.log(`[useBatchedSkiaImageWithMorph] ${hookId}: Enqueueing high-res (${bucket}px)`);
    imageLoadQueue.enqueue(url, bucket, priority, (error) => {
      if (!mounted.current || error) {
        console.log(
          `[useBatchedSkiaImageWithMorph] ${hookId}: High-res load error or unmounted`
        );
        return;
      }

      const high = skiaImageCache.get(highResUrl);
      if (high) {
        // Determine if this is an upgrade (bucket increased)
        const isUpgrade = previousBucketRef.current && previousBucketRef.current < bucket;
        const loadTime = Date.now() - (imageLoadStartRef.current || 0);
        console.log(
          `[useBatchedSkiaImageWithMorph] ${hookId}: High-res loaded (${bucket}px) in ${loadTime}ms, isUpgrade=${isUpgrade} (prev: ${previousBucketRef.current})`
        );
        setImage(high); // Upgrade to high-res when available
        setCurrentBucket(bucket);
        setIsUpgrading(isUpgrade);
        previousBucketRef.current = bucket;
      }
    });
  }, [url, bucket, priority]); // Rerun when url or bucket changes

  // Reset upgrade flag after a short delay to prevent multiple animations
  useEffect(() => {
    if (isUpgrading) {
      const timer = setTimeout(() => {
        setIsUpgrading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isUpgrading]);

  return {
    image,
    isUpgrading,
    currentBucket,
  };
}
