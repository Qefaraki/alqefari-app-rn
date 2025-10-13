import React, { useEffect, useRef, useState } from 'react';
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
  const [measuredHeight, setMeasuredHeight] = useState(400); // Default fallback

  // Measure actual content height for accurate animations
  const onLayout = (event) => {
    const { height: layoutHeight } = event.nativeEvent.layout;
    // Only update if not currently animating and height is valid
    if (layoutHeight > 0 && !deletingState) {
      setMeasuredHeight(layoutHeight);
    }
  };

  useEffect(() => {
    // Track animations for cleanup
    let phaseOneAnimations = null;
    let phaseTwoAnimations = null;
    let restoringAnimations = null;

    if (deletingState === 'removing') {
      // Phase 1: Quick feedback (0-200ms) - User sees immediate response
      phaseOneAnimations = Animated.parallel([
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

      phaseOneAnimations.start(() => {
        // Phase 2: Graceful removal (200-500ms)
        phaseTwoAnimations = Animated.parallel([
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

        phaseTwoAnimations.start(() => {
          onAnimationComplete?.('removed');
        });
      });
    } else if (deletingState === 'restoring') {
      // Error recovery: Smooth spring animation back (feels natural and forgiving)
      restoringAnimations = Animated.parallel([
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

      restoringAnimations.start(() => {
        onAnimationComplete?.('restored');
      });
    }

    // Cleanup: Stop all animations if component unmounts or state changes
    return () => {
      if (phaseOneAnimations) {
        phaseOneAnimations.stop();
      }
      if (phaseTwoAnimations) {
        phaseTwoAnimations.stop();
      }
      if (restoringAnimations) {
        restoringAnimations.stop();
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
      outputRange: [0, measuredHeight], // Use actual measured height for smooth animations
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
