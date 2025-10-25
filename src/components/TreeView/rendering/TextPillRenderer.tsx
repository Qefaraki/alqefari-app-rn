/**
 * TextPillRenderer - LOD Tier 2 minimal text-only node rendering
 *
 * Phase 2 Day 4 - Extracted from TreeView.js (lines 2963-3040)
 * October 2025 - Updated for minimal modern aesthetic
 *
 * Renders compact text-only pills for Level of Detail (LOD) Tier 2.
 * Used when zoomed out to show more nodes with minimal visual weight.
 *
 * LOD Tier 2 Characteristics:
 * - Triggered at scale < 0.48 (approximately)
 * - Compact size: 75x38px (same width as photo nodes, compact height)
 * - Full name display (truncated if needed)
 * - Lighter shadow (1px offset, 6% opacity - less weight than photo nodes)
 * - Minimal rounded corners (10px radius)
 * - No border - minimal aesthetic
 *
 * Design Constraints (Najdi Sadu Minimal):
 * - Al-Jass White background (#F9F7F3)
 * - Camel Hair Beige shadow (#D1BBA3 6% opacity)
 * - Sadu Night text (#242121)
 * - Font size 11px bold (same as photo nodes)
 *
 * Performance:
 * - Uses cached paragraph for text rendering
 * - Minimal rendering footprint for distant nodes
 * - Integrates with SpatialGrid viewport culling
 */

import React from 'react';
import { Group, RoundedRect, Paragraph } from '@shopify/react-native-skia';
import { renderT2Shadow } from './ShadowRenderer';

export interface TextPillRendererProps {
  // Node data
  nodeId: string;
  name: string;
  x: number;
  y: number;

  // Selection state
  isSelected: boolean;

  // Paragraph cache function
  getCachedParagraph: (
    text: string,
    weight: 'regular' | 'medium' | 'bold',
    fontSize: number,
    color: string,
    width: number
  ) => any | null;

  // Node frame tracking (for tap detection & highlights)
  onFrameCalculated?: (frame: {
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius: number;
  }) => void;
}

/**
 * Render minimal shadow for T2 pill
 *
 * Lighter shadow than photo nodes (6% opacity).
 * Offset: 1px down, 3px blur radius.
 *
 * @param x - Left edge X
 * @param y - Top edge Y
 * @param width - Pill width
 * @param height - Pill height
 * @param borderRadius - Corner radius
 * @returns Shadow element
 */
export function renderT2PillShadow(
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number
) {
  // Note: Using renderT2Shadow from ShadowRenderer if available
  // Otherwise, shadow is embedded in RoundedRect child
  return null; // Shadow will be rendered as child of RoundedRect
}

/**
 * TextPillRenderer component
 *
 * Renders a compact text-only pill for LOD Tier 2.
 * Shows first name only with minimal visual styling.
 *
 * @param props - Text pill renderer props
 * @returns Group containing pill elements
 */
export const TextPillRenderer: React.FC<TextPillRendererProps> = ({
  nodeId,
  name,
  x: centerX,
  y: centerY,
  isSelected,
  getCachedParagraph,
  onFrameCalculated,
}) => {
  const nodeWidth = PILL_CONSTANTS.WIDTH;
  const nodeHeight = PILL_CONSTANTS.HEIGHT;
  const cornerRadius = PILL_CONSTANTS.CORNER_RADIUS;

  // Calculate top-left corner from center position
  const x = centerX - nodeWidth / 2;
  const y = centerY - nodeHeight / 2;

  // Notify parent of frame bounds (for tap detection)
  if (onFrameCalculated) {
    onFrameCalculated({
      x,
      y,
      width: nodeWidth,
      height: nodeHeight,
      borderRadius: cornerRadius,
    });
  }

  // Create cached paragraph for text rendering (full name, bold)
  const nameParagraph = getCachedParagraph(
    name,
    'bold',
    PILL_CONSTANTS.FONT_SIZE,
    PILL_CONSTANTS.TEXT_COLOR,
    nodeWidth
  );

  return (
    <Group key={nodeId}>
      {/* Shadow (lighter for T2 pills) */}
      {renderT2Shadow(x, y, nodeWidth, nodeHeight, cornerRadius)}

      {/* Main pill background - Al-Jass White with soft shadow */}
      <RoundedRect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        r={cornerRadius}
        color={PILL_CONSTANTS.BACKGROUND_COLOR}
      />

      {/* Text - centered vertically (full name, bold) */}
      {nameParagraph && (
        <Paragraph
          paragraph={nameParagraph}
          x={x}
          y={y + (nodeHeight - nameParagraph.getHeight()) / 2}
          width={nodeWidth}
        />
      )}
    </Group>
  );
};

// Export constants for testing
export const PILL_CONSTANTS = {
  // Dimensions - Minimal Modern Design (October 2025)
  WIDTH: 75,        // Same as photo nodes for vertical alignment
  HEIGHT: 38,       // Compact, same as text-only nodes in NodeRenderer
  CORNER_RADIUS: 10, // Modern rounded corners

  // Colors (Najdi Sadu Minimal Palette)
  BACKGROUND_COLOR: '#F9F7F3', // Al-Jass White
  TEXT_COLOR: '#242121', // Sadu Night
  SHADOW_COLOR: '#D1BBA30F', // Camel Hair Beige 6% opacity (lighter than photo nodes)

  // No border in minimal aesthetic
  DEFAULT_BORDER_COLOR: 'transparent',
  SELECTED_BORDER_COLOR: 'transparent',

  // Border widths (not used, but kept for compatibility)
  DEFAULT_BORDER_WIDTH: 0,
  SELECTED_BORDER_WIDTH: 0,

  // Typography
  FONT_SIZE: 11,    // Same as photo nodes
  FONT_WEIGHT: 'bold' as const, // Bold for consistency
};
