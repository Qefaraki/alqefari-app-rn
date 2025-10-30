/**
 * Line Styles System - Support for straight and bezier curve connections
 *
 * Provides unified path generation for tree connections with support for:
 * - Straight lines (original system)
 * - Bezier curves (smooth, curved connections)
 *
 * Can be toggled in Settings without app restart.
 */

import { Skia, SkPath } from "@shopify/react-native-skia";
import {
  calculateBusY,
  calculateParentVerticalPath,
  calculateChildVerticalPaths,
  shouldRenderBusLine,
  type LayoutNode,
  type Connection,
} from "../spatial/PathCalculator";
import {
  D3_SIMPLE_CIRCLE,
  STANDARD_NODE,
  ROOT_NODE,
  G2_NODE,
  CIRCULAR_NODE,
  TIDY_CIRCLE,
  TIDY_RECT,
} from "../rendering/nodeConstants";

export const LINE_STYLES = {
  STRAIGHT: "straight",
  BEZIER: "bezier", // DEPRECATED: Use CURVES instead
  CURVES: "curves", // NEW: D3 linkHorizontal() curves
} as const;

export type LineStyle = (typeof LINE_STYLES)[keyof typeof LINE_STYLES];

/**
 * Bezier Curve Configuration
 * Production styling with Najdi Sadu palette
 */
export const BEZIER_CONFIG = {
  CURVE_STRENGTH: 0.4, // Reduced from 0.50 - gentler curves
  STROKE_WIDTH: 1.2, // Light but visible stroke
  STROKE_OPACITY: 0.45, // Allow overlap to build subtle spine
  STROKE_COLOR: "#BEBEBE", // Soft grey similar to D3 example
} as const;

// Dev-only instrumentation to trace tidy curve geometry when needed
const DEBUG_TIDY_CURVES = __DEV__ && false;
let tidyCurveDebugSamples = 0;

/**
 * Generate straight line paths (original system)
 * Uses the existing PathCalculator functions for elbow-style connections
 *
 * @param connection - Parent and children nodes
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 */
export function generateStraightPaths(
  connection: Connection,
  showPhotos: boolean = true,
  nodeStyle: "rectangular" | "circular" = "rectangular",
): SkPath[] {
  const { parent, children } = connection;
  const paths: SkPath[] = [];

  // Use existing PathCalculator logic (now with circular node support)
  const busY = calculateBusY(parent, children, showPhotos, nodeStyle);
  const parentVertical = calculateParentVerticalPath(
    parent,
    busY,
    showPhotos,
    nodeStyle,
  );

  // Create Skia path for parent vertical line
  const pathBuilder = Skia.Path.Make();
  pathBuilder.moveTo(parentVertical.startX, parentVertical.startY);
  pathBuilder.lineTo(parentVertical.endX, parentVertical.endY);

  // Add horizontal bus line if needed
  if (shouldRenderBusLine(children, parent)) {
    const busLine = calculateBusLine(children, busY);
    pathBuilder.moveTo(busLine.startX, busLine.startY);
    pathBuilder.lineTo(busLine.endX, busLine.endY);
  }

  // Add child vertical lines
  const childVerticals = calculateChildVerticalPaths(
    children,
    busY,
    showPhotos,
    nodeStyle,
  );
  childVerticals.forEach((path) => {
    pathBuilder.moveTo(path.startX, path.startY);
    pathBuilder.lineTo(path.endX, path.endY);
  });

  return [pathBuilder];
}

/**
 * Calculate actual rendered node height based on node type and style
 *
 * This ensures curves connect to the actual edge position of rendered nodes,
 * not hardcoded dimensions that may not match the renderer.
 *
 * @param node - Node with generation, father_id, photo_url, _hasChildren
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' rendering mode
 * @returns Actual height in pixels of the rendered node
 */
function calculateActualNodeHeight(
  node: {
    father_id: string | null;
    photo_url?: string;
    generation?: number;
    _hasChildren?: boolean;
  },
  showPhotos: boolean,
  nodeStyle: "rectangular" | "circular",
  lineStyle: LineStyle = LINE_STYLES.STRAIGHT,
): number {
  const isRoot = !node.father_id;
  const hasPhoto = showPhotos && !!node.photo_url;
  const isG2Parent = node.generation === 2 && node._hasChildren;

  const tidyCircular =
    nodeStyle === "circular" && lineStyle === LINE_STYLES.CURVES;
  const tidyRect =
    nodeStyle === "rectangular" && lineStyle === LINE_STYLES.CURVES;

  if (nodeStyle === "circular") {
    if (tidyCircular) {
      const config = isRoot
        ? TIDY_CIRCLE.ROOT
        : isG2Parent
        ? TIDY_CIRCLE.G2
        : TIDY_CIRCLE.STANDARD;

      return config.DIAMETER;
    }

    if (isRoot) return CIRCULAR_NODE.ROOT_DIAMETER;
    if (isG2Parent) return CIRCULAR_NODE.G2_DIAMETER;
    return CIRCULAR_NODE.DIAMETER;
  } else {
    if (tidyRect) {
      if (isRoot) return TIDY_RECT.ROOT.HEIGHT;
      if (isG2Parent)
        return hasPhoto ? TIDY_RECT.G2.HEIGHT_PHOTO : TIDY_RECT.G2.HEIGHT_TEXT;
      return hasPhoto
        ? TIDY_RECT.STANDARD.HEIGHT
        : TIDY_RECT.STANDARD.HEIGHT_TEXT_ONLY;
    }

    // Rectangular mode
    if (isRoot) return ROOT_NODE.HEIGHT;
    if (isG2Parent)
      return hasPhoto ? G2_NODE.HEIGHT_PHOTO : G2_NODE.HEIGHT_TEXT;
    return hasPhoto ? STANDARD_NODE.HEIGHT : STANDARD_NODE.HEIGHT_TEXT_ONLY;
  }
}

/**
 * Calculate actual rendered node width based on node type and style
 *
 * For horizontal trees, this is critical for calculating left/right edge positions.
 * Note: For circular nodes, width = height = diameter.
 *
 * @param node - Node with generation, father_id, photo_url, _hasChildren
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' rendering mode
 * @returns Actual width in pixels of the rendered node
 */
function calculateActualNodeWidth(
  node: {
    father_id: string | null;
    photo_url?: string;
    generation?: number;
    _hasChildren?: boolean;
  },
  showPhotos: boolean,
  nodeStyle: "rectangular" | "circular",
  lineStyle: LineStyle = LINE_STYLES.STRAIGHT,
): number {
  const isRoot = !node.father_id;
  const hasPhoto = showPhotos && !!node.photo_url;
  const isG2Parent = node.generation === 2 && node._hasChildren;

  const tidyCircular =
    nodeStyle === "circular" && lineStyle === LINE_STYLES.CURVES;
  const tidyRect =
    nodeStyle === "rectangular" && lineStyle === LINE_STYLES.CURVES;

  if (nodeStyle === "circular") {
    if (tidyCircular) {
      const config = isRoot
        ? TIDY_CIRCLE.ROOT
        : isG2Parent
        ? TIDY_CIRCLE.G2
        : TIDY_CIRCLE.STANDARD;

      return config.DIAMETER;
    }

    // Circles: width = height = diameter
    if (isRoot) return CIRCULAR_NODE.ROOT_DIAMETER;
    if (isG2Parent) return CIRCULAR_NODE.G2_DIAMETER;
    return CIRCULAR_NODE.DIAMETER;
  } else {
    if (tidyRect) {
      if (isRoot) return TIDY_RECT.ROOT.WIDTH;
      if (isG2Parent)
        return hasPhoto ? TIDY_RECT.G2.WIDTH_PHOTO : TIDY_RECT.G2.WIDTH_TEXT;
      return hasPhoto
        ? TIDY_RECT.STANDARD.WIDTH
        : TIDY_RECT.STANDARD.WIDTH_TEXT_ONLY;
    }

    // Rectangular mode - use WIDTH constants
    if (isRoot) return ROOT_NODE.WIDTH;
    if (isG2Parent) return hasPhoto ? G2_NODE.WIDTH_PHOTO : G2_NODE.WIDTH_TEXT;
    return hasPhoto ? STANDARD_NODE.WIDTH : STANDARD_NODE.WIDTH_TEXT_ONLY;
  }
}

function getLabelHeight(
  node: LayoutNode,
  nodeStyle: "rectangular" | "circular" = "rectangular",
  lineStyle: LineStyle = LINE_STYLES.STRAIGHT,
): number {
  const tidyCircular =
    nodeStyle === "circular" && lineStyle === LINE_STYLES.CURVES;

  if (!tidyCircular) {
    return 0;
  }

  const isRoot = !node.father_id;
  const isG2Parent = node.generation === 2 && (node as any)._hasChildren;

  const config = isRoot
    ? TIDY_CIRCLE.ROOT
    : isG2Parent
    ? TIDY_CIRCLE.G2
    : TIDY_CIRCLE.STANDARD;

  return (config.NAME_GAP || 0) + (config.NAME_HEIGHT || 0);
}

/**
 * Generate bezier curve paths for smooth connections
 * Creates beautiful curved lines from parent to each child
 * Uses optimized control points for family tree aesthetics
 *
 * @param connection - Parent and children nodes
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 */
export function generateBezierPaths(
  connection: Connection,
  showPhotos: boolean = true,
  nodeStyle: "rectangular" | "circular" = "rectangular",
  lineStyle: LineStyle = LINE_STYLES.BEZIER,
): SkPath[] {
  const { parent, children } = connection;
  const paths: SkPath[] = [];

  // Calculate actual rendered dimensions (respects rectangular vs circular mode)
  const parentHeight = calculateActualNodeHeight(
    parent,
    showPhotos,
    nodeStyle,
    lineStyle,
  );
  const parentBottomY = parent.y + parentHeight / 2;

  // For multiple children, create a unified bezier approach
  if (children.length === 1) {
    // Single child - simple direct curve
    const child = children[0];
    const childHeight = calculateActualNodeHeight(
      child,
      showPhotos,
      nodeStyle,
      lineStyle,
    );
    const childTopY = child.y - childHeight / 2;

    const pathBuilder = Skia.Path.Make();
    pathBuilder.moveTo(parent.x, parentBottomY);

    // Calculate control points for smooth single curve
    const deltaY = childTopY - parentBottomY;
    const controlOffset = Math.abs(deltaY) * BEZIER_CONFIG.CURVE_STRENGTH;

    pathBuilder.cubicTo(
      parent.x,
      parentBottomY + controlOffset, // First control point (vertical from parent)
      child.x,
      childTopY - controlOffset, // Second control point (vertical to child)
      child.x,
      childTopY, // End point
    );

    paths.push(pathBuilder);
  } else {
    // Multiple children - fan-out curves with horizontal spread (PHASE 2: Fix overlapping)
    // Calculate child positions once
    const childPositions = children.map((child) => {
      const childHeight = calculateActualNodeHeight(
        child,
        showPhotos,
        nodeStyle,
        lineStyle,
      );
      return {
        ...child,
        topY: child.y - childHeight / 2,
        height: childHeight,
      };
    });

    // PHASE 2: Calculate fan-out spread parameters (optimized: calculated once)
    const centerIndex = (children.length - 1) / 2;
    const spreadFactor = Math.min(children.length * 4, 20); // 4px per child, max 20px

    children.forEach((child, index) => {
      const childPos = childPositions[index];
      const pathBuilder = Skia.Path.Make();

      // Start from parent bottom
      pathBuilder.moveTo(parent.x, parentBottomY);

      // PHASE 2: Calculate horizontal offset for fan-out effect
      const offsetFromCenter = index - centerIndex;
      const horizontalSpread = offsetFromCenter * spreadFactor;

      // Calculate control points for elegant branching
      const deltaX = child.x - parent.x;
      const deltaY = childPos.topY - parentBottomY;
      const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Control point strength based on distance
      const baseStrength = Math.min(
        totalDistance * BEZIER_CONFIG.CURVE_STRENGTH,
        60,
      );

      // PHASE 2: First control point - spread horizontally from parent
      const cp1X = parent.x + deltaX * 0.2 + horizontalSpread;
      const cp1Y = parentBottomY + baseStrength * 0.6;

      // Second control point - converge to child
      const cp2X = child.x - deltaX * 0.1;
      const cp2Y = childPos.topY - baseStrength * 0.4;

      pathBuilder.cubicTo(
        cp1X,
        cp1Y, // First control point (with horizontal spread)
        cp2X,
        cp2Y, // Second control point
        child.x,
        childPos.topY, // End point
      );

      paths.push(pathBuilder);
    });
  }

  return paths;
}

/**
 * Generate tidy bus-style curves (D3-inspired vertical stems with curved fan-out)
 *
 * Matches the classic tidy tree look:
 * - Parent stem: straight vertical segment from parent node
 * - Shared bus: optional horizontal segment that aligns siblings
 * - Child approach: gentle Bézier easing that peels away from bus and straightens
 *   before entering the child card
 */
export function generateTidyCurvePaths(
  connection: Connection,
  showPhotos: boolean = true,
  nodeStyle: "rectangular" | "circular" = "rectangular",
  lineStyle: LineStyle = LINE_STYLES.CURVES,
): SkPath[] {
  const { parent, children } = connection;

  if (!parent || !children || children.length === 0) {
    return [];
  }

  const pathBuilder = Skia.Path.Make();

  const tidyCircular =
    nodeStyle === "circular" && lineStyle === LINE_STYLES.CURVES;

  // Parent stem – straight drop from the rendered bottom edge
  const parentHeight = calculateActualNodeHeight(
    parent,
    showPhotos,
    nodeStyle,
    lineStyle,
  );
  const parentBottomY = parent.y + parentHeight / 2;

  const childXs = children.map((child) => child.x);
  const childYs = children.map((child) => child.y);

  const parentCenterX = parent.x;
  const parentBottom = parentBottomY;
  const parentLabelHeight = getLabelHeight(parent, nodeStyle, lineStyle);

  const stemAnchorY = parentBottom + parentLabelHeight;
  const CHILD_ANCHOR_OFFSET = 12;

  const childMetadata = children.map((child) => {
    const childHeight = calculateActualNodeHeight(
      child,
      showPhotos,
      nodeStyle,
      lineStyle,
    );
    const childTopY = child.y - childHeight / 2;
    return {
      childCenterX: child.x,
      childTopY,
    };
  });

  if (DEBUG_TIDY_CURVES && tidyCurveDebugSamples < 5) {
    console.log("[TidyCurves] geometry", {
      parent: { id: parent.id, x: parent.x, y: parent.y },
      childXs,
      childYs,
      parentBottom,
      nodeStyle,
    });
    tidyCurveDebugSamples += 1;
  }

  // Draw shared vertical stem from parent node to anchor
  pathBuilder.moveTo(parentCenterX, parentBottom);
  pathBuilder.lineTo(parentCenterX, stemAnchorY);

  // Fan-out curves using single cubic Bezier per child (D3 linkVertical-style)
  childMetadata.forEach(({ childCenterX, childTopY }) => {
    const startY = stemAnchorY;
    const anchorOffset = tidyCircular ? CHILD_ANCHOR_OFFSET * 0.6 : CHILD_ANCHOR_OFFSET;
    const desiredAnchor = childTopY - anchorOffset;
    const childAnchorY = Math.min(childTopY - 4, desiredAnchor);
    const minimumGap = tidyCircular ? 2 : 4;
    const safeAnchorY = childAnchorY <= startY ? startY + minimumGap : childAnchorY;
    const midY = startY + (safeAnchorY - startY) / 2;

    pathBuilder.moveTo(parentCenterX, startY);
    pathBuilder.cubicTo(
      parentCenterX,
      midY,
      childCenterX,
      midY,
      childCenterX,
      safeAnchorY,
    );

    // Final short vertical approach into the child node
    pathBuilder.lineTo(childCenterX, childTopY);
  });

  return [pathBuilder];
}

/**
 * Generate line paths based on selected style
 * Unified interface for straight, bezier, and D3 curves
 */
/**
 * Generate line paths based on style
 *
 * @param connection - Parent and children nodes
 * @param lineStyle - 'straight', 'bezier', or 'curves'
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 */
export function generateLinePaths(
  connection: Connection,
  lineStyle: LineStyle = LINE_STYLES.STRAIGHT,
  showPhotos: boolean = true,
  nodeStyle: "rectangular" | "circular" = "rectangular",
): SkPath[] {
  switch (lineStyle) {
    case LINE_STYLES.CURVES:
      return generateTidyCurvePaths(
        connection,
        showPhotos,
        nodeStyle,
        lineStyle,
      );

    case LINE_STYLES.BEZIER:
      // DEPRECATED: Use CURVES instead
      return generateBezierPaths(
        connection,
        showPhotos,
        nodeStyle,
        lineStyle,
      );

    case LINE_STYLES.STRAIGHT:
    default:
      return generateStraightPaths(connection, showPhotos, nodeStyle);
  }
}

interface PathElement {
  key: string;
  path: SkPath;
  style: LineStyle;
}

interface BatchedResult {
  elements: PathElement[];
  count: number;
}

/**
 * Pre-build all connection paths with specified style
 * Compatible with existing batched rendering system
 * Includes performance optimizations for large datasets
 *
 * @param connections - Array of parent-children connections
 * @param lineStyle - 'straight' or 'bezier'
 * @param showPhotos - Whether photos are visible
 * @param nodeStyle - 'rectangular' or 'circular' (Tree Design System)
 */
export function buildBatchedPaths(
  connections: Connection[],
  lineStyle: LineStyle = LINE_STYLES.STRAIGHT,
  showPhotos: boolean = true,
  nodeStyle: "rectangular" | "circular" = "rectangular",
): BatchedResult {
  const elements: PathElement[] = [];
  let edgeCount = 0;
  const maxConnections = 1000; // Performance limit

  // Performance: Use a Set to track processed connections and avoid duplicates
  const processedConnections = new Set<string>();

  for (const conn of connections.slice(0, maxConnections)) {
    const parent = conn.parent;
    const children = conn.children;

    // Validation and duplicate prevention
    if (!parent || !children || children.length === 0) {
      continue;
    }

    const connectionKey = `${parent.id}-${children.map((c) => c.id).join(",")}`;
    if (processedConnections.has(connectionKey)) {
      continue;
    }
    processedConnections.add(connectionKey);

    try {
      // Generate paths based on line style (now with circular node support)
      const paths = generateLinePaths(
        { parent, children },
        lineStyle,
        showPhotos,
        nodeStyle,
      );

      // Add to elements array with proper error handling
      paths.forEach((path, index) => {
        if (!path) return; // Skip invalid paths

        elements.push({
          key: `connection-${parent.id}-${index}-${lineStyle}`,
          path: path, // Don't clone - Skia paths are already optimized
          style: lineStyle,
        });

        edgeCount++;
      });
    } catch (error) {
      if (__DEV__) {
        console.warn(
          `[LineStyles] Failed to generate path for connection ${parent.id}:`,
          error,
        );
      }
      continue;
    }
  }

  return { elements, count: edgeCount };
}
