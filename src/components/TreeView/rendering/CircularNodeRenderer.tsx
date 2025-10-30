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
import { Circle, Group, Paragraph } from '@shopify/react-native-skia';

// Import components
import { ImageNode } from './ImageNode';
import { CIRCULAR_NODE, COLORS, TIDY_CIRCLE } from './nodeConstants';
import type { LayoutNode, LineStyleOption } from './NodeRenderer';

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

  // Image rendering (required for ImageNode component)
  useBatchedSkiaImage: (url: string, bucket: number, priority: string) => any;

  // Connection style (enables D3 tidy styling tweaks)
  lineStyle?: LineStyleOption;
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
  useBatchedSkiaImage,
  lineStyle = 'straight',
}: CircularNodeRendererProps): JSX.Element {
  // Determine node type
  const isRoot = !node.father_id;
  const isG2Parent = node.generation === 2 && !!node._hasChildren;
  const isTidyVariant = lineStyle === 'bezier' || lineStyle === 'curves';

  // Get size-specific constants
  const diameter = dimensions.diameter;
  const radius = diameter / 2;
  const tidyConfig = isRoot
    ? TIDY_CIRCLE.ROOT
    : isG2Parent
      ? TIDY_CIRCLE.G2
      : TIDY_CIRCLE.STANDARD;

  const photoSize = isTidyVariant
    ? tidyConfig.PHOTO_SIZE
    : isRoot
      ? CIRCULAR_NODE.ROOT_PHOTO_SIZE
      : isG2Parent
        ? CIRCULAR_NODE.G2_PHOTO_SIZE
        : CIRCULAR_NODE.PHOTO_SIZE;

  const selectionStrokeWidth = isTidyVariant
    ? 1.2
    : isRoot
      ? CIRCULAR_NODE.ROOT_SELECTION_BORDER
      : CIRCULAR_NODE.SELECTION_BORDER;

  const imageBucket = isTidyVariant
    ? photoSize
    : isRoot
      ? CIRCULAR_NODE.ROOT_IMAGE_BUCKET
      : isG2Parent
        ? CIRCULAR_NODE.G2_IMAGE_BUCKET
        : CIRCULAR_NODE.IMAGE_BUCKET;

  const nameGap = isTidyVariant
    ? tidyConfig.NAME_GAP
    : isRoot
      ? CIRCULAR_NODE.NAME_GAP
      : CIRCULAR_NODE.NAME_GAP;

  const nameHeight = isTidyVariant
    ? tidyConfig.NAME_HEIGHT
    : isRoot
      ? CIRCULAR_NODE.ROOT_NAME_HEIGHT
      : CIRCULAR_NODE.NAME_HEIGHT;

  const nameFontSize = isTidyVariant ? tidyConfig.FONT_SIZE : 11;

  // Node center position
  const centerX = node.x;
  const centerY = node.y;

  // Calculate deceased status for grayscale photos
  const isDeceased = node.status === 'deceased';

  // Check if we should show photo
  const hasPhoto = showPhotos && !!node.photo_url;

  // Text positioning (centered below circle)
  const textY = centerY + radius + nameGap;
  const textX = centerX - diameter / 2; // Left edge for centering

  // Create name paragraph (max 2 lines, ellipsis truncation)
  const nameParagraph = useMemo(
    () => {
      const paragraph = getCachedParagraph(
        node.name || '',
        'bold',
        nameFontSize,
        isTidyVariant ? TIDY_CIRCLE.COLORS.TEXT : COLORS.TEXT,
        diameter, // Match node width for proper centering
        2, // Max 2 lines
      );

      // PHASE 1.1: Verification logging (REMOVED - too verbose)

      return paragraph;
    },
    [node.name, diameter, getCachedParagraph, textX, textY, nameFontSize, isTidyVariant],
  );

  const baseLayer = useMemo(() => {
    const tidyRingWidth = 1.6;
    const tidyGap = 1.2;

    if (hasPhoto) {
      if (isTidyVariant) {
        return (
          <Circle
            cx={centerX}
            cy={centerY}
            r={Math.max(radius - 0.6, 0)}
            color={TIDY_CIRCLE.COLORS.INNER_FILL}
          />
        );
      }

      return (
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius}
          color={COLORS.NODE_BACKGROUND}
        />
      );
    }

    if (isTidyVariant) {
      const ringRadius = radius;
      const fillRadius = Math.max(ringRadius - tidyRingWidth / 2 - tidyGap, 0);
      return (
        <>
          <Circle
            cx={centerX}
            cy={centerY}
            r={ringRadius}
            style="stroke"
            strokeWidth={tidyRingWidth}
            color={TIDY_CIRCLE.COLORS.OUTER_RING}
          />
          {fillRadius > 0 && (
            <Circle
              cx={centerX}
              cy={centerY}
              r={fillRadius}
              color={TIDY_CIRCLE.COLORS.OUTER_RING}
            />
          )}
        </>
      );
    }

    return (
      <Circle
        cx={centerX}
        cy={centerY}
        r={radius}
        color={CIRCULAR_NODE.TEXT_ONLY_FILL}
      />
    );
  }, [hasPhoto, isTidyVariant, centerX, centerY, radius]);

  const tidyOuterOffset = hasPhoto ? 0.8 : 2.0;
  const selectionRadius =
    radius + (isTidyVariant ? tidyOuterOffset : 0) + selectionStrokeWidth;

  const selectionElement = isSelected ? (
    <Circle
      cx={centerX}
      cy={centerY}
      r={selectionRadius}
      style="stroke"
      strokeWidth={selectionStrokeWidth}
      color={COLORS.SELECTION_BORDER}
    />
  ) : null;

  return (
    <Group>
      {baseLayer}
      {selectionElement}

      {hasPhoto && (
        <ImageNode
          x={centerX - photoSize / 2}
          y={centerY - photoSize / 2}
          width={photoSize}
          height={photoSize}
          url={node.photo_url!}
          blurhash={node.blurhash}
          cornerRadius={photoSize / 2}
          tier={node._tier || 1}
          scale={node._scale || 1}
          nodeId={node.id}
          selectBucket={node._selectBucket}
          showPhotos={showPhotos}
          isDeceased={isDeceased}
          useBatchedSkiaImage={useBatchedSkiaImage}
        />
      )}

      {/* Name text below circle */}
      {nameParagraph && (
        <Paragraph
          paragraph={nameParagraph}
          x={textX}
          y={textY}
          width={diameter}
        />
      )}
    </Group>
  );
}
