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

  // Debug logging
  const logRef = useRef<{ lastScale?: number; lastIsUpgrading?: boolean }>({});

  useEffect(() => {
    // Log scale changes
    if (logRef.current.lastScale !== scale) {
      console.log(
        `[PhotoMorph] Scale changed: ${logRef.current.lastScale?.toFixed(1) || 'init'} → ${scale.toFixed(1)} (threshold: 3.0, meets threshold: ${scale >= 3.0})`
      );
      logRef.current.lastScale = scale;
    }

    // Log upgrade changes
    if (logRef.current.lastIsUpgrading !== isUpgrading) {
      console.log(
        `[PhotoMorph] Upgrade flag: ${logRef.current.lastIsUpgrading} → ${isUpgrading}`
      );
      logRef.current.lastIsUpgrading = isUpgrading;
    }

    // Log animation decision
    if (shouldAnimate) {
      console.log(
        `[PhotoMorph] 🎬 ANIMATION TRIGGERED: scale=${scale.toFixed(1)}, isUpgrading=${isUpgrading}, shouldAnimateBlur=${shouldAnimateBlur}`
      );
    }
  }, [scale, isUpgrading, shouldAnimate]);

  useEffect(() => {
    if (shouldAnimate) {
      console.log(`[PhotoMorph] Starting 250ms crossfade + pop animation...`);
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
      console.log(
        `[PhotoMorph] Instant swap (not animating): scale=${scale.toFixed(1)}, isUpgrading=${isUpgrading}`
      );
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
