/**
 * Performance and animation constants
 * Phase 1 Day 2 - Constants extraction
 */

// Animation Durations (ms)
export const ANIMATION_DURATION_SHORT = 200;
export const ANIMATION_DURATION_MEDIUM = 400;
export const ANIMATION_DURATION_LONG = 600;

// Gesture Thresholds
export const GESTURE_ACTIVE_OFFSET = 5; // px before gesture activation
export const GESTURE_DECELERATION = 0.998; // iOS default deceleration rate
export const GESTURE_RUBBER_BAND_FACTOR = 0.6; // Resistance at boundaries

// Zoom Limits
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.0;
export const DEFAULT_ZOOM = 1.0;
