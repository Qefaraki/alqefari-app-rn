/**
 * TextPillRenderer - LOD Tier 2 text-only pill rendering
 *
 * Phase 2 Day 4 - Extracted from TreeView.js (lines 2963-3040)
 *
 * Renders compact text-only pills for Level of Detail (LOD) Tier 2.
 * Used when zoomed out to show more nodes with minimal visual weight.
 *
 * LOD Tier 2 Characteristics:
 * - Triggered at scale < 0.48 (approximately)
 * - Small pill size: 60x26 px
 * - First name only (truncates full name)
 * - Lighter shadow (0.5px offset, 3% opacity)
 * - Rounded corners (13px radius)
 *
 * Design Constraints (Najdi Sadu):
 * - White background (#FFFFFF)
 * - Camel Hair Beige border (#D1BBA3 60% opacity)
 * - Najdi Crimson selection (#A13333)
 * - Sadu Night text (#242121)
 * - Font size 10px (regular weight)
 *
 * KNOWN ISSUE (Phase 2 - AS-IS extraction):
 * - Text pill jumps when selected due to border width change
 * - Border width changes from 1 to 1.5, causing 0.5px shift
 * - Will be fixed in Phase 3 refactoring
 * - AS-IS extraction preserves bug for before/after comparison
 *
 * Performance:
 * - Uses cached paragraph for text rendering
 * - Minimal rendering footprint for distant nodes
 * - Integrates with SpatialGrid viewport culling
 */

import React from 'react';
import { Group, RoundedRect, Paragraph } from '@shopify/react-native-skia';
import { renderT2Shadow } from './ShadowRenderer';
import { TEXT_PILL } from './nodeConstants';

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
 * Extract first name from full name
 *
 * Splits full name by space and returns first segment.
 * Used to minimize text in compact T2 pills.
 *
 * @param fullName - Full name string (e.g., "عبدالله محمد")
 * @returns First name only (e.g., "عبدالله")
 */
export function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0];
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
  const nodeWidth = TEXT_PILL.WIDTH;
  const nodeHeight = TEXT_PILL.HEIGHT;
  const cornerRadius = TEXT_PILL.CORNER_RADIUS;

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

  // Extract first name for compact display
  const firstName = extractFirstName(name);

  // Create cached paragraph for text rendering
  const nameParagraph = getCachedParagraph(
    firstName,
    'regular',
    TEXT_PILL.FONT_SIZE,
    TEXT_PILL.TEXT_COLOR,
    nodeWidth
  );

  // Calculate border width based on selection state
  // KNOWN ISSUE: Width change causes 0.5px jump (Phase 3 fix)
  const borderWidth = isSelected
    ? TEXT_PILL.SELECTED_BORDER_WIDTH
    : TEXT_PILL.DEFAULT_BORDER_WIDTH;

  // Calculate border color based on selection state
  const borderColor = isSelected
    ? TEXT_PILL.SELECTED_BORDER_COLOR
    : TEXT_PILL.DEFAULT_BORDER_COLOR;

  return (
    <Group key={nodeId}>
      {/* Shadow (lighter for T2 pills) */}
      {renderT2Shadow(x, y, nodeWidth, nodeHeight, cornerRadius)}

      {/* Main pill background */}
      <RoundedRect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        r={cornerRadius}
        color={PILL_CONSTANTS.BACKGROUND_COLOR}
      />

      {/* Border */}
      <RoundedRect
        x={x}
        y={y}
        width={nodeWidth}
        height={nodeHeight}
        r={cornerRadius}
        color={borderColor}
        style="stroke"
        strokeWidth={borderWidth}
      />

      {/* First name text */}
      {nameParagraph && (
        <Paragraph
          paragraph={nameParagraph}
          x={x}
          y={y + PILL_CONSTANTS.TEXT_OFFSET_Y}
          width={nodeWidth}
        />
      )}
    </Group>
  );
};

// Export constants for testing (re-exported from nodeConstants.ts)
export const PILL_CONSTANTS = {
  // Dimensions (from TEXT_PILL constants)
  WIDTH: TEXT_PILL.WIDTH,           // 54 (consolidated with photo nodes)
  HEIGHT: TEXT_PILL.HEIGHT,         // 26
  CORNER_RADIUS: TEXT_PILL.CORNER_RADIUS,  // 4

  // Colors (Najdi Sadu palette)
  BACKGROUND_COLOR: TEXT_PILL.BACKGROUND_COLOR,  // #FFFFFF
  TEXT_COLOR: TEXT_PILL.TEXT_COLOR,  // Sadu Night
  DEFAULT_BORDER_COLOR: TEXT_PILL.DEFAULT_BORDER_COLOR,  // Camel Hair Beige 60%
  SELECTED_BORDER_COLOR: TEXT_PILL.SELECTED_BORDER_COLOR,  // Najdi Crimson

  // Border widths
  DEFAULT_BORDER_WIDTH: TEXT_PILL.DEFAULT_BORDER_WIDTH,  // 1
  SELECTED_BORDER_WIDTH: TEXT_PILL.SELECTED_BORDER_WIDTH,  // 1.5 - KNOWN ISSUE: Causes 0.5px jump

  // Typography
  FONT_SIZE: TEXT_PILL.FONT_SIZE,    // 10
  TEXT_OFFSET_Y: TEXT_PILL.TEXT_OFFSET_Y,  // 4 (15% of height)
};
