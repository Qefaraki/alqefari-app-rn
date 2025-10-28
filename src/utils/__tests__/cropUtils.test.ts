/**
 * Unit Tests for Photo Crop Utilities
 *
 * Tests all crop utility functions with edge cases and validation logic.
 * Ensures backwards compatibility with NULL/undefined crop values.
 *
 * Test Coverage:
 * - normalizeCropValues() - NULL/undefined handling
 * - hasCrop() - Type guards and edge cases
 * - getCropAreaPercentage() - Area calculations
 * - isValidCrop() - Validation bounds
 * - clampCropCoordinates() - Floating-point edge cases
 *
 * Run: npm test -- cropUtils.test.ts
 *
 * Created: 2025-10-28
 */

import {
  normalizeCropValues,
  hasCrop,
  getCropAreaPercentage,
  isValidCrop,
  clampCropCoordinates,
  CropData,
  PartialCropData,
} from '../cropUtils';

describe('cropUtils', () => {
  // ========================================================================
  // normalizeCropValues() - NULL/undefined handling
  // ========================================================================
  describe('normalizeCropValues', () => {
    it('should normalize all NULL values to 0.0', () => {
      const input: PartialCropData = {
        crop_top: null,
        crop_bottom: null,
        crop_left: null,
        crop_right: null,
      };
      const result = normalizeCropValues(input);
      expect(result).toEqual({
        crop_top: 0.0,
        crop_bottom: 0.0,
        crop_left: 0.0,
        crop_right: 0.0,
      });
    });

    it('should normalize all undefined values to 0.0', () => {
      const input: PartialCropData = {};
      const result = normalizeCropValues(input);
      expect(result).toEqual({
        crop_top: 0.0,
        crop_bottom: 0.0,
        crop_left: 0.0,
        crop_right: 0.0,
      });
    });

    it('should preserve existing numeric values', () => {
      const input: PartialCropData = {
        crop_top: 0.1,
        crop_bottom: 0.2,
        crop_left: 0.15,
        crop_right: 0.25,
      };
      const result = normalizeCropValues(input);
      expect(result).toEqual({
        crop_top: 0.1,
        crop_bottom: 0.2,
        crop_left: 0.15,
        crop_right: 0.25,
      });
    });

    it('should handle mixed NULL and numeric values', () => {
      const input: PartialCropData = {
        crop_top: 0.1,
        crop_bottom: null,
        crop_left: 0.2,
        crop_right: null,
      };
      const result = normalizeCropValues(input);
      expect(result).toEqual({
        crop_top: 0.1,
        crop_bottom: 0.0,
        crop_left: 0.2,
        crop_right: 0.0,
      });
    });

    it('should handle zero values correctly (not treat as falsy)', () => {
      const input: PartialCropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0,
        crop_right: 0,
      };
      const result = normalizeCropValues(input);
      expect(result).toEqual({
        crop_top: 0.0,
        crop_bottom: 0.0,
        crop_left: 0.0,
        crop_right: 0.0,
      });
    });
  });

  // ========================================================================
  // hasCrop() - Type guards and edge cases
  // ========================================================================
  describe('hasCrop', () => {
    it('should return false for all zero values', () => {
      const input: PartialCropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0,
        crop_right: 0,
      };
      expect(hasCrop(input)).toBe(false);
    });

    it('should return false for all NULL values', () => {
      const input: PartialCropData = {
        crop_top: null,
        crop_bottom: null,
        crop_left: null,
        crop_right: null,
      };
      expect(hasCrop(input)).toBe(false);
    });

    it('should return true if ANY crop value is > 0', () => {
      const testCases = [
        { crop_top: 0.1, crop_bottom: 0, crop_left: 0, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0.1, crop_left: 0, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0, crop_left: 0.1, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: 0.1 },
      ];

      testCases.forEach((input) => {
        expect(hasCrop(input)).toBe(true);
      });
    });

    it('should return true if multiple crop values > 0', () => {
      const input: PartialCropData = {
        crop_top: 0.1,
        crop_bottom: 0.2,
        crop_left: 0.15,
        crop_right: 0.25,
      };
      expect(hasCrop(input)).toBe(true);
    });

    it('should return false for empty object (undefined fields)', () => {
      const input: PartialCropData = {};
      expect(hasCrop(input)).toBe(false);
    });
  });

  // ========================================================================
  // getCropAreaPercentage() - Area calculations
  // ========================================================================
  describe('getCropAreaPercentage', () => {
    it('should return 100% for no crop (all zeros)', () => {
      const input: PartialCropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0,
        crop_right: 0,
      };
      expect(getCropAreaPercentage(input)).toBe(100);
    });

    it('should calculate 64% for 20% crop on all sides', () => {
      const input: PartialCropData = {
        crop_top: 0.2,
        crop_bottom: 0.2,
        crop_left: 0.2,
        crop_right: 0.2,
      };
      // (1 - 0.2 - 0.2) × (1 - 0.2 - 0.2) × 100 = 0.6 × 0.6 × 100 = 36%
      // Note: Corrected expected value - should be 36%, not 64%
      expect(getCropAreaPercentage(input)).toBe(36);
    });

    it('should calculate 50% for 50% horizontal crop', () => {
      const input: PartialCropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0.25,
        crop_right: 0.25,
      };
      // (1 - 0.25 - 0.25) × (1 - 0 - 0) × 100 = 0.5 × 1 × 100 = 50%
      expect(getCropAreaPercentage(input)).toBe(50);
    });

    it('should calculate 50% for 50% vertical crop', () => {
      const input: PartialCropData = {
        crop_top: 0.25,
        crop_bottom: 0.25,
        crop_left: 0,
        crop_right: 0,
      };
      // (1 - 0 - 0) × (1 - 0.25 - 0.25) × 100 = 1 × 0.5 × 100 = 50%
      expect(getCropAreaPercentage(input)).toBe(50);
    });

    it('should calculate 1% for minimum visible area', () => {
      const input: PartialCropData = {
        crop_top: 0.45,
        crop_bottom: 0.45,
        crop_left: 0.45,
        crop_right: 0.45,
      };
      // (1 - 0.45 - 0.45) × (1 - 0.45 - 0.45) × 100 = 0.1 × 0.1 × 100 = 1%
      expect(getCropAreaPercentage(input)).toBe(1);
    });

    it('should handle NULL values (normalized to 0)', () => {
      const input: PartialCropData = {
        crop_top: null,
        crop_bottom: null,
        crop_left: null,
        crop_right: null,
      };
      expect(getCropAreaPercentage(input)).toBe(100);
    });
  });

  // ========================================================================
  // isValidCrop() - Validation bounds
  // ========================================================================
  describe('isValidCrop', () => {
    it('should accept all zeros (no crop)', () => {
      const crop: CropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0,
        crop_right: 0,
      };
      expect(isValidCrop(crop)).toBe(true);
    });

    it('should accept valid crop within bounds', () => {
      const crop: CropData = {
        crop_top: 0.1,
        crop_bottom: 0.1,
        crop_left: 0.1,
        crop_right: 0.1,
      };
      expect(isValidCrop(crop)).toBe(true);
    });

    it('should reject negative values', () => {
      const testCases = [
        { crop_top: -0.1, crop_bottom: 0, crop_left: 0, crop_right: 0 },
        { crop_top: 0, crop_bottom: -0.1, crop_left: 0, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0, crop_left: -0.1, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: -0.1 },
      ];

      testCases.forEach((crop) => {
        expect(isValidCrop(crop as CropData)).toBe(false);
      });
    });

    it('should reject values > 1.0', () => {
      const testCases = [
        { crop_top: 1.1, crop_bottom: 0, crop_left: 0, crop_right: 0 },
        { crop_top: 0, crop_bottom: 1.1, crop_left: 0, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0, crop_left: 1.1, crop_right: 0 },
        { crop_top: 0, crop_bottom: 0, crop_left: 0, crop_right: 1.1 },
      ];

      testCases.forEach((crop) => {
        expect(isValidCrop(crop as CropData)).toBe(false);
      });
    });

    it('should reject horizontal sum >= 1.0', () => {
      const crop: CropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0.5,
        crop_right: 0.5,
      };
      expect(isValidCrop(crop)).toBe(false);
    });

    it('should reject vertical sum >= 1.0', () => {
      const crop: CropData = {
        crop_top: 0.5,
        crop_bottom: 0.5,
        crop_left: 0,
        crop_right: 0,
      };
      expect(isValidCrop(crop)).toBe(false);
    });

    it('should reject visible area < 10% (horizontal)', () => {
      const crop: CropData = {
        crop_top: 0,
        crop_bottom: 0,
        crop_left: 0.46,
        crop_right: 0.46,
      };
      // Remaining width: 1 - 0.46 - 0.46 = 0.08 (8% < 10%)
      expect(isValidCrop(crop)).toBe(false);
    });

    it('should reject visible area < 10% (vertical)', () => {
      const crop: CropData = {
        crop_top: 0.46,
        crop_bottom: 0.46,
        crop_left: 0,
        crop_right: 0,
      };
      // Remaining height: 1 - 0.46 - 0.46 = 0.08 (8% < 10%)
      expect(isValidCrop(crop)).toBe(false);
    });

    it('should accept minimum visible area = 10%', () => {
      const crop: CropData = {
        crop_top: 0.45,
        crop_bottom: 0.45,
        crop_left: 0.45,
        crop_right: 0.45,
      };
      // Remaining area: 0.1 × 0.1 = 1% (each dimension 10%)
      expect(isValidCrop(crop)).toBe(true);
    });
  });

  // ========================================================================
  // clampCropCoordinates() - Floating-point edge cases
  // ========================================================================
  describe('clampCropCoordinates', () => {
    it('should preserve values within bounds', () => {
      const crop: CropData = {
        crop_top: 0.5,
        crop_bottom: 0.3,
        crop_left: 0.2,
        crop_right: 0.4,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual(crop);
    });

    it('should clamp negative values to 0.0', () => {
      const crop: CropData = {
        crop_top: -0.1,
        crop_bottom: -0.2,
        crop_left: -0.15,
        crop_right: -0.25,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual({
        crop_top: 0.0,
        crop_bottom: 0.0,
        crop_left: 0.0,
        crop_right: 0.0,
      });
    });

    it('should clamp values > 1.0 to 0.999', () => {
      const crop: CropData = {
        crop_top: 1.1,
        crop_bottom: 1.05,
        crop_left: 1.2,
        crop_right: 1.001,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual({
        crop_top: 0.999,
        crop_bottom: 0.999,
        crop_left: 0.999,
        crop_right: 0.999,
      });
    });

    it('should clamp exactly 1.0 to 0.999 (edge case)', () => {
      const crop: CropData = {
        crop_top: 1.0,
        crop_bottom: 1.0,
        crop_left: 1.0,
        crop_right: 1.0,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual({
        crop_top: 0.999,
        crop_bottom: 0.999,
        crop_left: 0.999,
        crop_right: 0.999,
      });
    });

    it('should clamp floating-point rounding near 1.0', () => {
      const crop: CropData = {
        crop_top: 0.9999,
        crop_bottom: 0.99999,
        crop_left: 0.999999,
        crop_right: 1.0000001,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual({
        crop_top: 0.999,
        crop_bottom: 0.999,
        crop_left: 0.999,
        crop_right: 0.999,
      });
    });

    it('should handle mixed valid and invalid values', () => {
      const crop: CropData = {
        crop_top: 0.5,
        crop_bottom: -0.1,
        crop_left: 1.1,
        crop_right: 0.3,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual({
        crop_top: 0.5,
        crop_bottom: 0.0,
        crop_left: 0.999,
        crop_right: 0.3,
      });
    });

    it('should accept 0.999 as valid (not clamp further)', () => {
      const crop: CropData = {
        crop_top: 0.999,
        crop_bottom: 0.999,
        crop_left: 0.999,
        crop_right: 0.999,
      };
      const result = clampCropCoordinates(crop);
      expect(result).toEqual(crop);
    });
  });

  // ========================================================================
  // Integration Tests - Combined behavior
  // ========================================================================
  describe('Integration - Combined behavior', () => {
    it('should validate after clamping (full workflow)', () => {
      // Simulate PhotoCropEditor workflow
      const rawCrop: CropData = {
        crop_top: 0.9999,  // Floating-point rounding
        crop_bottom: 0.1,
        crop_left: 0.1,
        crop_right: 0.1,
      };

      const clampedCrop = clampCropCoordinates(rawCrop);
      expect(clampedCrop.crop_top).toBe(0.999);  // Clamped
      expect(isValidCrop(clampedCrop)).toBe(false);  // Still invalid (sum >= 1.0)
    });

    it('should normalize NULL then validate', () => {
      const input: PartialCropData = {
        crop_top: null,
        crop_bottom: null,
        crop_left: null,
        crop_right: null,
      };

      const normalized = normalizeCropValues(input);
      expect(hasCrop(normalized)).toBe(false);
      expect(getCropAreaPercentage(normalized)).toBe(100);
      expect(isValidCrop(normalized)).toBe(true);
    });

    it('should handle old database profile (all NULL)', () => {
      const oldProfile: PartialCropData = {
        crop_top: null,
        crop_bottom: null,
        crop_left: null,
        crop_right: null,
      };

      const crop = normalizeCropValues(oldProfile);
      expect(hasCrop(crop)).toBe(false);  // No crop applied
      expect(isValidCrop(crop)).toBe(true);  // Valid (all zeros)
    });
  });
});
