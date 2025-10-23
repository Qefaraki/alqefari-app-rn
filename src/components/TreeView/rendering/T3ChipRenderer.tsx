/**
 * T3ChipRenderer - LOD Tier 3 aggregation chips
 *
 * Phase 2 Day 6 - Extracted from TreeView.js (lines 2901-2960)
 *
 * Renders aggregation chips for hero nodes when fully zoomed out (LOD Tier 3).
 * Shows hero name and descendant count in compact chip format.
 *
 * LOD Tier 3 Behavior:
 * - Only renders when AGGREGATION_ENABLED flag is true
 * - Shows 3 hero branch chips (root + 2 largest branches)
 * - Uses precomputed centroids for positioning
 * - Transforms world coordinates to screen space
 *
 * Chip Design:
 * - Root chips: 1.3x scale (130x47px)
 * - Standard chips: 1.0x scale (100x36px)
 * - Corner radius: 16px (rounded pill shape)
 * - Colors: White background, Camel Hair border, Sadu Night text
 *
 * Text Display:
 * - Format: "Name (count)"
 * - Example: "عبدالله (245)"
 * - Font: Arabic font with center alignment
 * - Size: 12px base (15.6px for root)
 *
 * KNOWN PATTERNS (AS-IS for Phase 2):
 * - Requires arabicFont prop (from parent hook)
 * - Uses indices.centroids and indices.subtreeSizes
 * - Returns array of Group elements (not fragment)
 */

import React from 'react';
import { Group, RoundedRect, Text as SkiaText } from '@shopify/react-native-skia';

export interface HeroNode {
  id: string;
  name: string;
  father_id: string | null;
}

export interface Indices {
  centroids: Record<string, { x: number; y: number }>;
  subtreeSizes: Record<string, number>;
}

export interface T3ChipRendererProps {
  // Hero nodes to render (typically 3)
  heroNodes: HeroNode[];

  // Indices with centroids and subtree sizes
  indices: Indices;

  // Transform state
  scale: number;
  translateX: number;
  translateY: number;

  // Arabic font for text rendering
  arabicFont: any;

  // Feature flag
  aggregationEnabled?: boolean;
}

/**
 * Transform world coordinates to screen space
 *
 * Applies zoom scale and translation to convert world coordinates
 * (layout space) to screen coordinates (canvas space).
 *
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @param scale - Current zoom scale
 * @param translateX - Camera X translation
 * @param translateY - Camera Y translation
 * @returns Screen space coordinates {x, y}
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  scale: number,
  translateX: number,
  translateY: number
): { x: number; y: number } {
  return {
    x: worldX * scale + translateX,
    y: worldY * scale + translateY,
  };
}

/**
 * Calculate chip dimensions
 *
 * Root nodes get 1.3x scale for prominence.
 * Standard nodes use 1.0x scale.
 *
 * @param isRoot - Whether node is root (no father)
 * @returns {width, height, scale} Chip dimensions
 */
export function calculateChipDimensions(isRoot: boolean): {
  width: number;
  height: number;
  scale: number;
} {
  const chipScale = isRoot
    ? CHIP_CONSTANTS.ROOT_SCALE
    : CHIP_CONSTANTS.STANDARD_SCALE;

  return {
    width: CHIP_CONSTANTS.BASE_WIDTH * chipScale,
    height: CHIP_CONSTANTS.BASE_HEIGHT * chipScale,
    scale: chipScale,
  };
}

/**
 * Format chip text
 *
 * Combines hero name with descendant count.
 * Format: "Name (count)"
 *
 * @param name - Hero node name
 * @param count - Descendant count
 * @returns Formatted text string
 */
export function formatChipText(name: string, count: number): string {
  return `${name} (${count})`;
}

/**
 * Render single T3 chip
 *
 * Renders chip background, border, and text for one hero node.
 *
 * @param hero - Hero node data
 * @param centroid - World space position
 * @param subtreeSize - Descendant count
 * @param scale - Zoom scale
 * @param translateX - Camera X translation
 * @param translateY - Camera Y translation
 * @param arabicFont - Font for text rendering
 * @returns Group with chip elements
 */
export function renderChip(
  hero: HeroNode,
  centroid: { x: number; y: number },
  subtreeSize: number,
  scale: number,
  translateX: number,
  translateY: number,
  arabicFont: any
): JSX.Element {
  // Transform to screen space
  const screen = worldToScreen(centroid.x, centroid.y, scale, translateX, translateY);

  // Calculate dimensions
  const isRoot = !hero.father_id;
  const dims = calculateChipDimensions(isRoot);

  // Calculate top-left corner
  const x = screen.x - dims.width / 2;
  const y = screen.y - dims.height / 2;

  // Format text
  const text = formatChipText(hero.name, subtreeSize);
  const fontSize = CHIP_CONSTANTS.BASE_FONT_SIZE * dims.scale;

  return (
    <Group key={`chip-${hero.id}`}>
      {/* Background */}
      <RoundedRect
        x={x}
        y={y}
        width={dims.width}
        height={dims.height}
        r={CHIP_CONSTANTS.CORNER_RADIUS}
        color={CHIP_CONSTANTS.BACKGROUND_COLOR}
      />

      {/* Border */}
      <RoundedRect
        x={x}
        y={y}
        width={dims.width}
        height={dims.height}
        r={CHIP_CONSTANTS.CORNER_RADIUS}
        color={CHIP_CONSTANTS.BORDER_COLOR}
        style="stroke"
        strokeWidth={CHIP_CONSTANTS.BORDER_WIDTH}
      />

      {/* Text (if font available) */}
      {arabicFont && (
        <SkiaText
          x={screen.x}
          y={screen.y + 4}
          text={text}
          font={arabicFont}
          textAlign="center"
          fontSize={fontSize}
          color={CHIP_CONSTANTS.TEXT_COLOR}
        />
      )}
    </Group>
  );
}

/**
 * T3ChipRenderer component
 *
 * Renders aggregation chips for all hero nodes.
 * Returns null if aggregation disabled.
 *
 * @param props - T3 chip renderer props
 * @returns Array of chip Groups or null
 */
export const T3ChipRenderer: React.FC<T3ChipRendererProps> = ({
  heroNodes,
  indices,
  scale,
  translateX,
  translateY,
  arabicFont,
  aggregationEnabled = true,
}) => {
  if (!aggregationEnabled) return null;

  const chips: JSX.Element[] = [];

  heroNodes.forEach((hero) => {
    // Get precomputed centroid
    const centroid = indices.centroids[hero.id];
    if (!centroid) return;

    // Get subtree size
    const subtreeSize = indices.subtreeSizes[hero.id];
    if (subtreeSize === undefined) return;

    // Render chip
    const chip = renderChip(
      hero,
      centroid,
      subtreeSize,
      scale,
      translateX,
      translateY,
      arabicFont
    );

    chips.push(chip);
  });

  return <>{chips}</>;
};

// Export constants for testing
export const CHIP_CONSTANTS = {
  // Dimensions
  BASE_WIDTH: 100,
  BASE_HEIGHT: 36,
  ROOT_SCALE: 1.3,
  STANDARD_SCALE: 1.0,
  CORNER_RADIUS: 16,

  // Colors (Najdi Sadu palette)
  BACKGROUND_COLOR: '#FFFFFF',
  BORDER_COLOR: '#D1BBA340', // Camel Hair Beige 40%
  TEXT_COLOR: '#242121', // Sadu Night
  BORDER_WIDTH: 0.5,

  // Typography
  BASE_FONT_SIZE: 12,
  TEXT_OFFSET_Y: 4,
};
