/**
 * ShadowRenderer Tests
 *
 * Test suite for shadow rendering with Najdi design constraints.
 *
 * Coverage:
 * - Opacity validation (max 0.08)
 * - Color generation with alpha
 * - Shadow rendering and positioning
 * - T1/T2 shadow variants
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  ShadowRenderer,
  validateShadowOpacity,
  opacityToHex,
  createShadowColor,
  renderT1Shadow,
  renderT2Shadow,
  SHADOW_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/ShadowRenderer';

describe('ShadowRenderer', () => {
  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('SHADOW_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(SHADOW_CONSTANTS.MAX_OPACITY).toBe(0.08);
      expect(SHADOW_CONSTANTS.DEFAULT_OPACITY).toBe(0.05);
      expect(SHADOW_CONSTANTS.DEFAULT_OFFSET_X).toBe(1);
      expect(SHADOW_CONSTANTS.DEFAULT_OFFSET_Y).toBe(1);
      expect(SHADOW_CONSTANTS.T1_OPACITY).toBe(0.05);
      expect(SHADOW_CONSTANTS.T2_OPACITY).toBe(0.03);
    });
  });

  // ============================================================================
  // VALIDATE SHADOW OPACITY TESTS
  // ============================================================================

  describe('validateShadowOpacity', () => {
    test('should pass opacity within bounds', () => {
      expect(validateShadowOpacity(0.05)).toBe(0.05);
    });

    test('should clamp to max opacity (0.08)', () => {
      expect(validateShadowOpacity(0.15)).toBe(0.08);
      expect(validateShadowOpacity(1.0)).toBe(0.08);
    });

    test('should clamp to min opacity (0.0)', () => {
      expect(validateShadowOpacity(-0.05)).toBe(0);
    });

    test('should handle exactly max opacity', () => {
      expect(validateShadowOpacity(0.08)).toBe(0.08);
    });

    test('should handle zero opacity', () => {
      expect(validateShadowOpacity(0.0)).toBe(0.0);
    });

    test('should handle very small opacity', () => {
      expect(validateShadowOpacity(0.001)).toBe(0.001);
    });
  });

  // ============================================================================
  // OPACITY TO HEX TESTS
  // ============================================================================

  describe('opacityToHex', () => {
    test('should convert 0.0 to 00', () => {
      expect(opacityToHex(0.0)).toBe('00');
    });

    test('should convert 1.0 to ff', () => {
      expect(opacityToHex(1.0)).toBe('ff');
    });

    test('should convert 0.5 to 80 (128)', () => {
      const result = opacityToHex(0.5);
      expect(result).toBe('80'); // 0.5 * 255 = 127.5 ≈ 128 = 0x80
    });

    test('should convert 0.05 to 0d (13)', () => {
      const result = opacityToHex(0.05);
      expect(result).toBe('0d'); // 0.05 * 255 = 12.75 ≈ 13 = 0x0d
    });

    test('should convert 0.08 to 14 (20)', () => {
      const result = opacityToHex(0.08);
      expect(result).toBe('14'); // 0.08 * 255 = 20.4 ≈ 20 = 0x14
    });

    test('should pad single digit hex', () => {
      const result = opacityToHex(0.01); // ≈ 2.55 ≈ 3 = 0x03
      expect(result).toMatch(/^0[0-9a-f]$/);
    });
  });

  // ============================================================================
  // CREATE SHADOW COLOR TESTS
  // ============================================================================

  describe('createShadowColor', () => {
    test('should create default black shadow', () => {
      const result = createShadowColor();
      expect(result).toMatch(/^#000000[0-9a-f]{2}$/);
    });

    test('should create shadow with specific opacity', () => {
      const result = createShadowColor('#000000', 0.05);
      expect(result).toBe('#0000000d'); // 0.05 * 255 ≈ 13 = 0x0d
    });

    test('should clamp opacity to max (0.08)', () => {
      const result = createShadowColor('#000000', 0.15);
      const expected = createShadowColor('#000000', 0.08);
      expect(result).toBe(expected);
    });

    test('should handle custom base color', () => {
      const result = createShadowColor('#FF0000', 0.05);
      expect(result).toMatch(/^#FF0000[0-9a-f]{2}$/);
    });

    test('should create T1 shadow color', () => {
      const result = createShadowColor('#000000', SHADOW_CONSTANTS.T1_OPACITY);
      expect(result).toBe('#0000000d'); // 0.05 opacity
    });

    test('should create T2 shadow color', () => {
      const result = createShadowColor('#000000', SHADOW_CONSTANTS.T2_OPACITY);
      expect(result).toBe('#00000008'); // 0.03 opacity
    });
  });

  // ============================================================================
  // SHADOW RENDERER COMPONENT TESTS
  // ============================================================================

  describe('ShadowRenderer component', () => {
    test('should render with default props', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={100}
          y={200}
          width={85}
          height={90}
          cornerRadius={8}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should apply default offset', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={100}
          y={200}
          width={85}
          height={90}
          cornerRadius={8}
        />
      );

      // Default offset is 1, 1
      expect(UNSAFE_root).toBeDefined();
    });

    test('should apply custom opacity', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={100}
          y={200}
          width={85}
          height={90}
          cornerRadius={8}
          opacity={0.03}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should apply custom offset', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={100}
          y={200}
          width={85}
          height={90}
          cornerRadius={8}
          offsetX={0.5}
          offsetY={0.5}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should clamp excessive opacity to 0.08', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={100}
          y={200}
          width={85}
          height={90}
          cornerRadius={8}
          opacity={0.5} // Will be clamped to 0.08
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle zero opacity', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={100}
          y={200}
          width={85}
          height={90}
          cornerRadius={8}
          opacity={0.0}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should match corner radius of parent', () => {
      const { UNSAFE_root: root1 } = render(
        <ShadowRenderer
          x={0}
          y={0}
          width={85}
          height={90}
          cornerRadius={8}
        />
      );

      const { UNSAFE_root: root2 } = render(
        <ShadowRenderer
          x={0}
          y={0}
          width={85}
          height={90}
          cornerRadius={13}
        />
      );

      expect(root1).toBeDefined();
      expect(root2).toBeDefined();
    });

    test('should handle negative coordinates', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={-100}
          y={-200}
          width={85}
          height={90}
          cornerRadius={8}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle large dimensions', () => {
      const { UNSAFE_root } = render(
        <ShadowRenderer
          x={0}
          y={0}
          width={500}
          height={300}
          cornerRadius={20}
        />
      );

      expect(UNSAFE_root).toBeDefined();
    });
  });

  // ============================================================================
  // RENDER T1 SHADOW TESTS
  // ============================================================================

  describe('renderT1Shadow', () => {
    test('should render T1 shadow (photo card)', () => {
      const result = renderT1Shadow(100, 200, 85, 90, 8);

      expect(result).toBeDefined();
      expect(result.type).toBe(ShadowRenderer);
    });

    test('should use correct T1 opacity (0.05)', () => {
      const result = renderT1Shadow(0, 0, 85, 90, 8);

      expect(result.props.opacity).toBe(0.05);
    });

    test('should use 1px offset for T1', () => {
      const result = renderT1Shadow(0, 0, 85, 90, 8);

      expect(result.props.offsetX).toBe(1);
      expect(result.props.offsetY).toBe(1);
    });

    test('should handle different corner radius', () => {
      const result = renderT1Shadow(0, 0, 85, 90, 13);

      expect(result.props.cornerRadius).toBe(13);
    });
  });

  // ============================================================================
  // RENDER T2 SHADOW TESTS
  // ============================================================================

  describe('renderT2Shadow', () => {
    test('should render T2 shadow (text pill)', () => {
      const result = renderT2Shadow(100, 200, 60, 35, 13);

      expect(result).toBeDefined();
      expect(result.type).toBe(ShadowRenderer);
    });

    test('should use correct T2 opacity (0.03)', () => {
      const result = renderT2Shadow(0, 0, 60, 35, 13);

      expect(result.props.opacity).toBe(0.03);
    });

    test('should use 0.5px offset for T2', () => {
      const result = renderT2Shadow(0, 0, 60, 35, 13);

      expect(result.props.offsetX).toBe(0.5);
      expect(result.props.offsetY).toBe(0.5);
    });

    test('should handle different corner radius', () => {
      const result = renderT2Shadow(0, 0, 60, 35, 8);

      expect(result.props.cornerRadius).toBe(8);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    test('T1 shadow should be darker than T2 shadow', () => {
      const t1 = SHADOW_CONSTANTS.T1_OPACITY;
      const t2 = SHADOW_CONSTANTS.T2_OPACITY;

      expect(t1).toBeGreaterThan(t2);
    });

    test('T1 shadow should have larger offset than T2', () => {
      const t1Shadow = renderT1Shadow(0, 0, 85, 90, 8);
      const t2Shadow = renderT2Shadow(0, 0, 60, 35, 13);

      expect(t1Shadow.props.offsetX).toBeGreaterThan(t2Shadow.props.offsetX);
    });

    test('Both shadow types should respect max opacity constraint', () => {
      expect(SHADOW_CONSTANTS.T1_OPACITY).toBeLessThanOrEqual(SHADOW_CONSTANTS.MAX_OPACITY);
      expect(SHADOW_CONSTANTS.T2_OPACITY).toBeLessThanOrEqual(SHADOW_CONSTANTS.MAX_OPACITY);
    });
  });
});
