/**
 * CircularNodeRenderer - Circular avatar-style node rendering
 *
 * Part of Tree Design System (October 2025)
 *
 * Renders circular avatar nodes with photo clipping and text below.
 * Alternative to rectangular card-style nodes for modern, compact appearance.
 *
 * Features:
 * - Circular photo avatars with ClipPath masking
 * - Text-only nodes show solid colored circle (Najdi Crimson)
 * - Name text positioned below circle (centered, max 2 lines)
 * - Selection state with circular ring border
 * - Supports root/G2/standard size variations
 * - RTL-compatible text positioning
 */

import React, { useMemo } from 'react';
import { Circle, Group, ClipPath, Path, Paragraph } from '@shopify/react-native-skia';
import { Skia } from '@shopify/react-native-skia';

// Import components
import { ImageNode } from './ImageNode';
import { CIRCULAR_NODE, COLORS } from './nodeConstants';
import type { LayoutNode } from './NodeRenderer';

export interface CircularNodeRendererProps {
  // Node data
  node: LayoutNode;

  // Display settings
  showPhotos: boolean;
  isSelected: boolean;

  // Dimensions (pre-calculated from calculateNodeDimensions)
  dimensions: {
    width: number;
    height: number;
    borderRadius: number;
    shape: 'circular';
    diameter: number;
  };

  // Text rendering
  getCachedParagraph: (
    text: string,
    fontWeight: string,
    fontSize: number,
    color: string,
    maxWidth: number,
    maxLines?: number,
  ) => any;
}

/**
 * Render circular node with photo or solid fill
 */
export function CircularNodeRenderer({
  node,
  showPhotos,
  isSelected,
  dimensions,
  getCachedParagraph,
}: CircularNodeRendererProps): JSX.Element {
  // Determine node type
  const isRoot = !node.father_id;
  const isG2Parent = node.generation === 2 && !!node._hasChildren;

  // Get size-specific constants
  const diameter = dimensions.diameter;
  const radius = diameter / 2;

  const photoSize = isRoot
    ? CIRCULAR_NODE.ROOT_PHOTO_SIZE
    : isG2Parent
      ? CIRCULAR_NODE.G2_PHOTO_SIZE
      : CIRCULAR_NODE.PHOTO_SIZE;

  const selectionBorder = isRoot
    ? CIRCULAR_NODE.ROOT_SELECTION_BORDER
    : CIRCULAR_NODE.SELECTION_BORDER;

  const imageBucket = isRoot
    ? CIRCULAR_NODE.ROOT_IMAGE_BUCKET
    : isG2Parent
      ? CIRCULAR_NODE.G2_IMAGE_BUCKET
      : CIRCULAR_NODE.IMAGE_BUCKET;

  const nameHeight = isRoot
    ? CIRCULAR_NODE.ROOT_NAME_HEIGHT
    : CIRCULAR_NODE.NAME_HEIGHT;

  // Node center position
  const centerX = node.x;
  const centerY = node.y;

  // Check if we should show photo
  const hasPhoto = showPhotos && !!node.photo_url;

  // Text positioning (centered below circle)
  const textY = centerY + radius + CIRCULAR_NODE.NAME_GAP;
  const textX = centerX - diameter / 2; // Left edge for centering

  // Create name paragraph (max 2 lines, ellipsis truncation)
  const nameParagraph = useMemo(
    () =>
      getCachedParagraph(
        node.name || '',
        'bold',
        11, // Standard font size
        COLORS.TEXT,
        diameter, // Max width matches circle diameter
        2, // Max 2 lines
      ),
    [node.name, diameter, getCachedParagraph],
  );

  // Create circular clip path for photo masking
  const circularClipPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(centerX, centerY, radius);
    return path;
  }, [centerX, centerY, radius]);

  return (
    <Group>
      {/* Selection border (outer circle) */}
      {isSelected && (
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius + selectionBorder}
          style="stroke"
          strokeWidth={selectionBorder}
          color={COLORS.SELECTION_BORDER}
        />
      )}

      {hasPhoto ? (
        /* Photo node with circular clipping */
        <>
          {/* Background circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            color={COLORS.NODE_BACKGROUND}
          />

          {/* Clipped photo */}
          <Group>
            <ClipPath>
              <Circle cx={centerX} cy={centerY} r={radius} />
            </ClipPath>
            <ImageNode
              x={centerX - photoSize / 2}
              y={centerY - photoSize / 2}
              width={photoSize}
              height={photoSize}
              url={node.photo_url!}
              bucket={imageBucket}
            />
          </Group>
        </>
      ) : (
        /* Text-only node - solid fill (no initials) */
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius}
          color={CIRCULAR_NODE.TEXT_ONLY_FILL}
        />
      )}

      {/* Name text below circle */}
      <Paragraph x={textX} y={textY} paragraph={nameParagraph} />
    </Group>
  );
}
