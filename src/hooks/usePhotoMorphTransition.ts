import { useEffect } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Hook for crossfade + scale pop morph effect when photo quality upgrades
 *
 * Creates smooth transition when user zooms in and higher quality image loads:
 * - Old image fades out (opacity 1.0 → 0)
 * - New image fades in (opacity 0 → 1.0)
 * - New image scales in (scale 0.98 → 1.0)
 *
 * Animation only triggers at extreme zoom (scale >= 3.0) for intentional feel.
 * This matches iOS Photos app quality upgrade behavior.
 *
 * @param isUpgrading - true when high-res image has loaded and ready to transition
 * @param scale - Current zoom scale (used to determine if animation should trigger)
 * @param shouldAnimateBlur - Optional flag to disable animation (default: true)
 * @returns Object with animated shared values for both images
 */
export function usePhotoMorphTransition(
  isUpgrading: boolean,
  scale: number = 1.0,
  shouldAnimateBlur: boolean = true
) {
  // Track animation state separately to allow external control
  const lowResOpacity = useSharedValue(1);
  const highResOpacity = useSharedValue(0);
  const highResScale = useSharedValue(0.98);

  // Only animate at extreme zoom (scale >= 3.0)
  // This prevents animation noise during normal scrolling
  const shouldAnimate = shouldAnimateBlur && scale >= 3.0 && isUpgrading;

  useEffect(() => {
    if (shouldAnimate) {
      // Crossfade + scale animation (250ms = iOS-standard timing)
      lowResOpacity.value = withTiming(0, {
        duration: 250,
        // Use iOS ease-in-out curve for natural feel
      });
      highResOpacity.value = withTiming(1, {
        duration: 250,
      });
      highResScale.value = withTiming(1.0, {
        duration: 250,
      });
    } else {
      // Instant swap if not animating (or below threshold)
      lowResOpacity.value = 0;
      highResOpacity.value = 1;
      highResScale.value = 1.0;
    }
  }, [isUpgrading, shouldAnimate]);

  return {
    lowResOpacity,
    highResOpacity,
    highResScale,
    isAnimating: shouldAnimate,
  };
}
