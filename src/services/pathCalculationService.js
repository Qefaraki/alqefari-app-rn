/**
 * Path Calculation Service for Alqefari Family Tree
 *
 * Provides generic tree traversal and path-finding algorithms for highlighting features.
 * Supports single paths, dual paths (LCA), and N-way paths with caching for performance.
 *
 * Features:
 * - Generic path calculation with configurable traversal direction
 * - LCA (Lowest Common Ancestor) for 2 nodes
 * - N-way LCA for 3+ nodes (sibling groups)
 * - LRU caching for performance optimization
 * - Circular reference detection
 * - Configurable max depth safety
 *
 * Usage:
 *   const service = new PathCalculationService(nodesMap);
 *   const path = service.calculatePath(profileId);
 *   const lca = service.findLCA(spouse1Id, spouse2Id);
 */

/**
 * Simple LRU Cache implementation
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Delete if exists (to re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * Path Calculation Service
 */
export class PathCalculationService {
  constructor(nodesMap) {
    this.nodesMap = nodesMap;
    this.cache = new LRUCache(100);
  }

  /**
   * Update the nodes map (call when tree data changes)
   * @param {Map} newNodesMap - Updated nodes map
   */
  updateNodesMap(newNodesMap) {
    this.nodesMap = newNodesMap;
    this.cache.clear(); // Invalidate cache on data change
  }

  /**
   * Calculate ancestry path from a node to root
   * @param {string} nodeId - Starting node ID
   * @param {Object} options - Configuration options
   * @param {string} options.direction - 'paternal' | 'maternal' | 'both' (default: 'paternal')
   * @param {number} options.maxDepth - Maximum depth to traverse (default: 500)
   * @returns {Array<Object>} Array of path nodes with metadata
   */
  calculatePath(nodeId, options = {}) {
    const {
      direction = 'paternal',
      maxDepth = 500,
    } = options;

    // Check cache
    const cacheKey = `${nodeId}-${direction}-${maxDepth}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate path
    const path = this._traverse(nodeId, direction, maxDepth);

    // Cache result
    this.cache.set(cacheKey, path);

    return path;
  }

  /**
   * Find Lowest Common Ancestor (LCA) for two nodes
   * @param {string} nodeId1 - First node ID
   * @param {string} nodeId2 - Second node ID
   * @returns {string|null} LCA node ID or null if no common ancestor
   */
  findLCA(nodeId1, nodeId2) {
    if (!nodeId1 || !nodeId2) return null;
    if (nodeId1 === nodeId2) return nodeId1;

    // Get both paths to root
    const path1 = this.calculatePath(nodeId1);
    const path2 = this.calculatePath(nodeId2);

    if (path1.length === 0 || path2.length === 0) return null;

    // Create set of path1 IDs for O(1) lookup
    const path1Set = new Set(path1.map(node => node.id));

    // Find first node in path2 that exists in path1
    for (const node of path2) {
      if (path1Set.has(node.id)) {
        return node.id; // First common ancestor
      }
    }

    return null;
  }

  /**
   * Find N-way common ancestor for 3+ nodes (sibling groups)
   * @param {Array<string>} nodeIds - Array of node IDs
   * @returns {string|null} Common ancestor ID or null
   */
  findNWayLCA(nodeIds) {
    if (!nodeIds || nodeIds.length === 0) return null;
    if (nodeIds.length === 1) return nodeIds[0];
    if (nodeIds.length === 2) return this.findLCA(nodeIds[0], nodeIds[1]);

    // Get all paths to root
    const pathSets = nodeIds.map(id => {
      const path = this.calculatePath(id);
      return new Set(path.map(node => node.id));
    });

    // Find intersection of all paths
    const intersection = new Set(pathSets[0]);
    for (let i = 1; i < pathSets.length; i++) {
      for (const nodeId of intersection) {
        if (!pathSets[i].has(nodeId)) {
          intersection.delete(nodeId);
        }
      }
    }

    if (intersection.size === 0) return null;

    // Return shallowest common ancestor (closest to root)
    const commonAncestors = Array.from(intersection);
    return commonAncestors.reduce((shallowest, current) => {
      const shallowNode = this.nodesMap.get(shallowest);
      const currentNode = this.nodesMap.get(current);

      if (!shallowNode) return current;
      if (!currentNode) return shallowest;

      const shallowDepth = shallowNode.depth ?? Infinity;
      const currentDepth = currentNode.depth ?? Infinity;

      return currentDepth < shallowDepth ? current : shallowest;
    });
  }

  /**
   * Calculate dual paths for cousin marriage highlighting
   * Returns both paths and their intersection point
   * @param {string} spouse1Id - First spouse ID
   * @param {string} spouse2Id - Second spouse ID
   * @returns {Object} { paths: [path1, path2], intersection: lcaId }
   */
  calculateDualPaths(spouse1Id, spouse2Id) {
    const lca = this.findLCA(spouse1Id, spouse2Id);

    if (!lca) {
      // No common ancestor - return full paths to root
      return {
        paths: [
          this.calculatePath(spouse1Id),
          this.calculatePath(spouse2Id)
        ],
        intersection: null
      };
    }

    // Get full paths to root (NO TRIMMING - show complete ancestry)
    const fullPath1 = this.calculatePath(spouse1Id);
    const fullPath2 = this.calculatePath(spouse2Id);

    return {
      paths: [fullPath1, fullPath2], // Return full paths, not trimmed
      intersection: lca
    };
  }

  /**
   * Internal: Traverse tree from node to root
   * @private
   */
  _traverse(nodeId, direction, maxDepth) {
    const path = [];
    const visited = new Set();
    let current = nodeId;
    let depth = 0;

    while (current && depth < maxDepth) {
      // Circular reference detection
      if (visited.has(current)) {
        console.warn(`[PathCalculationService] Circular reference detected at node ${current}`);
        break;
      }
      visited.add(current);

      // Get node data
      const node = this.nodesMap.get(current);
      if (!node) {
        console.warn(`[PathCalculationService] Node not found: ${current}`);
        break;
      }

      // Add to path
      path.push({
        id: node.id,
        depth: node.depth,
        generation: node.generation,
        name: node.name,
      });

      // Navigate to parent based on direction
      switch (direction) {
        case 'paternal':
          current = node.father_id;
          break;
        case 'maternal':
          current = node.mother_id;
          break;
        case 'both':
          // For dual-parent paths, default to paternal
          // Future: implement proper dual-parent traversal
          current = node.father_id;
          break;
        default:
          current = node.father_id;
      }

      depth++;
    }

    if (depth >= maxDepth) {
      console.warn(`[PathCalculationService] Max depth reached (${maxDepth}) for node ${nodeId}`);
    }

    return path;
  }

  /**
   * Internal: Trim path array at specific node (inclusive)
   * @private
   */
  _trimPathAtNode(path, nodeId) {
    const index = path.findIndex(node => node.id === nodeId);
    if (index === -1) return path; // Node not in path, return full path
    return path.slice(0, index + 1); // Include the node itself
  }

  /**
   * Clear the path cache
   * Call this when tree data is updated
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.maxSize,
    };
  }
}

export default PathCalculationService;
