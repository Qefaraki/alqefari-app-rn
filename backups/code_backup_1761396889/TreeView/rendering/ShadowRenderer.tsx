/**
 * ShadowRenderer - Subtle shadow rendering for nodes
 *
 * Phase 2 Day 4 - Extracted from TreeView.js (lines 2983-2990, 3074-3081)
 *
 * Renders subtle drop shadows beneath tree nodes using Najdi design constraints.
 * Implements "soft shadow" pattern with minimal visual weight.
 *
 * Design Constraints (Najdi Sadu):
 * - Maximum opacity: 0.08 (8%) to maintain lightness
 * - Typical opacity: 0.05 (5%) for standard nodes
 * - Small offset: 0.5-1px for subtle depth
 * - No blur: Uses solid color RoundedRect, not BoxShadow (performance)
 *
 * Shadow Variants:
 * - T1 nodes (photo cards): 1px offset, 0.05 opacity (#00000015 = ~8%)
 * - T2 nodes (text pills): 0.5px offset, 0.03 opacity (#00000008 = ~3%)
 *
 * Performance:
 * - Uses RoundedRect instead of BoxShadow (faster rendering)
 * - No blur calculations (GPU-friendly)
 * - Matches border radius of parent node
 */

import React from 'react';
import { RoundedRect } from '@shopify/react-native-skia';

export interface ShadowRendererProps {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  opacity?: number; // Max 0.08 per Najdi design
  offsetX?: number; // Default 1
  offsetY?: number; // Default 1
}

/**
 * Validate opacity stays within Najdi design constraints
 *
 * Ensures shadow opacity never exceeds maximum (0.08).
 * This maintains the light, airy aesthetic of Najdi Sadu design.
 *
 * @param opacity - Desired opacity (0.0 - 1.0)
 * @returns Clamped opacity (max 0.08)
 */
export function validateShadowOpacity(opacity: number): number {
  return Math.min(Math.max(opacity, 0), SHADOW_CONSTANTS.MAX_OPACITY);
}

/**
 * Convert opacity to hex alpha string
 *
 * Converts decimal opacity (0.0-1.0) to 2-digit hex (00-FF).
 * Used for creating color strings like "#00000015" (black with 8% opacity).
 *
 * @param opacity - Opacity value (0.0 - 1.0)
 * @returns Hex alpha string (00-FF)
 */
export function opacityToHex(opacity: number): string {
  const alpha = Math.round(opacity * 255);
  return alpha.toString(16).padStart(2, '0');
}

/**
 * Create shadow color string
 *
 * Generates color string with opacity for shadow rendering.
 * Format: "#RRGGBBAA" where AA is alpha in hex.
 *
 * @param baseColor - Base color (default black #000000)
 * @param opacity - Opacity (0.0 - 1.0, max 0.08)
 * @returns Color string with alpha
 */
export function createShadowColor(
  baseColor: string = '#000000',
  opacity: number = SHADOW_CONSTANTS.DEFAULT_OPACITY
): string {
  const validOpacity = validateShadowOpacity(opacity);
  const hex = opacityToHex(validOpacity);
  return `${baseColor}${hex}`;
}

/**
 * ShadowRenderer component
 *
 * Renders a subtle shadow beneath a node using offset RoundedRect.
 * Shadow matches the corner radius of the parent node.
 *
 * @param props - Shadow renderer props
 * @returns RoundedRect shadow component
 */
export const ShadowRenderer: React.FC<ShadowRendererProps> = ({
  x,
  y,
  width,
  height,
  cornerRadius,
  opacity = SHADOW_CONSTANTS.DEFAULT_OPACITY,
  offsetX = SHADOW_CONSTANTS.DEFAULT_OFFSET_X,
  offsetY = SHADOW_CONSTANTS.DEFAULT_OFFSET_Y,
}) => {
  const shadowColor = createShadowColor('#000000', opacity);

  return (
    <RoundedRect
      x={x + offsetX}
      y={y + offsetY}
      width={width}
      height={height}
      r={cornerRadius}
      color={shadowColor}
    />
  );
};

/**
 * Render T1 node shadow (photo cards)
 *
 * Standard shadow for photo nodes with 1px offset and 5% opacity.
 *
 * @param x - Node X position
 * @param y - Node Y position
 * @param width - Node width
 * @param height - Node height
 * @param cornerRadius - Corner radius
 * @returns Shadow component
 */
export function renderT1Shadow(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number
): JSX.Element {
  return (
    <ShadowRenderer
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={cornerRadius}
      opacity={0.05} // #00000015 ≈ 5% (0.082 actual)
      offsetX={1}
      offsetY={1}
    />
  );
}

/**
 * Render T2 node shadow (text pills)
 *
 * Lighter shadow for text-only nodes with 0.5px offset and 3% opacity.
 *
 * @param x - Node X position
 * @param y - Node Y position
 * @param width - Node width
 * @param height - Node height
 * @param cornerRadius - Corner radius
 * @returns Shadow component
 */
export function renderT2Shadow(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number
): JSX.Element {
  return (
    <ShadowRenderer
      x={x}
      y={y}
      width={width}
      height={height}
      cornerRadius={cornerRadius}
      opacity={0.03} // #00000008 ≈ 3% (0.031 actual)
      offsetX={0.5}
      offsetY={0.5}
    />
  );
}

// Export constants for testing
export const SHADOW_CONSTANTS = {
  MAX_OPACITY: 0.08, // Najdi design constraint
  DEFAULT_OPACITY: 0.05, // Standard shadow opacity
  DEFAULT_OFFSET_X: 1,
  DEFAULT_OFFSET_Y: 1,
  T1_OPACITY: 0.05, // Photo card shadow
  T2_OPACITY: 0.03, // Text pill shadow (lighter)
};
