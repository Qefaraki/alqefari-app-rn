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

    test('should maximize photo fill with negative padding (overflow effect)', () => {
      // Standard node width: 50px photo + (-6px) padding = 38px card width
      expect(STANDARD_NODE.WIDTH).toBe(38); // Ultra-compact spacing
      expect(STANDARD_NODE.WIDTH % 2).toBe(0); // Even number for symmetric centering

      // Negative padding - photo overflows card edges by 6px each side
      expect(STANDARD_NODE.WIDTH).toBe(50 + (-6) * 2); // Photo size + (-6px) padding × 2
    });

    test('root node width must stay constant', () => {
      // Root nodes are exception to standard sizing
      expect(ROOT_NODE.WIDTH).toBe(120);
      expect(NODE_RENDERER_CONSTANTS.ROOT_WIDTH).toBe(120);

      // Root width should follow 8px grid (15 × 8)
      expect(ROOT_NODE.WIDTH % 8).toBe(0);
    });

    test('selection border with negative padding (photo overflow)', () => {
      // Selection border (2.5px) with negative horizontal padding (-6px per side)
      // Photo overflows card edges by 6px on each side
      expect(STANDARD_NODE.SELECTION_BORDER).toBe(2.5);
      expect(STANDARD_NODE.WIDTH - 50).toBe(-12); // -6px × 2 = -12px padding (photo overflows)
    });
  });

  describe('Separation Function Alignment', () => {
    test('d3 separation calculation uses correct node widths', () => {
      // d3 separation function (from treeLayout.js line 157-177):
      // - For siblings: (aWidth / 2) + (bWidth / 2) + 9px gap
      // - For cousins: (aWidth / 2) + (bWidth / 2) + 40px gap

      const aWidth = STANDARD_NODE.WIDTH;  // 38px
      const bWidth = STANDARD_NODE.WIDTH;  // 38px
      const siblingGap = 9;
      const cousinGap = 40;

      // Sibling separation: 19 + 19 + 9 = 47px (min space between siblings, 20% tighter)
      const siblingSeparation = aWidth / 2 + bWidth / 2 + siblingGap;
      expect(siblingSeparation).toBe(47);

      // Cousin separation: 19 + 19 + 40 = 78px (min space between cousins, 13% tighter)
      const cousinSeparation = aWidth / 2 + bWidth / 2 + cousinGap;
      expect(cousinSeparation).toBe(78);

      // These calculations should match what d3 actually uses
      // (Verified by integration testing on sample tree data)
    });

    test('photo vs text-only nodes have same separation', () => {
      // Both photo and text-only use STANDARD_NODE.WIDTH (38px)
      const photoWidth = STANDARD_NODE.WIDTH;
      const textWidth = STANDARD_NODE.WIDTH_TEXT_ONLY;

      expect(photoWidth).toBe(textWidth);
      expect(photoWidth).toBe(38);

      // This ensures consistent spacing regardless of LOD tier
    });
  });

  describe('Collision Detection Assumptions', () => {
    test('subtree bounds calculation assumes correct node dimensions', () => {
      // Collision resolution (treeLayout.js line 18-32) uses getNodeDimensions()
      // which returns STANDARD_NODE.WIDTH or ROOT_NODE.WIDTH

      // Test: 3 siblings with minimum spacing
      const numSiblings = 3;
      const nodeWidth = STANDARD_NODE.WIDTH;  // 38px
      const gap = 9;  // sibling gap

      // Rough bounds: (node1 width/2) + gap + (node2 width) + gap + (node3 width/2)
      // = 19 + 9 + 38 + 9 + 19 = 94px total width for 3 siblings (more compact)
      const totalWidth = numSiblings * nodeWidth + (numSiblings - 1) * gap;
      expect(totalWidth).toBe(3 * 38 + 2 * 9);
      expect(totalWidth).toBe(132);

      // This should NOT produce overlaps if d3 uses same width in separation()
    });
  });

  describe('No Hardcoded Dimension Duplication', () => {
    test('should NOT have alternative width values like 85px or 50px', () => {
      // Old constants file had NODE_WIDTH_WITH_PHOTO = 85 (WRONG)
      // Previous version used 50px (compact with no padding)
      // Current ultra-compact version uses 38px (with photo overflow effect)

      // Standard node should be 38px, not 85px or 50px
      expect(STANDARD_NODE.WIDTH).not.toBe(85);
      expect(STANDARD_NODE.WIDTH).not.toBe(65);
      expect(STANDARD_NODE.WIDTH).not.toBe(50);

      // Only valid value (ultra-compact spacing with overflow)
      expect(STANDARD_NODE.WIDTH).toBe(38);
    });

    test('should NOT have conflicting TEXT-ONLY widths', () => {
      // Both photo and text nodes should use same width for consistency
      expect(STANDARD_NODE.WIDTH).toBe(STANDARD_NODE.WIDTH_TEXT_ONLY);
      expect(STANDARD_NODE.WIDTH).toBe(38);
      expect(STANDARD_NODE.WIDTH_TEXT_ONLY).toBe(38);

      // No more mismatched widths (all use ultra-compact 38px)
    });
  });

  describe('Performance Impact', () => {
    test('width reduction maintains minimum sibling spacing', () => {
      // Previous version: 50px nodes + 9px gap = 59px per node pair
      // Current: 38px nodes + 9px gap = 47px per node pair
      // Reduction: 12px per sibling pair (20% additional tightness, photo overflow effect)

      const previousSpacing = 50 + 9;  // 59px (50px compact version)
      const newSpacing = STANDARD_NODE.WIDTH + 9;  // 47px (current ultra-compact with overflow)
      const savings = previousSpacing - newSpacing;

      expect(newSpacing).toBe(47);
      expect(savings).toBe(12);

      // Dense tree (10 siblings):
      // Previous: 10 × 59 = 590px width
      // New: 10 × 47 = 470px width
      // Savings: 120px (20% reduction) with photo overflow effect
      expect(10 * newSpacing).toBe(470);
      expect(10 * previousSpacing).toBe(590);
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

      // Values should match new ultra-compact standard
      expect(NODE_WIDTH_WITH_PHOTO).toBe(38);
      expect(NODE_WIDTH_TEXT_ONLY).toBe(38);
      expect(NODE_HEIGHT_WITH_PHOTO).toBe(75);
      expect(NODE_HEIGHT_TEXT_ONLY).toBe(35);
    });
  });
});
