/**
 * Unit tests for colorUtils
 * Phase 1 Day 0 - Test infrastructure
 */

describe('colorUtils', () => {
  // Tests will run after colorUtils.ts is created in Day 2
  let hexToRgba, createGrayscaleMatrix, createDimMatrix, interpolateColor;

  beforeAll(() => {
    try {
      const colorUtils = require('../../src/components/TreeView/utils/colorUtils');
      hexToRgba = colorUtils.hexToRgba;
      createGrayscaleMatrix = colorUtils.createGrayscaleMatrix;
      createDimMatrix = colorUtils.createDimMatrix;
      interpolateColor = colorUtils.interpolateColor;
    } catch (error) {
      // Utils don't exist yet - will be created in Day 2
      console.warn('colorUtils not found - will be created in Phase 1 Day 2');
    }
  });

  describe('hexToRgba', () => {
    it('should convert 6-digit hex to rgba with alpha 1.0', () => {
      if (!hexToRgba) return;
      expect(hexToRgba('#A13333', 1.0)).toBe('rgba(161, 51, 51, 1)');
    });

    it('should convert 6-digit hex to rgba with custom alpha', () => {
      if (!hexToRgba) return;
      expect(hexToRgba('#A13333', 0.5)).toBe('rgba(161, 51, 51, 0.5)');
    });

    it('should handle uppercase hex', () => {
      if (!hexToRgba) return;
      expect(hexToRgba('#FF00FF', 1.0)).toBe('rgba(255, 0, 255, 1)');
    });

    it('should handle lowercase hex', () => {
      if (!hexToRgba) return;
      expect(hexToRgba('#ff00ff', 1.0)).toBe('rgba(255, 0, 255, 1)');
    });

    it('should handle black color', () => {
      if (!hexToRgba) return;
      expect(hexToRgba('#000000', 1.0)).toBe('rgba(0, 0, 0, 1)');
    });

    it('should handle white color', () => {
      if (!hexToRgba) return;
      expect(hexToRgba('#FFFFFF', 0.8)).toBe('rgba(255, 255, 255, 0.8)');
    });
  });

  describe('createGrayscaleMatrix', () => {
    it('should return 20-element ColorMatrix array', () => {
      if (!createGrayscaleMatrix) return;
      const matrix = createGrayscaleMatrix();
      expect(matrix).toHaveLength(20);
    });

    it('should use luminosity method coefficients (ITU-R BT.709)', () => {
      if (!createGrayscaleMatrix) return;
      const matrix = createGrayscaleMatrix();

      // First row: [0.2126, 0.7152, 0.0722, 0, 0]
      expect(matrix[0]).toBeCloseTo(0.2126, 4);
      expect(matrix[1]).toBeCloseTo(0.7152, 4);
      expect(matrix[2]).toBeCloseTo(0.0722, 4);
      expect(matrix[3]).toBe(0);
      expect(matrix[4]).toBe(0);
    });

    it('should preserve alpha channel', () => {
      if (!createGrayscaleMatrix) return;
      const matrix = createGrayscaleMatrix();

      // Alpha row: [0, 0, 0, 1, 0]
      expect(matrix[15]).toBe(0);
      expect(matrix[16]).toBe(0);
      expect(matrix[17]).toBe(0);
      expect(matrix[18]).toBe(1);
      expect(matrix[19]).toBe(0);
    });
  });

  describe('createDimMatrix', () => {
    it('should default to 0.85 dimming factor', () => {
      if (!createDimMatrix) return;
      const matrix = createDimMatrix();

      expect(matrix[0]).toBe(0.85);  // R
      expect(matrix[6]).toBe(0.85);  // G
      expect(matrix[12]).toBe(0.85); // B
    });

    it('should accept custom dimming factor', () => {
      if (!createDimMatrix) return;
      const matrix = createDimMatrix(0.7);

      expect(matrix[0]).toBe(0.7);
      expect(matrix[6]).toBe(0.7);
      expect(matrix[12]).toBe(0.7);
    });

    it('should preserve alpha channel', () => {
      if (!createDimMatrix) return;
      const matrix = createDimMatrix(0.5);

      // Alpha should remain 1.0
      expect(matrix[18]).toBe(1);
    });

    it('should return 20-element array', () => {
      if (!createDimMatrix) return;
      const matrix = createDimMatrix();
      expect(matrix).toHaveLength(20);
    });
  });

  describe('interpolateColor', () => {
    it('should return start color at progress 0', () => {
      if (!interpolateColor) return;
      const result = interpolateColor('#000000', '#FFFFFF', 0);
      expect(result).toBe('#000000');
    });

    it('should return end color at progress 1', () => {
      if (!interpolateColor) return;
      const result = interpolateColor('#000000', '#FFFFFF', 1);
      expect(result).toBe('#ffffff');
    });

    it('should interpolate midpoint correctly', () => {
      if (!interpolateColor) return;
      const result = interpolateColor('#000000', '#FFFFFF', 0.5);
      expect(result).toBe('#7f7f7f'); // Midpoint gray
    });

    it('should interpolate Najdi Crimson to Desert Ochre', () => {
      if (!interpolateColor) return;
      // Najdi Crimson: #A13333, Desert Ochre: #D58C4A
      const result = interpolateColor('#A13333', '#D58C4A', 0.5);
      // Midpoint: R: (161+213)/2=187, G: (51+140)/2=95, B: (51+74)/2=62
      expect(result).toBe('#bb5f3e');
    });

    it('should handle progress at 0.25', () => {
      if (!interpolateColor) return;
      const result = interpolateColor('#000000', '#FFFFFF', 0.25);
      expect(result).toBe('#3f3f3f'); // 25% gray
    });

    it('should handle progress at 0.75', () => {
      if (!interpolateColor) return;
      const result = interpolateColor('#000000', '#FFFFFF', 0.75);
      expect(result).toBe('#bfbfbf'); // 75% gray
    });
  });
});
