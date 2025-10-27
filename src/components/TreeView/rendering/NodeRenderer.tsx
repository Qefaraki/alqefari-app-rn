/**
 * NodeRenderer - LOD Tier 1 full node card rendering
 *
 * Phase 2 Day 7 - Extracted from TreeView.js (lines 3058-3295)
 *
 * Renders complete node cards with photo avatars, generation badges, name text,
 * and special styling for root/G2 parent nodes.
 *
 * LOD Tier 1 Behavior:
 * - Full detail rendering (main tree view)
 * - Photo avatars with ImageNode component
 * - Name text with bold SF Arabic font
 * - Generation badges (subtle, semi-transparent)
 * - Soft shadows for depth
 * - Selection highlighting (red border)
 *
 * Node Types:
 * 1. Root node (generation 1, no father):
 *    - Width: 120px (special), Height: 100px
 *    - Font size: 22pt (double size)
 *    - Sadu pattern icons (decorative)
 *    - Border radius: 20px (extra rounded)
 *
 * 2. G2 Parent (generation 2 with children):
 *    - Width: 95px (photo) / 75px (text-only)
 *    - Smaller Sadu icons (14px vs 20px)
 *    - Standard height
 *
 * 3. Standard nodes:
 *    - Width: 85px (photo) / 65px (text-only)
 *    - Height: 105px (photo) / 35px (text-only)
 *    - Border radius: 13px
 *
 * Layout Variations:
 * - Photo nodes: Avatar (50px circle) at top, name below
 * - Text-only nodes: Name centered vertically
 * - Generation badge: Top-right (photo) or centered top (text-only)
 *
 * Integration:
 * - Uses ImageNode for photo rendering
 * - Uses SaduIcon/SaduIconG2 for decorative patterns
 * - Uses getCachedParagraph for text rendering
 * - Updates nodeFramesRef for highlight system
 *
 * KNOWN PATTERNS (AS-IS for Phase 2):
 * - Requires getCachedParagraph from parent
 * - Requires SaduIcon/SaduIconG2 components
 * - Requires ImageNode component
 * - Uses nodeFramesRef for frame tracking
 * - Selection state from selectedPersonId prop
 */

import React from 'react';
import { Group, RoundedRect, Circle, Paragraph, Shadow } from '@shopify/react-native-skia';

// Import extracted components
import { ImageNode } from './ImageNode';
import { CircularNodeRenderer } from './CircularNodeRenderer';
import {
  STANDARD_NODE,
  ROOT_NODE,
  G2_NODE,
  CIRCULAR_NODE,
  PHOTO_SIZE,
  SHADOW_STYLES,
  COLORS,
} from './nodeConstants';

export interface LayoutNode {
  id: string;
  name: string;
  generation: number;
  father_id: string | null;
  photo_url?: string;
  x: number;
  y: number;
  nodeWidth?: number;
  _tier?: number;
  _scale?: number;
  _selectBucket?: (nodeId: string, pixelSize: number) => number;
  _hasChildren?: boolean;
}

export interface NodeRendererProps {
  // Node data
  node: LayoutNode;

  // Display settings
  showPhotos: boolean;
  selectedPersonId: string | null;
  nodeStyle?: 'rectangular' | 'circular'; // Tree Design System (Oct 2025)

  // Hero nodes for T1 detection
  heroNodes?: Array<{ id: string }>;

  // Search tiers for T2 detection
  searchTiers?: Record<string, number>;

  // Text rendering function from parent
  getCachedParagraph: (
    text: string,
    weight: string,
    size: number,
    color: string,
    maxWidth: number,
  ) => any;

  // Sadu icon components from parent
  SaduIcon: React.ComponentType<{ x: number; y: number; size: number }>;
  SaduIconG2: React.ComponentType<{ x: number; y: number; size: number }>;

  // Image loading hook from parent
  useBatchedSkiaImage: (url: string, bucket: number, priority: string) => any;

  // Frame tracking ref (mutated)
  nodeFramesRef: React.MutableRefObject<Map<string, any>>;
}

/**
 * Calculate node dimensions based on type
 *
 * Returns width, height, and border radius for a node based on:
 * - Root status (generation 1, no father)
 * - G2 parent status (generation 2 with children)
 * - Photo availability
 *
 * @param node - Layout node data
 * @param showPhotos - Whether photos are enabled
 * @param hasChildren - Whether node has children
 * @returns {width, height, borderRadius} Node dimensions
 */
export function calculateNodeDimensions(
  node: LayoutNode,
  showPhotos: boolean,
  hasChildren: boolean,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
): {
  width: number;
  height: number;
  borderRadius: number;
  shape: 'rectangular' | 'circular';
  diameter?: number;
} {
  const isRoot = !node.father_id;
  const hasPhoto = showPhotos && !!node.photo_url;
  const isG2Parent = node.generation === 2 && hasChildren;

  // Circular node dimensions
  if (nodeStyle === 'circular') {
    if (isRoot) {
      const totalHeight = CIRCULAR_NODE.ROOT_DIAMETER + CIRCULAR_NODE.NAME_GAP + CIRCULAR_NODE.ROOT_NAME_HEIGHT;
      return {
        width: CIRCULAR_NODE.ROOT_DIAMETER,
        height: totalHeight,
        borderRadius: CIRCULAR_NODE.ROOT_DIAMETER / 2,
        shape: 'circular',
        diameter: CIRCULAR_NODE.ROOT_DIAMETER,
      };
    }

    if (isG2Parent) {
      const totalHeight = CIRCULAR_NODE.G2_DIAMETER + CIRCULAR_NODE.NAME_GAP + CIRCULAR_NODE.G2_NAME_HEIGHT;
      return {
        width: CIRCULAR_NODE.G2_DIAMETER,
        height: totalHeight,
        borderRadius: CIRCULAR_NODE.G2_DIAMETER / 2,
        shape: 'circular',
        diameter: CIRCULAR_NODE.G2_DIAMETER,
      };
    }

    const totalHeight = CIRCULAR_NODE.DIAMETER + CIRCULAR_NODE.NAME_GAP + CIRCULAR_NODE.NAME_HEIGHT;
    return {
      width: CIRCULAR_NODE.DIAMETER,
      height: totalHeight,
      borderRadius: CIRCULAR_NODE.DIAMETER / 2,
      shape: 'circular',
      diameter: CIRCULAR_NODE.DIAMETER,
    };
  }

  // Rectangular node dimensions (existing logic)
  let width: number;
  let height: number;
  let borderRadius: number;

  if (isRoot) {
    width = ROOT_NODE.WIDTH;
    height = ROOT_NODE.HEIGHT;
    borderRadius = ROOT_NODE.BORDER_RADIUS;
  } else if (isG2Parent) {
    width = hasPhoto ? G2_NODE.WIDTH_PHOTO : G2_NODE.WIDTH_TEXT;
    height = hasPhoto ? G2_NODE.HEIGHT_PHOTO : G2_NODE.HEIGHT_TEXT;
    borderRadius = G2_NODE.BORDER_RADIUS;
  } else {
    width = node.nodeWidth || (hasPhoto ? STANDARD_NODE.WIDTH : STANDARD_NODE.WIDTH_TEXT_ONLY);
    height = hasPhoto ? STANDARD_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY;
    borderRadius = STANDARD_NODE.CORNER_RADIUS;
  }

  return {
    width,
    height,
    borderRadius,
    shape: 'rectangular',
  };
}

/**
 * Determine if node is a hero node (LOD Tier 1)
 *
 * @param nodeId - Node ID to check
 * @param heroNodes - Array of hero nodes
 * @returns true if node is a hero
 */
export function isHeroNode(nodeId: string, heroNodes?: Array<{ id: string }>): boolean {
  return heroNodes?.some((hero) => hero.id === nodeId) || false;
}

/**
 * Determine if node is a search Tier 2 node
 *
 * @param nodeId - Node ID to check
 * @param searchTiers - Search tier mapping
 * @returns true if node is Tier 2
 */
export function isSearchTier2(nodeId: string, searchTiers?: Record<string, number>): boolean {
  return searchTiers?.[nodeId] === 2;
}

/**
 * Render soft blurred shadow (used as child of RoundedRect)
 *
 * iOS-style soft shadow with Gaussian blur.
 * Uses Camel Hair Beige to match connection lines.
 *
 * @returns Shadow component
 */
export function renderShadow(): JSX.Element {
  return (
    <Shadow
      dx={SHADOW_STYLES.STANDARD_DX}
      dy={SHADOW_STYLES.STANDARD_DY}
      blur={SHADOW_STYLES.STANDARD_BLUR}
      color={SHADOW_STYLES.STANDARD_COLOR}
    />
  );
}

/**
 * Render node background
 *
 * @param x - Background X position
 * @param y - Background Y position
 * @param width - Background width
 * @param height - Background height
 * @param borderRadius - Corner radius
 * @returns Background element
 */
export function renderBackground(
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
): JSX.Element {
  return (
    <RoundedRect
      x={x}
      y={y}
      width={width}
      height={height}
      r={borderRadius}
      color={COLORS.NODE_BACKGROUND}
    >
      {/* Glassmorphism shadow for depth */}
      {renderShadow()}
    </RoundedRect>
  );
}

/**
 * Render node border
 *
 * @param x - Border X position
 * @param y - Border Y position
 * @param width - Border width
 * @param height - Border height
 * @param borderRadius - Corner radius
 * @param isSelected - Whether node is selected
 * @param isRoot - Whether node is root (affects border width)
 * @returns Border element
 */
export function renderBorder(
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
  isSelected: boolean,
  isRoot: boolean = false,
): JSX.Element | null {
  // Only render border for selected nodes
  if (!isSelected) return null;

  const strokeWidth = isRoot ? ROOT_NODE.SELECTION_BORDER : STANDARD_NODE.SELECTION_BORDER;

  return (
    <RoundedRect
      x={x}
      y={y}
      width={width}
      height={height}
      r={borderRadius}
      color={COLORS.SELECTION_BORDER}
      style="stroke"
      strokeWidth={strokeWidth}
    />
  );
}

/**
 * Render photo placeholder (skeleton)
 *
 * @param centerX - Square center X
 * @param centerY - Square center Y
 * @param size - Square size (width and height)
 * @param cornerRadius - Corner radius for rounded square
 * @returns Placeholder elements
 */
export function renderPhotoPlaceholder(
  centerX: number,
  centerY: number,
  size: number,
  cornerRadius: number,
): JSX.Element {
  const x = centerX - size / 2;
  const y = centerY - size / 2;

  return (
    <>
      <RoundedRect x={x} y={y} width={size} height={size} r={cornerRadius} color={COLORS.SKELETON} />
      <RoundedRect
        x={x}
        y={y}
        width={size}
        height={size}
        r={cornerRadius}
        color="#D1BBA340"
        style="stroke"
        strokeWidth={1}
      />
    </>
  );
}

/**
 * Render generation badge
 *
 * @param generation - Generation number
 * @param x - Badge X position
 * @param y - Badge Y position
 * @param width - Max width for centering
 * @param getCachedParagraph - Text rendering function
 * @returns Badge element or null
 */
export function renderGenerationBadge(
  generation: number,
  x: number,
  y: number,
  width: number,
  getCachedParagraph: (text: string, weight: string, size: number, color: string, maxWidth: number) => any,
): JSX.Element | null {
  const genParagraph = getCachedParagraph(
    String(generation),
    "regular",
    7,
    "#24212140", // Sadu Night with 25% opacity
    width,
  );

  if (!genParagraph) return null;

  return <Paragraph paragraph={genParagraph} x={x} y={y} width={width} />;
}

/**
 * Render name text
 *
 * @param name - Name to render
 * @param isRoot - Whether node is root (double size)
 * @param x - Text X position
 * @param y - Text Y position
 * @param width - Max width
 * @param getCachedParagraph - Text rendering function
 * @returns Name element or null
 */
export function renderNameText(
  name: string,
  isRoot: boolean,
  x: number,
  y: number,
  width: number,
  getCachedParagraph: (text: string, weight: string, size: number, color: string, maxWidth: number) => any,
): JSX.Element | null {
  const nameParagraph = getCachedParagraph(
    name,
    "bold",
    isRoot ? 22 : 11,
    COLORS.TEXT,
    width,
  );

  if (!nameParagraph) return null;

  return <Paragraph paragraph={nameParagraph} x={x} y={y} width={width} />;
}

/**
 * NodeRenderer component
 *
 * Renders LOD Tier 1 full node card with photo/text layout.
 *
 * @param props - Node renderer props
 * @returns Node card Group element
 */
export const NodeRenderer: React.FC<NodeRendererProps> = ({
  node,
  showPhotos,
  selectedPersonId,
  nodeStyle = 'rectangular', // Default to rectangular for backwards compatibility
  heroNodes,
  searchTiers,
  getCachedParagraph,
  SaduIcon,
  SaduIconG2,
  useBatchedSkiaImage,
  nodeFramesRef,
}) => {
  const isRoot = !node.father_id;
  const hasPhoto = showPhotos && !!node.photo_url;
  const isG2Parent = node.generation === 2 && node._hasChildren;
  const isSelected = selectedPersonId === node.id;

  const isT1 = isHeroNode(node.id, heroNodes);
  const isT2 = isSearchTier2(node.id, searchTiers);

  // Calculate dimensions (now with nodeStyle support)
  const dimensions = calculateNodeDimensions(
    node,
    showPhotos,
    node._hasChildren || false,
    nodeStyle,
  );

  // Conditional rendering: Use CircularNodeRenderer for circular nodes
  if (dimensions.shape === 'circular') {
    return (
      <CircularNodeRenderer
        node={node}
        showPhotos={showPhotos}
        isSelected={isSelected}
        dimensions={dimensions}
        getCachedParagraph={getCachedParagraph}
      />
    );
  }

  // Rectangular node rendering (existing logic below)
  const { width, height, borderRadius } = dimensions;

  // Calculate position (centered)
  // Unified PTS Architecture: node.y already includes root offset + top-alignment
  // No runtime offsets needed - just use node.y directly!
  const x = node.x - width / 2;
  const y = node.y - height / 2;

  // Track frame for highlight system
  nodeFramesRef.current.set(node.id, {
    x,
    y,
    width,
    height,
    borderRadius: isRoot ? ROOT_NODE.BORDER_RADIUS : isT1 ? 16 : isT2 ? 13 : STANDARD_NODE.CORNER_RADIUS,
  });

  return (
    <Group key={node.id}>
      {/* Main card background with soft shadow inside */}
      {renderBackground(x, y, width, height, borderRadius)}

      {/* Border */}
      {renderBorder(x, y, width, height, borderRadius, isSelected, isRoot)}

      {hasPhoto ? (
        <>
          {/* Photo placeholder */}
          {renderPhotoPlaceholder(node.x, node.y - 10, PHOTO_SIZE, STANDARD_NODE.CORNER_RADIUS)}

          {/* Load and display image if available */}
          {node.photo_url && (
            <ImageNode
              url={node.photo_url}
              x={node.x - PHOTO_SIZE / 2}
              y={node.y - 10 - PHOTO_SIZE / 2}
              width={PHOTO_SIZE}
              height={PHOTO_SIZE}
              cornerRadius={STANDARD_NODE.CORNER_RADIUS}
              tier={node._tier || 1}
              scale={node._scale || 1}
              nodeId={node.id}
              selectBucket={node._selectBucket}
              showPhotos={showPhotos}
              useBatchedSkiaImage={useBatchedSkiaImage}
            />
          )}

          {/* Name text - positioned near bottom of card */}
          {(() => {
            const nameParagraph = getCachedParagraph(
              node.name,
              "bold",
              isRoot ? 22 : 11,
              COLORS.TEXT,
              width,
            );

            if (!nameParagraph) return null;

            // Position text near bottom of card - slightly higher than bottom edge
            const textY = y + (height * 0.80) - (nameParagraph.getHeight() / 2) + 2;

            return <Paragraph paragraph={nameParagraph} x={x} y={textY} width={width} />;
          })()}
        </>
      ) : (
        <>

          {/* Text-only name - centered vertically */}
          {(() => {
            const nameParagraph = getCachedParagraph(
              node.name,
              "bold",
              isRoot ? 22 : 11,
              COLORS.TEXT,
              width,
            );

            if (!nameParagraph) return null;

            const textX = x;
            const textY = y + (height - nameParagraph.getHeight()) / 2;

            return <Paragraph paragraph={nameParagraph} x={textX} y={textY} width={width} />;
          })()}

          {/* Sadu icons for root node */}
          {isRoot && !hasPhoto && (
            <>
              {/* Left Sadu icon */}
              <SaduIcon x={x + 5} y={y + height / 2 - 10} size={20} />

              {/* Right Sadu icon */}
              <SaduIcon x={x + width - 25} y={y + height / 2 - 10} size={20} />
            </>
          )}

          {/* Sadu icons for Generation 2 parent nodes */}
          {isG2Parent && (
            <>
              {/* Left Sadu icon */}
              <SaduIconG2
                x={x + 3}
                y={hasPhoto ? y + 5 : y + height / 2 - 7}
                size={14}
              />

              {/* Right Sadu icon */}
              <SaduIconG2
                x={x + width - 17}
                y={hasPhoto ? y + 5 : y + height / 2 - 7}
                size={14}
              />
            </>
          )}
        </>
      )}
    </Group>
  );
};

// Export constants for testing (re-exported from nodeConstants.ts)
export const NODE_RENDERER_CONSTANTS = {
  NODE_WIDTH_WITH_PHOTO: STANDARD_NODE.WIDTH,      // 54
  NODE_HEIGHT_WITH_PHOTO: STANDARD_NODE.HEIGHT,    // 75
  NODE_WIDTH_TEXT_ONLY: STANDARD_NODE.WIDTH_TEXT_ONLY,  // 54
  NODE_HEIGHT_TEXT_ONLY: STANDARD_NODE.HEIGHT_TEXT_ONLY,  // 35
  PHOTO_SIZE: PHOTO_SIZE,                          // 50
  CORNER_RADIUS: STANDARD_NODE.CORNER_RADIUS,      // 10
  SELECTION_BORDER: STANDARD_NODE.SELECTION_BORDER,  // 2
  ROOT_WIDTH: ROOT_NODE.WIDTH,                     // 120
  ROOT_HEIGHT: ROOT_NODE.HEIGHT,                   // 100
  ROOT_BORDER_RADIUS: ROOT_NODE.BORDER_RADIUS,     // 20
  G2_PHOTO_WIDTH: G2_NODE.WIDTH_PHOTO,             // 95
  G2_TEXT_WIDTH: G2_NODE.WIDTH_TEXT,               // 75
  G2_BORDER_RADIUS: G2_NODE.BORDER_RADIUS,         // 16
};
