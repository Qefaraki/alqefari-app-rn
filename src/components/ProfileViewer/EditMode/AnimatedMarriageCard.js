import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';

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
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(1)).current;
  const measuredHeightRef = useRef(400); // Cached height measurement (no re-renders)

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

  useEffect(() => {
    // Track mount state to prevent callbacks after unmount
    let isMounted = true;
    let currentAnimation = null;

    if (deletingState === 'removing') {
      // Phase 1: Quick feedback (0-200ms) - User sees immediate response
      const phaseOne = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      currentAnimation = phaseOne;

      phaseOne.start(({ finished }) => {
        if (!isMounted || !finished) return;

        // Phase 2: Graceful removal (200-500ms)
        const phaseTwo = Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.95,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(height, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: false, // Height can't use native driver
          }),
        ]);

        currentAnimation = phaseTwo;

        phaseTwo.start(({ finished }) => {
          if (!isMounted || !finished) return;
          onAnimationComplete?.('removed');
        });
      });
    } else if (deletingState === 'restoring') {
      // Error recovery: Smooth spring animation back (feels natural and forgiving)
      const restore = Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(height, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: false,
        }),
      ]);

      currentAnimation = restore;

      restore.start(({ finished }) => {
        if (!isMounted || !finished) return;
        onAnimationComplete?.('restored');
      });
    }

    // Cleanup: Stop animations and prevent callbacks after unmount
    return () => {
      isMounted = false;
      if (currentAnimation) {
        currentAnimation.stop();
      }
    };
  }, [deletingState, opacity, scale, height, onAnimationComplete]);

  // Only constrain height during animations, not in normal editing state
  const animatedStyle = {
    opacity,
    transform: [{ scale }],
  };

  // Only apply height animation when actively deleting/restoring
  if (deletingState === 'removing' || deletingState === 'restoring') {
    animatedStyle.height = height.interpolate({
      inputRange: [0, 1],
      outputRange: [0, measuredHeightRef.current], // Use cached height (no re-renders)
    });
    animatedStyle.overflow = 'hidden';
  }

  return (
    <Animated.View style={animatedStyle} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
};

export default AnimatedMarriageCard;
