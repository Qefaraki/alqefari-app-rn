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
import { Group, RoundedRect, Circle, Paragraph } from '@shopify/react-native-skia';

// Import extracted components
import { ImageNode } from './ImageNode';

// Node dimensions constants (from TreeView utilities)
// TEMP: Minimal padding until Perfect Tree redesign
const NODE_WIDTH_WITH_PHOTO = 65;  // Was 85, then 75, now 65 (minimal padding)
const NODE_HEIGHT_WITH_PHOTO = 75; // Was 105, then 85, now 75 (minimal padding)
const NODE_WIDTH_TEXT_ONLY = 50;   // Was 65 (further reduced for tighter spacing)
const NODE_HEIGHT_TEXT_ONLY = 35;
const PHOTO_SIZE = 50;
const CORNER_RADIUS = 4; // Smooth corners

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
): { width: number; height: number; borderRadius: number } {
  const isRoot = !node.father_id;
  const hasPhoto = showPhotos && !!node.photo_url;
  const isG2Parent = node.generation === 2 && hasChildren;

  let width: number;
  let height: number;
  let borderRadius: number;

  if (isRoot) {
    width = 120;
    height = 100;
    borderRadius = 20;
  } else if (isG2Parent) {
    width = hasPhoto ? 95 : 75;
    height = hasPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
    borderRadius = 16;
  } else {
    width = node.nodeWidth || (hasPhoto ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY);
    height = hasPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
    borderRadius = CORNER_RADIUS;
  }

  return { width, height, borderRadius };
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
 * Render node shadow
 *
 * Soft shadow for depth effect.
 *
 * @param x - Shadow X position
 * @param y - Shadow Y position
 * @param width - Shadow width
 * @param height - Shadow height
 * @param borderRadius - Corner radius
 * @returns Shadow element
 */
export function renderShadow(
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
): JSX.Element {
  return (
    <RoundedRect
      x={x + 1}
      y={y + 1}
      width={width}
      height={height}
      r={borderRadius}
      color="#00000015"
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
      color="#FFFFFF"
    />
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
 * @returns Border element
 */
export function renderBorder(
  x: number,
  y: number,
  width: number,
  height: number,
  borderRadius: number,
  isSelected: boolean,
): JSX.Element {
  return (
    <RoundedRect
      x={x}
      y={y}
      width={width}
      height={height}
      r={borderRadius}
      color={isSelected ? "#A13333" : "#D1BBA360"}
      style="stroke"
      strokeWidth={isSelected ? 2.5 : 1.2}
    />
  );
}

/**
 * Render photo placeholder (skeleton)
 *
 * @param centerX - Circle center X
 * @param centerY - Circle center Y
 * @param radius - Circle radius
 * @returns Placeholder elements
 */
export function renderPhotoPlaceholder(
  centerX: number,
  centerY: number,
  radius: number,
): JSX.Element {
  return (
    <>
      <Circle cx={centerX} cy={centerY} r={radius} color="#D1BBA320" />
      <Circle
        cx={centerX}
        cy={centerY}
        r={radius}
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
    "#242121",
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

  // Calculate dimensions
  const { width, height, borderRadius } = calculateNodeDimensions(
    node,
    showPhotos,
    node._hasChildren || false,
  );

  // Calculate position (centered)
  const x = node.x - width / 2;
  const y = node.y - height / 2;

  // Track frame for highlight system
  nodeFramesRef.current.set(node.id, {
    x,
    y,
    width,
    height,
    borderRadius: isRoot ? 20 : isT1 ? 16 : isT2 ? 13 : CORNER_RADIUS,
  });

  return (
    <Group key={node.id}>
      {/* Soft shadow */}
      {renderShadow(x, y, width, height, borderRadius)}

      {/* Main card background */}
      {renderBackground(x, y, width, height, borderRadius)}

      {/* Border */}
      {renderBorder(x, y, width, height, borderRadius, isSelected)}

      {hasPhoto ? (
        <>
          {/* Photo placeholder */}
          {renderPhotoPlaceholder(node.x, node.y - 10, PHOTO_SIZE / 2)}

          {/* Load and display image if available */}
          {node.photo_url && (
            <ImageNode
              url={node.photo_url}
              x={node.x - PHOTO_SIZE / 2}
              y={node.y - 10 - PHOTO_SIZE / 2}
              width={PHOTO_SIZE}
              height={PHOTO_SIZE}
              radius={PHOTO_SIZE / 2}
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
              "#242121",
              width,
            );

            if (!nameParagraph) return null;

            // Position text near bottom of card - slightly higher than bottom edge
            const textY = y + (height * 0.80) - (nameParagraph.getHeight() / 2);

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
              "#242121",
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

// Export constants for testing
export const NODE_RENDERER_CONSTANTS = {
  NODE_WIDTH_WITH_PHOTO: 65,
  NODE_HEIGHT_WITH_PHOTO: 75,
  NODE_WIDTH_TEXT_ONLY: 50,   // Updated from 65
  NODE_HEIGHT_TEXT_ONLY: 35,
  PHOTO_SIZE: 50,
  CORNER_RADIUS: 4,
  ROOT_WIDTH: 120,
  ROOT_HEIGHT: 100,
  ROOT_BORDER_RADIUS: 20,
  G2_PHOTO_WIDTH: 95,
  G2_TEXT_WIDTH: 75,
  G2_BORDER_RADIUS: 16,
};
