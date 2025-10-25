/**
 * CameraController - Viewport transformation and navigation
 *
 * Phase 2 Day 3 - Extracted from TreeView.js (lines 1397-1419, 1705-1819)
 *
 * Manages camera state (pan, zoom, bounds) and navigation to specific nodes.
 * Handles coordinate transformation between canvas space and screen space.
 *
 * Key Responsibilities:
 * - Sync Reanimated shared values → React state
 * - Calculate visible viewport bounds with dynamic margins
 * - Animate camera to center on specific nodes
 * - Handle navigation cancellation for rapid interactions
 *
 * Coordinate System:
 * - Canvas Space: Node positions (x, y) in layout
 * - Screen Space: Transformed positions after pan/zoom
 * - Formula: screenX = canvasX * scale + translateX
 *
 * Bounds Calculation:
 * - Dynamic margins scale inversely with zoom (constant screen pixels)
 * - Viewport culling uses expanded bounds for smooth scrolling
 *
 * Animation:
 * - Spring animation for pan (damping: 20, stiffness: 90, mass: 1)
 * - Timing animation for zoom (duration: 600ms, cubic easing)
 * - Navigation ID tracking prevents stale callbacks
 */

import { SharedValue, cancelAnimation, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Easing } from 'react-native';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  name: string;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CameraSharedValues {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  savedTranslateX: SharedValue<number>;
  savedTranslateY: SharedValue<number>;
  savedScale: SharedValue<number>;
}

export interface CameraCallbacks {
  onTransformUpdate?: (transform: Transform) => void;
  onBoundsUpdate?: (bounds: Bounds) => void;
  onNavigationComplete?: () => void;
}

export interface NavigationConfig {
  springDamping?: number;
  springStiffness?: number;
  springMass?: number;
  zoomDuration?: number;
  zoomEasing?: (value: number) => number;
  minAutoZoom?: number;
  maxAutoZoom?: number;
  defaultZoom?: number;
}

// Viewport margins (constant screen pixels)
const DEFAULT_MARGIN_X = 100;
const DEFAULT_MARGIN_Y = 100;

/**
 * Calculate visible viewport bounds
 *
 * Transforms screen viewport to canvas bounds with dynamic margins.
 * Margins scale inversely with zoom to maintain constant screen pixels.
 *
 * Formula:
 * - Canvas bounds = (screen bounds - translate) / scale
 * - Dynamic margin = fixed screen pixels / scale
 *
 * @param transform - Current camera transform
 * @param viewport - Screen dimensions
 * @param marginX - Horizontal margin in screen pixels
 * @param marginY - Vertical margin in screen pixels
 * @returns Visible bounds in canvas space
 */
export function calculateVisibleBounds(
  transform: Transform,
  viewport: Viewport,
  marginX: number = DEFAULT_MARGIN_X,
  marginY: number = DEFAULT_MARGIN_Y
): Bounds {
  // Dynamic margins scale inversely with zoom
  const dynamicMarginX = marginX / transform.scale;
  const dynamicMarginY = marginY / transform.scale;

  return {
    minX: (-transform.x - dynamicMarginX) / transform.scale,
    maxX: (-transform.x + viewport.width + dynamicMarginX) / transform.scale,
    minY: (-transform.y - dynamicMarginY) / transform.scale,
    maxY: (-transform.y + viewport.height + dynamicMarginY) / transform.scale,
  };
}

/**
 * Calculate target transform to center node on screen
 *
 * Given a node's canvas position, calculates the camera transform
 * needed to center it on screen at the specified zoom level.
 *
 * Formula:
 * - To center: nodeX * scale + translateX = viewport.width / 2
 * - Therefore: translateX = viewport.width / 2 - nodeX * scale
 *
 * @param node - Target node with canvas coordinates
 * @param viewport - Screen dimensions
 * @param targetScale - Desired zoom level
 * @returns Target camera transform
 */
export function calculateCenterTransform(
  node: LayoutNode,
  viewport: Viewport,
  targetScale: number
): Transform {
  return {
    x: viewport.width / 2 - node.x * targetScale,
    y: viewport.height / 2 - node.y * targetScale,
    scale: targetScale,
  };
}

/**
 * Determine target zoom level for navigation
 *
 * If current zoom is reasonable (within bounds), keep it.
 * Otherwise, zoom to default readable level.
 *
 * @param currentScale - Current zoom level
 * @param config - Navigation configuration
 * @returns Target zoom level
 */
export function determineTargetZoom(
  currentScale: number,
  config: NavigationConfig = {}
): number {
  const {
    minAutoZoom = 0.8,
    maxAutoZoom = 3.0,
    defaultZoom = 1.5,
  } = config;

  // If current zoom is reasonable, keep it
  if (currentScale >= minAutoZoom && currentScale <= maxAutoZoom) {
    return currentScale;
  }

  // Otherwise, zoom to default readable level
  return defaultZoom;
}

/**
 * Sync camera state from Reanimated shared values to React state
 *
 * Reads current transform from shared values and triggers callbacks
 * with updated transform and bounds.
 *
 * @param sharedValues - Reanimated shared values
 * @param viewport - Screen dimensions
 * @param callbacks - State update callbacks
 * @param marginX - Horizontal margin in screen pixels
 * @param marginY - Vertical margin in screen pixels
 */
export function syncCameraState(
  sharedValues: CameraSharedValues,
  viewport: Viewport,
  callbacks: CameraCallbacks,
  marginX: number = DEFAULT_MARGIN_X,
  marginY: number = DEFAULT_MARGIN_Y
): void {
  'worklet';
  const transform: Transform = {
    x: sharedValues.translateX.value,
    y: sharedValues.translateY.value,
    scale: sharedValues.scale.value,
  };

  // Calculate visible bounds
  const bounds = calculateVisibleBounds(transform, viewport, marginX, marginY);

  // Trigger callbacks (must be wrapped with runOnJS if called from worklet)
  if (callbacks.onTransformUpdate) {
    callbacks.onTransformUpdate(transform);
  }

  if (callbacks.onBoundsUpdate) {
    callbacks.onBoundsUpdate(bounds);
  }
}

/**
 * Navigate camera to center on specific node
 *
 * Animates camera transform to center the target node on screen.
 * Uses spring animation for pan and timing for zoom.
 *
 * Features:
 * - Navigation ID tracking prevents stale callbacks
 * - Immediate state update makes nodes visible during animation
 * - Cancels any ongoing animations before starting
 * - Syncs state after spring completes (~840ms)
 *
 * @param node - Target node to center on
 * @param sharedValues - Reanimated shared values
 * @param viewport - Screen dimensions
 * @param callbacks - State update callbacks
 * @param config - Navigation configuration
 * @param navigationIdRef - Ref to track navigation ID (prevents stale callbacks)
 * @param marginX - Horizontal margin in screen pixels
 * @param marginY - Vertical margin in screen pixels
 */
export function navigateToNode(
  node: LayoutNode,
  sharedValues: CameraSharedValues,
  viewport: Viewport,
  callbacks: CameraCallbacks,
  config: NavigationConfig = {},
  navigationIdRef?: { current: number | null },
  marginX: number = DEFAULT_MARGIN_X,
  marginY: number = DEFAULT_MARGIN_Y
): void {
  'worklet';
  const {
    springDamping = 20,
    springStiffness = 90,
    springMass = 1,
    zoomDuration = 600,
    zoomEasing = Easing.inOut(Easing.cubic),
  } = config;

  // Determine target zoom level
  const currentScale = sharedValues.scale.value;
  const targetScale = determineTargetZoom(currentScale, config);

  // Calculate target transform
  const targetTransform = calculateCenterTransform(node, viewport, targetScale);

  // Cancel any ongoing animations
  cancelAnimation(sharedValues.translateX);
  cancelAnimation(sharedValues.translateY);
  cancelAnimation(sharedValues.scale);

  // Track navigation ID to prevent stale callbacks
  const navigationId = Date.now();
  if (navigationIdRef) {
    navigationIdRef.current = navigationId;
  }

  // Immediately update React state with target transform
  // This makes nodes visible during animation flight
  const targetBounds = calculateVisibleBounds(
    targetTransform,
    viewport,
    marginX,
    marginY
  );

  if (callbacks.onTransformUpdate) {
    runOnJS(callbacks.onTransformUpdate)(targetTransform);
  }

  if (callbacks.onBoundsUpdate) {
    runOnJS(callbacks.onBoundsUpdate)(targetBounds);
  }

  // Spring animation for pan (smoother deceleration)
  sharedValues.translateX.value = withSpring(
    targetTransform.x,
    {
      damping: springDamping,
      stiffness: springStiffness,
      mass: springMass,
    },
    (finished) => {
      // Only sync if this navigation wasn't cancelled by a newer one
      if (finished && (!navigationIdRef || navigationIdRef.current === navigationId)) {
        // Final sync after animation completes
        syncCameraState(sharedValues, viewport, callbacks, marginX, marginY);

        if (callbacks.onNavigationComplete) {
          runOnJS(callbacks.onNavigationComplete)();
        }
      }
    }
  );

  sharedValues.translateY.value = withSpring(targetTransform.y, {
    damping: springDamping,
    stiffness: springStiffness,
    mass: springMass,
  });

  // Timing animation for zoom (more predictable)
  sharedValues.scale.value = withTiming(targetTransform.scale, {
    duration: zoomDuration,
    easing: zoomEasing,
  });

  // Update saved values
  sharedValues.savedTranslateX.value = targetTransform.x;
  sharedValues.savedTranslateY.value = targetTransform.y;
  sharedValues.savedScale.value = targetTransform.scale;
}

// Export constants for testing
export const CAMERA_CONSTANTS = {
  DEFAULT_MARGIN_X,
  DEFAULT_MARGIN_Y,
  DEFAULT_SPRING_DAMPING: 20,
  DEFAULT_SPRING_STIFFNESS: 90,
  DEFAULT_SPRING_MASS: 1,
  DEFAULT_ZOOM_DURATION: 600,
  DEFAULT_MIN_AUTO_ZOOM: 0.8,
  DEFAULT_MAX_AUTO_ZOOM: 3.0,
  DEFAULT_ZOOM: 1.5,
};
