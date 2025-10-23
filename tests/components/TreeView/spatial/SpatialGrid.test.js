/**
 * SpatialGrid tests
 * Phase 2 Day 1
 */

import { SpatialGrid, GRID_CELL_SIZE, MAX_VISIBLE_NODES } from '../../../../src/components/TreeView/spatial/SpatialGrid';

describe('SpatialGrid', () => {
  // Test data: 10 nodes in a grid pattern
  const createTestNodes = () => [
    { id: '1', x: 0, y: 0 },
    { id: '2', x: 100, y: 0 },
    { id: '3', x: 200, y: 0 },
    { id: '4', x: 0, y: 100 },
    { id: '5', x: 100, y: 100 },
    { id: '6', x: 200, y: 100 },
    { id: '7', x: 0, y: 200 },
    { id: '8', x: 100, y: 200 },
    { id: '9', x: 200, y: 200 },
    { id: '10', x: 300, y: 300 }, // Far node
  ];

  const createIdToNodeMap = (nodes) => {
    const map = new Map();
    nodes.forEach(node => map.set(node.id, node));
    return map;
  };

  describe('constructor', () => {
    it('should build grid from nodes', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes);

      expect(grid).toBeInstanceOf(SpatialGrid);
    });

    it('should use default cell size', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes);
      const stats = grid.getStats();

      expect(stats.cellSize).toBe(GRID_CELL_SIZE);
    });

    it('should use custom cell size', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes, 128);
      const stats = grid.getStats();

      expect(stats.cellSize).toBe(128);
    });
  });

  describe('getVisibleNodes', () => {
    it('should return nodes within viewport', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes, 150); // Small cells for testing
      const idToNode = createIdToNodeMap(nodes);

      const viewport = { x: 0, y: 0, width: 200, height: 200 };
      const scale = 1.0;

      const visible = grid.getVisibleNodes(viewport, scale, idToNode);

      // Should include nodes in top-left quadrant
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThanOrEqual(nodes.length);
    });

    it('should transform viewport to world space', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes);
      const idToNode = createIdToNodeMap(nodes);

      // Camera at (0, 0) with scale 2.0
      const viewport = { x: 0, y: 0, width: 400, height: 400 };
      const scale = 2.0;

      const visible = grid.getVisibleNodes(viewport, scale, idToNode);

      expect(visible.length).toBeGreaterThan(0);
    });

    it('should respect MAX_VISIBLE_NODES cap', () => {
      // Create many nodes
      const manyNodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        x: (i % 30) * 10,
        y: Math.floor(i / 30) * 10,
      }));

      const grid = new SpatialGrid(manyNodes);
      const idToNode = createIdToNodeMap(manyNodes);

      const viewport = { x: 0, y: 0, width: 1000, height: 1000 };
      const scale = 1.0;

      const visible = grid.getVisibleNodes(viewport, scale, idToNode);

      expect(visible.length).toBeLessThanOrEqual(MAX_VISIBLE_NODES);
    });

    it('should handle zoomed out viewport', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes);
      const idToNode = createIdToNodeMap(nodes);

      // Zoomed out (scale 0.5) - sees more
      const viewport = { x: 0, y: 0, width: 200, height: 200 };
      const scale = 0.5;

      const visible = grid.getVisibleNodes(viewport, scale, idToNode);

      expect(visible.length).toBeGreaterThan(0);
    });

    it('should return empty array when viewport is outside tree', () => {
      const nodes = createTestNodes(); // Max x=300, y=300
      const grid = new SpatialGrid(nodes);
      const idToNode = createIdToNodeMap(nodes);

      // Viewport far away from tree
      const viewport = { x: -5000, y: -5000, width: 200, height: 200 };
      const scale = 1.0;

      const visible = grid.getVisibleNodes(viewport, scale, idToNode);

      expect(visible.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return grid statistics', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes);
      const stats = grid.getStats();

      expect(stats).toHaveProperty('cellSize');
      expect(stats).toHaveProperty('totalCells');
      expect(stats).toHaveProperty('occupiedCells');
      expect(stats).toHaveProperty('totalNodes');
      expect(stats).toHaveProperty('avgNodesPerCell');
      expect(stats).toHaveProperty('maxNodesPerCell');

      expect(stats.totalNodes).toBe(10);
      expect(stats.occupiedCells).toBeGreaterThan(0);
    });

    it('should calculate average nodes per cell', () => {
      const nodes = createTestNodes();
      const grid = new SpatialGrid(nodes, 100); // Very small cells
      const stats = grid.getStats();

      expect(stats.avgNodesPerCell).toBeGreaterThan(0);
      expect(stats.avgNodesPerCell).toBeLessThanOrEqual(stats.totalNodes);
    });
  });

  describe('constants', () => {
    it('should export GRID_CELL_SIZE', () => {
      expect(GRID_CELL_SIZE).toBe(256);
    });

    it('should export MAX_VISIBLE_NODES', () => {
      expect(MAX_VISIBLE_NODES).toBe(500);
    });
  });
});
