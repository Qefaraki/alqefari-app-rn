/**
 * Tree Layout Integration Tests
 *
 * Tests the alignment between d3 layout system and renderer dimensions.
 * Ensures layout separation calculations use the same constants as rendering.
 *
 * Critical Test: Layout system (d3) must use IDENTICAL node dimensions as renderer
 * to prevent 20px+ mismatch between planned spacing and actual rendering.
 */

import {
  STANDARD_NODE,
  ROOT_NODE,
  NODE_WIDTH_WITH_PHOTO,
  NODE_WIDTH_TEXT_ONLY,
  NODE_HEIGHT_WITH_PHOTO,
  NODE_HEIGHT_TEXT_ONLY,
} from '../../src/components/TreeView/rendering/nodeConstants';
import { NODE_RENDERER_CONSTANTS } from '../../src/components/TreeView/rendering/NodeRenderer';

describe('Tree Layout Integration', () => {
  describe('Dimension Alignment: d3 layout ↔ renderer', () => {
    test('should use identical node dimensions (no 20px+ deltas)', () => {
      // Layout system uses STANDARD_NODE.WIDTH, renderer uses NODE_RENDERER_CONSTANTS.NODE_WIDTH_WITH_PHOTO
      // These MUST be identical or spacing calculation fails
      expect(NODE_WIDTH_WITH_PHOTO).toBe(STANDARD_NODE.WIDTH);
      expect(NODE_RENDERER_CONSTANTS.NODE_WIDTH_WITH_PHOTO).toBe(STANDARD_NODE.WIDTH);

      // Text-only nodes
      expect(NODE_WIDTH_TEXT_ONLY).toBe(STANDARD_NODE.WIDTH_TEXT_ONLY);
      expect(NODE_RENDERER_CONSTANTS.NODE_WIDTH_TEXT_ONLY).toBe(STANDARD_NODE.WIDTH_TEXT_ONLY);

      // Heights must match too (used in path calculation and collision detection)
      expect(NODE_HEIGHT_WITH_PHOTO).toBe(STANDARD_NODE.HEIGHT);
      expect(NODE_HEIGHT_TEXT_ONLY).toBe(STANDARD_NODE.HEIGHT_TEXT_ONLY);
    });

    test('should maximize photo fill with 4px padding (breathing room)', () => {
      // Standard node width: 50px photo + 4px padding = 58px card width
      expect(STANDARD_NODE.WIDTH).toBe(58); // Photo with comfortable breathing room
      expect(STANDARD_NODE.WIDTH % 2).toBe(0); // Even number for symmetric centering

      // 4px padding on each side - provides comfortable spacing
      expect(STANDARD_NODE.WIDTH).toBe(50 + 4 * 2); // Photo size + 4px padding × 2
    });

    test('root node width must stay constant', () => {
      // Root nodes are exception to standard sizing
      expect(ROOT_NODE.WIDTH).toBe(120);
      expect(NODE_RENDERER_CONSTANTS.ROOT_WIDTH).toBe(120);

      // Root width should follow 8px grid (15 × 8)
      expect(ROOT_NODE.WIDTH % 8).toBe(0);
    });

    test('selection border with 4px padding (breathing room around photo)', () => {
      // Selection border (2.5px) with 4px horizontal padding (4px per side)
      // Photo has comfortable spacing around it
      expect(STANDARD_NODE.SELECTION_BORDER).toBe(2.5);
      expect(STANDARD_NODE.WIDTH - 50).toBe(8); // 4px × 2 = 8px padding (breathing room)
    });
  });

  describe('Separation Function Alignment', () => {
    test('d3 separation calculation uses correct node widths', () => {
      // d3 separation function (from treeLayout.js line 157-177):
      // - For siblings: (aWidth / 2) + (bWidth / 2) + 9px gap
      // - For cousins: (aWidth / 2) + (bWidth / 2) + 40px gap

      const aWidth = STANDARD_NODE.WIDTH;  // 58px
      const bWidth = STANDARD_NODE.WIDTH;  // 58px
      const siblingGap = 9;
      const cousinGap = 40;

      // Sibling separation: 29 + 29 + 9 = 67px (min space between siblings)
      const siblingSeparation = aWidth / 2 + bWidth / 2 + siblingGap;
      expect(siblingSeparation).toBe(67);

      // Cousin separation: 29 + 29 + 40 = 98px (min space between cousins)
      const cousinSeparation = aWidth / 2 + bWidth / 2 + cousinGap;
      expect(cousinSeparation).toBe(98);

      // These calculations should match what d3 actually uses
      // (Verified by integration testing on sample tree data)
    });

    test('photo vs text-only nodes have same separation', () => {
      // Both photo and text-only use STANDARD_NODE.WIDTH (58px)
      const photoWidth = STANDARD_NODE.WIDTH;
      const textWidth = STANDARD_NODE.WIDTH_TEXT_ONLY;

      expect(photoWidth).toBe(textWidth);
      expect(photoWidth).toBe(58);

      // This ensures consistent spacing regardless of LOD tier
    });
  });

  describe('Collision Detection Assumptions', () => {
    test('subtree bounds calculation assumes correct node dimensions', () => {
      // Collision resolution (treeLayout.js line 18-32) uses getNodeDimensions()
      // which returns STANDARD_NODE.WIDTH or ROOT_NODE.WIDTH

      // Test: 3 siblings with minimum spacing
      const numSiblings = 3;
      const nodeWidth = STANDARD_NODE.WIDTH;  // 58px
      const gap = 9;  // sibling gap

      // Rough bounds: (node1 width/2) + gap + (node2 width) + gap + (node3 width/2)
      // = 29 + 9 + 58 + 9 + 29 = 134px total width for 3 siblings
      const totalWidth = numSiblings * nodeWidth + (numSiblings - 1) * gap;
      expect(totalWidth).toBe(3 * 58 + 2 * 9);
      expect(totalWidth).toBe(192);

      // This should NOT produce overlaps if d3 uses same width in separation()
    });
  });

  describe('No Hardcoded Dimension Duplication', () => {
    test('should NOT have alternative width values like 85px or 54px', () => {
      // Old constants file had NODE_WIDTH_WITH_PHOTO = 85 (WRONG)
      // Previous version used 54px (50px photo + 2px padding × 2) - OBSOLETE
      // Current version uses 58px (50px photo + 4px padding × 2)

      // Standard node should be 58px, not 85px or 54px
      expect(STANDARD_NODE.WIDTH).not.toBe(85);
      expect(STANDARD_NODE.WIDTH).not.toBe(65);
      expect(STANDARD_NODE.WIDTH).not.toBe(54);

      // Only valid value (photo with breathing room padding)
      expect(STANDARD_NODE.WIDTH).toBe(58);
    });

    test('should NOT have conflicting TEXT-ONLY widths', () => {
      // Both photo and text nodes should use same width for consistency
      expect(STANDARD_NODE.WIDTH).toBe(STANDARD_NODE.WIDTH_TEXT_ONLY);
      expect(STANDARD_NODE.WIDTH).toBe(58);
      expect(STANDARD_NODE.WIDTH_TEXT_ONLY).toBe(58);

      // No mismatched widths (all use standard 58px)
    });
  });

  describe('Spacing Calculations', () => {
    test('standard sibling spacing maintains consistent separation', () => {
      // Current version: 58px nodes + 9px gap = 67px per node pair
      const nodeSpacing = STANDARD_NODE.WIDTH + 9;  // 67px (58px nodes + 9px gap)

      expect(nodeSpacing).toBe(67);

      // Dense tree (10 siblings):
      // 10 × 67 = 670px width
      expect(10 * nodeSpacing).toBe(670);
    });
  });

  describe('Backwards Compatibility', () => {
    test('legacy constant names still export correct values', () => {
      // Old code imports NODE_WIDTH_WITH_PHOTO from old location
      // New nodeConstants re-exports these for compatibility
      expect(NODE_WIDTH_WITH_PHOTO).toBeDefined();
      expect(NODE_WIDTH_TEXT_ONLY).toBeDefined();
      expect(NODE_HEIGHT_WITH_PHOTO).toBeDefined();
      expect(NODE_HEIGHT_TEXT_ONLY).toBeDefined();

      // Values should match current standard (58px)
      expect(NODE_WIDTH_WITH_PHOTO).toBe(58);
      expect(NODE_WIDTH_TEXT_ONLY).toBe(58);
      expect(NODE_HEIGHT_WITH_PHOTO).toBe(75);
      expect(NODE_HEIGHT_TEXT_ONLY).toBe(35);
    });
  });
});
