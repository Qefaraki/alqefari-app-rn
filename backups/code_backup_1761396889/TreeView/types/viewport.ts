/**
 * Viewport and camera type definitions for TreeView
 * Phase 1 Day 3 - Type system
 */

/**
 * 2D point in canvas space
 */
export interface Point {
  /** X coordinate */
  x: number;

  /** Y coordinate */
  y: number;
}

/**
 * Rectangular bounds in canvas space
 * Used for collision detection and viewport culling
 */
export interface Rect {
  /** X coordinate of top-left corner */
  x: number;

  /** Y coordinate of top-left corner */
  y: number;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;
}

/**
 * Min/max bounds for tree layout
 * Used to calculate tree dimensions and center point
 */
export interface Bounds {
  /** Minimum X coordinate */
  minX: number;

  /** Maximum X coordinate */
  maxX: number;

  /** Minimum Y coordinate */
  minY: number;

  /** Maximum Y coordinate */
  maxY: number;
}

/**
 * Camera state for viewport navigation
 * Represents the current view into the tree canvas
 */
export interface Camera {
  /** X translation offset (pixels) */
  translateX: number;

  /** Y translation offset (pixels) */
  translateY: number;

  /** Zoom scale factor (0.5-3.0) */
  scale: number;

  /** Whether camera is currently animating */
  isAnimating: boolean;

  /** Target position for smooth animations */
  targetX?: number;

  /** Target position for smooth animations */
  targetY?: number;

  /** Target scale for smooth zoom animations */
  targetScale?: number;
}

/**
 * 2D transformation matrix
 * Used for gesture handling and coordinate conversion
 */
export interface Transform {
  /** X translation in pixels */
  translateX: number;

  /** Y translation in pixels */
  translateY: number;

  /** Scale factor (zoom level) */
  scale: number;

  /** Rotation in radians (reserved for future use) */
  rotation: number;
}

/**
 * Viewport dimensions and device info
 * Used for responsive layout and culling calculations
 */
export interface Viewport {
  /** Screen width in pixels */
  width: number;

  /** Screen height in pixels */
  height: number;

  /** Device pixel ratio (for high-DPI screens) */
  pixelRatio: number;

  /** Safe area insets (iOS notch, home indicator) */
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Visible bounds in canvas space
 * Calculated from camera + viewport for culling
 */
export interface VisibleBounds {
  /** Left edge X coordinate */
  left: number;

  /** Right edge X coordinate */
  right: number;

  /** Top edge Y coordinate */
  top: number;

  /** Bottom edge Y coordinate */
  bottom: number;

  /** Bounds width (right - left) */
  width: number;

  /** Bounds height (bottom - top) */
  height: number;
}

/**
 * Gesture state for pan/pinch handling
 * Used by react-native-gesture-handler
 */
export interface GestureState {
  /** Whether gesture is currently active */
  isActive: boolean;

  /** X velocity in pixels/second */
  velocityX: number;

  /** Y velocity in pixels/second */
  velocityY: number;

  /** Pinch scale velocity */
  scaleVelocity: number;

  /** Accumulated X translation */
  translationX: number;

  /** Accumulated Y translation */
  translationY: number;

  /** Pinch scale factor */
  scale: number;

  /** Focal point X (for pinch zoom) */
  focalX: number;

  /** Focal point Y (for pinch zoom) */
  focalY: number;
}
