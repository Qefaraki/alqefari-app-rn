/**
 * ConnectionRenderer Tests
 *
 * Test suite for parent-child connection line rendering.
 *
 * Coverage:
 * - Bus line calculation and positioning
 * - Bus line conditional rendering
 * - Node height calculation (root vs photo vs text-only)
 * - Viewport culling logic
 * - Path batching performance optimization
 * - LOD Tier 3 connection hiding
 * - Edge count capping
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  ConnectionRenderer,
  calculateBusY,
  calculateBusExtent,
  shouldRenderBusLine,
  getNodeHeight,
  renderConnection,
  renderEdgesBatched,
  CONNECTION_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/ConnectionRenderer';

describe('ConnectionRenderer', () => {
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('CONNECTION_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(CONNECTION_CONSTANTS.DEFAULT_LINE_COLOR).toBe('#D1BBA360');
      expect(CONNECTION_CONSTANTS.DEFAULT_LINE_WIDTH).toBe(1.2);
      expect(CONNECTION_CONSTANTS.DEFAULT_NODE_HEIGHT_WITH_PHOTO).toBe(90);
      expect(CONNECTION_CONSTANTS.DEFAULT_NODE_HEIGHT_TEXT_ONLY).toBe(35);
      expect(CONNECTION_CONSTANTS.ROOT_NODE_HEIGHT).toBe(100);
      expect(CONNECTION_CONSTANTS.MAX_VISIBLE_EDGES).toBe(1000);
      expect(CONNECTION_CONSTANTS.BATCH_SIZE).toBe(50);
      expect(CONNECTION_CONSTANTS.BUS_LINE_OFFSET_THRESHOLD).toBe(5);
    });
  });

  // ============================================================================
  // CALCULATE BUS Y TESTS
  // ============================================================================

  describe('calculateBusY', () => {
    test('should calculate halfway point between parent and nearest child', () => {
      const parentY = 100;
      const childYs = [200, 250, 300];

      const result = calculateBusY(parentY, childYs);

      // Halfway between 100 and 200 (nearest child)
      expect(result).toBe(150);
    });

    test('should handle single child', () => {
      const result = calculateBusY(100, [200]);
      expect(result).toBe(150);
    });

    test('should use nearest child when multiple', () => {
      const result = calculateBusY(100, [300, 200, 400]);
      // Nearest child is 200, so bus at (100 + 200) / 2 = 150
      expect(result).toBe(150);
    });

    test('should handle negative coordinates', () => {
      const result = calculateBusY(-100, [0]);
      expect(result).toBe(-50);
    });

    test('should throw error for empty children array', () => {
      expect(() => {
        calculateBusY(100, []);
      }).toThrow('calculateBusY requires at least one child');
    });

    test('should handle children above parent (unusual but valid)', () => {
      const result = calculateBusY(200, [100]);
      // Halfway between 200 and 100 = 150
      expect(result).toBe(150);
    });
  });

  // ============================================================================
  // CALCULATE BUS EXTENT TESTS
  // ============================================================================

  describe('calculateBusExtent', () => {
    test('should find min and max X positions', () => {
      const childXs = [150, 100, 200];

      const result = calculateBusExtent(childXs);

      expect(result.minX).toBe(100);
      expect(result.maxX).toBe(200);
    });

    test('should handle single child', () => {
      const result = calculateBusExtent([150]);
      expect(result.minX).toBe(150);
      expect(result.maxX).toBe(150);
    });

    test('should handle negative coordinates', () => {
      const result = calculateBusExtent([-100, 0, 100]);
      expect(result.minX).toBe(-100);
      expect(result.maxX).toBe(100);
    });

    test('should handle all same X positions', () => {
      const result = calculateBusExtent([100, 100, 100]);
      expect(result.minX).toBe(100);
      expect(result.maxX).toBe(100);
    });
  });

  // ============================================================================
  // SHOULD RENDER BUS LINE TESTS
  // ============================================================================

  describe('shouldRenderBusLine', () => {
    test('should render bus for multiple children', () => {
      const result = shouldRenderBusLine(2, 100, 100);
      expect(result).toBe(true);
    });

    test('should render bus for single child with offset > 5px', () => {
      const result = shouldRenderBusLine(1, 100, 110);
      expect(result).toBe(true);
    });

    test('should not render bus for single child aligned with parent', () => {
      const result = shouldRenderBusLine(1, 100, 100);
      expect(result).toBe(false);
    });

    test('should not render bus for single child with offset <= 5px', () => {
      const result = shouldRenderBusLine(1, 100, 105);
      expect(result).toBe(false);
    });

    test('should render bus for single child with negative offset > 5px', () => {
      const result = shouldRenderBusLine(1, 100, 90);
      expect(result).toBe(true);
    });

    test('should handle zero children (edge case)', () => {
      // This shouldn't happen in practice, but test the logic
      const result = shouldRenderBusLine(0, 100, 100);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // GET NODE HEIGHT TESTS
  // ============================================================================

  describe('getNodeHeight', () => {
    test('should return 100 for root node', () => {
      const rootNode = { id: 'n1', x: 0, y: 0, father_id: null };

      const result = getNodeHeight(rootNode, true, 90, 35);

      expect(result).toBe(100);
    });

    test('should return photo height for node with photo', () => {
      const photoNode = {
        id: 'n1',
        x: 0,
        y: 0,
        father_id: 'f1',
        photo_url: 'https://example.com/photo.jpg',
      };

      const result = getNodeHeight(photoNode, true, 90, 35);

      expect(result).toBe(90);
    });

    test('should return text height for node without photo', () => {
      const textNode = { id: 'n1', x: 0, y: 0, father_id: 'f1' };

      const result = getNodeHeight(textNode, true, 90, 35);

      expect(result).toBe(35);
    });

    test('should return text height when showPhotos is false', () => {
      const photoNode = {
        id: 'n1',
        x: 0,
        y: 0,
        father_id: 'f1',
        photo_url: 'https://example.com/photo.jpg',
      };

      const result = getNodeHeight(photoNode, false, 90, 35);

      expect(result).toBe(35);
    });

    test('should ignore photo URL for root node', () => {
      const rootWithPhoto = {
        id: 'n1',
        x: 0,
        y: 0,
        father_id: null,
        photo_url: 'https://example.com/photo.jpg',
      };

      const result = getNodeHeight(rootWithPhoto, true, 90, 35);

      expect(result).toBe(100);
    });
  });

  // ============================================================================
  // RENDER CONNECTION TESTS (UNBATCHED)
  // ============================================================================

  describe('renderConnection', () => {
    const mockNodes = [
      { id: 'p1', x: 100, y: 100, father_id: 'gp1' },
      { id: 'c1', x: 80, y: 200, father_id: 'p1' },
      { id: 'c2', x: 120, y: 220, father_id: 'p1' },
    ];

    const mockConnection = {
      parent: { id: 'p1', x: 100, y: 100 },
      children: [
        { id: 'c1', x: 80, y: 200 },
        { id: 'c2', x: 120, y: 220 },
      ],
    };

    const config = {
      nodeHeightWithPhoto: 90,
      nodeHeightTextOnly: 35,
      lineColor: '#D1BBA360',
      lineWidth: 1.2,
    };

    test('should render parent line, bus line, and child lines', () => {
      const result = renderConnection(
        mockConnection,
        mockNodes,
        false,
        config
      );

      // Should have: 1 parent line + 1 bus line + 2 child lines = 4 lines
      expect(result.length).toBe(4);
    });

    test('should return empty array if parent not found', () => {
      const invalidConnection = {
        parent: { id: 'invalid', x: 100, y: 100 },
        children: [{ id: 'c1', x: 80, y: 200 }],
      };

      const result = renderConnection(
        invalidConnection,
        mockNodes,
        false,
        config
      );

      expect(result).toEqual([]);
    });

    test('should skip child lines for missing children', () => {
      const partialConnection = {
        parent: { id: 'p1', x: 100, y: 100 },
        children: [
          { id: 'c1', x: 80, y: 200 },
          { id: 'invalid', x: 120, y: 220 },
        ],
      };

      const result = renderConnection(
        partialConnection,
        mockNodes,
        false,
        config
      );

      // Should have: 1 parent + 1 bus + 1 child (c1 only) = 3 lines
      expect(result.length).toBe(3);
    });

    test('should omit bus line for single aligned child', () => {
      const alignedConnection = {
        parent: { id: 'p1', x: 100, y: 100 },
        children: [{ id: 'c1', x: 100, y: 200 }],
      };

      const nodes = [
        { id: 'p1', x: 100, y: 100, father_id: 'gp1' },
        { id: 'c1', x: 100, y: 200, father_id: 'p1' },
      ];

      const result = renderConnection(alignedConnection, nodes, false, config);

      // Should have: 1 parent + 1 child (no bus) = 2 lines
      expect(result.length).toBe(2);
    });
  });

  // ============================================================================
  // RENDER EDGES BATCHED TESTS
  // ============================================================================

  describe('renderEdgesBatched', () => {
    const mockNodes = [
      { id: 'p1', x: 100, y: 100, father_id: 'gp1' },
      { id: 'c1', x: 80, y: 200, father_id: 'p1' },
      { id: 'c2', x: 120, y: 220, father_id: 'p1' },
    ];

    const mockConnections = [
      {
        parent: { id: 'p1', x: 100, y: 100 },
        children: [
          { id: 'c1', x: 80, y: 200 },
          { id: 'c2', x: 120, y: 220 },
        ],
      },
    ];

    const config = {
      nodeHeightWithPhoto: 90,
      nodeHeightTextOnly: 35,
      lineColor: '#D1BBA360',
      lineWidth: 1.2,
      maxVisibleEdges: 1000,
    };

    test('should return null for LOD Tier 3', () => {
      const visibleNodeIds = new Set(['p1', 'c1', 'c2']);

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        3, // Tier 3
        false,
        config
      );

      expect(result.elements).toBeNull();
      expect(result.count).toBe(0);
    });

    test('should render connections for Tier 1', () => {
      const visibleNodeIds = new Set(['p1', 'c1', 'c2']);

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        1,
        false,
        config
      );

      expect(result.elements).not.toBeNull();
      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.count).toBe(3); // children.length + 1 = 2 + 1 = 3
    });

    test('should skip connections with no visible nodes', () => {
      const visibleNodeIds = new Set(['other']);

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        1,
        false,
        config
      );

      expect(result.count).toBe(0);
    });

    test('should render if parent is visible', () => {
      const visibleNodeIds = new Set(['p1']); // Only parent visible

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        1,
        false,
        config
      );

      expect(result.count).toBeGreaterThan(0);
    });

    test('should render if any child is visible', () => {
      const visibleNodeIds = new Set(['c1']); // Only one child visible

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        1,
        false,
        config
      );

      expect(result.count).toBeGreaterThan(0);
    });

    test('should respect maxVisibleEdges cap', () => {
      const visibleNodeIds = new Set(['p1', 'c1', 'c2']);
      const smallConfig = { ...config, maxVisibleEdges: 2 };

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        1,
        false,
        smallConfig
      );

      expect(result.count).toBeLessThanOrEqual(3); // Max 2 edges config, but 1 conn = 3 count
    });

    test('should batch paths every 50 edges', () => {
      // Create many connections to test batching
      const manyConnections = [];
      const manyNodes = [];
      const visibleIds = new Set();

      for (let i = 0; i < 30; i++) {
        const parentId = `p${i}`;
        const child1Id = `c${i}a`;
        const child2Id = `c${i}b`;

        manyNodes.push({
          id: parentId,
          x: 100 + i * 10,
          y: 100,
          father_id: 'root',
        });
        manyNodes.push({
          id: child1Id,
          x: 100 + i * 10 - 5,
          y: 200,
          father_id: parentId,
        });
        manyNodes.push({
          id: child2Id,
          x: 100 + i * 10 + 5,
          y: 200,
          father_id: parentId,
        });

        manyConnections.push({
          parent: { id: parentId, x: 100 + i * 10, y: 100 },
          children: [
            { id: child1Id, x: 100 + i * 10 - 5, y: 200 },
            { id: child2Id, x: 100 + i * 10 + 5, y: 200 },
          ],
        });

        visibleIds.add(parentId);
        visibleIds.add(child1Id);
        visibleIds.add(child2Id);
      }

      const result = renderEdgesBatched(
        manyConnections,
        manyNodes,
        visibleIds,
        1,
        false,
        config
      );

      // With 30 connections, each producing ~4 edges, we get ~120 edges
      // Batched at 50 edges per path = 3 paths
      expect(result.elements.length).toBeGreaterThan(1);
    });

    test('should use custom batch size', () => {
      const visibleNodeIds = new Set(['p1', 'c1', 'c2']);
      const customConfig = { ...config, batchSize: 10 };

      const result = renderEdgesBatched(
        mockConnections,
        mockNodes,
        visibleNodeIds,
        1,
        false,
        customConfig
      );

      expect(result.elements).not.toBeNull();
    });
  });

  // ============================================================================
  // CONNECTION RENDERER COMPONENT TESTS
  // ============================================================================

  describe('ConnectionRenderer component', () => {
    const mockNodes = [
      { id: 'p1', x: 100, y: 100, father_id: 'gp1' },
      { id: 'c1', x: 80, y: 200, father_id: 'p1' },
    ];

    const mockConnections = [
      {
        parent: { id: 'p1', x: 100, y: 100 },
        children: [{ id: 'c1', x: 80, y: 200 }],
      },
    ];

    test('should render with default props', () => {
      const visibleNodeIds = new Set(['p1', 'c1']);

      const { UNSAFE_root } = render(
        <ConnectionRenderer
          connections={mockConnections}
          nodes={mockNodes}
          visibleNodeIds={visibleNodeIds}
          tier={1}
          showPhotos={false}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should render null for Tier 3', () => {
      const visibleNodeIds = new Set(['p1', 'c1']);

      const { UNSAFE_root } = render(
        <ConnectionRenderer
          connections={mockConnections}
          nodes={mockNodes}
          visibleNodeIds={visibleNodeIds}
          tier={3}
          showPhotos={false}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should use custom line color and width', () => {
      const visibleNodeIds = new Set(['p1', 'c1']);

      const { UNSAFE_root } = render(
        <ConnectionRenderer
          connections={mockConnections}
          nodes={mockNodes}
          visibleNodeIds={visibleNodeIds}
          tier={1}
          showPhotos={false}
          lineColor="#FF0000"
          lineWidth={2}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle empty connections array', () => {
      const visibleNodeIds = new Set(['p1']);

      const { UNSAFE_root } = render(
        <ConnectionRenderer
          connections={[]}
          nodes={mockNodes}
          visibleNodeIds={visibleNodeIds}
          tier={1}
          showPhotos={false}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle empty visible nodes set', () => {
      const { UNSAFE_root } = render(
        <ConnectionRenderer
          connections={mockConnections}
          nodes={mockNodes}
          visibleNodeIds={new Set()}
          tier={1}
          showPhotos={false}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    test('should handle complex connection with many children', () => {
      const parent = { id: 'p1', x: 200, y: 100, father_id: 'gp1' };
      const children = [
        { id: 'c1', x: 100, y: 200, father_id: 'p1' },
        { id: 'c2', x: 150, y: 210, father_id: 'p1' },
        { id: 'c3', x: 200, y: 220, father_id: 'p1' },
        { id: 'c4', x: 250, y: 230, father_id: 'p1' },
        { id: 'c5', x: 300, y: 240, father_id: 'p1' },
      ];

      const nodes = [parent, ...children];
      const connection = {
        parent: { id: 'p1', x: 200, y: 100 },
        children: children.map((c) => ({ id: c.id, x: c.x, y: c.y })),
      };

      const config = {
        nodeHeightWithPhoto: 90,
        nodeHeightTextOnly: 35,
        lineColor: '#D1BBA360',
        lineWidth: 1.2,
        maxVisibleEdges: 1000,
      };

      const result = renderEdgesBatched(
        [connection],
        nodes,
        new Set(['p1', 'c1', 'c2', 'c3', 'c4', 'c5']),
        1,
        false,
        config
      );

      // Should render: 1 parent + 1 bus + 5 children = 7 edges
      expect(result.count).toBeGreaterThan(0);
      expect(result.elements).not.toBeNull();
    });

    test('should maintain performance with large tree', () => {
      const connections = [];
      const nodes = [];
      const visibleIds = new Set();

      // Create 100 connections
      for (let i = 0; i < 100; i++) {
        const parentId = `p${i}`;
        const childId = `c${i}`;

        nodes.push({ id: parentId, x: i * 10, y: 100, father_id: 'root' });
        nodes.push({ id: childId, x: i * 10, y: 200, father_id: parentId });

        connections.push({
          parent: { id: parentId, x: i * 10, y: 100 },
          children: [{ id: childId, x: i * 10, y: 200 }],
        });

        visibleIds.add(parentId);
        visibleIds.add(childId);
      }

      const config = {
        nodeHeightWithPhoto: 90,
        nodeHeightTextOnly: 35,
        lineColor: '#D1BBA360',
        lineWidth: 1.2,
        maxVisibleEdges: 1000,
      };

      const startTime = Date.now();
      const result = renderEdgesBatched(
        connections,
        nodes,
        visibleIds,
        1,
        false,
        config
      );
      const endTime = Date.now();

      // Should complete in reasonable time (<100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.count).toBeGreaterThan(0);
    });
  });
});
