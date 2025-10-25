/**
 * ZoomHandler - Zoom constraints and calculations
 *
 * Phase 2 Day 3 - Extracted from TreeView.js (lines 2527-2597)
 *
 * Manages zoom level constraints and "fit to bounds" calculations.
 * Ensures scale stays within min/max limits and handles zoom-to-fit logic.
 *
 * Key Responsibilities:
 * - Clamp scale values within bounds
 * - Calculate optimal scale to fit region in viewport
 * - Ensure minimum scale for LOD tier thresholds (T2 visibility)
 *
 * Zoom-to-Fit Strategy:
 * - Calculate bounding box for target region (with padding)
 * - Determine scale needed to fit width and height
 * - Use smaller of the two (guarantees entire region visible)
 * - Apply minimum scale for T2 threshold (ensures readability)
 * - Clamp to global min/max zoom limits
 *
 * LOD Integration:
 * - Ensures zoom reaches at least T2 threshold for chip expansion
 * - Adds 20% buffer above T2 to guarantee visibility
 * - Uses NODE_WIDTH_WITH_PHOTO and PixelRatio for accurate calculation
 */

import { PixelRatio } from 'react-native';
import { NODE_WIDTH_WITH_PHOTO } from '../rendering/nodeConstants';

// LOD tier thresholds (must match LODCalculator values)
const T2_BASE = 48; // pixels - from LODCalculator T2 threshold

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

export interface ZoomConfig {
  minZoom?: number;
  maxZoom?: number;
  padding?: number;
  t2BufferPercent?: number;
}

/**
 * Clamp value within min/max bounds
 *
 * Constrains value to [min, max] range.
 *
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate minimum scale for T2 LOD threshold
 *
 * Ensures nodes reach T2 tier (48px) for proper visibility.
 * Adds buffer percentage above threshold to guarantee crossing.
 *
 * Formula:
 * - T2 threshold: NODE_WIDTH * scale * pixelRatio >= 48
 * - Therefore: scale >= 48 / (NODE_WIDTH * pixelRatio)
 *
 * @param bufferPercent - Buffer above threshold (default 20%)
 * @returns Minimum scale for T2 visibility
 */
export function calculateMinScaleForT2(bufferPercent: number = 0.2): number {
  const minScaleForT2 = T2_BASE / (NODE_WIDTH_WITH_PHOTO * PixelRatio.get());
  return minScaleForT2 * (1 + bufferPercent);
}

/**
 * Calculate optimal scale to fit bounds in viewport
 *
 * Determines zoom level needed to fit bounding box within viewport.
 * Uses smaller of width/height scale to guarantee entire region visible.
 *
 * @param bounds - Bounding box to fit (canvas coordinates)
 * @param viewport - Screen dimensions
 * @param padding - Padding around bounds in canvas units
 * @returns Optimal scale to fit bounds
 */
export function calculateFitToViewScale(
  bounds: Bounds,
  viewport: Viewport,
  padding: number = 100
): number {
  // Add padding to bounds
  const paddedBounds = {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minY: bounds.minY - padding,
    maxY: bounds.maxY + padding,
  };

  // Calculate required scale for width and height
  const boundsWidth = paddedBounds.maxX - paddedBounds.minX;
  const boundsHeight = paddedBounds.maxY - paddedBounds.minY;

  const scaleX = viewport.width / boundsWidth;
  const scaleY = viewport.height / boundsHeight;

  // Use smaller scale to fit both dimensions
  return Math.min(scaleX, scaleY);
}

/**
 * Calculate zoom-to-fit scale with constraints
 *
 * Combines fit-to-view calculation with LOD and zoom limits.
 * Ensures result meets T2 threshold and stays within min/max zoom.
 *
 * Steps:
 * 1. Calculate basic fit-to-view scale
 * 2. Ensure meets T2 threshold (for readability)
 * 3. Clamp to global min/max zoom limits
 *
 * @param bounds - Bounding box to fit
 * @param viewport - Screen dimensions
 * @param config - Zoom configuration
 * @returns Constrained zoom-to-fit scale
 */
export function calculateZoomToFit(
  bounds: Bounds,
  viewport: Viewport,
  config: ZoomConfig = {}
): number {
  const {
    minZoom = 0.1,
    maxZoom = 5.0,
    padding = 100,
    t2BufferPercent = 0.2,
  } = config;

  // Calculate basic fit-to-view scale
  let targetScale = calculateFitToViewScale(bounds, viewport, padding);

  // Ensure we reach at least T2 threshold for readability
  const minScaleForT2 = calculateMinScaleForT2(t2BufferPercent);
  targetScale = Math.max(targetScale, minScaleForT2);

  // Clamp to global zoom limits
  return clamp(targetScale, minZoom, maxZoom);
}

/**
 * Calculate center point of bounds
 *
 * @param bounds - Bounding box
 * @returns Center coordinates
 */
export function calculateBoundsCenter(bounds: Bounds): { x: number; y: number } {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

/**
 * Calculate bounding box for set of nodes
 *
 * Finds min/max coordinates encompassing all nodes.
 *
 * @param nodes - Array of nodes with x, y coordinates
 * @returns Bounding box or null if no nodes
 */
export function calculateNodesBounds(
  nodes: Array<{ x: number; y: number }>
): Bounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }

  // Check for empty result (all nodes at infinity)
  if (minX === Infinity || maxX === -Infinity) {
    return null;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Calculate target transform for zoom-to-fit
 *
 * Combines zoom calculation with centering logic.
 * Returns complete transform (x, y, scale) to fit and center bounds.
 *
 * @param bounds - Bounding box to fit
 * @param viewport - Screen dimensions
 * @param config - Zoom configuration
 * @returns Target camera transform
 */
export function calculateFitToViewTransform(
  bounds: Bounds,
  viewport: Viewport,
  config: ZoomConfig = {}
): { x: number; y: number; scale: number } {
  const targetScale = calculateZoomToFit(bounds, viewport, config);
  const center = calculateBoundsCenter(bounds);

  // Calculate translation to center bounds
  // Formula: translateX = viewport.width/2 - centerX * scale
  const targetX = viewport.width / 2 - center.x * targetScale;
  const targetY = viewport.height / 2 - center.y * targetScale;

  return {
    x: targetX,
    y: targetY,
    scale: targetScale,
  };
}

// Export constants for testing
export const ZOOM_CONSTANTS = {
  T2_BASE,
  DEFAULT_MIN_ZOOM: 0.1,
  DEFAULT_MAX_ZOOM: 5.0,
  DEFAULT_PADDING: 100,
  DEFAULT_T2_BUFFER_PERCENT: 0.2,
};
