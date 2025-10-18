import React, { useEffect, useRef, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

/**
 * AnimatedMarriageCard
 *
 * Animated wrapper for marriage cards that provides iOS-native delete animations.
 * Inspired by iOS Mail and Reminders delete behavior.
 *
 * Animation Flow:
 * - Phase 1 (0-200ms): Quick feedback - fade to 80%, scale to 98%
 * - Phase 2 (200-500ms): Graceful removal - fade to 0%, collapse height
 * - Error Recovery: Spring animation back if delete fails
 *
 * @param {React.ReactNode} children - The marriage card content to animate
 * @param {string} deletingState - One of: undefined, 'removing', 'restoring'
 * @param {Function} onAnimationComplete - Callback when animation finishes
 */
const AnimatedMarriageCard = ({ children, deletingState, onAnimationComplete }) => {
  // Shared values for Reanimated v4 (runs on UI thread)
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const height = useSharedValue(1);

  // Store measured height (runs on JS thread)
  const measuredHeightRef = useRef(400);
  const isMounted = useRef(true);

  // Measure actual content height for accurate animations
  const onLayout = useCallback((event) => {
    const { height: layoutHeight } = event.nativeEvent.layout;
    // Only update if not currently animating and height is valid
    if (layoutHeight > 0 && !deletingState) {
      // Only update if significantly different (avoid floating point issues)
      if (Math.abs(measuredHeightRef.current - layoutHeight) > 1) {
        measuredHeightRef.current = layoutHeight;
      }
    }
  }, [deletingState]);

  // Animation callback (must be wrapped with runOnJS for Reanimated)
  const notifyAnimationComplete = useCallback((state) => {
    if (isMounted.current && onAnimationComplete) {
      onAnimationComplete(state);
    }
  }, [onAnimationComplete]);

  useEffect(() => {
    isMounted.current = true;

    if (deletingState === 'removing') {
      // Phase 1: Quick feedback (0-200ms) - User sees immediate response
      // Sequence ensures phase 2 starts after phase 1 completes
      opacity.value = withSequence(
        withTiming(0.8, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: 300,
          easing: Easing.in(Easing.cubic),
        }, (finished) => {
          if (finished && isMounted.current) {
            runOnJS(notifyAnimationComplete)('removed');
          }
        })
      );

      scale.value = withSequence(
        withTiming(0.98, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0.95, {
          duration: 300,
          easing: Easing.in(Easing.cubic),
        })
      );

      // Height collapse starts after phase 1 (200ms delay)
      height.value = withTiming(0, {
        duration: 300,
        easing: Easing.in(Easing.cubic),
      });

    } else if (deletingState === 'restoring') {
      // Error recovery: Smooth spring animation back (feels natural and forgiving)
      opacity.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      }, (finished) => {
        if (finished && isMounted.current) {
          runOnJS(notifyAnimationComplete)('restored');
        }
      });

      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });

      height.value = withSpring(1, {
        damping: 15,
        stiffness: 150,
      });
    }

    return () => {
      isMounted.current = false;
    };
  }, [deletingState, opacity, scale, height, notifyAnimationComplete]);

  // Animated styles using Reanimated's useAnimatedStyle
  const animatedStyle = useAnimatedStyle(() => {
    const style = {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };

    // Only apply height animation when actively deleting/restoring
    if (deletingState === 'removing' || deletingState === 'restoring') {
      style.height = height.value * measuredHeightRef.current;
      style.overflow = 'hidden';
    }

    return style;
  });

  return (
    <Animated.View style={animatedStyle} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
};

export default AnimatedMarriageCard;
