/**
 * HitDetection Tests
 *
 * Test suite for tap coordinate detection (T3 chips and T1/T2 nodes).
 *
 * Coverage:
 * - T3 chip tap detection (aggregation mode)
 * - T1/T2 node bounds checking
 * - Screen-to-canvas coordinate transformation
 * - Combined tap detection (chip first, then node)
 * - Edge cases (boundaries, overlapping, zoom, etc.)
 */

import {
  detectChipTap,
  detectNodeTap,
  detectTap,
  NODE_DIMENSIONS,
} from '../../../../src/components/TreeView/interaction/HitDetection';

describe('HitDetection', () => {
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('NODE_DIMENSIONS', () => {
    test('should export expected dimension constants', () => {
      expect(NODE_DIMENSIONS.ROOT_WIDTH).toBe(120);
      expect(NODE_DIMENSIONS.ROOT_HEIGHT).toBe(100);
      expect(NODE_DIMENSIONS.CHIP_WIDTH_BASE).toBe(100);
      expect(NODE_DIMENSIONS.CHIP_HEIGHT_BASE).toBe(36);
      expect(NODE_DIMENSIONS.CHIP_SCALE_ROOT).toBe(1.3);
      expect(NODE_DIMENSIONS.CHIP_SCALE_NORMAL).toBe(1.0);
    });
  });

  // ============================================================================
  // DETECT CHIP TAP TESTS (T3 Aggregation Mode)
  // ============================================================================

  describe('detectChipTap', () => {
    // Mock context for T3 aggregation mode
    const mockContext = {
      tier: 3,
      indices: {
        heroNodes: [
          { id: 'root', father_id: null, x: 500, y: 300, name: 'Root' }, // root node
          { id: 'hero2', father_id: 'parent1', x: 800, y: 400, name: 'Hero 2' }, // normal node
          { id: 'hero3', father_id: 'parent2', x: 200, y: 600, name: 'Hero 3' }, // normal node
        ],
        centroids: {
          'root': { x: 500, y: 300 },
          'hero2': { x: 800, y: 400 },
          'hero3': { x: 200, y: 600 },
        },
      },
      visibleNodes: [],
      transform: { x: 0, y: 0, scale: 1 },
    };

    test('should return null if tier !== 3', () => {
      const context = { ...mockContext, tier: 1 };
      const result = detectChipTap(100, 100, context, true);
      expect(result).toBeNull();
    });

    test('should return null if tier is 2', () => {
      const context = { ...mockContext, tier: 2 };
      const result = detectChipTap(100, 100, context, true);
      expect(result).toBeNull();
    });

    test('should return null if aggregation disabled', () => {
      const result = detectChipTap(800, 400, mockContext, false);
      expect(result).toBeNull();
    });

    test('should return null if no hero nodes', () => {
      const context = {
        ...mockContext,
        indices: { heroNodes: [], centroids: {} },
      };
      const result = detectChipTap(100, 100, context, true);
      expect(result).toBeNull();
    });

    test('should return null if indices is null', () => {
      const context = {
        ...mockContext,
        indices: null,
      };
      const result = detectChipTap(100, 100, context, true);
      expect(result).toBeNull();
    });

    test('should detect chip tap at center of normal chip (scale 1.0)', () => {
      // Center of hero2: (800, 400)
      // Normal chip: 100 * 1.0 = 100px wide, 36 * 1.0 = 36px tall
      const result = detectChipTap(800, 400, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should detect chip tap at edge of normal chip (right edge)', () => {
      // Center of hero2: (800, 400)
      // Normal chip: 100px wide, 36px tall
      // Right edge: 800 + 50 = 850
      const result = detectChipTap(850, 400, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should detect chip tap at edge of normal chip (left edge)', () => {
      // Left edge: 800 - 50 = 750
      const result = detectChipTap(750, 400, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should detect chip tap at edge of normal chip (top edge)', () => {
      // Top edge: 400 - 18 = 382
      const result = detectChipTap(800, 382, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should detect chip tap at edge of normal chip (bottom edge)', () => {
      // Bottom edge: 400 + 18 = 418
      const result = detectChipTap(800, 418, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should not detect tap outside normal chip bounds (right)', () => {
      // Just beyond right edge: 800 + 51 = 851
      const result = detectChipTap(851, 400, mockContext, true);
      expect(result).toBeNull();
    });

    test('should not detect tap outside normal chip bounds (left)', () => {
      // Just beyond left edge: 800 - 51 = 749
      const result = detectChipTap(749, 400, mockContext, true);
      expect(result).toBeNull();
    });

    test('should not detect tap outside normal chip bounds (top)', () => {
      // Just beyond top edge: 400 - 19 = 381
      const result = detectChipTap(800, 381, mockContext, true);
      expect(result).toBeNull();
    });

    test('should not detect tap outside normal chip bounds (bottom)', () => {
      // Just beyond bottom edge: 400 + 19 = 419
      const result = detectChipTap(800, 419, mockContext, true);
      expect(result).toBeNull();
    });

    test('should detect chip tap on root chip with 1.3x scale', () => {
      // Center of root: (500, 300)
      // Root chip: 100 * 1.3 = 130px wide, 36 * 1.3 = 46.8px tall
      const result = detectChipTap(500, 300, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[0] });
    });

    test('should detect tap at edge of root chip (right edge)', () => {
      // Root chip: 130px wide
      // Right edge: 500 + 65 = 565
      const result = detectChipTap(565, 300, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[0] });
    });

    test('should detect tap at edge of root chip (left edge)', () => {
      // Left edge: 500 - 65 = 435
      const result = detectChipTap(435, 300, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[0] });
    });

    test('should detect tap at edge of root chip (top edge)', () => {
      // Root chip: 46.8px tall
      // Top edge: 300 - 23.4 ≈ 276.6
      const result = detectChipTap(500, 277, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[0] });
    });

    test('should detect tap at edge of root chip (bottom edge)', () => {
      // Bottom edge: 300 + 23.4 ≈ 323.4
      const result = detectChipTap(500, 323, mockContext, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[0] });
    });

    test('should not detect tap outside root chip bounds', () => {
      // Just beyond right edge: 500 + 66 = 566
      const result = detectChipTap(566, 300, mockContext, true);
      expect(result).toBeNull();
    });

    test('should apply transform correctly (screen to canvas)', () => {
      // Transform: x=100, y=50, scale=1.0
      // Centroid in canvas space: (800, 400)
      // Screen space: (800 * 1.0 + 100, 400 * 1.0 + 50) = (900, 450)
      const context = {
        ...mockContext,
        transform: { x: 100, y: 50, scale: 1.0 },
      };
      const result = detectChipTap(900, 450, context, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should apply transform correctly with negative values', () => {
      // Transform: x=-100, y=-50, scale=1.0
      // Centroid in canvas space: (800, 400)
      // Screen space: (800 * 1.0 - 100, 400 * 1.0 - 50) = (700, 350)
      const context = {
        ...mockContext,
        transform: { x: -100, y: -50, scale: 1.0 },
      };
      const result = detectChipTap(700, 350, context, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should handle zoom out (scale < 1)', () => {
      // Transform: x=0, y=0, scale=0.5
      // Centroid in canvas space: (800, 400)
      // Screen space: (800 * 0.5, 400 * 0.5) = (400, 200)
      const context = {
        ...mockContext,
        transform: { x: 0, y: 0, scale: 0.5 },
      };
      const result = detectChipTap(400, 200, context, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should handle zoom in (scale > 1)', () => {
      // Transform: x=0, y=0, scale=2.0
      // Centroid in canvas space: (800, 400)
      // Screen space: (800 * 2.0, 400 * 2.0) = (1600, 800)
      const context = {
        ...mockContext,
        transform: { x: 0, y: 0, scale: 2.0 },
      };
      const result = detectChipTap(1600, 800, context, true);
      expect(result).toEqual({ type: 'chip', hero: mockContext.indices.heroNodes[1] });
    });

    test('should handle multiple overlapping chips (return first hit)', () => {
      // Place two hero nodes very close together
      const context = {
        ...mockContext,
        indices: {
          heroNodes: [
            { id: 'close1', father_id: 'parent1', x: 500, y: 300, name: 'Close 1' },
            { id: 'close2', father_id: 'parent2', x: 520, y: 300, name: 'Close 2' }, // 20px right
          ],
          centroids: {
            'close1': { x: 500, y: 300 },
            'close2': { x: 520, y: 300 },
          },
        },
      };

      // Tap at center of close1 - should hit close1 first
      const result = detectChipTap(500, 300, context, true);
      expect(result).toEqual({ type: 'chip', hero: context.indices.heroNodes[0] });
    });

    test('should skip chips without centroids', () => {
      const context = {
        ...mockContext,
        indices: {
          heroNodes: [
            { id: 'noCentroid', father_id: 'parent1', x: 100, y: 100, name: 'No Centroid' },
            { id: 'hasCentroid', father_id: 'parent2', x: 200, y: 200, name: 'Has Centroid' },
          ],
          centroids: {
            // noCentroid is missing from centroids
            'hasCentroid': { x: 200, y: 200 },
          },
        },
      };

      // Tap at noCentroid location - should not hit
      const result1 = detectChipTap(100, 100, context, true);
      expect(result1).toBeNull();

      // Tap at hasCentroid location - should hit
      const result2 = detectChipTap(200, 200, context, true);
      expect(result2).toEqual({ type: 'chip', hero: context.indices.heroNodes[1] });
    });

    test('should handle chip at screen edge', () => {
      // Chip at (0, 0) - left-top edge of screen
      const context = {
        ...mockContext,
        indices: {
          heroNodes: [{ id: 'edge', father_id: 'parent1', x: 0, y: 0, name: 'Edge' }],
          centroids: { 'edge': { x: 0, y: 0 } },
        },
      };

      // Tap at center (should hit)
      const result1 = detectChipTap(0, 0, context, true);
      expect(result1).toEqual({ type: 'chip', hero: context.indices.heroNodes[0] });

      // Tap at edge (should hit)
      const result2 = detectChipTap(50, 0, context, true);
      expect(result2).toEqual({ type: 'chip', hero: context.indices.heroNodes[0] });
    });

    test('should handle empty centroids object', () => {
      const context = {
        ...mockContext,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: {}, // Empty centroids
        },
      };

      const result = detectChipTap(100, 100, context, true);
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // DETECT NODE TAP TESTS (T1/T2 Mode)
  // ============================================================================

  describe('detectNodeTap', () => {
    // Standard node dimensions (from constants)
    const NODE_WIDTH_WITH_PHOTO = 85;
    const NODE_HEIGHT_WITH_PHOTO = 90;
    const NODE_WIDTH_TEXT_ONLY = 60;
    const NODE_HEIGHT_TEXT_ONLY = 35;

    // Mock context with visible nodes
    const mockContext = {
      tier: 1,
      indices: null,
      visibleNodes: [
        { id: 'root', x: 100, y: 100, father_id: null, photo_url: null, name: 'Root' }, // root, no photo
        { id: 'photo1', x: 300, y: 200, father_id: 'root', photo_url: 'http://example.com/1.jpg', name: 'Photo 1' },
        { id: 'text1', x: 500, y: 300, father_id: 'root', photo_url: null, name: 'Text 1' }, // text-only
      ],
      transform: { x: 0, y: 0, scale: 1 },
    };

    test('should detect tap on photo node at center', () => {
      // Photo node center: (300, 200)
      const result = detectNodeTap(
        300, 200, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should detect tap at edge of photo node (right edge)', () => {
      // Photo node: 85px wide
      // Right edge: 300 + 42.5 = 342.5
      const result = detectNodeTap(
        342, 200, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should detect tap at edge of photo node (left edge)', () => {
      // Left edge: 300 - 42.5 = 257.5
      const result = detectNodeTap(
        258, 200, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should detect tap at edge of photo node (top edge)', () => {
      // Photo node: 90px tall
      // Top edge: 200 - 45 = 155
      const result = detectNodeTap(
        300, 155, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should detect tap at edge of photo node (bottom edge)', () => {
      // Bottom edge: 200 + 45 = 245
      const result = detectNodeTap(
        300, 245, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should not detect tap outside photo node bounds (right)', () => {
      // Just beyond right edge: 300 + 43 = 343
      const result = detectNodeTap(
        343, 200, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: null });
    });

    test('should not detect tap outside photo node bounds (left)', () => {
      // Just beyond left edge: 300 - 43 = 257
      const result = detectNodeTap(
        257, 200, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: null });
    });

    test('should detect tap on text-only node (different dimensions)', () => {
      // Text node center: (500, 300)
      // Text node: 60px wide, 35px tall
      const result = detectNodeTap(
        500, 300, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'text1' });
    });

    test('should handle smaller height of text-only node', () => {
      // Text node: 60px wide, 35px tall
      // Top edge: 300 - 17.5 = 282.5
      const result1 = detectNodeTap(
        500, 283, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result1).toEqual({ type: 'node', nodeId: 'text1' });

      // Just outside top edge: 282
      const result2 = detectNodeTap(
        500, 282, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result2).toEqual({ type: 'node', nodeId: null });
    });

    test('should detect tap on root node with custom dimensions (120x100)', () => {
      // Root node center: (100, 100)
      // Root node: 120px wide, 100px tall
      const result = detectNodeTap(
        100, 100, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'root' });
    });

    test('should apply transform correctly (screen to canvas)', () => {
      // Transform: x=100, y=50, scale=1.0
      // Node in canvas space: (300, 200)
      // Tap in screen space: (300 * 1.0 + 100, 200 * 1.0 + 50) = (400, 250)
      // Reverse transform: ((400 - 100) / 1.0, (250 - 50) / 1.0) = (300, 200)
      const context = {
        ...mockContext,
        transform: { x: 100, y: 50, scale: 1.0 },
      };
      const result = detectNodeTap(
        400, 250, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should use custom root dimensions from config', () => {
      // Root node: 120x100
      // Right edge: 100 + 60 = 160
      const result1 = detectNodeTap(
        160, 100, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result1).toEqual({ type: 'node', nodeId: 'root' });

      // Just outside right edge: 161
      const result2 = detectNodeTap(
        161, 100, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result2).toEqual({ type: 'node', nodeId: null });
    });

    test('should return first node hit when multiple overlapping', () => {
      // Place two nodes very close together
      const context = {
        ...mockContext,
        visibleNodes: [
          { id: 'overlap1', x: 100, y: 100, father_id: 'root', photo_url: 'http://1.jpg', name: 'Overlap 1' },
          { id: 'overlap2', x: 110, y: 100, father_id: 'root', photo_url: 'http://2.jpg', name: 'Overlap 2' },
        ],
      };

      // Tap at center of overlap1 - should hit overlap1 first
      const result = detectNodeTap(
        100, 100, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'overlap1' });
    });

    test('should return null if no visible nodes', () => {
      const context = {
        ...mockContext,
        visibleNodes: [],
      };
      const result = detectNodeTap(
        100, 100, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: null });
    });

    test('should transform correctly with negative translation', () => {
      // Transform: x=-100, y=-50, scale=1.0
      // Node in canvas space: (300, 200)
      // Tap in screen space: (300 * 1.0 - 100, 200 * 1.0 - 50) = (200, 150)
      const context = {
        ...mockContext,
        transform: { x: -100, y: -50, scale: 1.0 },
      };
      const result = detectNodeTap(
        200, 150, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should transform correctly with zoom out (scale < 1)', () => {
      // Transform: x=0, y=0, scale=0.5
      // Node in canvas space: (300, 200)
      // Tap in screen space: (300 * 0.5, 200 * 0.5) = (150, 100)
      // Reverse: ((150 - 0) / 0.5, (100 - 0) / 0.5) = (300, 200)
      const context = {
        ...mockContext,
        transform: { x: 0, y: 0, scale: 0.5 },
      };
      const result = detectNodeTap(
        150, 100, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should transform correctly with zoom in (scale > 1)', () => {
      // Transform: x=0, y=0, scale=2.0
      // Node in canvas space: (300, 200)
      // Tap in screen space: (300 * 2.0, 200 * 2.0) = (600, 400)
      // Reverse: ((600 - 0) / 2.0, (400 - 0) / 2.0) = (300, 200)
      const context = {
        ...mockContext,
        transform: { x: 0, y: 0, scale: 2.0 },
      };
      const result = detectNodeTap(
        600, 400, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('should handle node at screen edge', () => {
      const context = {
        ...mockContext,
        visibleNodes: [
          { id: 'edge', x: 0, y: 0, father_id: 'root', photo_url: 'http://edge.jpg', name: 'Edge' },
        ],
      };

      // Tap at center
      const result1 = detectNodeTap(
        0, 0, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result1).toEqual({ type: 'node', nodeId: 'edge' });

      // Tap at edge
      const result2 = detectNodeTap(
        42, 0, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result2).toEqual({ type: 'node', nodeId: 'edge' });
    });

    test('should handle node partially off-screen', () => {
      const context = {
        ...mockContext,
        visibleNodes: [
          { id: 'partial', x: -50, y: -50, father_id: 'root', photo_url: 'http://partial.jpg', name: 'Partial' },
        ],
      };

      // Tap at center (off screen in reality, but algorithm doesn't care)
      const result = detectNodeTap(
        -50, -50, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'partial' });
    });

    test('should respect node type dimensions (photo vs text-only vs root)', () => {
      const context = {
        ...mockContext,
        visibleNodes: [
          { id: 'root', x: 0, y: 0, father_id: null, photo_url: null, name: 'Root' }, // 120x100
          { id: 'photo', x: 200, y: 0, father_id: 'root', photo_url: 'http://photo.jpg', name: 'Photo' }, // 85x90
          { id: 'text', x: 400, y: 0, father_id: 'root', photo_url: null, name: 'Text' }, // 60x35
        ],
      };

      // Tap at right edge of each node type
      const result1 = detectNodeTap(60, 0, context, NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO, NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY);
      expect(result1).toEqual({ type: 'node', nodeId: 'root' }); // 120/2 = 60

      const result2 = detectNodeTap(242, 0, context, NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO, NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY);
      expect(result2).toEqual({ type: 'node', nodeId: 'photo' }); // 200 + 85/2 = 242.5

      const result3 = detectNodeTap(430, 0, context, NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO, NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY);
      expect(result3).toEqual({ type: 'node', nodeId: 'text' }); // 400 + 60/2 = 430
    });

    test('edge case: tap exactly at node boundary', () => {
      // Tap exactly at right boundary of photo node
      // Right edge: 300 + 42.5 = 342.5
      const result = detectNodeTap(
        342.5, 200, mockContext,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'photo1' });
    });

    test('edge case: tap at (0,0)', () => {
      const context = {
        ...mockContext,
        visibleNodes: [
          { id: 'origin', x: 0, y: 0, father_id: null, photo_url: null, name: 'Origin' },
        ],
      };

      const result = detectNodeTap(
        0, 0, context,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );
      expect(result).toEqual({ type: 'node', nodeId: 'origin' });
    });
  });

  // ============================================================================
  // DETECT TAP TESTS (Combined Detection)
  // ============================================================================

  describe('detectTap', () => {
    const NODE_WIDTH_WITH_PHOTO = 85;
    const NODE_HEIGHT_WITH_PHOTO = 90;
    const NODE_WIDTH_TEXT_ONLY = 60;
    const NODE_HEIGHT_TEXT_ONLY = 35;

    test('should detect and return chip tap in T3 mode', () => {
      const context = {
        tier: 3,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: { 'hero1': { x: 100, y: 100 } },
        },
        visibleNodes: [],
        transform: { x: 0, y: 0, scale: 1 },
      };

      const result = detectTap(
        100, 100, context, true,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'chip', hero: context.indices.heroNodes[0] });
    });

    test('should detect and return node tap in T1 mode', () => {
      const context = {
        tier: 1,
        indices: null,
        visibleNodes: [
          { id: 'node1', x: 100, y: 100, father_id: null, photo_url: null, name: 'Node 1' },
        ],
        transform: { x: 0, y: 0, scale: 1 },
      };

      const result = detectTap(
        100, 100, context, false,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: 'node1' });
    });

    test('should detect and return node tap in T2 mode', () => {
      const context = {
        tier: 2,
        indices: null,
        visibleNodes: [
          { id: 'node2', x: 200, y: 200, father_id: 'root', photo_url: 'http://2.jpg', name: 'Node 2' },
        ],
        transform: { x: 0, y: 0, scale: 1 },
      };

      const result = detectTap(
        200, 200, context, false,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: 'node2' });
    });

    test('should prioritize chip tap over node tap in T3 mode', () => {
      // Setup context where both chip and node would be hit at same location
      const context = {
        tier: 3,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: { 'hero1': { x: 100, y: 100 } },
        },
        visibleNodes: [
          { id: 'node1', x: 100, y: 100, father_id: null, photo_url: null, name: 'Node 1' },
        ],
        transform: { x: 0, y: 0, scale: 1 },
      };

      const result = detectTap(
        100, 100, context, true,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result.type).toBe('chip');
      expect(result).toEqual({ type: 'chip', hero: context.indices.heroNodes[0] });
    });

    test('should ignore node taps in T3 mode when aggregation enabled and no chip hit', () => {
      const context = {
        tier: 3,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: { 'hero1': { x: 100, y: 100 } },
        },
        visibleNodes: [
          { id: 'node1', x: 500, y: 500, father_id: 'root', photo_url: null, name: 'Node 1' },
        ],
        transform: { x: 0, y: 0, scale: 1 },
      };

      // Tap at node1 location (not at chip)
      const result = detectTap(
        500, 500, context, true,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toBeNull(); // Should ignore node tap in T3 mode
    });

    test('should detect node taps in T3 mode when aggregation disabled', () => {
      const context = {
        tier: 3,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: { 'hero1': { x: 100, y: 100 } },
        },
        visibleNodes: [
          { id: 'node1', x: 500, y: 500, father_id: 'root', photo_url: null, name: 'Node 1' },
        ],
        transform: { x: 0, y: 0, scale: 1 },
      };

      // Tap at node1 location with aggregation disabled
      const result = detectTap(
        500, 500, context, false, // aggregationEnabled = false
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: 'node1' });
    });

    test('should return null if no hit in T1/T2 mode', () => {
      const context = {
        tier: 1,
        indices: null,
        visibleNodes: [
          { id: 'node1', x: 100, y: 100, father_id: null, photo_url: null, name: 'Node 1' },
        ],
        transform: { x: 0, y: 0, scale: 1 },
      };

      // Tap far from any node
      const result = detectTap(
        1000, 1000, context, false,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: null });
    });

    test('should return null if no chip hit in T3 mode', () => {
      const context = {
        tier: 3,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: { 'hero1': { x: 100, y: 100 } },
        },
        visibleNodes: [],
        transform: { x: 0, y: 0, scale: 1 },
      };

      // Tap far from any chip
      const result = detectTap(
        1000, 1000, context, true,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toBeNull();
    });

    test('should handle empty state (no nodes, no chips)', () => {
      const context = {
        tier: 1,
        indices: null,
        visibleNodes: [],
        transform: { x: 0, y: 0, scale: 1 },
      };

      const result = detectTap(
        100, 100, context, false,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: null });
    });

    test('should handle transform edge cases (complex transform)', () => {
      const context = {
        tier: 1,
        indices: null,
        visibleNodes: [
          { id: 'node1', x: 300, y: 200, father_id: 'root', photo_url: 'http://1.jpg', name: 'Node 1' },
        ],
        transform: { x: -150, y: 75, scale: 1.5 },
      };

      // Node in canvas space: (300, 200)
      // Screen space: (300 * 1.5 - 150, 200 * 1.5 + 75) = (450 - 150, 300 + 75) = (300, 375)
      const result = detectTap(
        300, 375, context, false,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: 'node1' });
    });

    test('should pass correct context to detectChipTap', () => {
      const context = {
        tier: 3,
        indices: {
          heroNodes: [{ id: 'hero1', father_id: null, x: 100, y: 100, name: 'Hero 1' }],
          centroids: { 'hero1': { x: 100, y: 100 } },
        },
        visibleNodes: [],
        transform: { x: 50, y: 25, scale: 1.2 },
      };

      const result = detectTap(
        170, 145, // 100 * 1.2 + 50 = 170, 100 * 1.2 + 25 = 145
        context,
        true,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'chip', hero: context.indices.heroNodes[0] });
    });

    test('should pass correct context to detectNodeTap', () => {
      const context = {
        tier: 2,
        indices: null,
        visibleNodes: [
          { id: 'node1', x: 200, y: 150, father_id: 'root', photo_url: null, name: 'Node 1' },
        ],
        transform: { x: 100, y: 50, scale: 2.0 },
      };

      // Screen space: (200 * 2.0 + 100, 150 * 2.0 + 50) = (500, 350)
      const result = detectTap(
        500, 350, context, false,
        NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY
      );

      expect(result).toEqual({ type: 'node', nodeId: 'node1' });
    });
  });
});
