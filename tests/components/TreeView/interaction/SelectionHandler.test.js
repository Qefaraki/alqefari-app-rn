/**
 * SelectionHandler Tests
 *
 * Test suite for node selection and hit detection logic.
 *
 * Coverage:
 * - Node tap detection (T1/T2 mode)
 * - Chip tap detection (T3 mode)
 * - Coordinate transformation (screen → canvas)
 * - Hit detection with different node types (root, photo, text-only)
 * - Selection callbacks
 */

import {
  handleNodeSelection,
  detectChipTap,
  detectNodeTap,
  handleTapGesture,
  SELECTION_CONSTANTS,
} from '../../../../src/components/TreeView/interaction/SelectionHandler';

describe('SelectionHandler', () => {
  let callbacks;
  let clearHighlights;
  let mockState;

  beforeEach(() => {
    // Create mock callbacks
    callbacks = {
      onNodeSelect: jest.fn(),
      onChipSelect: jest.fn(),
    };

    clearHighlights = jest.fn();

    // Create mock gesture state
    mockState = {
      tier: 1,
      transform: { x: 0, y: 0, scale: 1.0 },
      visibleNodes: [],
      indices: {
        heroNodes: [],
        centroids: {},
      },
    };
  });

  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('SELECTION_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(SELECTION_CONSTANTS.ROOT_NODE_WIDTH).toBe(120);
      expect(SELECTION_CONSTANTS.ROOT_NODE_HEIGHT).toBe(100);
      expect(SELECTION_CONSTANTS.T3_CHIP_WIDTH).toBe(100);
      expect(SELECTION_CONSTANTS.T3_CHIP_HEIGHT).toBe(36);
      expect(SELECTION_CONSTANTS.T3_CHIP_SCALE_ROOT).toBe(1.3);
      expect(SELECTION_CONSTANTS.T3_CHIP_SCALE_NORMAL).toBe(1.0);
    });
  });

  // ============================================================================
  // HANDLE NODE SELECTION TESTS
  // ============================================================================

  describe('handleNodeSelection', () => {
    test('should call onNodeSelect callback with node ID', () => {
      handleNodeSelection('node1', callbacks, false, clearHighlights);

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node1');
    });

    test('should call onNodeSelect with null when no node hit', () => {
      handleNodeSelection(null, callbacks, false, clearHighlights);

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith(null);
    });

    test('should clear highlights when provided', () => {
      handleNodeSelection('node1', callbacks, false, clearHighlights);

      expect(clearHighlights).toHaveBeenCalled();
    });

    test('should not crash if clearHighlights is undefined', () => {
      expect(() =>
        handleNodeSelection('node1', callbacks, false)
      ).not.toThrow();
    });

    test('should work in admin mode', () => {
      handleNodeSelection('node1', callbacks, true, clearHighlights);

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node1');
      expect(clearHighlights).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DETECT CHIP TAP TESTS (T3 MODE)
  // ============================================================================

  describe('detectChipTap', () => {
    beforeEach(() => {
      // Setup T3 state with hero nodes
      mockState.tier = 3;
      mockState.indices.heroNodes = [
        {
          id: 'hero1',
          x: 100,
          y: 200,
          father_id: 'parent1',
          photo_url: null,
          name: 'Hero 1',
        },
        {
          id: 'root_hero',
          x: 50,
          y: 50,
          father_id: null, // Root node
          photo_url: null,
          name: 'Root Hero',
        },
      ];
      mockState.indices.centroids = {
        hero1: { x: 100, y: 200 },
        root_hero: { x: 50, y: 50 },
      };
    });

    test('should return null if not in T3 mode', () => {
      mockState.tier = 1;
      const tapEvent = { x: 100, y: 200 };

      const result = detectChipTap(tapEvent, mockState);

      expect(result).toBeNull();
    });

    test('should return null if aggregation disabled', () => {
      const tapEvent = { x: 100, y: 200 };
      const config = { aggregationEnabled: false };

      const result = detectChipTap(tapEvent, mockState, config);

      expect(result).toBeNull();
    });

    test('should return null if no hero nodes', () => {
      mockState.indices.heroNodes = [];
      const tapEvent = { x: 100, y: 200 };

      const result = detectChipTap(tapEvent, mockState);

      expect(result).toBeNull();
    });

    test('should detect chip tap at center of normal chip', () => {
      // Chip at centroid (100, 200) with transform (0, 0, 1.0)
      // Screen coords = (100, 200)
      const tapEvent = { x: 100, y: 200 };

      const result = detectChipTap(tapEvent, mockState);

      expect(result).not.toBeNull();
      expect(result.id).toBe('hero1');
    });

    test('should detect chip tap at edge of normal chip', () => {
      // Normal chip: 100x36, so bounds are ±50x, ±18y
      const tapEvent = { x: 149, y: 217 }; // Just inside right-bottom edge

      const result = detectChipTap(tapEvent, mockState);

      expect(result).not.toBeNull();
      expect(result.id).toBe('hero1');
    });

    test('should not detect tap outside normal chip bounds', () => {
      const tapEvent = { x: 151, y: 200 }; // Just outside right edge

      const result = detectChipTap(tapEvent, mockState);

      expect(result).toBeNull();
    });

    test('should detect chip tap on root chip with 1.3x scale', () => {
      // Root chip: 100 * 1.3 = 130x, 36 * 1.3 = 46.8y
      // Centroid at (50, 50), so bounds are ±65x, ±23.4y
      const tapEvent = { x: 50, y: 50 }; // Center

      const result = detectChipTap(tapEvent, mockState);

      expect(result).not.toBeNull();
      expect(result.id).toBe('root_hero');
    });

    test('should detect tap at edge of root chip', () => {
      // Root chip bounds: 50 ± 65x, 50 ± 23.4y
      const tapEvent = { x: 114, y: 72 }; // Just inside right-bottom edge

      const result = detectChipTap(tapEvent, mockState);

      expect(result).not.toBeNull();
      expect(result.id).toBe('root_hero');
    });

    test('should apply transform correctly', () => {
      // Transform: translate (100, 50), scale 2.0
      mockState.transform = { x: 100, y: 50, scale: 2.0 };

      // Centroid (100, 200) → Screen (100*2+100, 200*2+50) = (300, 450)
      const tapEvent = { x: 300, y: 450 };

      const result = detectChipTap(tapEvent, mockState);

      expect(result).not.toBeNull();
      expect(result.id).toBe('hero1');
    });

    test('should return first chip hit when multiple overlapping', () => {
      // Add overlapping chip
      mockState.indices.heroNodes.push({
        id: 'hero2',
        x: 105,
        y: 205,
        father_id: 'parent2',
        photo_url: null,
        name: 'Hero 2',
      });
      mockState.indices.centroids.hero2 = { x: 105, y: 205 };

      const tapEvent = { x: 102, y: 202 }; // Within both chips

      const result = detectChipTap(tapEvent, mockState);

      // Should return first hero in iteration order
      expect(result).not.toBeNull();
      expect(result.id).toBe('hero1');
    });

    test('should skip chips without centroids', () => {
      delete mockState.indices.centroids.hero1;
      const tapEvent = { x: 100, y: 200 };

      const result = detectChipTap(tapEvent, mockState);

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // DETECT NODE TAP TESTS (T1/T2 MODE)
  // ============================================================================

  describe('detectNodeTap', () => {
    beforeEach(() => {
      mockState.tier = 1;
      mockState.visibleNodes = [
        {
          id: 'node1',
          x: 200,
          y: 300,
          father_id: 'parent1',
          photo_url: 'https://example.com/photo.jpg',
          name: 'Node 1',
        },
        {
          id: 'node2',
          x: 400,
          y: 300,
          father_id: 'parent1',
          photo_url: null, // Text-only node
          name: 'Node 2',
        },
        {
          id: 'root_node',
          x: 100,
          y: 100,
          father_id: null, // Root node
          photo_url: 'https://example.com/root.jpg',
          name: 'Root Node',
        },
      ];
    });

    test('should detect tap on photo node at center', () => {
      // Photo node at (200, 300), size 85x90
      // Transform identity, so screen = canvas
      const tapEvent = { x: 200, y: 300 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('node1');
    });

    test('should detect tap at edge of photo node', () => {
      // Photo node bounds: 200 ± 42.5 (width 85), 300 ± 45 (height 90)
      const tapEvent = { x: 241, y: 343 }; // Just inside bottom-right edge

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('node1');
    });

    test('should not detect tap outside photo node', () => {
      const tapEvent = { x: 243, y: 300 }; // Just outside right edge

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBeNull();
    });

    test('should detect tap on text-only node', () => {
      // Text-only node at (400, 300), size 60x35
      const tapEvent = { x: 400, y: 300 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('node2');
    });

    test('should handle smaller height of text-only node', () => {
      // Text-only node bounds: 400 ± 30x, 300 ± 17.5y
      const tapEvent = { x: 400, y: 318 }; // Just outside bottom edge

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBeNull();
    });

    test('should detect tap on root node with custom dimensions', () => {
      // Root node at (100, 100), size 120x100 (default config)
      const tapEvent = { x: 100, y: 100 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('root_node');
    });

    test('should apply transform correctly', () => {
      // Transform: translate (100, 50), scale 2.0
      mockState.transform = { x: 100, y: 50, scale: 2.0 };

      // Node at canvas (200, 300)
      // Screen = (200*2+100, 300*2+50) = (500, 650)
      const tapEvent = { x: 500, y: 650 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('node1');
    });

    test('should use custom root node dimensions from config', () => {
      const tapEvent = { x: 100, y: 100 };
      const config = { rootNodeWidth: 150, rootNodeHeight: 120 };

      const result = detectNodeTap(tapEvent, mockState, config);

      expect(result).toBe('root_node');
    });

    test('should return first node hit when overlapping', () => {
      // Add overlapping node
      mockState.visibleNodes.unshift({
        id: 'node_overlap',
        x: 205,
        y: 305,
        father_id: 'parent1',
        photo_url: 'https://example.com/photo2.jpg',
        name: 'Overlap Node',
      });

      const tapEvent = { x: 202, y: 302 }; // Within both nodes

      const result = detectNodeTap(tapEvent, mockState);

      // Should return first node in iteration order
      expect(result).toBe('node_overlap');
    });

    test('should return null if no visible nodes', () => {
      mockState.visibleNodes = [];
      const tapEvent = { x: 200, y: 300 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBeNull();
    });

    test('should transform correctly with negative translation', () => {
      mockState.transform = { x: -100, y: -50, scale: 1.0 };

      // Node at canvas (200, 300)
      // Screen = (200*1-100, 300*1-50) = (100, 250)
      const tapEvent = { x: 100, y: 250 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('node1');
    });

    test('should transform correctly with zoom out (scale < 1)', () => {
      mockState.transform = { x: 0, y: 0, scale: 0.5 };

      // Node at canvas (200, 300)
      // Screen = (200*0.5, 300*0.5) = (100, 150)
      const tapEvent = { x: 100, y: 150 };

      const result = detectNodeTap(tapEvent, mockState);

      expect(result).toBe('node1');
    });
  });

  // ============================================================================
  // HANDLE TAP GESTURE TESTS
  // ============================================================================

  describe('handleTapGesture', () => {
    beforeEach(() => {
      mockState.visibleNodes = [
        {
          id: 'node1',
          x: 200,
          y: 300,
          father_id: 'parent1',
          photo_url: 'https://example.com/photo.jpg',
          name: 'Node 1',
        },
      ];
    });

    test('should detect and handle node tap in T1 mode', () => {
      const tapEvent = { x: 200, y: 300 };

      handleTapGesture(tapEvent, mockState, callbacks, false, clearHighlights);

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node1');
      expect(clearHighlights).toHaveBeenCalled();
    });

    test('should detect and handle chip tap in T3 mode', () => {
      mockState.tier = 3;
      mockState.indices.heroNodes = [
        {
          id: 'hero1',
          x: 100,
          y: 200,
          father_id: 'parent1',
          photo_url: null,
          name: 'Hero 1',
        },
      ];
      mockState.indices.centroids = { hero1: { x: 100, y: 200 } };

      const tapEvent = { x: 100, y: 200 };

      handleTapGesture(tapEvent, mockState, callbacks, false, clearHighlights, {
        aggregationEnabled: true,
      });

      expect(callbacks.onChipSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hero1' })
      );
      expect(callbacks.onNodeSelect).not.toHaveBeenCalled();
    });

    test('should ignore tap in T3 mode with aggregation if no chip hit', () => {
      mockState.tier = 3;
      mockState.indices.heroNodes = [];

      const tapEvent = { x: 200, y: 300 };

      handleTapGesture(tapEvent, mockState, callbacks, false, clearHighlights, {
        aggregationEnabled: true,
      });

      expect(callbacks.onChipSelect).not.toHaveBeenCalled();
      expect(callbacks.onNodeSelect).not.toHaveBeenCalled();
    });

    test('should handle node tap in T3 mode if aggregation disabled', () => {
      mockState.tier = 3;
      const tapEvent = { x: 200, y: 300 };

      handleTapGesture(tapEvent, mockState, callbacks, false, clearHighlights, {
        aggregationEnabled: false,
      });

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node1');
    });

    test('should pass admin mode to selection handler', () => {
      const tapEvent = { x: 200, y: 300 };

      handleTapGesture(tapEvent, mockState, callbacks, true, clearHighlights);

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node1');
    });

    test('should handle null node ID when no hit', () => {
      const tapEvent = { x: 1000, y: 1000 }; // Far outside any node

      handleTapGesture(tapEvent, mockState, callbacks, false, clearHighlights);

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith(null);
    });

    test('should work without clearHighlights callback', () => {
      const tapEvent = { x: 200, y: 300 };

      expect(() =>
        handleTapGesture(tapEvent, mockState, callbacks, false)
      ).not.toThrow();

      expect(callbacks.onNodeSelect).toHaveBeenCalledWith('node1');
    });

    test('should work without onChipSelect callback', () => {
      mockState.tier = 3;
      mockState.indices.heroNodes = [
        {
          id: 'hero1',
          x: 100,
          y: 200,
          father_id: 'parent1',
          photo_url: null,
          name: 'Hero 1',
        },
      ];
      mockState.indices.centroids = { hero1: { x: 100, y: 200 } };

      const callbacksWithoutChip = { onNodeSelect: jest.fn() };
      const tapEvent = { x: 100, y: 200 };

      expect(() =>
        handleTapGesture(tapEvent, mockState, callbacksWithoutChip, false, null, {
          aggregationEnabled: true,
        })
      ).not.toThrow();
    });

    test('should prioritize chip tap over node tap', () => {
      mockState.tier = 3;
      mockState.indices.heroNodes = [
        {
          id: 'hero1',
          x: 200,
          y: 300,
          father_id: 'parent1',
          photo_url: null,
          name: 'Hero 1',
        },
      ];
      mockState.indices.centroids = { hero1: { x: 200, y: 300 } };

      // Tap at location where both chip and node exist
      const tapEvent = { x: 200, y: 300 };

      handleTapGesture(tapEvent, mockState, callbacks, false, clearHighlights, {
        aggregationEnabled: true,
      });

      // Should select chip, not node
      expect(callbacks.onChipSelect).toHaveBeenCalled();
      expect(callbacks.onNodeSelect).not.toHaveBeenCalled();
    });
  });
});
