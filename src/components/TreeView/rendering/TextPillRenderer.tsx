/**
 * TextPillRenderer - LOD Tier 2 glassmorphism text-only node rendering
 *
 * Phase 2 Day 4 - Extracted from TreeView.js (lines 2963-3040)
 * October 2025 - Updated for glassmorphism aesthetic (pure white, ultra compact)
 *
 * Renders ultra-compact text-only glass cards for Level of Detail (LOD) Tier 2.
 * Used when zoomed out to show more nodes with minimal visual footprint.
 *
 * LOD Tier 2 Characteristics:
 * - Triggered at scale < 0.48 (approximately)
 * - Ultra-compact size: 75x28px (dynamic width, minimal height)
 * - Full name display (truncated if needed)
 * - Strong shadow (2px offset, 12% black opacity - glass effect)
 * - Tight rounded corners (8px radius) for modern look
 * - No border - glassmorphism aesthetic
 *
 * Design Constraints (Glassmorphism):
 * - Pure white background (#FFFFFF)
 * - Strong shadow (#0000001F - 12% black opacity)
 * - Sadu Night text (#242121)
 * - Font size 10pt bold (ultra compact)
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
  // Dimensions - Glassmorphism (October 2025) - Ultra compact
  WIDTH: 75,        // Dynamic per text width, but base is 75px
  HEIGHT: 28,       // Compact: 4px + text + 4px
  CORNER_RADIUS: 8, // Tight modern corners for glassmorphism

  // Colors - Glassmorphism Palette
  BACKGROUND_COLOR: '#FFFFFF', // Pure white glass card
  TEXT_COLOR: '#242121', // Sadu Night for contrast
  SHADOW_COLOR: '#0000001F', // Strong shadow: 12% black opacity

  // No border in glassmorphism aesthetic
  DEFAULT_BORDER_COLOR: 'transparent',
  SELECTED_BORDER_COLOR: 'transparent',

  // Border widths (not used, but kept for compatibility)
  DEFAULT_BORDER_WIDTH: 0,
  SELECTED_BORDER_WIDTH: 0,

  // Typography - Ultra compact
  FONT_SIZE: 10,    // Smaller for compact height (was 11pt)
  FONT_WEIGHT: 'bold' as const, // Bold for clarity
};
