/**
 * Highlight Renderers for Alqefari Family Tree
 *
 * Strategy pattern implementation for rendering different highlight types.
 * Each renderer class knows how to render its specific highlight type.
 *
 * Renderers:
 * - SinglePathRenderer: Search results, user lineage (one path to root)
 * - DualPathRenderer: Cousin marriages (two paths with common ancestor)
 * - MultiPathRenderer: Future sibling groups (N paths converging)
 *
 * Usage:
 *   const renderer = createRenderer(highlightType, pathData, context);
 *   const elements = renderer.render();
 */

import React from 'react';
import { Group, Path, Paint, Blur, CornerPathEffect } from '@shopify/react-native-skia';
import { ANCESTRY_COLORS, ANCESTRY_COLORS_SECONDARY } from '../../services/highlightingService';

// Constants from TreeView
const NODE_HEIGHT_WITH_PHOTO = 80;
const NODE_HEIGHT_TEXT_ONLY = 40;

/**
 * Helper: Convert hex to rgba with alpha
 */
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Base Renderer Class
 */
class HighlightRenderer {
  constructor(typeId, highlightConfig, pathData, context) {
    this.typeId = typeId; // Unique identifier: 'search', 'userLineage', 'cousinMarriage'
    this.config = highlightConfig;
    this.pathData = pathData;
    this.context = context; // { nodes, connections, showPhotos, pathOpacity, Skia, activeHighlights }
  }

  render() {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Build path segments from connections
   * Reuses EXACT same busY calculation as regular edges
   */
  _buildPathSegments(pathNodeIds, colorPalette = ANCESTRY_COLORS) {
    const { nodes, connections, showPhotos, Skia } = this.context;

    const pathSet = new Set(pathNodeIds);
    const segmentsByDepth = new Map(); // depth -> { pathObj, color }
    let totalSegments = 0;

    // Loop through connections and draw routing for path segments
    for (const conn of connections) {
      // Skip if parent not in path
      if (!pathSet.has(conn.parent.id)) continue;

      // Find which child in this connection is part of the path
      const pathChild = conn.children.find(c => pathSet.has(c.id));
      if (!pathChild) continue;

      const parent = nodes.find(n => n.id === conn.parent.id);
      const child = nodes.find(n => n.id === pathChild.id);
      if (!parent || !child) continue;

      // Calculate depth difference for color selection
      const depthDiff = Math.abs(child.depth - parent.depth);

      // Get or create path for this depth level
      if (!segmentsByDepth.has(depthDiff)) {
        const colorIndex = depthDiff % colorPalette.length;
        segmentsByDepth.set(depthDiff, {
          pathObj: Skia.Path.Make(),
          color: colorPalette[colorIndex]
        });
      }
      const { pathObj } = segmentsByDepth.get(depthDiff);

      // Reuse EXACT same busY calculation as regular edges
      const childYs = conn.children.map(c => c.y);
      const busY = parent.y + (Math.min(...childYs) - parent.y) / 2;

      const parentHeight = (showPhotos && parent.photo_url) ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
      const childHeight = (showPhotos && child.photo_url) ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;

      // Draw 3-segment routing matching regular edges exactly:
      // 1. Parent down to bus
      pathObj.moveTo(parent.x, parent.y + parentHeight / 2);
      pathObj.lineTo(parent.x, busY);

      // 2. Horizontal along bus (if parent and child x differ)
      if (Math.abs(parent.x - child.x) > 1) {
        pathObj.lineTo(child.x, busY);
      }

      // 3. Bus up to child
      pathObj.lineTo(child.x, child.y - childHeight / 2);

      totalSegments++;
    }

    return { segmentsByDepth, totalSegments };
  }

  /**
   * Render 4-layer glow system for a path
   * @param {string} keySuffix - Additional suffix for dual paths (e.g., 'path1', 'path2')
   */
  _renderPathWithGlow(pathObj, baseColor, depthDiff, opacity, keySuffix = '') {
    const keyPrefix = keySuffix ? `${this.typeId}-${keySuffix}` : this.typeId;

    return [
      // Layer 4: Outer glow - soft halo (largest blur)
      <Group key={`${keyPrefix}-${depthDiff}-outer`} layer={<Paint><Blur blur={16} /></Paint>}>
        <Path
          path={pathObj}
          color={hexToRgba(baseColor, 0.18)}
          style="stroke"
          strokeWidth={8}
          opacity={opacity}
        >
          <CornerPathEffect r={4} />
        </Path>
      </Group>,

      // Layer 3: Middle glow - medium blur
      <Group key={`${keyPrefix}-${depthDiff}-middle`} layer={<Paint><Blur blur={10} /></Paint>}>
        <Path
          path={pathObj}
          color={hexToRgba(baseColor, 0.24)}
          style="stroke"
          strokeWidth={5.5}
          opacity={opacity}
        >
          <CornerPathEffect r={4} />
        </Path>
      </Group>,

      // Layer 2: Inner accent - subtle blur
      <Group key={`${keyPrefix}-${depthDiff}-inner`} layer={<Paint><Blur blur={5} /></Paint>}>
        <Path
          path={pathObj}
          color={hexToRgba(baseColor, 0.32)}
          style="stroke"
          strokeWidth={4}
          opacity={opacity}
        >
          <CornerPathEffect r={4} />
        </Path>
      </Group>,

      // Layer 1: Core line - crisp and vibrant (no blur)
      <Path
        key={`${keyPrefix}-${depthDiff}-core`}
        path={pathObj}
        color={baseColor}
        style="stroke"
        strokeWidth={3}
        opacity={opacity}
      >
        <CornerPathEffect r={4} />
      </Path>
    ];
  }
}

/**
 * Single Path Renderer
 * Used for: Search results, User lineage
 */
export class SinglePathRenderer extends HighlightRenderer {
  /**
   * Get effective opacity for rendering
   * Always returns the shared value for smooth animations
   * Search highlights render later (higher z-index), providing natural visual priority
   */
  _computeEffectiveOpacity() {
    const { pathOpacity } = this.context;
    return pathOpacity; // Always return shared value for animated opacity
  }

  render() {
    const { pathNodeIds } = this.pathData;

    if (!pathNodeIds || pathNodeIds.length < 2) {
      console.log('[SinglePathRenderer] No path to render (null or < 2 nodes)');
      return null;
    }

    console.log('[SinglePathRenderer] Rendering path with', pathNodeIds.length, 'nodes');

    // Build path segments
    const { segmentsByDepth, totalSegments } = this._buildPathSegments(
      pathNodeIds,
      this.config.colorPalette
    );

    if (totalSegments === 0) {
      console.warn('[SinglePathRenderer] No valid path segments to render');
      return null;
    }

    // Compute effective opacity based on priority
    const effectiveOpacity = this._computeEffectiveOpacity();

    // Render each depth level with 4-layer glow system
    return Array.from(segmentsByDepth.entries()).flatMap(([depthDiff, { pathObj, color }]) => {
      return this._renderPathWithGlow(pathObj, color, depthDiff, effectiveOpacity);
    });
  }
}

/**
 * Dual Path Renderer
 * Used for: Cousin marriages (two paths converging at common ancestor)
 */
export class DualPathRenderer extends HighlightRenderer {
  render() {
    const { paths, intersection } = this.pathData;
    const { pathOpacity, nodes } = this.context;

    if (!paths || paths.length !== 2) {
      console.warn('[DualPathRenderer] Invalid path data - expected 2 paths');
      return null;
    }

    const [path1Nodes, path2Nodes] = paths;

    if (path1Nodes.length < 2 && path2Nodes.length < 2) {
      console.log('[DualPathRenderer] Both paths too short to render');
      return null;
    }

    console.log('[DualPathRenderer] Rendering dual paths:', {
      path1Length: path1Nodes.length,
      path2Length: path2Nodes.length,
      intersection
    });

    // Extract node IDs from path objects
    const path1Ids = path1Nodes.map(node => node.id);
    const path2Ids = path2Nodes.map(node => node.id);

    // Build segments for both paths
    const path1Segments = path1Nodes.length >= 2
      ? this._buildPathSegments(path1Ids, this.config.colorPalette.path1)
      : { segmentsByDepth: new Map(), totalSegments: 0 };

    const path2Segments = path2Nodes.length >= 2
      ? this._buildPathSegments(path2Ids, this.config.colorPalette.path2)
      : { segmentsByDepth: new Map(), totalSegments: 0 };

    const elements = [];

    // Render Path 1 (warm colors)
    if (path1Segments.totalSegments > 0) {
      const path1Elements = Array.from(path1Segments.segmentsByDepth.entries()).flatMap(
        ([depthDiff, { pathObj, color }]) => {
          return this._renderPathWithGlow(pathObj, color, depthDiff, pathOpacity, 'path1');
        }
      );
      elements.push(...path1Elements);
    }

    // Render Path 2 (cool colors) - stagger animation if configured
    if (path2Segments.totalSegments > 0) {
      const path2Elements = Array.from(path2Segments.segmentsByDepth.entries()).flatMap(
        ([depthDiff, { pathObj, color }]) => {
          return this._renderPathWithGlow(pathObj, color, depthDiff, pathOpacity, 'path2');
        }
      );
      elements.push(...path2Elements);
    }

    // Render intersection node (common ancestor) with special styling
    if (intersection) {
      const intersectionNode = nodes.find(n => n.id === intersection);
      if (intersectionNode) {
        const intersectionElement = this._renderIntersectionNode(
          intersectionNode,
          this.config.colorPalette.intersection
        );
        elements.push(...intersectionElement);
      }
    }

    return elements;
  }

  /**
   * Render special highlight for intersection node (common ancestor)
   */
  _renderIntersectionNode(node, color) {
    const { pathOpacity, Skia } = this.context;

    // Create circle path at node position
    const circlePath = Skia.Path.Make();
    circlePath.addCircle(node.x, node.y, 20); // 20px radius

    return [
      // Pulsing outer glow
      <Group key={`${this.typeId}-intersection-outer`} layer={<Paint><Blur blur={12} /></Paint>}>
        <Path
          path={circlePath}
          color={hexToRgba(color, 0.2)}
          style="stroke"
          strokeWidth={4}
          opacity={pathOpacity}
        />
      </Group>,

      // Inner ring
      <Group key={`${this.typeId}-intersection-inner`} layer={<Paint><Blur blur={6} /></Paint>}>
        <Path
          path={circlePath}
          color={hexToRgba(color, 0.35)}
          style="stroke"
          strokeWidth={2.5}
          opacity={pathOpacity}
        />
      </Group>,

      // Core ring (crisp)
      <Path
        key={`${this.typeId}-intersection-core`}
        path={circlePath}
        color={color}
        style="stroke"
        strokeWidth={2}
        opacity={pathOpacity}
      />
    ];
  }
}

/**
 * Multi Path Renderer
 * Used for: Future sibling groups (3+ paths converging)
 */
export class MultiPathRenderer extends HighlightRenderer {
  render() {
    // Future implementation for sibling groups
    console.log('[MultiPathRenderer] Not yet implemented');
    return null;
  }
}

/**
 * Renderer Factory
 * Creates appropriate renderer based on highlight type
 * @param {string} typeId - Unique highlight type identifier ('search', 'userLineage', 'cousinMarriage')
 * @param {Object} highlightConfig - Highlight configuration from HIGHLIGHT_TYPES
 * @param {Object} pathData - Calculated path data
 * @param {Object} context - Rendering context (nodes, connections, etc.)
 */
export function createRenderer(typeId, highlightConfig, pathData, context) {
  if (!typeId || !highlightConfig || !pathData || !context) {
    console.warn('[createRenderer] Missing required parameters');
    return null;
  }

  switch (highlightConfig.multiPath) {
    case false:
      return new SinglePathRenderer(typeId, highlightConfig, pathData, context);
    case 'dual':
      return new DualPathRenderer(typeId, highlightConfig, pathData, context);
    case 'multi':
      return new MultiPathRenderer(typeId, highlightConfig, pathData, context);
    default:
      console.warn(`[createRenderer] Unknown multiPath type: ${highlightConfig.multiPath}`);
      return new SinglePathRenderer(typeId, highlightConfig, pathData, context);
  }
}

export default {
  SinglePathRenderer,
  DualPathRenderer,
  MultiPathRenderer,
  createRenderer,
};
