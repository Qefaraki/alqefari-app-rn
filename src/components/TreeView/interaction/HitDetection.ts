/**
 * Hit Detection Module
 * Phase 1 - Gesture Refactoring
 *
 * Extracted from TreeView.js (lines 2201-2266)
 * Handles tap coordinate detection for T3 chips and T1/T2 nodes.
 *
 * Key Responsibilities:
 * - T3 chip tap detection (aggregation mode)
 * - T1/T2 node bounds checking
 * - Screen-to-canvas coordinate transformation
 *
 * CRITICAL: This module expects gestureStateRef to be synchronized BEFORE calling.
 * The caller MUST run syncTransformAndBounds() before hit detection.
 */

/**
 * Tree node structure (subset of fields needed for hit detection)
 */
export interface TreeNode {
  id: string;
  x: number;
  y: number;
  father_id?: string | null;
  photo_url?: string | null;
  name?: string;
  [key: string]: any;
}

/**
 * Spatial indices structure for T3 aggregation
 */
export interface TreeIndices {
  heroNodes?: TreeNode[];
  centroids?: Record<string, { x: number; y: number }>;
  [key: string]: any;
}

/**
 * Transform state for coordinate conversion
 */
export interface Transform {
  x: number;
  y: number;
  scale: number;
}

/**
 * Hit detection context (from gestureStateRef.current)
 */
export interface HitDetectionContext {
  tier: number;
  indices: TreeIndices | null;
  visibleNodes: TreeNode[];
  transform: Transform;
}

/**
 * Chip tap result (T3 aggregation mode)
 */
export interface ChipTapResult {
  type: 'chip';
  hero: TreeNode;
}

/**
 * Node tap result (T1/T2 mode)
 */
export interface NodeTapResult {
  type: 'node';
  nodeId: string | null;
}

/**
 * Combined tap result
 */
export type TapResult = ChipTapResult | NodeTapResult | null;

import {
  ROOT_NODE,
  STANDARD_NODE,
  CIRCULAR_NODE,
} from '../rendering/nodeConstants';

/**
 * Node dimension constants (imported from centralized nodeConstants)
 */
export const NODE_DIMENSIONS = {
  ROOT_WIDTH: ROOT_NODE.WIDTH,      // 120
  ROOT_HEIGHT: ROOT_NODE.HEIGHT,    // 100
  CHIP_WIDTH_BASE: 100,             // T3 chip base width
  CHIP_HEIGHT_BASE: 36,             // T3 chip base height
  CHIP_SCALE_ROOT: 1.3,             // Root chips are 1.3x larger
  CHIP_SCALE_NORMAL: 1.0,           // Standard chips at 1.0x
};

/**
 * Detect T3 aggregation chip tap
 *
 * Checks if tap coordinates hit any hero node chip in T3 mode.
 * Chips are rendered as rounded rectangles with dynamic scaling (root nodes are 1.3x larger).
 *
 * Algorithm:
 * 1. Only runs if tier === 3 and AGGREGATION_ENABLED
 * 2. Transforms centroid from canvas to screen space
 * 3. Applies chip scaling (1.3x for root, 1.0x for others)
 * 4. Checks if tap is within chip bounds
 *
 * @param tapX - Screen X coordinate
 * @param tapY - Screen Y coordinate
 * @param context - Hit detection context from gestureStateRef
 * @param aggregationEnabled - AGGREGATION_ENABLED flag from TreeView
 * @returns ChipTapResult if chip hit, null otherwise
 */
export function detectChipTap(
  tapX: number,
  tapY: number,
  context: HitDetectionContext,
  aggregationEnabled: boolean
): ChipTapResult | null {
  // Only check chips in T3 mode with aggregation enabled
  if (context.tier !== 3 || !aggregationEnabled || !context.indices?.heroNodes) {
    return null;
  }

  // Check each hero node chip
  for (const hero of context.indices.heroNodes) {
    const centroid = context.indices.centroids?.[hero.id];
    if (!centroid) continue;

    // Transform centroid from canvas to screen space
    const screenX = centroid.x * context.transform.scale + context.transform.x;
    const screenY = centroid.y * context.transform.scale + context.transform.y;

    // Calculate chip dimensions (root nodes are scaled 1.3x)
    const isRoot = !hero.father_id;
    const chipScale = isRoot ? NODE_DIMENSIONS.CHIP_SCALE_ROOT : NODE_DIMENSIONS.CHIP_SCALE_NORMAL;
    const chipWidth = NODE_DIMENSIONS.CHIP_WIDTH_BASE * chipScale;
    const chipHeight = NODE_DIMENSIONS.CHIP_HEIGHT_BASE * chipScale;

    // Check if tap is within chip bounds (centered on centroid)
    if (
      tapX >= screenX - chipWidth / 2 &&
      tapX <= screenX + chipWidth / 2 &&
      tapY >= screenY - chipHeight / 2 &&
      tapY <= screenY + chipHeight / 2
    ) {
      return { type: 'chip', hero };
    }
  }

  // No chip hit in T3 mode means ignore tap (return null, not node detection)
  return null;
}

// === Tree Design System (October 2025) - Circular Node Hit Detection ===

/**
 * Check if point is inside circular node
 *
 * Uses distance formula to check if tap point is within circle radius.
 *
 * @param canvasX - Tap X in canvas space
 * @param canvasY - Tap Y in canvas space
 * @param node - Tree node
 * @param hasChildren - Whether node has children (for G2 detection)
 * @returns True if point is inside circle
 */
function isPointInCircle(
  canvasX: number,
  canvasY: number,
  node: TreeNode,
  hasChildren: boolean
): boolean {
  const isRoot = !node.father_id;
  const isG2Parent = node.generation === 2 && hasChildren;

  // Determine radius based on node type
  let radius: number;
  if (isRoot) {
    radius = CIRCULAR_NODE.ROOT_DIAMETER / 2;
  } else if (isG2Parent) {
    radius = CIRCULAR_NODE.G2_DIAMETER / 2;
  } else {
    radius = CIRCULAR_NODE.DIAMETER / 2;
  }

  // Distance formula: √((x2-x1)² + (y2-y1)²)
  const dx = canvasX - node.x;
  const dy = canvasY - node.y;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSquared = radius * radius;

  return distanceSquared <= radiusSquared;
}

// === End Circular Node Hit Detection ===

/**
 * Detect T1/T2 node tap
 *
 * Checks if tap coordinates hit any visible node bounds.
 * Nodes have dynamic dimensions based on type (root, photo, text-only).
 * Supports both rectangular and circular nodes (Tree Design System).
 *
 * Algorithm:
 * 1. Transforms tap coordinates from screen to canvas space
 * 2. Iterates visible nodes checking bounds
 * 3. Root nodes: 120x100 (rect) or 100px diameter (circular)
 * 4. Photo nodes: NODE_WIDTH_WITH_PHOTO x NODE_HEIGHT_WITH_PHOTO (rect) or 40px diameter (circular)
 * 5. Text-only nodes: NODE_WIDTH_TEXT_ONLY x NODE_HEIGHT_TEXT_ONLY (rect) or 40px diameter (circular)
 *
 * @param tapX - Screen X coordinate
 * @param tapY - Screen Y coordinate
 * @param context - Hit detection context from gestureStateRef
 * @param nodeWidthWithPhoto - Photo node width constant
 * @param nodeHeightWithPhoto - Photo node height constant
 * @param nodeWidthTextOnly - Text-only node width constant
 * @param nodeHeightTextOnly - Text-only node height constant
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 * @returns NodeTapResult with nodeId (or null if no hit)
 */
export function detectNodeTap(
  tapX: number,
  tapY: number,
  context: HitDetectionContext,
  nodeWidthWithPhoto: number,
  nodeHeightWithPhoto: number,
  nodeWidthTextOnly: number,
  nodeHeightTextOnly: number,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
): NodeTapResult {
  // Transform screen coordinates to canvas space
  const canvasX = (tapX - context.transform.x) / context.transform.scale;
  const canvasY = (tapY - context.transform.y) / context.transform.scale;

  // Check each visible node
  for (const node of context.visibleNodes) {
    const hasChildren = (node as any)._hasChildren || false;

    // Circular hit detection (Tree Design System)
    if (nodeStyle === 'circular') {
      if (isPointInCircle(canvasX, canvasY, node, hasChildren)) {
        return { type: 'node', nodeId: node.id };
      }
      continue;
    }

    // Rectangular hit detection (original system)
    const isRoot = !node.father_id;

    // Determine node dimensions based on type
    const nodeWidth = isRoot
      ? NODE_DIMENSIONS.ROOT_WIDTH
      : (node.photo_url ? nodeWidthWithPhoto : nodeWidthTextOnly);
    const nodeHeight = isRoot
      ? NODE_DIMENSIONS.ROOT_HEIGHT
      : (node.photo_url ? nodeHeightWithPhoto : nodeHeightTextOnly);

    // Check if tap is within node bounds (centered on node.x, node.y)
    if (
      canvasX >= node.x - nodeWidth / 2 &&
      canvasX <= node.x + nodeWidth / 2 &&
      canvasY >= node.y - nodeHeight / 2 &&
      canvasY <= node.y + nodeHeight / 2
    ) {
      return { type: 'node', nodeId: node.id };
    }
  }

  // No node hit
  return { type: 'node', nodeId: null };
}

/**
 * Combined tap detection (chip first, then node)
 *
 * This is the main entry point for tap hit detection.
 * Checks T3 chips first (if in T3 mode), then falls back to node detection.
 *
 * CRITICAL: Caller MUST synchronize gestureStateRef.current.transform before calling:
 * ```javascript
 * syncTransformAndBounds();
 * gestureStateRef.current = {
 *   ...gestureStateRef.current,
 *   transform: { x: translateX.value, y: translateY.value, scale: scale.value }
 * };
 * const result = detectTap(x, y, gestureStateRef.current, ...);
 * ```
 *
 * @param tapX - Screen X coordinate
 * @param tapY - Screen Y coordinate
 * @param context - Hit detection context from gestureStateRef
 * @param aggregationEnabled - AGGREGATION_ENABLED flag from TreeView
 * @param nodeWidthWithPhoto - Photo node width constant
 * @param nodeHeightWithPhoto - Photo node height constant
 * @param nodeWidthTextOnly - Text-only node width constant
 * @param nodeHeightTextOnly - Text-only node height constant
 * @returns ChipTapResult, NodeTapResult, or null
 */
export function detectTap(
  tapX: number,
  tapY: number,
  context: HitDetectionContext,
  aggregationEnabled: boolean,
  nodeWidthWithPhoto: number,
  nodeHeightWithPhoto: number,
  nodeWidthTextOnly: number,
  nodeHeightTextOnly: number,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
): TapResult {
  // Check T3 chips first (priority over nodes)
  const chipResult = detectChipTap(tapX, tapY, context, aggregationEnabled);
  if (chipResult) {
    return chipResult;
  }

  // If in T3 mode but no chip hit, ignore tap (don't check nodes)
  if (context.tier === 3 && aggregationEnabled && context.indices?.heroNodes) {
    return null;
  }

  // Check T1/T2 nodes (with circular support)
  return detectNodeTap(
    tapX,
    tapY,
    context,
    nodeWidthWithPhoto,
    nodeHeightWithPhoto,
    nodeWidthTextOnly,
    nodeHeightTextOnly,
    nodeStyle
  );
}
