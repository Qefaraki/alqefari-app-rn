/**
 * SaduIcon - Najdi Sadu pattern icon renderer
 *
 * Phase 2 Day 2 - Extracted from TreeView.js (lines 430-500)
 *
 * Renders traditional Najdi Sadu patterns with Najdi Crimson color tint.
 * Used for visual decoration on root nodes and Generation 2 parent nodes.
 *
 * Patterns:
 * - Pattern 90 (root): Large geometric pattern for rootNode without photo
 * - Pattern 73 (G2): Smaller pattern for Generation 2 parents
 *
 * Color Tint:
 * - Najdi Crimson (#A13333) applied via ColorMatrix
 * - Matrix boosts red channel (0.631), reduces green/blue (0.2)
 */

import React from 'react';
import { Group, Image as SkiaImage, Paint, ColorMatrix, useImage } from '@shopify/react-native-skia';

export type SaduPatternType = 'root' | 'generation2';

export interface SaduIconProps {
  x: number;
  y: number;
  size: number;
  pattern?: SaduPatternType;
}

// Najdi Crimson color tint matrix
// Converts grayscale pattern to Najdi Crimson (#A13333)
const NAJDI_CRIMSON_MATRIX = [
  0.631, 0, 0, 0, 0,   // Red channel - boost to match #A13333 red
  0.2, 0, 0, 0, 0,     // Green channel - reduce (crimson has low green)
  0.2, 0, 0, 0, 0,     // Blue channel - reduce (crimson has low blue)
  0, 0, 0, 1, 0,       // Alpha channel - preserve transparency
];

/**
 * Sadu Icon component for Najdi pattern decoration
 *
 * Loads traditional Najdi Sadu geometric patterns and applies Najdi Crimson tint.
 * Returns null if pattern image fails to load.
 *
 * @param x - X coordinate for icon placement
 * @param y - Y coordinate for icon placement
 * @param size - Icon size in pixels (square)
 * @param pattern - Pattern type: 'root' (90.png) or 'generation2' (73.png)
 *
 * @example
 * // Root node decoration (large pattern)
 * <SaduIcon x={100} y={50} size={20} pattern="root" />
 *
 * // Generation 2 parent decoration (small pattern)
 * <SaduIcon x={100} y={50} size={14} pattern="generation2" />
 */
export const SaduIcon: React.FC<SaduIconProps> = ({
  x,
  y,
  size,
  pattern = 'root',
}) => {
  // Load appropriate pattern based on type
  const patternFile = pattern === 'root'
    ? require('../../../assets/sadu_patterns/png/90.png')
    : require('../../../assets/sadu_patterns/png/73.png');

  const saduImage = useImage(patternFile);

  // Return null if image not yet loaded (Skia async loading)
  if (!saduImage) return null;

  return (
    <Group>
      {/* Apply Najdi Crimson color tint via ColorMatrix layer */}
      <Group
        layer={
          <Paint>
            <ColorMatrix matrix={NAJDI_CRIMSON_MATRIX} />
          </Paint>
        }
      >
        <SkiaImage
          image={saduImage}
          x={x}
          y={y}
          width={size}
          height={size}
          fit="contain"
        />
      </Group>
    </Group>
  );
};

/**
 * Root node Sadu icon (Pattern 90)
 *
 * Convenience wrapper for root node decoration.
 * Uses larger geometric pattern (90.png).
 */
export const RootSaduIcon: React.FC<Omit<SaduIconProps, 'pattern'>> = (props) => (
  <SaduIcon {...props} pattern="root" />
);

/**
 * Generation 2 parent Sadu icon (Pattern 73)
 *
 * Convenience wrapper for Generation 2 parent node decoration.
 * Uses smaller geometric pattern (73.png).
 */
export const G2SaduIcon: React.FC<Omit<SaduIconProps, 'pattern'>> = (props) => (
  <SaduIcon {...props} pattern="generation2" />
);
