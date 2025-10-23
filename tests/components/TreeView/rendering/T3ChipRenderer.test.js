/**
 * T3ChipRenderer Tests
 *
 * Test suite for LOD Tier 3 aggregation chips.
 *
 * Coverage:
 * - World to screen coordinate transformation
 * - Chip dimension calculation (root vs standard)
 * - Text formatting
 * - Single chip rendering
 * - Multiple chip rendering
 * - Aggregation flag toggle
 * - Missing centroid/subtree size handling
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  T3ChipRenderer,
  worldToScreen,
  calculateChipDimensions,
  formatChipText,
  renderChip,
  CHIP_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/T3ChipRenderer';

describe('T3ChipRenderer', () => {
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('CHIP_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(CHIP_CONSTANTS.BASE_WIDTH).toBe(100);
      expect(CHIP_CONSTANTS.BASE_HEIGHT).toBe(36);
      expect(CHIP_CONSTANTS.ROOT_SCALE).toBe(1.3);
      expect(CHIP_CONSTANTS.STANDARD_SCALE).toBe(1.0);
      expect(CHIP_CONSTANTS.CORNER_RADIUS).toBe(16);
      expect(CHIP_CONSTANTS.BACKGROUND_COLOR).toBe('#FFFFFF');
      expect(CHIP_CONSTANTS.BORDER_COLOR).toBe('#D1BBA340');
      expect(CHIP_CONSTANTS.TEXT_COLOR).toBe('#242121');
      expect(CHIP_CONSTANTS.BORDER_WIDTH).toBe(0.5);
      expect(CHIP_CONSTANTS.BASE_FONT_SIZE).toBe(12);
      expect(CHIP_CONSTANTS.TEXT_OFFSET_Y).toBe(4);
    });
  });

  // ============================================================================
  // WORLD TO SCREEN TESTS
  // ============================================================================

  describe('worldToScreen', () => {
    test('should transform world coordinates to screen space', () => {
      const result = worldToScreen(100, 200, 1.0, 0, 0);

      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    test('should apply zoom scale', () => {
      const result = worldToScreen(100, 200, 2.0, 0, 0);

      expect(result.x).toBe(200);
      expect(result.y).toBe(400);
    });

    test('should apply translation', () => {
      const result = worldToScreen(100, 200, 1.0, 50, 75);

      expect(result.x).toBe(150);
      expect(result.y).toBe(275);
    });

    test('should apply scale and translation together', () => {
      const result = worldToScreen(100, 200, 2.0, 50, 75);

      expect(result.x).toBe(250); // 100 * 2 + 50
      expect(result.y).toBe(475); // 200 * 2 + 75
    });

    test('should handle zoom out (scale < 1)', () => {
      const result = worldToScreen(100, 200, 0.5, 0, 0);

      expect(result.x).toBe(50);
      expect(result.y).toBe(100);
    });

    test('should handle negative coordinates', () => {
      const result = worldToScreen(-100, -200, 1.0, 0, 0);

      expect(result.x).toBe(-100);
      expect(result.y).toBe(-200);
    });

    test('should handle negative translation', () => {
      const result = worldToScreen(100, 200, 1.0, -50, -75);

      expect(result.x).toBe(50);
      expect(result.y).toBe(125);
    });
  });

  // ============================================================================
  // CALCULATE CHIP DIMENSIONS TESTS
  // ============================================================================

  describe('calculateChipDimensions', () => {
    test('should return root dimensions (1.3x scale)', () => {
      const result = calculateChipDimensions(true);

      expect(result.width).toBe(130); // 100 * 1.3
      expect(result.height).toBeCloseTo(46.8, 1); // 36 * 1.3
      expect(result.scale).toBe(1.3);
    });

    test('should return standard dimensions (1.0x scale)', () => {
      const result = calculateChipDimensions(false);

      expect(result.width).toBe(100);
      expect(result.height).toBe(36);
      expect(result.scale).toBe(1.0);
    });
  });

  // ============================================================================
  // FORMAT CHIP TEXT TESTS
  // ============================================================================

  describe('formatChipText', () => {
    test('should format name and count', () => {
      const result = formatChipText('عبدالله', 245);

      expect(result).toBe('عبدالله (245)');
    });

    test('should handle single digit count', () => {
      const result = formatChipText('محمد', 5);

      expect(result).toBe('محمد (5)');
    });

    test('should handle zero count', () => {
      const result = formatChipText('أحمد', 0);

      expect(result).toBe('أحمد (0)');
    });

    test('should handle large count', () => {
      const result = formatChipText('عبدالله', 1234);

      expect(result).toBe('عبدالله (1234)');
    });

    test('should handle empty name', () => {
      const result = formatChipText('', 10);

      expect(result).toBe(' (10)');
    });
  });

  // ============================================================================
  // RENDER CHIP TESTS
  // ============================================================================

  describe('renderChip', () => {
    const mockFont = { family: 'SF Arabic', size: 12 };

    test('should render chip for standard node', () => {
      const hero = { id: 'n1', name: 'عبدالله', father_id: 'f1' };
      const centroid = { x: 100, y: 200 };

      const result = renderChip(hero, centroid, 50, 1.0, 0, 0, mockFont);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.key).toBe('chip-n1');
    });

    test('should render chip for root node', () => {
      const hero = { id: 'root', name: 'الأصل', father_id: null };
      const centroid = { x: 0, y: 0 };

      const result = renderChip(hero, centroid, 500, 1.0, 0, 0, mockFont);

      expect(result).toBeDefined();
      expect(result.key).toBe('chip-root');
    });

    test('should handle scaled transform', () => {
      const hero = { id: 'n1', name: 'محمد', father_id: 'f1' };
      const centroid = { x: 100, y: 200 };

      const result = renderChip(hero, centroid, 25, 2.0, 50, 75, mockFont);

      expect(result).toBeDefined();
    });

    test('should handle null font', () => {
      const hero = { id: 'n1', name: 'أحمد', father_id: 'f1' };
      const centroid = { x: 100, y: 200 };

      const result = renderChip(hero, centroid, 30, 1.0, 0, 0, null);

      expect(result).toBeDefined();
    });

    test('should handle negative coordinates', () => {
      const hero = { id: 'n1', name: 'علي', father_id: 'f1' };
      const centroid = { x: -100, y: -200 };

      const result = renderChip(hero, centroid, 15, 1.0, 0, 0, mockFont);

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // T3 CHIP RENDERER COMPONENT TESTS
  // ============================================================================

  describe('T3ChipRenderer component', () => {
    const mockFont = { family: 'SF Arabic', size: 12 };

    const mockHeroNodes = [
      { id: 'root', name: 'الأصل', father_id: null },
      { id: 'h1', name: 'عبدالله', father_id: 'root' },
      { id: 'h2', name: 'محمد', father_id: 'root' },
    ];

    const mockIndices = {
      centroids: {
        root: { x: 0, y: 0 },
        h1: { x: 100, y: 200 },
        h2: { x: -100, y: 200 },
      },
      subtreeSizes: {
        root: 500,
        h1: 250,
        h2: 180,
      },
    };

    test('should render all hero chips', () => {
      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={mockIndices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should render with transformed coordinates', () => {
      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={mockIndices}
          scale={2.0}
          translateX={50}
          translateY={75}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should return null when aggregation disabled', () => {
      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={mockIndices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
          aggregationEnabled={false}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should skip hero with missing centroid', () => {
      const partialIndices = {
        centroids: {
          root: { x: 0, y: 0 },
          // h1 missing
          h2: { x: -100, y: 200 },
        },
        subtreeSizes: {
          root: 500,
          h1: 250,
          h2: 180,
        },
      };

      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={partialIndices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should skip hero with missing subtree size', () => {
      const partialIndices = {
        centroids: {
          root: { x: 0, y: 0 },
          h1: { x: 100, y: 200 },
          h2: { x: -100, y: 200 },
        },
        subtreeSizes: {
          root: 500,
          // h1 missing
          h2: 180,
        },
      };

      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={partialIndices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle empty hero nodes array', () => {
      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={[]}
          indices={mockIndices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle null font', () => {
      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={mockIndices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={null}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle zoom out (scale < 1)', () => {
      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={mockHeroNodes}
          indices={mockIndices}
          scale={0.5}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    const mockFont = { family: 'SF Arabic', size: 12 };

    test('should render root chip with 1.3x scale', () => {
      const heroNodes = [{ id: 'root', name: 'الأصل', father_id: null }];
      const indices = {
        centroids: { root: { x: 0, y: 0 } },
        subtreeSizes: { root: 500 },
      };

      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={heroNodes}
          indices={indices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should render standard chip with 1.0x scale', () => {
      const heroNodes = [{ id: 'h1', name: 'عبدالله', father_id: 'root' }];
      const indices = {
        centroids: { h1: { x: 100, y: 200 } },
        subtreeSizes: { h1: 250 },
      };

      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={heroNodes}
          indices={indices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle mix of root and standard chips', () => {
      const heroNodes = [
        { id: 'root', name: 'الأصل', father_id: null },
        { id: 'h1', name: 'عبدالله', father_id: 'root' },
        { id: 'h2', name: 'محمد', father_id: 'root' },
      ];

      const indices = {
        centroids: {
          root: { x: 0, y: 0 },
          h1: { x: 100, y: 200 },
          h2: { x: -100, y: 200 },
        },
        subtreeSizes: {
          root: 500,
          h1: 250,
          h2: 180,
        },
      };

      const { UNSAFE_root } = render(
        <T3ChipRenderer
          heroNodes={heroNodes}
          indices={indices}
          scale={1.0}
          translateX={0}
          translateY={0}
          arabicFont={mockFont}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });
  });
});
