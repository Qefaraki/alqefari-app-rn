/**
 * SpatialGrid - Efficient viewport culling for tree nodes
 *
 * Phase 2 Day 1 - Extracted from TreeView.js (lines 506-558)
 *
 * Grid-based spatial partitioning for fast visible node queries.
 * Divides tree space into cells and only checks nodes in visible cells.
 *
 * Performance:
 * - O(1) insertion per node
 * - O(k) query where k = nodes in visible cells (not total nodes)
 * - Typical: 500 visible nodes from 2,392 total
 */

// Default cell size (reduced from 512px to better align with ~100px node spacing)
const GRID_CELL_SIZE = 256;

// Max visible nodes to prevent performance degradation
const MAX_VISIBLE_NODES = 500;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  [key: string]: any;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Spatial grid for efficient viewport culling
 *
 * @example
 * const grid = new SpatialGrid(nodes);
 * const visible = grid.getVisibleNodes(viewport, scale, idToNode);
 */
export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Set<string>>; // "x,y" -> Set<nodeId>

  constructor(nodes: LayoutNode[], cellSize: number = GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map();

    // Build grid by assigning each node to its cell
    nodes.forEach((node) => {
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      const key = `${cellX},${cellY}`;

      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key)!.add(node.id);
    });
  }

  /**
   * Get visible nodes within viewport
   *
   * @param viewport - Camera viewport in world space
   * @param scale - Camera zoom level
   * @param idToNode - Map of node IDs to node objects
   * @returns Array of visible nodes (capped at MAX_VISIBLE_NODES)
   */
  getVisibleNodes(
    viewport: Viewport,
    scale: number,
    idToNode: Map<string, LayoutNode>
  ): LayoutNode[] {
    // Transform viewport to world space
    const worldMinX = -viewport.x / scale;
    const worldMaxX = (-viewport.x + viewport.width) / scale;
    const worldMinY = -viewport.y / scale;
    const worldMaxY = (-viewport.y + viewport.height) / scale;

    // Get intersecting grid cells
    const minCellX = Math.floor(worldMinX / this.cellSize);
    const maxCellX = Math.floor(worldMaxX / this.cellSize);
    const minCellY = Math.floor(worldMinY / this.cellSize);
    const maxCellY = Math.floor(worldMaxY / this.cellSize);

    // Collect node IDs from visible cells
    const visibleIds = new Set<string>();
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellNodes = this.grid.get(`${cx},${cy}`);
        if (cellNodes) {
          cellNodes.forEach((id) => visibleIds.add(id));
        }
      }
    }

    // Convert IDs to nodes and apply hard cap
    const visibleNodes: LayoutNode[] = [];
    visibleIds.forEach((id) => {
      if (visibleNodes.length >= MAX_VISIBLE_NODES) return;
      const node = idToNode.get(id);
      if (node) visibleNodes.push(node);
    });

    return visibleNodes;
  }

  /**
   * Get grid statistics for debugging
   */
  getStats() {
    let totalNodes = 0;
    let maxNodesPerCell = 0;
    let occupiedCells = 0;

    this.grid.forEach((nodes) => {
      if (nodes.size > 0) {
        occupiedCells++;
        totalNodes += nodes.size;
        maxNodesPerCell = Math.max(maxNodesPerCell, nodes.size);
      }
    });

    return {
      cellSize: this.cellSize,
      totalCells: this.grid.size,
      occupiedCells,
      totalNodes,
      avgNodesPerCell: totalNodes / occupiedCells || 0,
      maxNodesPerCell,
    };
  }
}

export { GRID_CELL_SIZE, MAX_VISIBLE_NODES };
