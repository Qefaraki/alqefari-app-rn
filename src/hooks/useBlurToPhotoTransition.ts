import { useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';

/**
 * Hook for smooth multi-stage image loading with fade transitions
 *
 * Creates professional progressive loading sequence:
 * 1. Skeleton → Blurhash fade-in (opacity 0 → 0.9, 200ms)
 * 2. Blurhash → Photo crossfade (blur 0.9 → 0, photo 0 → 1, 200ms)
 *
 * Smart time-based cache detection:
 * - Cached images (both load in < 50ms): Show instantly, skip animations
 * - Incremental loads (assets arrive > 50ms apart): Smooth animated transitions
 * - Handles async blurhash conversion correctly (5-10ms decode time)
 *
 * Animation duration: 200ms per stage (iOS standard for smooth feel)
 * Race condition protection: Stage 2 waits for Stage 1 to complete
 * Complete cleanup: Resets all state on unmount to prevent visual corruption
 *
 * This eliminates ALL jarring "pops" in the loading sequence,
 * matching iOS Photos app and modern image loading UX (Instagram/Pinterest).
 *
 * @param hasPhoto - true when final photo has loaded
 * @param hasBlurhash - true when blurhash is available
 * @returns Object with animated shared values and transition states
 */
export function useBlurToPhotoTransition(
  hasPhoto: boolean,
  hasBlurhash: boolean
) {
  // Track if we've loaded each asset (to detect first appearance)
  const hasLoadedBlurhashRef = useRef(false);
  const hasLoadedPhotoRef = useRef(false);

  // Time-based cache detection: track mount time and asset load times
  // Use performance.now() for monotonic clock (never goes backward, microsecond precision)
  const mountTime = useRef(performance.now());
  const assetTimestamps = useRef<{
    blurhash: number | null;
    photo: number | null;
  }>({ blurhash: null, photo: null });

  // Animated opacity values
  const blurhashOpacity = useSharedValue(0); // Start hidden
  const photoOpacity = useSharedValue(0);

  // Track which animation is currently running
  const [isBlurhashFadingIn, setIsBlurhashFadingIn] = useState(false);
  const [isPhotoFadingIn, setIsPhotoFadingIn] = useState(false);

  // Debug logging ref
  const logRef = useRef<{
    lastHasPhoto?: boolean;
    lastHasBlurhash?: boolean;
  }>({});

  useEffect(() => {
    if (__DEV__ && false) {
      // Debug logging disabled to reduce spam
      if (logRef.current.lastHasPhoto !== hasPhoto) {
        console.log(
          `[ImageTransition] Photo state: ${logRef.current.lastHasPhoto} → ${hasPhoto}`
        );
        logRef.current.lastHasPhoto = hasPhoto;
      }
      if (logRef.current.lastHasBlurhash !== hasBlurhash) {
        console.log(
          `[ImageTransition] Blurhash state: ${logRef.current.lastHasBlurhash} → ${hasBlurhash}`
        );
        logRef.current.lastHasBlurhash = hasBlurhash;
      }
    }
  }, [hasPhoto, hasBlurhash]);

  // Effect 1: Mount/unmount only - Initialize and cleanup
  // Empty deps [] = only runs on mount and unmount (not on prop changes)
  useEffect(() => {
    // Initialize mount time (already done in useRef above, but explicit for clarity)
    mountTime.current = performance.now();

    // Cleanup: Only runs on UNMOUNT (not on dependency changes)
    return () => {
      if (__DEV__ && false) {
        console.log(`[ImageTransition] Unmounting - resetting all state`);
      }

      // Reset animation state flags
      setIsBlurhashFadingIn(false);
      setIsPhotoFadingIn(false);

      // Reset refs to prevent stale state on remount (CRITICAL for scroll behavior)
      hasLoadedBlurhashRef.current = false;
      hasLoadedPhotoRef.current = false;

      // Reset SharedValues to prevent visual corruption
      blurhashOpacity.value = 0;
      photoOpacity.value = 0;

      // Reset timestamps for fresh cache detection on remount
      assetTimestamps.current = { blurhash: null, photo: null };
    };
  }, []); // Empty deps = mount/unmount only

  // Effect 2: Asset state changes - Handle animations
  // Runs when assets become available, NO cleanup function
  useEffect(() => {
    // Time-based cache detection: Track when each asset becomes available
    if (hasBlurhash && assetTimestamps.current.blurhash === null) {
      assetTimestamps.current.blurhash = performance.now();
    }
    if (hasPhoto && assetTimestamps.current.photo === null) {
      assetTimestamps.current.photo = performance.now();
    }

    // Detect fast cache hits: both assets loaded in < 50ms = cached
    // Skip animations for cached images (instant display)
    if (
      assetTimestamps.current.blurhash !== null &&
      assetTimestamps.current.photo !== null &&
      !hasLoadedPhotoRef.current
    ) {
      // Bounds checking: Prevent negative deltas if clock changes or race conditions
      const blurhashLoadTime = Math.max(
        0,
        assetTimestamps.current.blurhash - mountTime.current
      );
      const photoLoadTime = Math.max(
        0,
        assetTimestamps.current.photo - mountTime.current
      );

      if (blurhashLoadTime < 50 && photoLoadTime < 50) {
        // Both loaded fast = cached, skip all animations
        hasLoadedBlurhashRef.current = true;
        hasLoadedPhotoRef.current = true;
        blurhashOpacity.value = 0;
        photoOpacity.value = 1;

        if (__DEV__ && false) {
          console.log(
            `[ImageTransition] ⚡ Cached load detected (blur: ${blurhashLoadTime}ms, photo: ${photoLoadTime}ms) - skipping animations`
          );
        }

        return; // Exit early, no animations needed
      }
    }

    // Stage 1: Blurhash fade-in (0 → 0.9 opacity, 200ms)
    // Only trigger on FIRST blurhash appearance
    if (hasBlurhash && !hasLoadedBlurhashRef.current) {
      hasLoadedBlurhashRef.current = true;
      setIsBlurhashFadingIn(true);

      if (__DEV__ && false) {
        console.log(`[ImageTransition] 🎬 Stage 1: Blurhash fade-in starting...`);
      }

      blurhashOpacity.value = withTiming(
        0.9,
        {
          duration: 200,
        },
        (finished) => {
          if (finished) {
            runOnJS(setIsBlurhashFadingIn)(false);
            if (__DEV__ && false) {
              console.log(`[ImageTransition] ✅ Stage 1: Blurhash fade-in complete`);
            }
          }
        }
      );
    }

    // Stage 2: Photo crossfade (blurhash 0.9 → 0, photo 0 → 1, 200ms)
    // Only trigger on FIRST photo appearance AND after blurhash animation completes
    // Wait for Stage 1 to finish to prevent race condition
    if (
      hasPhoto &&
      hasBlurhash &&
      !hasLoadedPhotoRef.current &&
      hasLoadedBlurhashRef.current &&
      !isBlurhashFadingIn // Wait for Stage 1 animation to complete
    ) {
      hasLoadedPhotoRef.current = true;
      setIsPhotoFadingIn(true);

      if (__DEV__ && false) {
        console.log(`[ImageTransition] 🎬 Stage 2: Photo crossfade starting...`);
      }

      // Blurhash fades out
      blurhashOpacity.value = withTiming(0, {
        duration: 200,
      });

      // Photo fades in (with completion callback)
      photoOpacity.value = withTiming(
        1,
        {
          duration: 200,
        },
        (finished) => {
          if (finished) {
            runOnJS(setIsPhotoFadingIn)(false);
            if (__DEV__ && false) {
              console.log(`[ImageTransition] ✅ Stage 2: Photo crossfade complete`);
            }
          }
        }
      );
    }

    // Handle edge cases
    if (hasPhoto && !hasBlurhash) {
      // No blurhash available: show photo immediately
      blurhashOpacity.value = 0;
      photoOpacity.value = 1;
      hasLoadedPhotoRef.current = true;
    } else if (!hasPhoto && hasBlurhash && hasLoadedPhotoRef.current) {
      // Photo disappeared: reset to blurhash state
      hasLoadedPhotoRef.current = false;
      blurhashOpacity.value = 0.9;
      photoOpacity.value = 0;
      setIsPhotoFadingIn(false);
    } else if (!hasBlurhash && !hasPhoto) {
      // Both gone: reset everything
      hasLoadedBlurhashRef.current = false;
      hasLoadedPhotoRef.current = false;
      blurhashOpacity.value = 0;
      photoOpacity.value = 0;
      setIsBlurhashFadingIn(false);
      setIsPhotoFadingIn(false);
    }

    // No cleanup here - Effect 1 handles all cleanup on unmount only
  }, [hasPhoto, hasBlurhash, isBlurhashFadingIn]); // Added isBlurhashFadingIn for race condition protection

  return {
    blurhashOpacity,
    photoOpacity,
    isBlurhashFadingIn, // True during Stage 1 (skeleton → blurhash)
    isPhotoFadingIn, // True during Stage 2 (blurhash → photo)
  };
}
