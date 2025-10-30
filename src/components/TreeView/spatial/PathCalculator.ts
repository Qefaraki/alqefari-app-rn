/**
 * PathCalculator - Connection line geometry calculations
 *
 * Phase 2 Day 1 - Extracted from TreeView.js (lines 2666-2840)
 *
 * Calculates parent-child connection line positions for tree rendering.
 * Handles parent vertical lines, horizontal bus lines, and child vertical lines.
 *
 * Geometry:
 * - Parent vertical: From parent bottom to bus line
 * - Horizontal bus: Spans all children at midpoint Y
 * - Child verticals: From bus line to child top
 *
 * Performance:
 * - Used in batched path rendering (50 edges per batch)
 * - Avoids creating individual <Line> elements
 * - Single Skia Path for all connections
 */

import {
  NODE_HEIGHT_WITH_PHOTO,
  NODE_HEIGHT_TEXT_ONLY,
  CIRCULAR_NODE,
} from '../rendering/nodeConstants';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;  // FINAL position (includes root offset + top-alignment)
  father_id?: string | null;
  photo_url?: string | null;
  [key: string]: any;
}

export interface PathSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface Connection {
  parent: LayoutNode;
  children: LayoutNode[];
}

// === Tree Design System (October 2025) - Circular Node Support ===

/**
 * Calculate connection point on circular node edge
 *
 * Returns the point on the circle's circumference closest to the target point.
 * Used for connecting lines to circular avatar nodes.
 *
 * @param centerX - Circle center X coordinate
 * @param centerY - Circle center Y coordinate
 * @param radius - Circle radius
 * @param targetX - Target point X (where line is going)
 * @param targetY - Target point Y (where line is going)
 * @returns Point on circle circumference {x, y}
 */
export function calculateCircularEdgePoint(
  centerX: number,
  centerY: number,
  radius: number,
  targetX: number,
  targetY: number,
): { x: number; y: number } {
  // Vector from center to target
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Handle edge case: target at center
  if (distance === 0) {
    return { x: centerX, y: centerY };
  }

  // Normalize and scale to radius
  return {
    x: centerX + (dx / distance) * radius,
    y: centerY + (dy / distance) * radius,
  };
}

/**
 * Get node edge point for connection lines
 *
 * Works for both rectangular and circular nodes.
 * For rectangular: Returns top/bottom center point
 * For circular: Returns edge point in direction of target
 *
 * @param node - Node to connect to
 * @param targetX - Target X coordinate (where line is going)
 * @param targetY - Target Y coordinate (where line is going)
 * @param nodeStyle - 'rectangular' or 'circular'
 * @param position - 'top' or 'bottom' (for rectangular nodes)
 * @param showPhotos - Whether photos are visible (affects height calculation)
 * @returns Edge point coordinates {x, y}
 */
export function getNodeEdgePoint(
  node: LayoutNode,
  targetX: number,
  targetY: number,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
  position: 'top' | 'bottom',
  showPhotos: boolean = true,
): { x: number; y: number } {
  if (nodeStyle === 'circular') {
    // Circular node: calculate edge point based on direction to target
    // Determine radius based on node type
    const isRoot = !node.father_id;
    const hasChildren = (node as any)._hasChildren || false;
    const isG2Parent = node.generation === 2 && hasChildren;

    let radius: number;
    if (isRoot) {
      radius = CIRCULAR_NODE.ROOT_DIAMETER / 2;
    } else if (isG2Parent) {
      radius = CIRCULAR_NODE.G2_DIAMETER / 2;
    } else {
      radius = CIRCULAR_NODE.DIAMETER / 2;
    }

    return calculateCircularEdgePoint(node.x, node.y, radius, targetX, targetY);
  }

  // Rectangular node: use existing logic (top/bottom center)
  const nodeShowingPhoto = ((node as any)._showPhoto ?? showPhotos) && node.photo_url;
  const isRoot = !node.father_id;

  let height: number;
  if (isRoot) {
    height = 100; // Root nodes
  } else {
    height = nodeShowingPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
  }

  return {
    x: node.x,
    y: position === 'bottom' ? node.y + height / 2 : node.y - height / 2,
  };
}

// === End Circular Node Support ===

/**
 * Calculate bus line Y coordinate (midpoint between parent bottom and nearest child top)
 *
 * Uses actual node heights to calculate edge positions, accounting for variable heights.
 *
 * @param parent - Parent node
 * @param children - Array of child nodes (must have at least one child)
 * @param showPhotos - Whether photos are visible (affects node height)
 * @returns Y coordinate for horizontal bus line
 * @throws Error if children array is empty
 */
export function calculateBusY(
  parent: LayoutNode,
  children: LayoutNode[],
  showPhotos: boolean = true,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular'
): number {
  if (children.length === 0) {
    throw new Error('calculateBusY requires at least one child node');
  }

  // Unified PTS Architecture: node.y already includes all offsets (root + top-alignment)
  // Just use node.y directly to get parent and child positions

  // Parent bottom edge (circular-aware)
  const parentBottom = getNodeEdgePoint(
    parent,
    parent.x,
    parent.y + 1000, // Target far below to ensure bottom point
    nodeStyle,
    'bottom',
    showPhotos
  ).y;

  // Nearest child top edge (circular-aware)
  const childTops = children.map(child =>
    getNodeEdgePoint(
      child,
      child.x,
      child.y - 1000, // Target far above to ensure top point
      nodeStyle,
      'top',
      showPhotos
    ).y
  );
  const minChildTop = Math.min(...childTops);

  // Midpoint between parent bottom and nearest child top
  return parentBottom + (minChildTop - parentBottom) / 2;
}

/**
 * Calculate parent vertical line segment
 *
 * @param parent - Parent node
 * @param busY - Bus line Y coordinate
 * @param showPhotos - Whether photos are visible (affects node height)
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 * @returns Path segment from parent bottom to bus line
 */
export function calculateParentVerticalPath(
  parent: LayoutNode,
  busY: number,
  showPhotos: boolean = true,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
): PathSegment {
  // Get parent bottom edge point (circular-aware)
  const parentBottom = getNodeEdgePoint(
    parent,
    parent.x,      // Target X (bus line is directly below)
    busY,          // Target Y (bus line)
    nodeStyle,
    'bottom',
    showPhotos
  );

  return {
    startX: parentBottom.x,
    startY: parentBottom.y,
    endX: parent.x,
    endY: busY,
  };
}

/**
 * Determine if horizontal bus line should be rendered
 *
 * Bus line is needed if:
 * - Multiple children (need to connect them)
 * - Single child with X offset from parent (>5px)
 *
 * @param children - Array of child nodes
 * @param parent - Parent node
 * @returns True if bus line should be rendered
 */
export function shouldRenderBusLine(
  children: LayoutNode[],
  parent: LayoutNode
): boolean {
  if (children.length > 1) return true;

  // Single child: only render if offset from parent
  return Math.abs(parent.x - children[0].x) > 5;
}

/**
 * Calculate horizontal bus line segment
 *
 * @param children - Array of child nodes
 * @param busY - Bus line Y coordinate
 * @returns Path segment spanning all children at busY
 */
export function calculateBusLine(
  children: LayoutNode[],
  busY: number
): PathSegment {
  const childXs = children.map((child) => child.x);
  const minChildX = Math.min(...childXs);
  const maxChildX = Math.max(...childXs);

  return {
    startX: minChildX,
    startY: busY,
    endX: maxChildX,
    endY: busY,
  };
}

/**
 * Calculate child vertical line segments
 *
 * @param children - Array of child nodes
 * @param busY - Bus line Y coordinate
 * @param showPhotos - Whether photos are visible (affects node height)
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 * @returns Array of path segments from bus line to each child top
 */
export function calculateChildVerticalPaths(
  children: LayoutNode[],
  busY: number,
  showPhotos: boolean = true,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
): PathSegment[] {
  return children.map((child) => {
    // Get child top edge point (circular-aware)
    const childTop = getNodeEdgePoint(
      child,
      child.x,       // Target X (bus line is directly above)
      busY,          // Target Y (bus line)
      nodeStyle,
      'top',
      showPhotos
    );

    return {
      startX: child.x,
      startY: busY,
      endX: childTop.x,
      endY: childTop.y,
    };
  });
}

/**
 * Calculate all path segments for a parent-children connection
 *
 * Combines parent vertical, bus line (if needed), and child verticals
 * into a single array of path segments for batched rendering.
 *
 * @param connection - Parent and children nodes
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 * @returns Array of all path segments for this connection
 *
 * @example
 * const segments = calculateConnectionPaths({
 *   parent: { id: '1', x: 100, y: 50, photo_url: 'url' },
 *   children: [
 *     { id: '2', x: 80, y: 150, father_id: '1' },
 *     { id: '3', x: 120, y: 150, father_id: '1' }
 *   ]
 * }, true, 'rectangular');
 * // Returns: [parentVertical, busLine, child1Vertical, child2Vertical]
 */
export function calculateConnectionPaths(
  connection: Connection,
  showPhotos: boolean = true,
  nodeStyle: 'rectangular' | 'circular' = 'rectangular',
): PathSegment[] {
  const { parent, children } = connection;
  const segments: PathSegment[] = [];

  // Calculate bus line Y (accounting for node heights)
  const busY = calculateBusY(parent, children, showPhotos, nodeStyle);

  // Add parent vertical line
  segments.push(calculateParentVerticalPath(parent, busY, showPhotos, nodeStyle));

  // Add horizontal bus line if needed
  if (shouldRenderBusLine(children, parent)) {
    segments.push(calculateBusLine(children, busY));
  }

  // Add child vertical lines
  segments.push(...calculateChildVerticalPaths(children, busY, showPhotos, nodeStyle));

  return segments;
}
