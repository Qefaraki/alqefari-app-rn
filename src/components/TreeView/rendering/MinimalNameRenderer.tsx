/**
 * MinimalNameRenderer - Ultra-simple renderer for testing vertical D3 tree layout
 *
 * Purpose: Verify Observable Plot-style vertical layout with minimal complexity
 * - No photos
 * - No styling
 * - No LOD tiers
 * - Just circles + names
 *
 * Used for: Testing vertical tree orientation before adding full features
 */

import React from 'react';
import { Circle, Group, Text as SkiaText, rect, Skia } from '@shopify/react-native-skia';
import { COLORS } from './nodeConstants';
import type { LayoutNode } from './NodeRenderer';

export interface MinimalNameRendererProps {
  node: LayoutNode;
  isSelected: boolean;
}

/**
 * Render minimal node: circle + name label
 * Observable Plot-style: Simple, uniform, vertical layout
 */
export function MinimalNameRenderer({
  node,
  isSelected,
}: MinimalNameRendererProps): JSX.Element {
  // Simple sizing
  const CIRCLE_RADIUS = 20;
  const SELECTION_BORDER = 2.5;
  const TEXT_OFFSET_Y = 30;  // Position name below circle

  // Node center
  const centerX = node.x;
  const centerY = node.y;

  // Create text paragraph for name
  const paragraph = Skia.ParagraphBuilder.Make()
    .pushStyle({
      color: Skia.Color(COLORS.TEXT),
      fontSize: 12,
      fontFamilies: ['SF Arabic', 'System'],
    })
    .addText(node.name || '')
    .pop()
    .build();

  // Layout paragraph (max width 100px, centered)
  paragraph.layout(100);
  const textWidth = paragraph.getMaxIntrinsicWidth();
  const textX = centerX - (textWidth / 2);  // Center text under circle
  const textY = centerY + TEXT_OFFSET_Y;

  return (
    <Group>
      {/* Selection ring */}
      {isSelected && (
        <Circle
          cx={centerX}
          cy={centerY}
          r={CIRCLE_RADIUS + SELECTION_BORDER}
          style="stroke"
          strokeWidth={SELECTION_BORDER}
          color={COLORS.SELECTION_BORDER}
        />
      )}

      {/* Circle node */}
      <Circle
        cx={centerX}
        cy={centerY}
        r={CIRCLE_RADIUS}
        color={COLORS.NODE_BACKGROUND}
        style="stroke"
        strokeWidth={2}
        opacity={0.8}
      />

      {/* Name label */}
      <SkiaText
        paragraph={paragraph}
        x={textX}
        y={textY}
        width={100}
      />
    </Group>
  );
}
