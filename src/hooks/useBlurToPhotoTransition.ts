import { useEffect, useRef } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Hook for smooth crossfade from blurhash placeholder to final photo
 *
 * Creates professional transition when photo finishes loading:
 * - Blurhash fades out (opacity 1.0 → 0)
 * - Photo fades in (opacity 0 → 1.0)
 *
 * Animation duration: 200ms (iOS standard for smooth feel)
 * Triggers: On EVERY photo load (not conditional like morph animation)
 *
 * This eliminates the jarring "pop" from blur to sharp image,
 * matching iOS Photos app and modern image loading UX.
 *
 * @param hasPhoto - true when final photo has loaded
 * @param hasBlurhash - true when blurhash is available
 * @returns Object with animated shared values for both images
 */
export function useBlurToPhotoTransition(
  hasPhoto: boolean,
  hasBlurhash: boolean
) {
  // Track if we've ever had a photo (to detect first load)
  const hasLoadedPhotoRef = useRef(false);

  // Animated opacity values
  const blurhashOpacity = useSharedValue(1);
  const photoOpacity = useSharedValue(0);

  // Debug logging ref
  const logRef = useRef<{ lastHasPhoto?: boolean }>({});

  useEffect(() => {
    if (__DEV__ && false) { // Debug logging disabled to reduce spam
      if (logRef.current.lastHasPhoto !== hasPhoto) {
        console.log(
          `[BlurCrossfade] Photo state changed: ${logRef.current.lastHasPhoto} → ${hasPhoto}`
        );
        logRef.current.lastHasPhoto = hasPhoto;
      }
    }
  }, [hasPhoto]);

  useEffect(() => {
    // Only trigger crossfade on FIRST photo load (not on re-renders)
    if (hasPhoto && hasBlurhash && !hasLoadedPhotoRef.current) {
      hasLoadedPhotoRef.current = true;

      if (__DEV__ && false) {
        console.log(`[BlurCrossfade] 🎬 Starting 200ms crossfade...`);
      }

      // Smooth 200ms crossfade (iOS standard timing)
      blurhashOpacity.value = withTiming(0, {
        duration: 200,
      });
      photoOpacity.value = withTiming(1, {
        duration: 200,
      });
    } else if (hasPhoto && !hasBlurhash) {
      // No blurhash: show photo immediately
      blurhashOpacity.value = 0;
      photoOpacity.value = 1;
    } else if (!hasPhoto && hasBlurhash) {
      // Reset for next load (if photo disappears)
      hasLoadedPhotoRef.current = false;
      blurhashOpacity.value = 1;
      photoOpacity.value = 0;
    }
  }, [hasPhoto, hasBlurhash]);

  // Consider transitioning if blurhash is fading out (opacity between 0 and 1)
  const isTransitioning = blurhashOpacity.value > 0 && photoOpacity.value > 0;

  return {
    blurhashOpacity,
    photoOpacity,
    isTransitioning,
  };
}
