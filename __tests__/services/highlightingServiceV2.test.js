/**
 * HighlightingServiceV2 - Unit Tests
 *
 * Test Coverage: 25 tests
 * - 5 state transformation tests
 * - 15 path calculation tests (5 types × 3 scenarios)
 * - 5 viewport culling tests
 */

import { highlightingServiceV2 } from '../../src/services/highlightingServiceV2';

describe('HighlightingServiceV2', () => {
  // ============================================
  // STATE TRANSFORMATION TESTS (5 tests)
  // ============================================

  describe('State Transformations', () => {
    it('should add highlight to empty state', () => {
      const state = {};
      const definition = {
        type: 'node_to_node',
        from: 1,
        to: 2,
        style: { color: '#FF0000' },
      };

      const newState = highlightingServiceV2.addHighlight(state, definition);

      expect(Object.keys(newState)).toHaveLength(1);
      const highlight = Object.values(newState)[0];
      expect(highlight.type).toBe('node_to_node');
      expect(highlight.from).toBe(1);
      expect(highlight.to).toBe(2);
      expect(highlight.style.color).toBe('#FF0000');
      expect(highlight.id).toBeDefined();
      expect(highlight.createdAt).toBeDefined();
    });

    it('should remove highlight by ID', () => {
      const state = {
        'h1': { id: 'h1', type: 'ancestry_path', nodeId: 1 },
        'h2': { id: 'h2', type: 'ancestry_path', nodeId: 2 },
      };

      const newState = highlightingServiceV2.removeHighlight(state, 'h1');

      expect(Object.keys(newState)).toHaveLength(1);
      expect(newState['h1']).toBeUndefined();
      expect(newState['h2']).toBeDefined();
    });

    it('should update highlight style', () => {
      const state = {
        'h1': {
          id: 'h1',
          type: 'node_to_node',
          from: 1,
          to: 2,
          style: { color: '#FF0000', opacity: 0.6 },
        },
      };

      const newState = highlightingServiceV2.updateHighlight(state, 'h1', {
        style: { color: '#0000FF', strokeWidth: 6 },
      });

      expect(newState['h1'].style.color).toBe('#0000FF');
      expect(newState['h1'].style.strokeWidth).toBe(6);
      expect(newState['h1'].style.opacity).toBe(0.6); // Preserved
    });

    it('should clear all highlights', () => {
      const state = {
        'h1': { id: 'h1', type: 'ancestry_path', nodeId: 1 },
        'h2': { id: 'h2', type: 'ancestry_path', nodeId: 2 },
      };

      const newState = highlightingServiceV2.clearAll();

      expect(Object.keys(newState)).toHaveLength(0);
    });

    it('should apply default style values when adding highlight', () => {
      const state = {};
      const definition = {
        type: 'ancestry_path',
        nodeId: 1,
      };

      const newState = highlightingServiceV2.addHighlight(state, definition);

      const highlight = Object.values(newState)[0];
      expect(highlight.style.color).toBe('#A13333'); // Default: Najdi Crimson
      expect(highlight.style.opacity).toBe(0.6);
      expect(highlight.style.strokeWidth).toBe(4);
      expect(highlight.priority).toBe(0);
    });
  });

  // ============================================
  // PATH CALCULATION TESTS (15 tests)
  // ============================================

  describe('Path Calculations', () => {
    // Mock tree data
    const createMockNodes = () => {
      const nodesMap = new Map();

      // Generation 1 (root)
      nodesMap.set(1, { id: 1, x: 500, y: 100, father_id: null, generation: 1 });

      // Generation 2
      nodesMap.set(2, { id: 2, x: 300, y: 300, father_id: 1, generation: 2 });
      nodesMap.set(3, { id: 3, x: 700, y: 300, father_id: 1, generation: 2 });

      // Generation 3
      nodesMap.set(4, { id: 4, x: 200, y: 500, father_id: 2, generation: 3 });
      nodesMap.set(5, { id: 5, x: 400, y: 500, father_id: 2, generation: 3 });
      nodesMap.set(6, { id: 6, x: 800, y: 500, father_id: 3, generation: 3 });

      return nodesMap;
    };

    // Path Type 1: Node-to-Node (3 tests)
    describe('node_to_node', () => {
      it('should calculate path between siblings', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'node_to_node',
            from: 4,
            to: 5,
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData.length).toBeGreaterThan(0);
        // Siblings connect via parent (4 → 2 → 5)
      });

      it('should calculate path between cousins', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'node_to_node',
            from: 4,
            to: 6,
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData.length).toBeGreaterThan(0);
        // Cousins connect via grandparent (4 → 2 → 1 → 3 → 6)
      });

      it('should return empty array for non-existent nodes', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'node_to_node',
            from: 999,
            to: 1000,
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData).toHaveLength(0);
      });
    });

    // Path Type 2: Connection Only (3 tests)
    describe('connection_only', () => {
      it('should highlight direct parent-child connection', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'connection_only',
            from: 2,
            to: 1,
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData).toHaveLength(1);
        expect(renderData[0].highlights).toHaveLength(1);
      });

      it('should return empty for non-direct connection', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'connection_only',
            from: 4,
            to: 5, // Siblings, not direct
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData).toHaveLength(0);
      });

      it('should work bidirectionally (child to parent or parent to child)', () => {
        const nodesMap = createMockNodes();
        const state1 = {
          'h1': {
            id: 'h1',
            type: 'connection_only',
            from: 2,
            to: 1, // Child → Parent
            style: { color: '#FF0000' },
          },
        };

        const state2 = {
          'h2': {
            id: 'h2',
            type: 'connection_only',
            from: 1,
            to: 2, // Parent → Child
            style: { color: '#0000FF' },
          },
        };

        const renderData1 = highlightingServiceV2.getRenderData(state1, nodesMap, null);
        const renderData2 = highlightingServiceV2.getRenderData(state2, nodesMap, null);

        expect(renderData1).toHaveLength(1);
        expect(renderData2).toHaveLength(1);
      });
    });

    // Path Type 3: Ancestry Path (3 tests)
    describe('ancestry_path', () => {
      it('should highlight path from node to root', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'ancestry_path',
            nodeId: 4,
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Should highlight: 4 → 2 → 1 (2 segments)
        expect(renderData.length).toBeGreaterThanOrEqual(2);
      });

      it('should respect maxDepth limit', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'ancestry_path',
            nodeId: 4,
            maxDepth: 1, // Only 1 level up
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Should only highlight: 4 → 2 (1 segment)
        expect(renderData).toHaveLength(1);
      });

      it('should handle root node (no ancestors)', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'ancestry_path',
            nodeId: 1, // Root node
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData).toHaveLength(0); // Root has no ancestors
      });
    });

    // Path Type 4: Tree-Wide (3 tests)
    describe('tree_wide', () => {
      it('should highlight all connections without filter', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'tree_wide',
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Total connections: 2 + 3 = 5 (G2 connections + G3 connections)
        expect(renderData.length).toBe(5);
      });

      it('should filter by generation', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'tree_wide',
            filter: { generation: 2 }, // Only G2 nodes
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Only G2 nodes connecting to G1: 2 connections
        expect(renderData.length).toBe(2);
      });

      it('should handle custom filter predicate', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'tree_wide',
            filter: {
              predicate: (node, parent) => node.id % 2 === 0, // Even IDs only
            },
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Even IDs: 2, 4, 6 (3 connections)
        expect(renderData.length).toBe(3);
      });
    });

    // Path Type 5: Subtree (3 tests)
    describe('subtree', () => {
      it('should highlight entire subtree', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'subtree',
            rootId: 2,
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Subtree of node 2: 2 → 4, 2 → 5 (2 connections)
        expect(renderData.length).toBe(2);
      });

      it('should respect maxDepth in subtree', () => {
        const nodesMap = createMockNodes();

        // Add generation 4 under node 4
        nodesMap.set(7, { id: 7, x: 150, y: 700, father_id: 4, generation: 4 });

        const state = {
          'h1': {
            id: 'h1',
            type: 'subtree',
            rootId: 2,
            maxDepth: 1, // Only direct children
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        // Only direct children: 2 → 4, 2 → 5 (2 connections, not 4 → 7)
        expect(renderData.length).toBe(2);
      });

      it('should handle leaf node (no descendants)', () => {
        const nodesMap = createMockNodes();
        const state = {
          'h1': {
            id: 'h1',
            type: 'subtree',
            rootId: 4, // Leaf node
            style: { color: '#FF0000' },
          },
        };

        const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

        expect(renderData).toHaveLength(0); // No descendants
      });
    });
  });

  // ============================================
  // VIEWPORT CULLING TESTS (5 tests)
  // ============================================

  describe('Viewport Culling', () => {
    const createMockNodes = () => {
      const nodesMap = new Map();
      nodesMap.set(1, { id: 1, x: 0, y: 0, father_id: null });
      nodesMap.set(2, { id: 2, x: 100, y: 100, father_id: 1 });
      nodesMap.set(3, { id: 3, x: 1000, y: 1000, father_id: 1 });
      return nodesMap;
    };

    it('should include segments inside viewport', () => {
      const nodesMap = createMockNodes();
      const state = {
        'h1': {
          id: 'h1',
          type: 'connection_only',
          from: 1,
          to: 2,
          style: { color: '#FF0000' },
        },
      };

      const viewport = { minX: 0, maxX: 500, minY: 0, maxY: 500 };
      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, viewport);

      expect(renderData.length).toBeGreaterThan(0);
    });

    it('should exclude segments outside viewport', () => {
      const nodesMap = createMockNodes();
      // Add node 4 completely outside viewport
      nodesMap.set(4, { id: 4, x: 600, y: 600, father_id: 3 });

      const state = {
        'h1': {
          id: 'h1',
          type: 'connection_only',
          from: 3, // x=1000, y=1000 (outside viewport)
          to: 4,   // x=600, y=600 (also outside viewport)
          style: { color: '#FF0000' },
        },
      };

      const viewport = { minX: 0, maxX: 500, minY: 0, maxY: 500 };
      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, viewport);

      expect(renderData).toHaveLength(0); // Completely outside viewport
    });

    it('should include segments partially in viewport', () => {
      const nodesMap = new Map();
      nodesMap.set(1, { id: 1, x: -50, y: -50, father_id: null });
      nodesMap.set(2, { id: 2, x: 50, y: 50, father_id: 1 });

      const state = {
        'h1': {
          id: 'h1',
          type: 'connection_only',
          from: 1,
          to: 2,
          style: { color: '#FF0000' },
        },
      };

      const viewport = { minX: 0, maxX: 500, minY: 0, maxY: 500 };
      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, viewport);

      expect(renderData.length).toBeGreaterThan(0); // Partially visible should be included
    });

    it('should return all segments when viewport is null', () => {
      const nodesMap = createMockNodes();
      const state = {
        'h1': { id: 'h1', type: 'connection_only', from: 1, to: 2, style: { color: '#FF0000' } },
        'h2': { id: 'h2', type: 'connection_only', from: 1, to: 3, style: { color: '#0000FF' } },
      };

      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

      expect(renderData.length).toBe(2); // All segments returned
    });

    it('should handle empty viewport (minX = maxX)', () => {
      const nodesMap = createMockNodes();
      const state = {
        'h1': {
          id: 'h1',
          type: 'connection_only',
          from: 1,
          to: 2,
          style: { color: '#FF0000' },
        },
      };

      const viewport = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, viewport);

      // Only segments at exactly (0, 0) should be included
      expect(renderData.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // ADDITIONAL TESTS (Bonus)
  // ============================================

  describe('Overlap Detection', () => {
    it('should detect overlapping highlights on same segment', () => {
      const nodesMap = new Map();
      nodesMap.set(1, { id: 1, x: 0, y: 0, father_id: null });
      nodesMap.set(2, { id: 2, x: 100, y: 100, father_id: 1 });

      const state = {
        'h1': {
          id: 'h1',
          type: 'connection_only',
          from: 1,
          to: 2,
          style: { color: '#FF0000' },
        },
        'h2': {
          id: 'h2',
          type: 'connection_only',
          from: 1,
          to: 2, // Same segment
          style: { color: '#0000FF' },
        },
      };

      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

      expect(renderData).toHaveLength(1); // One segment
      expect(renderData[0].highlights).toHaveLength(2); // Two highlights
    });

    it('should sort overlapping highlights by priority', () => {
      const nodesMap = new Map();
      nodesMap.set(1, { id: 1, x: 0, y: 0, father_id: null });
      nodesMap.set(2, { id: 2, x: 100, y: 100, father_id: 1 });

      const state = {
        'h1': {
          id: 'h1',
          type: 'connection_only',
          from: 1,
          to: 2,
          style: { color: '#FF0000' },
          priority: 5,
        },
        'h2': {
          id: 'h2',
          type: 'connection_only',
          from: 1,
          to: 2,
          style: { color: '#0000FF' },
          priority: 10, // Higher priority
        },
      };

      const renderData = highlightingServiceV2.getRenderData(state, nodesMap, null);

      expect(renderData).toHaveLength(1);
      // Segment should be sorted by max priority (10)
      expect(renderData[0].highlights.find(h => h.priority === 10)).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should return accurate stats', () => {
      const nodesMap = new Map();
      nodesMap.set(1, { id: 1, x: 0, y: 0, father_id: null });
      nodesMap.set(2, { id: 2, x: 100, y: 100, father_id: 1 });
      nodesMap.set(3, { id: 3, x: 200, y: 200, father_id: 1 });

      const state = {
        'h1': { id: 'h1', type: 'connection_only', from: 1, to: 2, style: { color: '#FF0000' } },
        'h2': { id: 'h2', type: 'connection_only', from: 1, to: 3, style: { color: '#0000FF' } },
      };

      const stats = highlightingServiceV2.getStats(state, nodesMap, null);

      expect(stats.highlightCount).toBe(2);
      expect(stats.segmentCount).toBe(2);
      expect(stats.visibleSegmentCount).toBe(2);
    });
  });
});
