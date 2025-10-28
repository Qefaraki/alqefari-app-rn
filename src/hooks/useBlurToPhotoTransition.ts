import { useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';

/**
 * Hook for smooth multi-stage image loading with fade transitions
 *
 * Creates professional progressive loading sequence:
 * 1. Skeleton → Blurhash fade-in (opacity 0 → 0.9, 200ms)
 * 2. Blurhash → Photo crossfade (blur 0.9 → 0, photo 0 → 1, 200ms)
 *
 * Animation duration: 200ms per stage (iOS standard for smooth feel)
 * Triggers: On EVERY image appearance (not conditional like morph animation)
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

  useEffect(() => {
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
    // Only trigger on FIRST photo appearance AND after blurhash has loaded
    if (
      hasPhoto &&
      hasBlurhash &&
      !hasLoadedPhotoRef.current &&
      hasLoadedBlurhashRef.current
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
  }, [hasPhoto, hasBlurhash]);

  return {
    blurhashOpacity,
    photoOpacity,
    isBlurhashFadingIn, // True during Stage 1 (skeleton → blurhash)
    isPhotoFadingIn, // True during Stage 2 (blurhash → photo)
  };
}
