/**
 * HighlightingServiceV2 - Pure service for advanced highlight management
 *
 * ARCHITECTURE:
 * - Pure service pattern (NOT singleton with internal state)
 * - All methods are stateless (take state in, return new state out)
 * - No side effects, no DOM manipulation, no rendering
 * - State managed by Zustand (useTreeStore)
 *
 * FEATURES:
 * - Unlimited path types (node-to-node, connection-only, ancestry, tree-wide, subtree)
 * - Segment overlap detection for color blending
 * - Viewport culling for performance
 * - Support for 100+ simultaneous highlights
 *
 * @version 2.0.0
 * @status Production-ready
 */

import { PathCalculationService } from './pathCalculationService';

class HighlightingServiceV2 {
  // ============================================
  // PURE STATE TRANSFORMERS (No Side Effects)
  // ============================================

  /**
   * Add highlight definition to state
   * @param {Object} state - Current highlights state (Map<id, definition>)
   * @param {Object} definition - Highlight definition
   * @returns {Object} New state with added highlight
   */
  addHighlight(state, definition) {
    const id = definition.id || this._generateId();

    // Validate definition
    if (!this._isValidDefinition(definition)) {
      console.warn('[HighlightingServiceV2] Invalid highlight definition:', definition);
      return state;
    }

    return {
      ...state,
      [id]: {
        ...definition,
        id,
        createdAt: Date.now(),
        priority: definition.priority ?? 0,
        style: {
          color: definition.style?.color || '#A13333',  // Default: Najdi Crimson
          opacity: definition.style?.opacity ?? 0.6,
          strokeWidth: definition.style?.strokeWidth ?? 4,
        },
      },
    };
  }

  /**
   * Remove highlight from state
   * @param {Object} state - Current highlights state
   * @param {string} id - Highlight ID
   * @returns {Object} New state without highlight
   */
  removeHighlight(state, id) {
    if (!state[id]) {
      console.warn(`[HighlightingServiceV2] Highlight ${id} not found`);
      return state;
    }

    const { [id]: removed, ...rest } = state;
    return rest;
  }

  /**
   * Update highlight definition
   * @param {Object} state - Current highlights state
   * @param {string} id - Highlight ID
   * @param {Object} updates - Fields to update
   * @returns {Object} New state with updated highlight
   */
  updateHighlight(state, id, updates) {
    if (!state[id]) {
      console.warn(`[HighlightingServiceV2] Highlight ${id} not found`);
      return state;
    }

    return {
      ...state,
      [id]: {
        ...state[id],
        ...updates,
        style: {
          ...state[id].style,
          ...(updates.style || {}),
        },
      },
    };
  }

  /**
   * Clear all highlights
   * @returns {Object} Empty state
   */
  clearAll() {
    return {};
  }

  // ============================================
  // RENDER DATA CALCULATION (Pure Functions)
  // ============================================

  /**
   * Calculate render data for all highlights
   *
   * Process:
   * 1. Calculate path segments for each highlight definition
   * 2. Detect overlapping segments (multiple highlights on same connection)
   * 3. Apply viewport culling (only visible segments)
   * 4. Sort by priority (higher priority renders on top)
   *
   * @param {Object} state - Current highlights state
   * @param {Map} nodesMap - Tree nodes (Map<id, node>)
   * @param {Object} viewport - Current viewport bounds { minX, maxX, minY, maxY }
   * @returns {Array<HighlightSegment>} Render data for visible segments
   */
  getRenderData(state, nodesMap, viewport) {
    if (!state || Object.keys(state).length === 0) {
      return [];
    }

    // 1. Calculate path segments for all highlights
    const allPaths = Object.values(state).map(def => ({
      id: def.id,
      segments: this._calculatePath(def, nodesMap),
      style: def.style,
      priority: def.priority,
    }));

    // 2. Build segment map with overlap detection
    const segmentMap = this._buildSegmentMap(allPaths);

    // 3. Apply viewport culling (only visible segments)
    const visibleSegments = this._cullByViewport(segmentMap, nodesMap, viewport);

    // 4. Sort by priority (higher = rendered on top)
    return visibleSegments.sort((a, b) => {
      // Sort by max priority of all highlights on this segment
      const aPriority = Math.max(...a.highlights.map(h => h.priority));
      const bPriority = Math.max(...b.highlights.map(h => h.priority));
      return bPriority - aPriority;
    });
  }

  // ============================================
  // PATH CALCULATION (5 Path Types)
  // ============================================

  /**
   * Calculate path segments for a highlight definition
   * @private
   * @param {Object} definition - Highlight definition
   * @param {Map} nodesMap - Tree nodes
   * @returns {Array<Segment>} Array of segments { from, to, x1, y1, x2, y2 }
   */
  _calculatePath(definition, nodesMap) {
    try {
      switch (definition.type) {
        case 'node_to_node':
          return this._calculateNodeToNodePath(definition, nodesMap);

        case 'connection_only':
          return this._calculateConnectionPath(definition, nodesMap);

        case 'ancestry_path':
          return this._calculateAncestryPath(definition, nodesMap);

        case 'tree_wide':
          return this._calculateTreeWidePath(definition, nodesMap);

        case 'subtree':
          return this._calculateSubtreePath(definition, nodesMap);

        default:
          console.warn(`[HighlightingServiceV2] Unknown path type: ${definition.type}`);
          return [];
      }
    } catch (error) {
      console.error(`[HighlightingServiceV2] Error calculating path for ${definition.id}:`, error);
      return [];
    }
  }

  /**
   * Path Type 1: Node-to-Node (using LCA algorithm)
   * Highlights the shortest path between two nodes via common ancestor
   * @private
   */
  _calculateNodeToNodePath(definition, nodesMap) {
    const { from, to } = definition;

    if (!from || !to) {
      console.warn('[HighlightingServiceV2] node_to_node requires from and to');
      return [];
    }

    const fromNode = nodesMap.get(from);
    const toNode = nodesMap.get(to);

    if (!fromNode || !toNode) {
      console.warn(`[HighlightingServiceV2] Node not found: from=${from}, to=${to}`);
      return [];
    }

    // Create PathCalculationService instance
    const pathService = new PathCalculationService(nodesMap);

    // Find Lowest Common Ancestor
    const lca = pathService.findLCA(from, to);

    if (!lca) {
      console.warn(`[HighlightingServiceV2] No common ancestor found for ${from} and ${to}`);
      return [];
    }

    // Get paths from both nodes to LCA
    const pathFromSource = pathService.calculatePath(from);
    const pathFromTarget = pathService.calculatePath(to);

    // Build combined path: from → LCA → to
    // 1. Get path from 'from' to LCA (inclusive)
    const pathToLCA = [];
    for (const node of pathFromSource) {
      pathToLCA.push(node.id);
      if (node.id === lca) break;
    }

    // 2. Get path from 'to' to LCA (reverse, excluding LCA to avoid duplicate)
    const pathFromLCAToTarget = [];
    for (const node of pathFromTarget) {
      if (node.id === lca) break;
      pathFromLCAToTarget.push(node.id);
    }
    pathFromLCAToTarget.reverse(); // Reverse to go from LCA to target

    // 3. Combine: from→LCA + LCA→to
    const fullPath = [...pathToLCA, ...pathFromLCAToTarget];

    if (fullPath.length < 2) {
      return [];
    }

    // Convert node IDs to segments with coordinates
    return this._pathIdsToSegments(fullPath, nodesMap);
  }

  /**
   * Path Type 2: Connection Only
   * Highlights a single direct connection (parent-child only)
   * @private
   */
  _calculateConnectionPath(definition, nodesMap) {
    const { from, to } = definition;

    if (!from || !to) {
      console.warn('[HighlightingServiceV2] connection_only requires from and to');
      return [];
    }

    const fromNode = nodesMap.get(from);
    const toNode = nodesMap.get(to);

    if (!fromNode || !toNode) {
      console.warn(`[HighlightingServiceV2] Node not found: from=${from}, to=${to}`);
      return [];
    }

    // Check if direct parent-child connection exists
    const isDirect = fromNode.father_id === to || toNode.father_id === from;

    if (!isDirect) {
      console.warn(`[HighlightingServiceV2] No direct connection between ${from} and ${to}`);
      return [];
    }

    return [{
      from: fromNode.id,
      to: toNode.id,
      x1: fromNode.x,
      y1: fromNode.y,
      x2: toNode.x,
      y2: toNode.y,
    }];
  }

  /**
   * Path Type 3: Ancestry Path
   * Highlights path from node to root (all ancestors)
   * @private
   */
  _calculateAncestryPath(definition, nodesMap) {
    const { nodeId, maxDepth } = definition;

    if (!nodeId) {
      console.warn('[HighlightingServiceV2] ancestry_path requires nodeId');
      return [];
    }

    let current = nodesMap.get(nodeId);
    const segments = [];
    let depth = 0;

    // Walk up the tree until root or maxDepth reached
    while (current && current.father_id) {
      if (maxDepth && depth >= maxDepth) break;

      const parent = nodesMap.get(current.father_id);
      if (!parent) break;

      segments.push({
        from: current.id,
        to: parent.id,
        x1: current.x,
        y1: current.y,
        x2: parent.x,
        y2: parent.y,
      });

      current = parent;
      depth++;
    }

    return segments;
  }

  /**
   * Path Type 4: Tree-Wide
   * Highlights all connections matching filter criteria
   * @private
   */
  _calculateTreeWidePath(definition, nodesMap) {
    const { filter } = definition;
    const segments = [];

    // Enumerate all connections in tree
    nodesMap.forEach(node => {
      if (!node.father_id) return;

      const parent = nodesMap.get(node.father_id);
      if (!parent) return;

      // Apply filter if provided
      if (filter && !this._passesFilter(node, parent, filter)) return;

      segments.push({
        from: node.id,
        to: parent.id,
        x1: node.x,
        y1: node.y,
        x2: parent.x,
        y2: parent.y,
      });
    });

    return segments;
  }

  /**
   * Path Type 5: Subtree
   * Highlights all connections within a subtree (node + descendants)
   * @private
   */
  _calculateSubtreePath(definition, nodesMap) {
    const { rootId, maxDepth } = definition;

    if (!rootId) {
      console.warn('[HighlightingServiceV2] subtree requires rootId');
      return [];
    }

    const segments = [];
    const visited = new Set();
    const HARD_DEPTH_LIMIT = 20; // Safety: max 20 generations to prevent infinite loops

    const traverse = (nodeId, depth) => {
      // CRITICAL: Hard depth limit BEFORE visited check (prevents infinite loops from circular refs)
      if (depth >= HARD_DEPTH_LIMIT) {
        console.warn(`[HighlightingServiceV2] Hard depth limit (${HARD_DEPTH_LIMIT}) reached at node ${nodeId}`);
        return;
      }

      // User-defined maxDepth check (use >= for correct off-by-one behavior)
      if (maxDepth !== undefined && depth >= maxDepth) return;

      // Circular reference protection
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodesMap.get(nodeId);
      if (!node) return;

      // Find all children
      nodesMap.forEach(child => {
        if (child.father_id === nodeId) {
          segments.push({
            from: nodeId,
            to: child.id,
            x1: node.x,
            y1: node.y,
            x2: child.x,
            y2: child.y,
          });

          traverse(child.id, depth + 1);
        }
      });
    };

    traverse(rootId, 0);
    return segments;
  }

  // ============================================
  // OVERLAP DETECTION (SegmentTracker Logic)
  // ============================================

  /**
   * Build segment map with overlap detection
   *
   * Tracks which highlights share the same segment (connection).
   * When multiple highlights overlap on same segment, they will be
   * rendered with Skia BlendMode for GPU color blending.
   *
   * @private
   * @param {Array} allPaths - All calculated paths
   * @returns {Map<string, SegmentData>} Map of segments with overlapping highlights
   */
  _buildSegmentMap(allPaths) {
    const segmentMap = new Map(); // key: "parentId-childId", value: { from, to, x1, y1, x2, y2, highlights: [...] }

    allPaths.forEach(({ id, segments, style, priority }) => {
      segments.forEach(seg => {
        // Create bidirectional key (parent-child can be in either order)
        const key = this._createSegmentKey(seg.from, seg.to);

        if (!segmentMap.has(key)) {
          segmentMap.set(key, {
            from: seg.from,
            to: seg.to,
            x1: seg.x1,
            y1: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            highlights: [],
          });
        }

        const entry = segmentMap.get(key);
        entry.highlights.push({
          id,
          color: style.color,
          opacity: style.opacity,
          strokeWidth: style.strokeWidth,
          priority,
        });
      });
    });

    return segmentMap;
  }

  /**
   * Create segment key (normalized for bidirectional lookup)
   * @private
   */
  _createSegmentKey(from, to) {
    // Always use smaller ID first for consistent key
    return from < to ? `${from}-${to}` : `${to}-${from}`;
  }

  // ============================================
  // VIEWPORT CULLING (Performance Optimization)
  // ============================================

  /**
   * Apply viewport culling to segments
   *
   * Filters out segments that are completely outside the viewport.
   * Only segments that intersect or are inside viewport are kept.
   *
   * OPTIMIZATION: Uses pre-calculated bounds for O(1) culling (vs O(4) calculating min/max)
   *
   * @private
   * @param {Map} segmentMap - All segments (with pre-calculated bounds)
   * @param {Map} nodesMap - Tree nodes (unused, kept for API consistency)
   * @param {Object} viewport - Viewport bounds { minX, maxX, minY, maxY }
   * @returns {Array<SegmentData>} Visible segments only
   */
  _cullByViewport(segmentMap, nodesMap, viewport) {
    if (!viewport) {
      // No viewport provided, return all segments
      return Array.from(segmentMap.values());
    }

    const { minX, maxX, minY, maxY } = viewport;

    return Array.from(segmentMap.values()).filter(seg => {
      // Use pre-calculated bounds for O(1) culling
      const segBounds = seg.bounds || {
        minX: Math.min(seg.x1, seg.x2),
        maxX: Math.max(seg.x1, seg.x2),
        minY: Math.min(seg.y1, seg.y2),
        maxY: Math.max(seg.y1, seg.y2)
      };

      // Check if segment intersects viewport (inclusive)
      const intersects = !(
        segBounds.maxX < minX ||  // Segment completely left of viewport
        segBounds.minX > maxX ||  // Segment completely right of viewport
        segBounds.maxY < minY ||  // Segment completely above viewport
        segBounds.minY > maxY     // Segment completely below viewport
      );

      return intersects;
    });
  }

  // ============================================
  // HELPER UTILITIES
  // ============================================

  /**
   * Generate unique highlight ID
   * @private
   */
  _generateId() {
    return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate highlight definition
   * @private
   */
  _isValidDefinition(definition) {
    if (!definition.type) return false;

    const validTypes = ['node_to_node', 'connection_only', 'ancestry_path', 'tree_wide', 'subtree'];
    if (!validTypes.includes(definition.type)) return false;

    // Type-specific validation
    switch (definition.type) {
      case 'node_to_node':
      case 'connection_only':
        return definition.from != null && definition.to != null;

      case 'ancestry_path':
        return definition.nodeId != null;

      case 'subtree':
        return definition.rootId != null;

      case 'tree_wide':
        return true; // No required params

      default:
        return false;
    }
  }

  /**
   * Calculate bounding box for two nodes (for fast viewport culling)
   * @private
   * @param {Object} nodeA - Parent node
   * @param {Object} nodeB - Child node
   * @returns {Object} Bounds { minX, maxX, minY, maxY }
   */
  _calculateBounds(nodeA, nodeB) {
    return {
      minX: Math.min(nodeA.x, nodeB.x),
      maxX: Math.max(nodeA.x, nodeB.x),
      minY: Math.min(nodeA.y, nodeB.y),
      maxY: Math.max(nodeA.y, nodeB.y),
    };
  }

  /**
   * Convert path (array of node IDs) to hybrid segments
   *
   * HYBRID STRUCTURE (for Bezier curve support):
   * - connection: Full node objects for path regeneration
   * - bezierPath: Memoized Skia path (generated by renderer)
   * - bounds: Pre-calculated bounding box for O(1) viewport culling
   *
   * @private
   * @param {Array<number>} pathIds - Array of node IDs
   * @param {Map} nodesMap - Tree nodes map
   * @returns {Array<HybridSegment>} Segments with connection references
   */
  _pathIdsToSegments(pathIds, nodesMap) {
    const segments = [];

    for (let i = 0; i < pathIds.length - 1; i++) {
      const nodeA = nodesMap.get(pathIds[i]);
      const nodeB = nodesMap.get(pathIds[i + 1]);

      if (nodeA && nodeB) {
        // CRITICAL: Validate coordinates are valid numbers (not NaN, undefined, or null)
        const x1Valid = typeof nodeA.x === 'number' && !isNaN(nodeA.x);
        const y1Valid = typeof nodeA.y === 'number' && !isNaN(nodeA.y);
        const x2Valid = typeof nodeB.x === 'number' && !isNaN(nodeB.x);
        const y2Valid = typeof nodeB.y === 'number' && !isNaN(nodeB.y);

        if (!x1Valid || !y1Valid || !x2Valid || !y2Valid) {
          console.warn(
            `[HighlightingServiceV2] Invalid coordinates for segment ${nodeA.id}→${nodeB.id}: ` +
            `A(${nodeA.x}, ${nodeA.y}), B(${nodeB.x}, ${nodeB.y})`
          );
          continue; // Skip this segment
        }

        // HYBRID STRUCTURE: Connection + Bounds + Bezier Path (cached by renderer)
        segments.push({
          from: nodeA.id,
          to: nodeB.id,
          // Connection object for Bezier path generation
          connection: {
            parent: nodeA,
            children: [nodeB],
          },
          // Bezier path (null initially, memoized by renderer)
          bezierPath: null,
          // Pre-calculated bounds for fast viewport culling (O(1))
          bounds: this._calculateBounds(nodeA, nodeB),
          // Legacy coordinates (for backward compatibility during transition)
          x1: nodeA.x,
          y1: nodeA.y,
          x2: nodeB.x,
          y2: nodeB.y,
        });
      }
    }

    return segments;
  }

  /**
   * Check if node/parent passes filter criteria
   * @private
   */
  _passesFilter(node, parent, filter) {
    if (!filter) return true;

    // Generation filter
    if (filter.generation !== undefined) {
      if (node.generation !== filter.generation) return false;
    }

    // Munasib filter (spouse connections)
    if (filter.munasib_only === true) {
      if (!node.munasib_id) return false;
    }

    // Custom predicate function (SANDBOXED: wrap in try-catch to prevent filter crashes)
    if (typeof filter.predicate === 'function') {
      try {
        return filter.predicate(node, parent);
      } catch (error) {
        console.error(
          `[HighlightingServiceV2] Filter predicate threw exception for node ${node.id}:`,
          error
        );
        return false; // Fail-safe: exclude node on error
      }
    }

    return true;
  }

  /**
   * Get statistics about current highlights
   * Useful for debugging and performance monitoring
   */
  getStats(state, nodesMap, viewport) {
    const highlightCount = Object.keys(state).length;

    if (highlightCount === 0) {
      return {
        highlightCount: 0,
        segmentCount: 0,
        visibleSegmentCount: 0,
        overlappingSegmentCount: 0,
        averageOverlaps: 0,
      };
    }

    const renderData = this.getRenderData(state, nodesMap, viewport);
    const segmentCount = renderData.length;
    const overlappingSegments = renderData.filter(seg => seg.highlights.length > 1);
    const averageOverlaps = overlappingSegments.length > 0
      ? overlappingSegments.reduce((sum, seg) => sum + seg.highlights.length, 0) / overlappingSegments.length
      : 0;

    return {
      highlightCount,
      segmentCount,
      visibleSegmentCount: renderData.length,
      overlappingSegmentCount: overlappingSegments.length,
      averageOverlaps: averageOverlaps.toFixed(2),
    };
  }
}

// Export singleton instance (but all methods are pure functions)
export const highlightingServiceV2 = new HighlightingServiceV2();
