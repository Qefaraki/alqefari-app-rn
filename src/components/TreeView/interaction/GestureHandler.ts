/**
 * GestureHandler - Tree view gesture management
 *
 * Phase 2 Day 3 - Extracted from TreeView.js (lines 2222-2662)
 *
 * Manages pan, pinch, tap, and long-press gestures for tree interaction.
 * Uses react-native-gesture-handler with Reanimated for smooth animations.
 *
 * Gestures:
 * - Pan: Drag tree with momentum decay
 * - Pinch: Zoom with focal point anchoring
 * - Tap: Node selection (max 250ms, 10px distance)
 * - Long Press: Quick add children (admin only, 500ms duration)
 *
 * Composition:
 * - Pan + Pinch: Simultaneous (with guards to prevent conflicts)
 * - Tap + Long Press: Exclusive (long press cancels tap)
 *
 * Performance:
 * - All gesture logic runs on UI thread (worklet)
 * - React state sync only on gesture end (on-demand)
 * - Animation cancellation prevents value drift
 */

import { Gesture } from 'react-native-gesture-handler';
import { SharedValue, cancelAnimation, withDecay, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import {
  GESTURE_PHYSICS,
  clampVelocity,
  shouldApplyMomentum,
  getZoomSpringConfig,
} from '../utils/constants/gesturePhysics';
import { createDecayModifier } from '../../../utils/cameraConstraints';

// Zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;

// Clamp utility
function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

export interface GestureSharedValues {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  savedTranslateX: SharedValue<number>;
  savedTranslateY: SharedValue<number>;
  savedScale: SharedValue<number>;
  isPinching: SharedValue<boolean>;
  initialFocalX: SharedValue<number>;
  initialFocalY: SharedValue<number>;
}

export interface GestureCallbacks {
  onGestureEnd?: () => void;
  onTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onMomentumStart?: () => void;
  onMomentumEnd?: () => void;
}

export interface GestureConfig {
  minZoom?: number;
  maxZoom?: number;
  decelerationRate?: number;
  tapMaxDuration?: number;
  tapMaxDistance?: number;
  longPressMinDuration?: number;
  longPressMaxDistance?: number;
  viewport?: { width: number; height: number };
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

/**
 * Create pan gesture with momentum decay
 *
 * Handles tree dragging with momentum. Guards against pinch conflicts.
 *
 * @param sharedValues - Reanimated shared values
 * @param callbacks - Gesture callbacks
 * @param config - Gesture configuration
 * @returns Pan gesture object
 */
export function createPanGesture(
  sharedValues: GestureSharedValues,
  callbacks: GestureCallbacks = {},
  config: GestureConfig = {}
) {
  const { translateX, translateY, savedTranslateX, savedTranslateY, isPinching, scale } = sharedValues;
  const decelerationRate = config.decelerationRate ?? GESTURE_PHYSICS.PAN_DECELERATION;

  // Create decay modifier for viewport bounds (prevents edge bouncing)
  const modifier = config.viewport && config.bounds
    ? createDecayModifier(
        config.viewport,
        config.bounds,
        scale.value,
        config.minZoom ?? MIN_ZOOM,
        config.maxZoom ?? MAX_ZOOM
      )
    : undefined;

  return Gesture.Pan()
    .onStart(() => {
      'worklet';
      // Don't start pan if we're pinching
      if (isPinching.value) {
        return;
      }
      console.log('[MOMENTUM] Pan started');
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      // Don't update during pinch
      if (isPinching.value) {
        return;
      }
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd((e) => {
      'worklet';
      // Don't apply momentum if we were pinching
      if (isPinching.value) {
        return;
      }

      // Clamp velocities to prevent jarring ultra-fast flicks
      const clampedVelocityX = GESTURE_PHYSICS.USE_VELOCITY_CLAMPING
        ? clampVelocity(e.velocityX, GESTURE_PHYSICS.PAN_VELOCITY_MAX)
        : e.velocityX;
      const clampedVelocityY = GESTURE_PHYSICS.USE_VELOCITY_CLAMPING
        ? clampVelocity(e.velocityY, GESTURE_PHYSICS.PAN_VELOCITY_MAX)
        : e.velocityY;

      // Check if velocity exceeds threshold (ignore micro-movements)
      if (
        GESTURE_PHYSICS.USE_VELOCITY_THRESHOLD &&
        !shouldApplyMomentum(
          clampedVelocityX,
          clampedVelocityY,
          GESTURE_PHYSICS.PAN_VELOCITY_THRESHOLD
        )
      ) {
        // No momentum, just save position
        console.log('[MOMENTUM] Pan ended (no momentum - below threshold)');
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        if (callbacks.onGestureEnd) {
          runOnJS(callbacks.onGestureEnd)();
        }
        return;
      }

      console.log(`[MOMENTUM] Pan ended - applying momentum (vX: ${clampedVelocityX.toFixed(0)}, vY: ${clampedVelocityY.toFixed(0)})`);

      // Signal momentum start (for prefetch deferral)
      if (callbacks.onMomentumStart) {
        runOnJS(callbacks.onMomentumStart)();
      }

      // Apply momentum with iOS-native physics + bounds modifier
      translateX.value = withDecay(
        {
          velocity: clampedVelocityX,
          deceleration: decelerationRate,
          modifier: modifier ? (value) => modifier(value, 'x') : undefined,
        },
        () => {
          // Sync React state when decay animation completes
          console.log('[MOMENTUM] Momentum coast completed');
          if (callbacks.onMomentumEnd) {
            runOnJS(callbacks.onMomentumEnd)();
          }
          if (callbacks.onGestureEnd) {
            runOnJS(callbacks.onGestureEnd)();
          }
        }
      );
      translateY.value = withDecay({
        velocity: clampedVelocityY,
        deceleration: decelerationRate,
        modifier: modifier ? (value) => modifier(value, 'y') : undefined,
      });

      // Save current values (before decay animation modifies them)
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });
}

/**
 * Create pinch gesture with focal point anchoring
 *
 * Handles zoom with focal point anchoring. Also handles pan during pinch
 * on physical iOS devices (two-finger drag).
 *
 * Formula:
 * - World coordinates: worldX = (focalX - translateX) / scale
 * - After zoom: translateX = focalX - worldX * newScale
 *
 * @param sharedValues - Reanimated shared values
 * @param callbacks - Gesture callbacks
 * @param config - Gesture configuration
 * @returns Pinch gesture object
 */
export function createPinchGesture(
  sharedValues: GestureSharedValues,
  callbacks: GestureCallbacks = {},
  config: GestureConfig = {}
) {
  const {
    translateX,
    translateY,
    scale,
    savedTranslateX,
    savedTranslateY,
    savedScale,
    isPinching,
    initialFocalX,
    initialFocalY,
  } = sharedValues;
  const minZoom = config.minZoom ?? MIN_ZOOM;
  const maxZoom = config.maxZoom ?? MAX_ZOOM;

  return Gesture.Pinch()
    .onStart((e) => {
      'worklet';
      // Only process with two fingers
      if (e.numberOfPointers === 2) {
        isPinching.value = true;
        // CRITICAL: Cancel any running animations to prevent value drift
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(scale);

        // Save the current stable values
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;

        // Store INITIAL focal point for anchoring zoom
        initialFocalX.value = e.focalX;
        initialFocalY.value = e.focalY;
      }
    })
    .onUpdate((e) => {
      'worklet';

      // Only process updates with two fingers
      if (e.numberOfPointers !== 2) {
        return;
      }

      // Calculate new scale (allow over-zoom during gesture for iOS-native bounce)
      const newScale = savedScale.value * e.scale;

      // CRITICAL FIX: Track how much the focal point has moved (pan component)
      const focalDeltaX = e.focalX - initialFocalX.value;
      const focalDeltaY = e.focalY - initialFocalY.value;

      // Convert INITIAL focal point to world coordinates (not the moving one!)
      const worldX = (initialFocalX.value - savedTranslateX.value) / savedScale.value;
      const worldY = (initialFocalY.value - savedTranslateY.value) / savedScale.value;

      // Apply zoom around initial focal point, then add the pan from finger movement
      translateX.value = initialFocalX.value - worldX * newScale + focalDeltaX;
      translateY.value = initialFocalY.value - worldY * newScale + focalDeltaY;
      scale.value = newScale;
    })
    .onEnd(() => {
      'worklet';
      console.log(`[GestureHandler] Pinch onEnd: scale=${scale.value.toFixed(2)}`);

      // Spring back if over-zoomed (iOS-native bounce feel)
      if (GESTURE_PHYSICS.USE_ZOOM_SPRING) {
        const isOverZoom = scale.value > maxZoom || scale.value < minZoom;
        if (isOverZoom) {
          const targetScale = scale.value > maxZoom ? maxZoom : minZoom;
          console.log(`[GestureHandler] Over-zoom detected, springing to ${targetScale}`);

          // CRITICAL: Preserve focal point during spring bounce
          // Store the focal point from last update (where user's fingers were)
          const currentFocalX = initialFocalX.value;
          const currentFocalY = initialFocalY.value;

          // Calculate world coordinates at current (over-zoomed) scale
          const worldX = (currentFocalX - translateX.value) / scale.value;
          const worldY = (currentFocalY - translateY.value) / scale.value;

          // Calculate target translation to preserve focal point at target scale
          const targetTranslateX = currentFocalX - worldX * targetScale;
          const targetTranslateY = currentFocalY - worldY * targetScale;

          // Spring scale AND translation simultaneously to preserve focal point
          scale.value = withSpring(
            targetScale,
            getZoomSpringConfig(),
            (finished) => {
              'worklet';
              if (finished) {
                // Only cancel animations if spring completed naturally
                cancelAnimation(translateX);
                cancelAnimation(translateY);
              }
            }
          );

          translateX.value = withSpring(targetTranslateX, getZoomSpringConfig());
          translateY.value = withSpring(targetTranslateY, getZoomSpringConfig());

          // CRITICAL: Save immediately (not in callback) to prevent stale values if interrupted
          savedScale.value = targetScale;
          savedTranslateX.value = targetTranslateX;
          savedTranslateY.value = targetTranslateY;
        } else {
          // No over-zoom, just save current values
          savedScale.value = scale.value;
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }
      } else {
        // Feature flag disabled, save current values
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }

      isPinching.value = false;

      // Sync React state after pinch completes
      if (callbacks.onGestureEnd) {
        console.log('[GestureHandler] Calling onGestureEnd callback');
        runOnJS(callbacks.onGestureEnd)();
      }
    });
}

/**
 * Create tap gesture for node selection
 *
 * Detects quick taps with movement/duration thresholds.
 *
 * @param callbacks - Gesture callbacks
 * @param config - Gesture configuration
 * @returns Tap gesture object
 */
export function createTapGesture(
  callbacks: GestureCallbacks = {},
  config: GestureConfig = {}
) {
  const maxDistance = config.tapMaxDistance ?? GESTURE_PHYSICS.TAP_MAX_DISTANCE;
  const maxDuration = config.tapMaxDuration ?? GESTURE_PHYSICS.TAP_MAX_DURATION;

  return Gesture.Tap()
    .maxDistance(maxDistance)
    .maxDuration(maxDuration)
    .runOnJS(true)
    .onEnd((e) => {
      if (callbacks.onTap) {
        callbacks.onTap(e.x, e.y);
      }
    });
}

/**
 * Create long press gesture for quick actions
 *
 * Detects long press with duration/distance thresholds.
 * Typically used for admin quick-add functionality.
 *
 * @param callbacks - Gesture callbacks
 * @param config - Gesture configuration
 * @returns Long press gesture object
 */
export function createLongPressGesture(
  callbacks: GestureCallbacks = {},
  config: GestureConfig = {}
) {
  const minDuration = config.longPressMinDuration ?? GESTURE_PHYSICS.LONG_PRESS_MIN_DURATION;
  const maxDistance = config.longPressMaxDistance ?? GESTURE_PHYSICS.LONG_PRESS_MAX_DISTANCE;

  return Gesture.LongPress()
    .minDuration(minDuration)
    .maxDistance(maxDistance)
    .runOnJS(true)
    .onStart((e) => {
      if (callbacks.onLongPress) {
        callbacks.onLongPress(e.x, e.y);
      }
    });
}

/**
 * Compose all gestures into a single gesture handler
 *
 * Composition strategy:
 * - Pan + Pinch: Simultaneous (with guards in each gesture)
 * - Tap + Long Press: Exclusive (long press cancels tap)
 *
 * @param sharedValues - Reanimated shared values
 * @param callbacks - Gesture callbacks
 * @param config - Gesture configuration
 * @returns Composed gesture object
 */
export function createComposedGesture(
  sharedValues: GestureSharedValues,
  callbacks: GestureCallbacks = {},
  config: GestureConfig = {}
) {
  const panGesture = createPanGesture(sharedValues, callbacks, config);
  const pinchGesture = createPinchGesture(sharedValues, callbacks, config);
  const tapGesture = createTapGesture(callbacks, config);
  const longPressGesture = createLongPressGesture(callbacks, config);

  // Compose gestures - allow simultaneous pan/pinch, exclusive tap/longPress
  return Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    Gesture.Exclusive(longPressGesture, tapGesture)
  );
}

// Export constants for testing
export const GESTURE_CONSTANTS = {
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_DECELERATION: GESTURE_PHYSICS.PAN_DECELERATION,
  DEFAULT_TAP_MAX_DURATION: GESTURE_PHYSICS.TAP_MAX_DURATION,
  DEFAULT_TAP_MAX_DISTANCE: GESTURE_PHYSICS.TAP_MAX_DISTANCE,
  DEFAULT_LONG_PRESS_MIN_DURATION: GESTURE_PHYSICS.LONG_PRESS_MIN_DURATION,
  DEFAULT_LONG_PRESS_MAX_DISTANCE: GESTURE_PHYSICS.LONG_PRESS_MAX_DISTANCE,
};
