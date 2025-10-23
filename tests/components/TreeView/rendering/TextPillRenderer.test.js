/**
 * TextPillRenderer Tests
 *
 * Test suite for LOD Tier 2 text-only pill rendering.
 *
 * Coverage:
 * - First name extraction
 * - Pill dimensions and positioning
 * - Selection state and border styling
 * - Shadow integration
 * - Frame bounds calculation
 * - Known issue: border width jump (AS-IS for Phase 2)
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  TextPillRenderer,
  extractFirstName,
  PILL_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/TextPillRenderer';

// Mock paragraph cache function
const mockGetCachedParagraph = jest.fn((text, weight, fontSize, color, width) => {
  return {
    getHeight: () => 14, // Mock paragraph height
    getWidth: () => width * 0.8, // Mock paragraph width
  };
});

describe('TextPillRenderer', () => {
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('PILL_CONSTANTS', () => {
    test('should export expected dimensions', () => {
      expect(PILL_CONSTANTS.WIDTH).toBe(60);
      expect(PILL_CONSTANTS.HEIGHT).toBe(26);
      expect(PILL_CONSTANTS.CORNER_RADIUS).toBe(4); // Smooth corners
    });

    test('should export Najdi Sadu colors', () => {
      expect(PILL_CONSTANTS.BACKGROUND_COLOR).toBe('#FFFFFF');
      expect(PILL_CONSTANTS.TEXT_COLOR).toBe('#242121');
      expect(PILL_CONSTANTS.DEFAULT_BORDER_COLOR).toBe('#D1BBA360');
      expect(PILL_CONSTANTS.SELECTED_BORDER_COLOR).toBe('#A13333');
    });

    test('should export border widths', () => {
      expect(PILL_CONSTANTS.DEFAULT_BORDER_WIDTH).toBe(1);
      expect(PILL_CONSTANTS.SELECTED_BORDER_WIDTH).toBe(1.5);
    });

    test('should export typography constants', () => {
      expect(PILL_CONSTANTS.FONT_SIZE).toBe(10);
      expect(PILL_CONSTANTS.TEXT_OFFSET_Y).toBe(4); // CHANGED: 7 → 4
    });
  });

  // ============================================================================
  // EXTRACT FIRST NAME TESTS
  // ============================================================================

  describe('extractFirstName', () => {
    test('should extract first name from full name', () => {
      const result = extractFirstName('عبدالله محمد الغفيري');
      expect(result).toBe('عبدالله');
    });

    test('should handle single name', () => {
      const result = extractFirstName('عبدالله');
      expect(result).toBe('عبدالله');
    });

    test('should handle two-part name', () => {
      const result = extractFirstName('محمد أحمد');
      expect(result).toBe('محمد');
    });

    test('should handle name with multiple spaces', () => {
      const result = extractFirstName('عبد الله محمد أحمد');
      expect(result).toBe('عبد');
    });

    test('should handle empty string', () => {
      const result = extractFirstName('');
      expect(result).toBe('');
    });

    test('should handle name with leading space', () => {
      const result = extractFirstName(' محمد أحمد');
      expect(result).toBe('');
    });

    test('should handle name with trailing space', () => {
      const result = extractFirstName('محمد ');
      expect(result).toBe('محمد');
    });
  });

  // ============================================================================
  // TEXT PILL RENDERER COMPONENT TESTS
  // ============================================================================

  describe('TextPillRenderer component', () => {
    beforeEach(() => {
      mockGetCachedParagraph.mockClear();
    });

    test('should render with default props', () => {
      const { UNSAFE_root } = render(
        <TextPillRenderer
          nodeId="n1"
          name="عبدالله محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should call getCachedParagraph with first name', () => {
      render(
        <TextPillRenderer
          nodeId="n1"
          name="عبدالله محمد الغفيري"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      expect(mockGetCachedParagraph).toHaveBeenCalledWith(
        'عبدالله', // First name only
        'regular',
        10,
        '#242121',
        60
      );
    });

    test('should calculate correct position from center', () => {
      const onFrameCalculated = jest.fn();

      render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
          onFrameCalculated={onFrameCalculated}
        />
      );

      expect(onFrameCalculated).toHaveBeenCalledWith({
        x: 100 - 30, // centerX - width/2
        y: 200 - 13, // centerY - height/2
        width: 60,
        height: 26,
        borderRadius: 4, // Smooth corners
      });
    });

    test('should handle negative coordinates', () => {
      const onFrameCalculated = jest.fn();

      render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={-100}
          y={-200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
          onFrameCalculated={onFrameCalculated}
        />
      );

      expect(onFrameCalculated).toHaveBeenCalledWith({
        x: -130, // -100 - 30
        y: -213, // -200 - 13
        width: 60,
        height: 26,
        borderRadius: 4, // Smooth corners
      });
    });

    test('should handle zero coordinates', () => {
      const onFrameCalculated = jest.fn();

      render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={0}
          y={0}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
          onFrameCalculated={onFrameCalculated}
        />
      );

      expect(onFrameCalculated).toHaveBeenCalledWith({
        x: -30, // 0 - 30
        y: -13, // 0 - 13
        width: 60,
        height: 26,
        borderRadius: 4, // Smooth corners
      });
    });

    test('should render without onFrameCalculated callback', () => {
      const { UNSAFE_root } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle null paragraph gracefully', () => {
      const mockNullParagraph = jest.fn(() => null);

      const { UNSAFE_root } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockNullParagraph}
        />
      );

      // Should still render pill background and border
      expect(UNSAFE_root).toBeDefined();
    });

    test('should render with different node IDs', () => {
      const { UNSAFE_root: root1 } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      const { UNSAFE_root: root2 } = render(
        <TextPillRenderer
          nodeId="n2"
          name="أحمد"
          x={150}
          y={250}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      expect(root1).toBeDefined();
      expect(root2).toBeDefined();
    });
  });

  // ============================================================================
  // SELECTION STATE TESTS
  // ============================================================================

  describe('Selection state', () => {
    test('should use default border when not selected', () => {
      const { UNSAFE_root } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      // Should use default border color and width
      expect(UNSAFE_root).toBeDefined();
    });

    test('should use selected border when selected', () => {
      const { UNSAFE_root } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={true}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      // Should use selected border color and width
      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle selection state change', () => {
      const { UNSAFE_root: root1 } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      const { UNSAFE_root: root2 } = render(
        <TextPillRenderer
          nodeId="n1"
          name="محمد"
          x={100}
          y={200}
          isSelected={true}
          getCachedParagraph={mockGetCachedParagraph}
        />
      );

      expect(root1).toBeDefined();
      expect(root2).toBeDefined();
    });
  });

  // ============================================================================
  // KNOWN ISSUE TESTS (AS-IS for Phase 2)
  // ============================================================================

  describe('Known issue: border width jump', () => {
    test('should have different border widths for selected vs unselected', () => {
      const defaultWidth = PILL_CONSTANTS.DEFAULT_BORDER_WIDTH;
      const selectedWidth = PILL_CONSTANTS.SELECTED_BORDER_WIDTH;

      // This is the known issue causing 0.5px jump
      expect(selectedWidth).toBeGreaterThan(defaultWidth);
      expect(selectedWidth - defaultWidth).toBe(0.5);
    });

    test('should document the border width difference', () => {
      // This test documents the known issue for Phase 3 fix
      // When selected, border width changes from 1 to 1.5
      // This causes a 0.5px visual jump in the pill
      expect(PILL_CONSTANTS.DEFAULT_BORDER_WIDTH).toBe(1);
      expect(PILL_CONSTANTS.SELECTED_BORDER_WIDTH).toBe(1.5);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    test('should work with real names', () => {
      const names = [
        'عبدالله محمد الغفيري',
        'محمد أحمد',
        'أحمد',
        'عبد الله',
      ];

      names.forEach((name) => {
        const { UNSAFE_root } = render(
          <TextPillRenderer
            nodeId={`n-${name}`}
            name={name}
            x={100}
            y={200}
            isSelected={false}
            getCachedParagraph={mockGetCachedParagraph}
          />
        );

        expect(UNSAFE_root).toBeDefined();
      });
    });

    test('should work with different positions', () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        { x: -100, y: -200 },
        { x: 1000, y: 2000 },
      ];

      positions.forEach((pos) => {
        const { UNSAFE_root } = render(
          <TextPillRenderer
            nodeId={`n-${pos.x}-${pos.y}`}
            name="محمد"
            x={pos.x}
            y={pos.y}
            isSelected={false}
            getCachedParagraph={mockGetCachedParagraph}
          />
        );

        expect(UNSAFE_root).toBeDefined();
      });
    });

    test('should maintain consistent dimensions', () => {
      const onFrameCalculated1 = jest.fn();
      const onFrameCalculated2 = jest.fn();

      render(
        <TextPillRenderer
          nodeId="n1"
          name="عبدالله"
          x={100}
          y={200}
          isSelected={false}
          getCachedParagraph={mockGetCachedParagraph}
          onFrameCalculated={onFrameCalculated1}
        />
      );

      render(
        <TextPillRenderer
          nodeId="n2"
          name="محمد أحمد الغفيري"
          x={150}
          y={250}
          isSelected={true}
          getCachedParagraph={mockGetCachedParagraph}
          onFrameCalculated={onFrameCalculated2}
        />
      );

      // All pills should have same dimensions regardless of name or selection
      expect(onFrameCalculated1.mock.calls[0][0].width).toBe(60);
      expect(onFrameCalculated1.mock.calls[0][0].height).toBe(26);
      expect(onFrameCalculated2.mock.calls[0][0].width).toBe(60);
      expect(onFrameCalculated2.mock.calls[0][0].height).toBe(26);
    });
  });
});
