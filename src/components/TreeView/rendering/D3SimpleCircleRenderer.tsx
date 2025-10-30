/**
 * D3SimpleCircleRenderer - Simple circular nodes for D3 layout modes
 *
 * Part of Tree Layout System (October 2025 - Phase 3B)
 *
 * Purpose: Render simple uniform circles for D3 modes (curves, cluster, radial)
 * Perfect for D3 link generators (linkHorizontal, linkRadial) which expect uniform nodes
 *
 * Features:
 * - Simple circles with photos (no text labels)
 * - Uniform sizing (40px standard, 80px root)
 * - Photo clipped to circular mask
 * - Empty circle for nodes without photos (Camel Hair Beige fill)
 * - Selection ring (Najdi Crimson, 2.5px)
 * - Perfect connection points for D3 curves
 *
 * Design Philosophy:
 * - Simplicity over complexity
 * - Uniform dimensions → perfect D3 connections
 * - Visual hierarchy through size only (no labels)
 *
 * Used by: TreeView.core.js when layoutMode = 'curves' | 'cluster' | 'radial'
 * NOT used by: Straight mode (uses NodeRenderer/CircularNodeRenderer)
 */

import React from 'react';
import { Circle, Group } from '@shopify/react-native-skia';

// Import components
import { ImageNode } from './ImageNode';
import { D3_SIMPLE_CIRCLE, COLORS } from './nodeConstants';
import type { LayoutNode } from './NodeRenderer';

export interface D3SimpleCircleRendererProps {
  // Node data
  node: LayoutNode;

  // Display settings
  showPhotos: boolean;
  isSelected: boolean;

  // Text rendering (unused but kept for interface compatibility)
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
}

/**
 * Render simple circle node with photo or solid fill
 * No text labels - keeps it simple for D3 connections
 */
export function D3SimpleCircleRenderer({
  node,
  showPhotos,
  isSelected,
  useBatchedSkiaImage,
}: D3SimpleCircleRendererProps): JSX.Element {
  // Determine node type
  const isRoot = !node.father_id;

  // Get size-specific constants
  const diameter = isRoot ? D3_SIMPLE_CIRCLE.ROOT_DIAMETER : D3_SIMPLE_CIRCLE.DIAMETER;
  const radius = diameter / 2;

  const photoSize = isRoot ? D3_SIMPLE_CIRCLE.ROOT_PHOTO_SIZE : D3_SIMPLE_CIRCLE.PHOTO_SIZE;
  const imageBucket = isRoot ? D3_SIMPLE_CIRCLE.ROOT_IMAGE_BUCKET : D3_SIMPLE_CIRCLE.IMAGE_BUCKET;

  // Node center position
  const centerX = node.x;
  const centerY = node.y;

  // Calculate deceased status for grayscale photos
  const isDeceased = node.status === 'deceased';

  // Check if we should show photo
  const hasPhoto = showPhotos && !!node.photo_url;

  return (
    <Group>
      {/* Selection ring (outer circle) */}
      {isSelected && (
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius + D3_SIMPLE_CIRCLE.SELECTION_BORDER}
          style="stroke"
          strokeWidth={D3_SIMPLE_CIRCLE.SELECTION_BORDER}
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

          {/* Photo with circular clipping via cornerRadius */}
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
        </>
      ) : (
        /* Empty circle (no photo) - solid Camel Hair Beige fill */
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius}
          color={D3_SIMPLE_CIRCLE.EMPTY_FILL}
        />
      )}
    </Group>
  );
}
