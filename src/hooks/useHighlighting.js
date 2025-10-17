/**
 * useHighlighting Hook
 *
 * Public API for managing tree highlighting features.
 * Provides simple, consistent interface for all highlight types.
 *
 * Usage:
 *   const { setHighlight, clearHighlight, clearAllHighlights, activeHighlights } = useHighlighting();
 *
 *   // Set single-path highlight (search result)
 *   setHighlight('SEARCH', profileId);
 *
 *   // Set dual-path highlight (cousin marriage)
 *   setHighlight('COUSIN_MARRIAGE', [spouse1Id, spouse2Id]);
 *
 *   // Clear specific highlight
 *   clearHighlight('SEARCH');
 *
 *   // Clear all highlights
 *   clearAllHighlights();
 */

import { useCallback, useRef } from 'react';
import { useTreeStore } from '../stores/useTreeStore';
import { HIGHLIGHT_TYPES } from '../services/highlightingService';
import PathCalculationService from '../services/pathCalculationService';

/**
 * Custom hook for tree highlighting
 */
export function useHighlighting() {
  const nodesMap = useTreeStore(state => state.nodesMap);

  // Highlighting state (will be added to TreeView as local state)
  // This hook provides the API, TreeView manages the state

  // Path calculation service instance (singleton per component)
  const pathServiceRef = useRef(null);

  // Initialize path service
  if (!pathServiceRef.current || pathServiceRef.current.nodesMap !== nodesMap) {
    pathServiceRef.current = new PathCalculationService(nodesMap);
  }

  /**
   * Calculate path data for a specific highlight type
   * @param {string} typeKey - Highlight type key (e.g., 'SEARCH', 'COUSIN_MARRIAGE')
   * @param {string|Array<string>} nodeIds - Node ID(s) to highlight
   * @returns {Object|null} Path data for rendering or null if invalid
   */
  const calculatePathData = useCallback((typeKey, nodeIds) => {
    const config = HIGHLIGHT_TYPES[typeKey];
    if (!config) {
      console.warn(`[useHighlighting] Unknown highlight type: ${typeKey}`);
      return null;
    }

    const pathService = pathServiceRef.current;

    switch (typeKey) {
      case 'SEARCH':
      case 'USER_LINEAGE': {
        // Single path from node to root
        const nodeId = Array.isArray(nodeIds) ? nodeIds[0] : nodeIds;
        if (!nodeId) return null;

        const path = pathService.calculatePath(nodeId);
        if (path.length < 2) return null;

        return {
          pathNodeIds: path.map(node => node.id),
          pathNodes: path
        };
      }

      case 'COUSIN_MARRIAGE': {
        // Dual path with common ancestor
        if (!Array.isArray(nodeIds) || nodeIds.length !== 2) {
          console.warn('[useHighlighting] COUSIN_MARRIAGE requires 2 node IDs');
          return null;
        }

        const [spouse1Id, spouse2Id] = nodeIds;

        // Validate both nodes exist in the tree
        if (!nodesMap.has(spouse1Id) || !nodesMap.has(spouse2Id)) {
          console.warn(`[useHighlighting] One or both spouses not in tree: ${spouse1Id}, ${spouse2Id}`);
          return null;
        }

        const { paths, intersection } = pathService.calculateDualPaths(spouse1Id, spouse2Id);

        if (paths[0].length < 2 && paths[1].length < 2) {
          console.warn('[useHighlighting] Both paths too short');
          return null;
        }

        return {
          paths: paths, // Array of path arrays
          intersection: intersection
        };
      }

      default:
        console.warn(`[useHighlighting] Unsupported highlight type: ${typeKey}`);
        return null;
    }
  }, []);

  /**
   * Clear path calculation cache
   * Call when tree data changes
   */
  const clearCache = useCallback(() => {
    if (pathServiceRef.current) {
      pathServiceRef.current.clearCache();
    }
  }, []);

  /**
   * Get cache statistics
   */
  const getCacheStats = useCallback(() => {
    if (pathServiceRef.current) {
      return pathServiceRef.current.getCacheStats();
    }
    return { size: 0, maxSize: 0 };
  }, []);

  return {
    calculatePathData,
    clearCache,
    getCacheStats,
    HIGHLIGHT_TYPES
  };
}

export default useHighlighting;
