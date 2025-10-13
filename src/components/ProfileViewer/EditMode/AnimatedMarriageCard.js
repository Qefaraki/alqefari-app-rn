import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (deletingState === 'removing') {
      // Phase 1: Quick feedback (0-200ms) - User sees immediate response
      Animated.parallel([
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
      ]).start(() => {
        // Phase 2: Graceful removal (200-500ms)
        Animated.parallel([
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
        ]).start(() => {
          onAnimationComplete?.('removed');
        });
      });
    } else if (deletingState === 'restoring') {
      // Error recovery: Smooth spring animation back (feels natural and forgiving)
      Animated.parallel([
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
      ]).start(() => {
        onAnimationComplete?.('restored');
      });
    }
  }, [deletingState, opacity, scale, height, onAnimationComplete]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ scale }],
        height: height.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 200], // Approximate marriage card height
        }),
        overflow: 'hidden', // Prevent content bleeding during collapse
      }}
    >
      {children}
    </Animated.View>
  );
};

export default AnimatedMarriageCard;
