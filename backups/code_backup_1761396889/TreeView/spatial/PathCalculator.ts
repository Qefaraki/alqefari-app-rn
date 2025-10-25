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
} from '../utils/constants/nodes';

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
  showPhotos: boolean = true
): number {
  if (children.length === 0) {
    throw new Error('calculateBusY requires at least one child node');
  }

  // Unified PTS Architecture: node.y already includes all offsets (root + top-alignment)
  // Just use node.y directly to get parent and child positions

  // Parent bottom edge
  const parentShowingPhoto = ((parent as any)._showPhoto ?? showPhotos) && parent.photo_url;
  const parentHeight = parentShowingPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
  const parentBottom = parent.y + parentHeight / 2;

  // Nearest child top edge
  const childTops = children.map(child => {
    const isRootChild = !child.father_id;
    const childShowingPhoto = ((child as any)._showPhoto ?? showPhotos) && child.photo_url;
    const childHeight = isRootChild ? 100 : (childShowingPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY);
    return child.y - childHeight / 2;
  });
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
 * @returns Path segment from parent bottom to bus line
 */
export function calculateParentVerticalPath(
  parent: LayoutNode,
  busY: number,
  showPhotos: boolean = true
): PathSegment {
  // Unified PTS Architecture: parent.y already includes all offsets
  const parentShowingPhoto = ((parent as any)._showPhoto ?? showPhotos) && parent.photo_url;
  const parentHeight = parentShowingPhoto
    ? NODE_HEIGHT_WITH_PHOTO
    : NODE_HEIGHT_TEXT_ONLY;

  return {
    startX: parent.x,
    startY: parent.y + parentHeight / 2,
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
 * @returns Array of path segments from bus line to each child top
 */
export function calculateChildVerticalPaths(
  children: LayoutNode[],
  busY: number,
  showPhotos: boolean = true
): PathSegment[] {
  return children.map((child) => {
    // Unified PTS Architecture: child.y already includes all offsets
    const isRootChild = !child.father_id;
    const childShowingPhoto = ((child as any)._showPhoto ?? showPhotos) && child.photo_url;
    const childHeight = isRootChild
      ? 100 // Root nodes have fixed 100px height
      : childShowingPhoto
      ? NODE_HEIGHT_WITH_PHOTO
      : NODE_HEIGHT_TEXT_ONLY;

    return {
      startX: child.x,
      startY: busY,
      endX: child.x,
      endY: child.y - childHeight / 2,
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
 * @returns Array of all path segments for this connection
 *
 * @example
 * const segments = calculateConnectionPaths({
 *   parent: { id: '1', x: 100, y: 50, photo_url: 'url' },
 *   children: [
 *     { id: '2', x: 80, y: 150, father_id: '1' },
 *     { id: '3', x: 120, y: 150, father_id: '1' }
 *   ]
 * }, true);
 * // Returns: [parentVertical, busLine, child1Vertical, child2Vertical]
 */
export function calculateConnectionPaths(
  connection: Connection,
  showPhotos: boolean = true
): PathSegment[] {
  const { parent, children } = connection;
  const segments: PathSegment[] = [];

  // Calculate bus line Y (accounting for node heights)
  const busY = calculateBusY(parent, children, showPhotos);

  // Add parent vertical line
  segments.push(calculateParentVerticalPath(parent, busY, showPhotos));

  // Add horizontal bus line if needed
  if (shouldRenderBusLine(children, parent)) {
    segments.push(calculateBusLine(children, busY));
  }

  // Add child vertical lines
  segments.push(...calculateChildVerticalPaths(children, busY, showPhotos));

  return segments;
}
