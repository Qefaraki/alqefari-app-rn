/**
 * ConnectionRenderer - Parent-child connection line rendering
 *
 * Phase 2 Day 5 - Extracted from TreeView.js (lines 2666-2840)
 *
 * Renders connection lines between parent and child nodes in the family tree.
 * Uses T-junction pattern: parent → vertical line → horizontal bus → child vertical lines.
 *
 * Connection Pattern:
 * ```
 * Parent (•)
 *    |          ← Vertical line from parent
 *    |
 * ───┴───       ← Horizontal bus line (if multiple children or offset)
 *  |   |
 *  •   •        ← Children
 * ```
 *
 * Performance Optimizations:
 * - Path batching: Groups 50 edges per Path element (reduces draw calls)
 * - Viewport culling: Only renders connections with visible parent or child
 * - LOD Tier 3: No connections rendered when fully zoomed out
 * - Max visible edges cap: Prevents performance degradation with large trees
 *
 * Design Constraints (Najdi Sadu):
 * - Line color: Camel Hair Beige (#D1BBA360 - 60% opacity)
 * - Line width: 1.2px for subtle visual weight
 * - Minimal intersections with node cards
 *
 * KNOWN PATTERNS (AS-IS for Phase 2):
 * - Recalculates node heights inline (could be extracted to NodeSizeProvider)
 * - Finds nodes in array for each connection (could use Map for O(1) lookup)
 * - Will be optimized in Phase 3 refactoring
 */

import React from 'react';
import { vec, Line, Path, Skia } from '@shopify/react-native-skia';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  father_id: string | null;
  photo_url?: string;
}

export interface ConnectionData {
  parent: { id: string; x: number; y: number };
  children: Array<{ id: string; x: number; y: number }>;
}

export interface ConnectionRendererProps {
  // Connection data
  connections: ConnectionData[];

  // Node lookup
  nodes: LayoutNode[];

  // Viewport culling
  visibleNodeIds: Set<string>;

  // LOD tier (1, 2, or 3)
  tier: number;

  // Display settings
  showPhotos: boolean;

  // Node dimensions (from constants)
  nodeHeightWithPhoto?: number;
  nodeHeightTextOnly?: number;
  lineColor?: string;
  lineWidth?: number;
  maxVisibleEdges?: number;
}

/**
 * Calculate bus line Y position
 *
 * Bus line is positioned halfway between parent and nearest child.
 * This creates balanced visual weight in the connection pattern.
 *
 * @param parentY - Parent node Y position
 * @param childYs - Array of child Y positions
 * @returns Bus line Y coordinate
 */
export function calculateBusY(parentY: number, childYs: number[]): number {
  if (childYs.length === 0) {
    throw new Error('calculateBusY requires at least one child');
  }

  const minChildY = Math.min(...childYs);
  return parentY + (minChildY - parentY) / 2;
}

/**
 * Calculate horizontal bus line extent
 *
 * Bus line spans from leftmost child to rightmost child.
 *
 * @param childXs - Array of child X positions
 * @returns {minX, maxX} Horizontal extent
 */
export function calculateBusExtent(childXs: number[]): {
  minX: number;
  maxX: number;
} {
  return {
    minX: Math.min(...childXs),
    maxX: Math.max(...childXs),
  };
}

/**
 * Determine if bus line is needed
 *
 * Bus line is required when:
 * 1. Multiple children exist, OR
 * 2. Single child is horizontally offset from parent (>5px)
 *
 * @param childCount - Number of children
 * @param parentX - Parent X position
 * @param firstChildX - First child X position
 * @returns True if bus line should be rendered
 */
export function shouldRenderBusLine(
  childCount: number,
  parentX: number,
  firstChildX: number
): boolean {
  if (childCount > 1) return true;
  return Math.abs(parentX - firstChildX) > 5;
}

/**
 * Get node height based on photo status
 *
 * Root nodes have fixed 100px height.
 * Other nodes vary by photo presence.
 *
 * @param node - Layout node
 * @param showPhotos - Whether photos are displayed
 * @param nodeHeightWithPhoto - Height for nodes with photos
 * @param nodeHeightTextOnly - Height for text-only nodes
 * @returns Node height in pixels
 */
export function getNodeHeight(
  node: LayoutNode,
  showPhotos: boolean,
  nodeHeightWithPhoto: number,
  nodeHeightTextOnly: number
): number {
  const isRoot = !node.father_id;
  if (isRoot) return 100;

  return showPhotos && node.photo_url ? nodeHeightWithPhoto : nodeHeightTextOnly;
}

/**
 * Render single connection (unbatched)
 *
 * Renders connection as individual Line components.
 * Used for debugging or when batching is disabled.
 *
 * @param connection - Connection data
 * @param nodes - All nodes for lookup
 * @param showPhotos - Whether photos are displayed
 * @param config - Rendering configuration
 * @returns Array of Line components
 */
export function renderConnection(
  connection: ConnectionData,
  nodes: LayoutNode[],
  showPhotos: boolean,
  config: {
    nodeHeightWithPhoto: number;
    nodeHeightTextOnly: number;
    lineColor: string;
    lineWidth: number;
  }
): JSX.Element[] {
  const parent = nodes.find((n) => n.id === connection.parent.id);
  if (!parent) return [];

  const lines: JSX.Element[] = [];

  // Calculate bus line position
  const childYs = connection.children.map((child) => child.y);
  const busY = calculateBusY(parent.y, childYs);

  // Parent vertical line
  const parentHeight = getNodeHeight(
    parent,
    showPhotos,
    config.nodeHeightWithPhoto,
    config.nodeHeightTextOnly
  );

  lines.push(
    <Line
      key={`parent-down-${parent.id}`}
      p1={vec(parent.x, parent.y + parentHeight / 2)}
      p2={vec(parent.x, busY)}
      color={config.lineColor}
      style="stroke"
      strokeWidth={config.lineWidth}
    />
  );

  // Horizontal bus line (conditional)
  if (
    shouldRenderBusLine(
      connection.children.length,
      parent.x,
      connection.children[0].x
    )
  ) {
    const childXs = connection.children.map((child) => child.x);
    const { minX, maxX } = calculateBusExtent(childXs);

    lines.push(
      <Line
        key={`bus-${parent.id}`}
        p1={vec(minX, busY)}
        p2={vec(maxX, busY)}
        color={config.lineColor}
        style="stroke"
        strokeWidth={config.lineWidth}
      />
    );
  }

  // Child vertical lines
  connection.children.forEach((child) => {
    const childNode = nodes.find((n) => n.id === child.id);
    if (!childNode) return;

    const childHeight = getNodeHeight(
      childNode,
      showPhotos,
      config.nodeHeightWithPhoto,
      config.nodeHeightTextOnly
    );

    lines.push(
      <Line
        key={`child-up-${child.id}`}
        p1={vec(childNode.x, busY)}
        p2={vec(childNode.x, childNode.y - childHeight / 2)}
        color={config.lineColor}
        style="stroke"
        strokeWidth={config.lineWidth}
      />
    );
  });

  return lines;
}

/**
 * Render connections with batching
 *
 * Groups multiple connections into single Path elements for performance.
 * Batches are flushed every 50 edges to balance memory and draw calls.
 *
 * @param connections - All connection data
 * @param nodes - All nodes for lookup
 * @param visibleNodeIds - Set of visible node IDs (viewport culling)
 * @param tier - LOD tier (returns null for tier 3)
 * @param showPhotos - Whether photos are displayed
 * @param config - Rendering configuration
 * @returns {elements, count} Path elements and edge count
 */
export function renderEdgesBatched(
  connections: ConnectionData[],
  nodes: LayoutNode[],
  visibleNodeIds: Set<string>,
  tier: number,
  showPhotos: boolean,
  config: {
    nodeHeightWithPhoto: number;
    nodeHeightTextOnly: number;
    lineColor: string;
    lineWidth: number;
    maxVisibleEdges: number;
    batchSize?: number;
  }
): { elements: JSX.Element[] | null; count: number } {
  // No connections in LOD Tier 3
  if (tier === 3) return { elements: null, count: 0 };

  const batchSize = config.batchSize || 50;
  let edgeCount = 0;
  const paths: JSX.Element[] = [];
  let pathBuilder = Skia.Path.Make();
  let currentBatch = 0;

  for (const conn of connections) {
    // Cap at max visible edges
    if (edgeCount >= config.maxVisibleEdges) break;

    // Viewport culling: Skip if parent and all children invisible
    if (
      !visibleNodeIds.has(conn.parent.id) &&
      !conn.children.some((c) => visibleNodeIds.has(c.id))
    ) {
      continue;
    }

    const parent = nodes.find((n) => n.id === conn.parent.id);
    if (!parent) continue;

    // Calculate positions
    const childYs = conn.children.map((child) => child.y);
    const busY = calculateBusY(parent.y, childYs);
    const parentHeight = getNodeHeight(
      parent,
      showPhotos,
      config.nodeHeightWithPhoto,
      config.nodeHeightTextOnly
    );

    // Add parent vertical line to path
    pathBuilder.moveTo(parent.x, parent.y + parentHeight / 2);
    pathBuilder.lineTo(parent.x, busY);

    // Add horizontal bus line if needed
    if (
      shouldRenderBusLine(conn.children.length, parent.x, conn.children[0].x)
    ) {
      const childXs = conn.children.map((child) => child.x);
      const { minX, maxX } = calculateBusExtent(childXs);

      pathBuilder.moveTo(minX, busY);
      pathBuilder.lineTo(maxX, busY);
    }

    // Add child vertical lines
    conn.children.forEach((child) => {
      const childNode = nodes.find((n) => n.id === child.id);
      if (childNode) {
        const childHeight = getNodeHeight(
          childNode,
          showPhotos,
          config.nodeHeightWithPhoto,
          config.nodeHeightTextOnly
        );
        pathBuilder.moveTo(childNode.x, busY);
        pathBuilder.lineTo(childNode.x, childNode.y - childHeight / 2);
      }
    });

    edgeCount += conn.children.length + 1;
    currentBatch += conn.children.length + 1;

    // Flush batch
    if (currentBatch >= batchSize) {
      const flushed = Skia.Path.Make();
      flushed.addPath(pathBuilder);
      paths.push(
        <Path
          key={`edges-${paths.length}`}
          path={flushed}
          color={config.lineColor}
          style="stroke"
          strokeWidth={config.lineWidth}
        />
      );
      pathBuilder.reset();
      currentBatch = 0;
    }
  }

  // Final batch
  if (currentBatch > 0) {
    const flushed = Skia.Path.Make();
    flushed.addPath(pathBuilder);
    paths.push(
      <Path
        key={`edges-${paths.length}`}
        path={flushed}
        color={config.lineColor}
        style="stroke"
        strokeWidth={config.lineWidth}
      />
    );
  }

  return { elements: paths, count: edgeCount };
}

/**
 * ConnectionRenderer component
 *
 * Renders all parent-child connections with batching and viewport culling.
 *
 * @param props - Connection renderer props
 * @returns Path elements or null
 */
export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({
  connections,
  nodes,
  visibleNodeIds,
  tier,
  showPhotos,
  nodeHeightWithPhoto = 90,
  nodeHeightTextOnly = 35,
  lineColor = '#D1BBA360',
  lineWidth = 1.5,
  maxVisibleEdges = 1000,
}) => {
  const { elements } = renderEdgesBatched(
    connections,
    nodes,
    visibleNodeIds,
    tier,
    showPhotos,
    {
      nodeHeightWithPhoto,
      nodeHeightTextOnly,
      lineColor,
      lineWidth,
      maxVisibleEdges,
    }
  );

  if (!elements) return null;

  return <>{elements}</>;
};

// Export constants for testing
export const CONNECTION_CONSTANTS = {
  DEFAULT_LINE_COLOR: '#D1BBA360', // Camel Hair Beige 60%
  DEFAULT_LINE_WIDTH: 1.5,
  DEFAULT_NODE_HEIGHT_WITH_PHOTO: 90,
  DEFAULT_NODE_HEIGHT_TEXT_ONLY: 35,
  ROOT_NODE_HEIGHT: 100,
  MAX_VISIBLE_EDGES: 1000,
  BATCH_SIZE: 50,
  BUS_LINE_OFFSET_THRESHOLD: 5, // Pixels
};
