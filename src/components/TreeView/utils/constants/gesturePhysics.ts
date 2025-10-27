/**
 * Gesture Physics Constants
 *
 * iOS-calibrated physics values for native gesture feel.
 * Benchmarked against iOS Photos app (October 2025).
 *
 * Phase 1: Core momentum physics (deceleration, velocity clamping, zoom spring)
 * Phase 2: Boundary rubber-banding (deferred)
 *
 * @module gesturePhysics
 * @see /docs/architecture/GESTURE_SYSTEM.md
 */

/**
 * Pan deceleration rate (iOS UIScrollView default)
 *
 * Controls momentum coast-out time:
 * - 0.995 (old): 3-5 seconds coast
 * - 0.998 (new): 1-2 seconds coast (matches iOS native)
 *
 * Formula: velocity(t) = v₀ × λ^t where λ is deceleration rate
 * Lower values = faster stopping
 *
 * @constant
 * @type {number}
 * @default 0.998
 * @see https://developer.apple.com/documentation/uikit/uiscrollview/1619438-decelerationrate
 */
export const PAN_DECELERATION = 0.998;

/**
 * Maximum pan velocity (points per second)
 *
 * Clamps gesture velocity to prevent jarring ultra-fast flicks.
 * iOS native gestures typically max out around 2000-2500 pts/sec.
 *
 * @constant
 * @type {number}
 * @default 2000
 */
export const PAN_VELOCITY_MAX = 2000;

/**
 * Minimum velocity threshold (points per second)
 *
 * Velocities below this threshold don't trigger momentum animation.
 * Prevents annoying micro-coasts from tiny movements.
 *
 * iOS native threshold is ~20-30 pts/sec.
 *
 * @constant
 * @type {number}
 * @default 30
 */
export const PAN_VELOCITY_THRESHOLD = 30;

/**
 * Zoom spring animation damping
 *
 * Controls how quickly zoom spring settles when over max/min limits.
 * Lower values = more oscillation/bounce
 * Higher values = faster settling, less bounce
 *
 * iOS-calibrated value for smooth, natural bounce.
 *
 * @constant
 * @type {number}
 * @default 0.7
 */
export const ZOOM_SPRING_DAMPING = 0.7;

/**
 * Zoom spring animation stiffness
 *
 * Controls how "tight" or responsive the spring feels.
 * Higher values = faster, snappier response
 * Lower values = slower, more elastic feel
 *
 * @constant
 * @type {number}
 * @default 100
 */
export const ZOOM_SPRING_STIFFNESS = 100;

/**
 * Zoom spring animation mass
 *
 * Simulates the "weight" of the object being animated.
 * Higher values = heavier feel, slower movement
 * Lower values = lighter feel, faster movement
 *
 * @constant
 * @type {number}
 * @default 0.5
 */
export const ZOOM_SPRING_MASS = 0.5;

/**
 * Maximum tap gesture duration (milliseconds)
 *
 * Taps longer than this are ignored.
 * iOS default is ~200-300ms.
 *
 * @constant
 * @type {number}
 * @default 250
 */
export const TAP_MAX_DURATION = 250;

/**
 * Maximum tap gesture movement distance (pixels)
 *
 * Taps that move more than this distance are treated as drags.
 * iOS default is ~10px.
 *
 * @constant
 * @type {number}
 * @default 10
 */
export const TAP_MAX_DISTANCE = 10;

/**
 * Minimum long press gesture duration (milliseconds)
 *
 * User must hold for at least this long to trigger long press.
 * iOS default is 500ms.
 *
 * @constant
 * @type {number}
 * @default 500
 */
export const LONG_PRESS_MIN_DURATION = 500;

/**
 * Maximum long press movement distance (pixels)
 *
 * Long press is cancelled if finger moves more than this distance.
 *
 * @constant
 * @type {number}
 * @default 10
 */
export const LONG_PRESS_MAX_DISTANCE = 10;

/**
 * Feature flags for gesture physics
 *
 * Allows selective enable/disable of physics features for testing.
 */
export const GESTURE_FEATURE_FLAGS = {
  /** Enable velocity clamping to prevent jarring flicks */
  USE_VELOCITY_CLAMPING: true,

  /** Enable velocity threshold to ignore micro-movements */
  USE_VELOCITY_THRESHOLD: true,

  /** Enable zoom spring bounce when over max/min limits */
  USE_ZOOM_SPRING: true,

  /** Phase 2: Enable boundary rubber-banding (not yet implemented) */
  USE_BOUNDARY_RUBBER_BAND: false,
} as const;

/**
 * Complete gesture physics configuration object
 *
 * Consolidates all physics constants for easy import.
 */
export const GESTURE_PHYSICS = {
  // Pan momentum
  PAN_DECELERATION,
  PAN_VELOCITY_MAX,
  PAN_VELOCITY_THRESHOLD,

  // Zoom momentum
  ZOOM_SPRING_DAMPING,
  ZOOM_SPRING_STIFFNESS,
  ZOOM_SPRING_MASS,

  // Gesture thresholds
  TAP_MAX_DURATION,
  TAP_MAX_DISTANCE,
  LONG_PRESS_MIN_DURATION,
  LONG_PRESS_MAX_DISTANCE,

  // Feature flags
  ...GESTURE_FEATURE_FLAGS,
} as const;

/**
 * Clamp velocity to maximum allowed value
 *
 * Prevents jarring ultra-fast flicks by limiting velocity magnitude
 * while preserving direction.
 *
 * @param velocity - Raw velocity from gesture event (can be positive or negative)
 * @param max - Maximum allowed velocity magnitude
 * @returns Clamped velocity with original sign preserved
 *
 * @example
 * clampVelocity(3000, 2000) // Returns 2000
 * clampVelocity(-3000, 2000) // Returns -2000
 * clampVelocity(1500, 2000) // Returns 1500 (unchanged)
 *
 * @worklet
 */
export function clampVelocity(velocity: number, max: number): number {
  'worklet';
  return Math.max(-max, Math.min(max, velocity));
}

/**
 * Check if velocity is above threshold for momentum animation
 *
 * Prevents annoying micro-coasts from tiny finger movements.
 * Returns true if either X or Y velocity exceeds threshold.
 *
 * @param velocityX - Horizontal velocity (points per second)
 * @param velocityY - Vertical velocity (points per second)
 * @param threshold - Minimum velocity to trigger momentum
 * @returns True if momentum should be applied, false otherwise
 *
 * @example
 * shouldApplyMomentum(500, 0, 30) // Returns true (X exceeds threshold)
 * shouldApplyMomentum(0, 500, 30) // Returns true (Y exceeds threshold)
 * shouldApplyMomentum(20, 10, 30) // Returns false (both below threshold)
 *
 * @worklet
 */
export function shouldApplyMomentum(
  velocityX: number,
  velocityY: number,
  threshold: number
): boolean {
  'worklet';
  return Math.abs(velocityX) > threshold || Math.abs(velocityY) > threshold;
}

/**
 * Get spring configuration for zoom animations
 *
 * Returns the iOS-calibrated spring config for smooth zoom bounce.
 * Separated into a function for easy override/customization.
 *
 * @returns Spring configuration object for react-native-reanimated withSpring
 *
 * @example
 * scale.value = withSpring(targetScale, getZoomSpringConfig())
 */
export function getZoomSpringConfig() {
  'worklet';
  return {
    damping: ZOOM_SPRING_DAMPING,
    stiffness: ZOOM_SPRING_STIFFNESS,
    mass: ZOOM_SPRING_MASS,
  };
}

/**
 * Legacy constants for backwards compatibility
 *
 * These match the old constants from performance.ts
 * Kept for gradual migration - will be removed in future version.
 *
 * @deprecated Use GESTURE_PHYSICS instead
 */
export const LEGACY_GESTURE_CONSTANTS = {
  GESTURE_DECELERATION: PAN_DECELERATION,
  GESTURE_ACTIVE_OFFSET: 5, // Not used in new implementation
} as const;
