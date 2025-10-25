/**
 * ZoomHandler Tests
 *
 * Test suite for zoom constraints and calculations.
 *
 * Coverage:
 * - Clamp utility
 * - Fit-to-view scale calculation
 * - LOD threshold integration (T2)
 * - Bounds calculation
 * - Transform calculation for zoom-to-fit
 */

import { PixelRatio } from 'react-native';
import {
  clamp,
  calculateMinScaleForT2,
  calculateFitToViewScale,
  calculateZoomToFit,
  calculateBoundsCenter,
  calculateNodesBounds,
  calculateFitToViewTransform,
  ZOOM_CONSTANTS,
} from '../../../../src/components/TreeView/zoom/ZoomHandler';
import { NODE_WIDTH_WITH_PHOTO } from '../../../../src/components/TreeView/rendering/nodeConstants';

describe('ZoomHandler', () => {
  const mockViewport = {
    width: 800,
    height: 600,
  };

  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('ZOOM_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(ZOOM_CONSTANTS.T2_BASE).toBe(48);
      expect(ZOOM_CONSTANTS.DEFAULT_MIN_ZOOM).toBe(0.1);
      expect(ZOOM_CONSTANTS.DEFAULT_MAX_ZOOM).toBe(5.0);
      expect(ZOOM_CONSTANTS.DEFAULT_PADDING).toBe(100);
      expect(ZOOM_CONSTANTS.DEFAULT_T2_BUFFER_PERCENT).toBe(0.2);
    });
  });

  // ============================================================================
  // CLAMP TESTS
  // ============================================================================

  describe('clamp', () => {
    test('should return value if within bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    test('should clamp to minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    test('should clamp to maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    test('should handle min = max', () => {
      expect(clamp(5, 3, 3)).toBe(3);
    });

    test('should handle value at min boundary', () => {
      expect(clamp(0, 0, 10)).toBe(0);
    });

    test('should handle value at max boundary', () => {
      expect(clamp(10, 0, 10)).toBe(10);
    });

    test('should work with negative bounds', () => {
      expect(clamp(-3, -10, -1)).toBe(-3);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });

    test('should work with floating point values', () => {
      expect(clamp(2.5, 0.0, 5.0)).toBe(2.5);
      expect(clamp(0.05, 0.1, 5.0)).toBe(0.1);
      expect(clamp(5.5, 0.1, 5.0)).toBe(5.0);
    });
  });

  // ============================================================================
  // CALCULATE MIN SCALE FOR T2 TESTS
  // ============================================================================

  describe('calculateMinScaleForT2', () => {
    test('should calculate min scale with default buffer', () => {
      const pixelRatio = PixelRatio.get();
      const expectedBase = 48 / (NODE_WIDTH_WITH_PHOTO * pixelRatio);
      const expected = expectedBase * 1.2; // 20% buffer

      const result = calculateMinScaleForT2();

      expect(result).toBeCloseTo(expected, 4);
    });

    test('should use custom buffer percentage', () => {
      const pixelRatio = PixelRatio.get();
      const expectedBase = 48 / (NODE_WIDTH_WITH_PHOTO * pixelRatio);
      const expected = expectedBase * 1.5; // 50% buffer

      const result = calculateMinScaleForT2(0.5);

      expect(result).toBeCloseTo(expected, 4);
    });

    test('should handle zero buffer', () => {
      const pixelRatio = PixelRatio.get();
      const expected = 48 / (NODE_WIDTH_WITH_PHOTO * pixelRatio);

      const result = calculateMinScaleForT2(0.0);

      expect(result).toBeCloseTo(expected, 4);
    });

    test('should return positive value', () => {
      const result = calculateMinScaleForT2();
      expect(result).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CALCULATE FIT TO VIEW SCALE TESTS
  // ============================================================================

  describe('calculateFitToViewScale', () => {
    test('should fit square bounds to viewport', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
      // With padding: 600x600 bounds
      // Scale needed: min(800/600, 600/600) = min(1.33, 1.0) = 1.0

      const result = calculateFitToViewScale(bounds, mockViewport);

      expect(result).toBeCloseTo(1.0, 2);
    });

    test('should fit wide bounds to viewport', () => {
      const bounds = { minX: 0, maxX: 800, minY: 0, maxY: 200 };
      // With padding: 1000x400 bounds
      // Scale needed: min(800/1000, 600/400) = min(0.8, 1.5) = 0.8

      const result = calculateFitToViewScale(bounds, mockViewport);

      expect(result).toBeCloseTo(0.8, 2);
    });

    test('should fit tall bounds to viewport', () => {
      const bounds = { minX: 0, maxX: 200, minY: 0, maxY: 800 };
      // With padding: 400x1000 bounds
      // Scale needed: min(800/400, 600/1000) = min(2.0, 0.6) = 0.6

      const result = calculateFitToViewScale(bounds, mockViewport);

      expect(result).toBeCloseTo(0.6, 2);
    });

    test('should handle custom padding', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
      const padding = 50;
      // With padding: 500x500 bounds
      // Scale needed: min(800/500, 600/500) = min(1.6, 1.2) = 1.2

      const result = calculateFitToViewScale(bounds, mockViewport, padding);

      expect(result).toBeCloseTo(1.2, 2);
    });

    test('should handle zero padding', () => {
      const bounds = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
      // No padding: exact viewport size
      // Scale needed: min(800/800, 600/600) = 1.0

      const result = calculateFitToViewScale(bounds, mockViewport, 0);

      expect(result).toBe(1.0);
    });

    test('should handle negative bounds', () => {
      const bounds = { minX: -200, maxX: 200, minY: -150, maxY: 150 };
      // With padding: 600x500 bounds
      // Scale needed: min(800/600, 600/500) = min(1.33, 1.2) = 1.2

      const result = calculateFitToViewScale(bounds, mockViewport);

      expect(result).toBeCloseTo(1.2, 2);
    });

    test('should handle very small bounds (zoom in)', () => {
      const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      // With padding: 210x210 bounds
      // Scale needed: min(800/210, 600/210) ≈ min(3.81, 2.86) = 2.86

      const result = calculateFitToViewScale(bounds, mockViewport);

      expect(result).toBeCloseTo(2.86, 1);
    });

    test('should handle very large bounds (zoom out)', () => {
      const bounds = { minX: 0, maxX: 2000, minY: 0, maxY: 2000 };
      // With padding: 2200x2200 bounds
      // Scale needed: min(800/2200, 600/2200) ≈ min(0.36, 0.27) = 0.27

      const result = calculateFitToViewScale(bounds, mockViewport);

      expect(result).toBeCloseTo(0.27, 2);
    });
  });

  // ============================================================================
  // CALCULATE ZOOM TO FIT TESTS
  // ============================================================================

  describe('calculateZoomToFit', () => {
    test('should apply min zoom constraint', () => {
      const bounds = { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
      // Set minZoom higher than T2 threshold to ensure it applies
      const minT2 = calculateMinScaleForT2();
      const config = { minZoom: minT2 * 2 }; // Much higher than T2

      const result = calculateZoomToFit(bounds, mockViewport, config);

      expect(result).toBe(minT2 * 2);
    });

    test('should apply max zoom constraint', () => {
      const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      const config = { maxZoom: 2.0 };

      const result = calculateZoomToFit(bounds, mockViewport, config);

      expect(result).toBe(2.0);
    });

    test('should apply T2 minimum threshold', () => {
      const bounds = { minX: 0, maxX: 5000, minY: 0, maxY: 5000 };
      // Fit-to-view would give very small scale, but T2 threshold enforces minimum

      const result = calculateZoomToFit(bounds, mockViewport);

      const minT2 = calculateMinScaleForT2();
      expect(result).toBeGreaterThanOrEqual(minT2);
    });

    test('should use fit-to-view if above T2 threshold', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
      // Fit-to-view gives 1.0, which is above T2 threshold

      const result = calculateZoomToFit(bounds, mockViewport);

      expect(result).toBeCloseTo(1.0, 1);
    });

    test('should use default config values', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };

      const result = calculateZoomToFit(bounds, mockViewport);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(5.0); // Default max zoom
    });

    test('should respect custom padding', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
      const config1 = { padding: 50 };
      const config2 = { padding: 200 };

      const result1 = calculateZoomToFit(bounds, mockViewport, config1);
      const result2 = calculateZoomToFit(bounds, mockViewport, config2);

      // More padding = smaller scale needed
      expect(result2).toBeLessThan(result1);
    });

    test('should respect custom T2 buffer', () => {
      const bounds = { minX: 0, maxX: 5000, minY: 0, maxY: 5000 };
      const config1 = { t2BufferPercent: 0.0 };
      const config2 = { t2BufferPercent: 0.5 };

      const result1 = calculateZoomToFit(bounds, mockViewport, config1);
      const result2 = calculateZoomToFit(bounds, mockViewport, config2);

      // More buffer = higher minimum scale
      expect(result2).toBeGreaterThan(result1);
    });
  });

  // ============================================================================
  // CALCULATE BOUNDS CENTER TESTS
  // ============================================================================

  describe('calculateBoundsCenter', () => {
    test('should calculate center of bounds', () => {
      const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 200 };

      const result = calculateBoundsCenter(bounds);

      expect(result.x).toBe(50);
      expect(result.y).toBe(100);
    });

    test('should handle negative bounds', () => {
      const bounds = { minX: -100, maxX: 100, minY: -50, maxY: 50 };

      const result = calculateBoundsCenter(bounds);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    test('should handle asymmetric bounds', () => {
      const bounds = { minX: 10, maxX: 50, minY: 20, maxY: 80 };

      const result = calculateBoundsCenter(bounds);

      expect(result.x).toBe(30);
      expect(result.y).toBe(50);
    });
  });

  // ============================================================================
  // CALCULATE NODES BOUNDS TESTS
  // ============================================================================

  describe('calculateNodesBounds', () => {
    test('should calculate bounds for single node', () => {
      const nodes = [{ x: 50, y: 100 }];

      const result = calculateNodesBounds(nodes);

      expect(result).toEqual({ minX: 50, maxX: 50, minY: 100, maxY: 100 });
    });

    test('should calculate bounds for multiple nodes', () => {
      const nodes = [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 150 },
      ];

      const result = calculateNodesBounds(nodes);

      expect(result).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 150 });
    });

    test('should return null for empty array', () => {
      const nodes = [];

      const result = calculateNodesBounds(nodes);

      expect(result).toBeNull();
    });

    test('should handle negative coordinates', () => {
      const nodes = [
        { x: -50, y: -100 },
        { x: 50, y: 100 },
      ];

      const result = calculateNodesBounds(nodes);

      expect(result).toEqual({ minX: -50, maxX: 50, minY: -100, maxY: 100 });
    });

    test('should handle nodes at same coordinates', () => {
      const nodes = [
        { x: 100, y: 200 },
        { x: 100, y: 200 },
        { x: 100, y: 200 },
      ];

      const result = calculateNodesBounds(nodes);

      expect(result).toEqual({ minX: 100, maxX: 100, minY: 200, maxY: 200 });
    });

    test('should ignore extra node properties', () => {
      const nodes = [
        { x: 0, y: 0, name: 'Node 1', id: 'n1' },
        { x: 100, y: 100, name: 'Node 2', id: 'n2' },
      ];

      const result = calculateNodesBounds(nodes);

      expect(result).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
    });
  });

  // ============================================================================
  // CALCULATE FIT TO VIEW TRANSFORM TESTS
  // ============================================================================

  describe('calculateFitToViewTransform', () => {
    test('should calculate complete transform', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };

      const result = calculateFitToViewTransform(bounds, mockViewport);

      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('scale');
      expect(result.scale).toBeCloseTo(1.0, 1);
    });

    test('should center bounds on screen', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
      // Center: (200, 200)
      // Scale: 1.0
      // translateX = 800/2 - 200*1.0 = 200
      // translateY = 600/2 - 200*1.0 = 100

      const result = calculateFitToViewTransform(bounds, mockViewport);

      expect(result.x).toBeCloseTo(200, 0);
      expect(result.y).toBeCloseTo(100, 0);
    });

    test('should handle negative bounds', () => {
      const bounds = { minX: -200, maxX: 200, minY: -150, maxY: 150 };
      // Center: (0, 0)
      // Scale: 1.2
      // translateX = 800/2 - 0*1.2 = 400
      // translateY = 600/2 - 0*1.2 = 300

      const result = calculateFitToViewTransform(bounds, mockViewport);

      expect(result.x).toBeCloseTo(400, 0);
      expect(result.y).toBeCloseTo(300, 0);
      expect(result.scale).toBeCloseTo(1.2, 1);
    });

    test('should respect zoom config', () => {
      const bounds = { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };
      const config = { minZoom: 0.5 };

      const result = calculateFitToViewTransform(bounds, mockViewport, config);

      // T2 threshold override: 48 / (38 * 2) * 1.2 = 0.758
      // Exceeds minZoom config of 0.5, so T2 minimum applies
      expect(result.scale).toBeCloseTo(0.758, 2);
    });

    test('should apply all config options', () => {
      const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 400 };
      const config = {
        minZoom: 0.5,
        maxZoom: 2.0,
        padding: 50,
        t2BufferPercent: 0.3,
      };

      const result = calculateFitToViewTransform(bounds, mockViewport, config);

      expect(result.scale).toBeGreaterThanOrEqual(0.5);
      expect(result.scale).toBeLessThanOrEqual(2.0);
    });

    test('should work with very small bounds', () => {
      const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

      const result = calculateFitToViewTransform(bounds, mockViewport);

      expect(result.scale).toBeGreaterThan(1.0); // Should zoom in
    });

    test('should work with very large bounds', () => {
      const bounds = { minX: 0, maxX: 5000, minY: 0, maxY: 5000 };

      const result = calculateFitToViewTransform(bounds, mockViewport);

      expect(result.scale).toBeLessThan(1.0); // Should zoom out (or T2 minimum)
    });
  });
});
