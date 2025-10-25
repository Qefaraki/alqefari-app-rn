/**
 * Progressive Loading Utilities
 *
 * Pure functions for progressive loading logic:
 * - getVisibleNodeIds: Detect which nodes are visible in viewport
 * - mergeEnrichedData: Merge rich data into nodes without recalculating layout
 */

/**
 * Get IDs of visible nodes in viewport
 *
 * Parameters:
 * - nodes: Array of layout nodes with x, y positions
 * - stage: { x, y, scale } from Reanimated shared values
 * - dimensions: { width, height } of viewport
 * - enrichedNodes: Set of already-enriched node IDs
 * - padding: Extra pixels around viewport to preload (default 200px)
 *
 * Returns: Array of node IDs that need enrichment
 */
export function getVisibleNodeIds(
  nodes,
  stage,
  dimensions,
  enrichedNodes = new Set(),
  padding = 200
) {
  if (!nodes || nodes.length === 0) return [];

  // Calculate viewport bounds in world coordinates
  // stage: { x: -panX, y: -panY, scale: zoomScale }
  const minX = -stage.x / stage.scale - padding;
  const maxX = (-stage.x + dimensions.width) / stage.scale + padding;
  const minY = -stage.y / stage.scale - padding;
  const maxY = (-stage.y + dimensions.height) / stage.scale + padding;

  // Filter nodes that are:
  // 1. In viewport (within bounds)
  // 2. Not already enriched
  // 3. Missing rich data (no bio field)
  return nodes
    .filter(node => {
      if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') {
        return false;
      }

      const inViewport =
        node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY;
      const notEnriched = !enrichedNodes.has(node.id);
      const needsEnrichment = !node.bio; // bio indicates rich data loaded

      return inViewport && (notEnriched || needsEnrichment);
    })
    .map(n => n.id);
}

/**
 * Merge enriched data into nodes without layout recalculation
 *
 * Parameters:
 * - existingNodes: Array of nodes with minimal fields
 * - enrichedData: Array of enriched profile objects from enrichVisibleNodes RPC
 *
 * Returns: Map of node ID → enriched data for efficient lookup
 *
 * Note: This returns a Map instead of modifying nodes in-place
 * This keeps the function pure and lets the caller decide merge strategy
 */
export function mergeEnrichedData(existingNodes = [], enrichedData = []) {
  const enrichedMap = new Map();

  if (!enrichedData || enrichedData.length === 0) {
    return enrichedMap;
  }

  // Create Map for O(1) lookup
  enrichedData.forEach(profile => {
    if (profile && profile.id) {
      enrichedMap.set(profile.id, profile);
    }
  });

  return enrichedMap;
}

/**
 * Check if a node has been enriched with rich data
 *
 * Returns true if node has rich data fields populated
 */
export function isNodeEnriched(node) {
  return !!(node && (node.bio || node.photo_url || node.phone));
}

/**
 * Estimate data size of structure vs full tree
 *
 * Used for logging and performance monitoring
 */
export function estimateDataSize(profileCount) {
  return {
    structure: {
      bytes: profileCount * 158,
      mb: (profileCount * 158 / 1024 / 1024).toFixed(2),
    },
    full: {
      bytes: profileCount * 1495,
      mb: (profileCount * 1495 / 1024 / 1024).toFixed(2),
    },
    savings: {
      percent: 89.4,
      ratio: '1:9.5',
    },
  };
}
