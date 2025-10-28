/**
 * Photo Crop Utilities
 *
 * Utilities for handling photo crop data with NULL/undefined handling
 * for backwards compatibility with older database entries.
 *
 * Crop Format:
 * - All values normalized to 0.0-1.0 range
 * - 0.0 = no crop from that edge
 * - 0.25 = crop 25% from that edge
 * - Values stored in database as NUMERIC(4,3)
 *
 * Created: 2025-10-27
 */

/**
 * Crop data structure (normalized 0.0-1.0)
 */
export interface CropData {
  crop_top: number;
  crop_bottom: number;
  crop_left: number;
  crop_right: number;
}

/**
 * Partial crop data from profile (may have null/undefined)
 */
export interface PartialCropData {
  crop_top?: number | null;
  crop_bottom?: number | null;
  crop_left?: number | null;
  crop_right?: number | null;
}

/**
 * Normalize crop values for backwards compatibility
 *
 * Handles NULL, undefined, and missing crop fields from older database
 * entries by converting them to 0.0 (no crop).
 *
 * Why Needed:
 * - Old profiles may have NULL crop values (before migration)
 * - Structure RPC may return undefined for non-enriched nodes
 * - Frontend needs consistent numeric values for calculations
 *
 * @param profile - Profile with optional crop fields
 * @returns Normalized crop data with guaranteed numeric values
 *
 * @example
 * const profile = { crop_top: null, crop_bottom: 0.1 }; // Old database entry
 * const crop = normalizeCropValues(profile);
 * // Returns: { crop_top: 0.0, crop_bottom: 0.1, crop_left: 0.0, crop_right: 0.0 }
 */
export function normalizeCropValues(profile: PartialCropData): CropData {
  return {
    crop_top: profile.crop_top ?? 0.0,
    crop_bottom: profile.crop_bottom ?? 0.0,
    crop_left: profile.crop_left ?? 0.0,
    crop_right: profile.crop_right ?? 0.0,
  };
}

/**
 * Check if profile has any crop applied
 *
 * Returns true if ANY of the 4 crop values is greater than 0.
 * Used to determine if GPU crop rendering should be applied.
 *
 * Performance Note:
 * - This is a guard function for useMemo dependencies
 * - Prevents unnecessary GPU crop operations when crop = 0.0
 * - Skips makeImageFromRect() when no crop is needed
 *
 * @param profile - Profile with crop fields
 * @returns true if profile has any crop (> 0.0), false otherwise
 *
 * @example
 * hasCrop({ crop_top: 0.0, crop_bottom: 0.0, crop_left: 0.0, crop_right: 0.0 }) // false
 * hasCrop({ crop_top: 0.1, crop_bottom: 0.0, crop_left: 0.0, crop_right: 0.0 }) // true
 * hasCrop({ crop_top: null, crop_bottom: null, crop_left: null, crop_right: null }) // false
 */
export function hasCrop(profile: PartialCropData): boolean {
  const crop = normalizeCropValues(profile);
  return crop.crop_top > 0 || crop.crop_bottom > 0 || crop.crop_left > 0 || crop.crop_right > 0;
}

/**
 * Calculate visible area percentage after crop
 *
 * Returns the percentage of the original image that remains visible
 * after applying crop values.
 *
 * Formula: (1 - left - right) × (1 - top - bottom) × 100
 *
 * @param profile - Profile with crop fields
 * @returns Visible area percentage (0-100)
 *
 * @example
 * getCropAreaPercentage({ crop_top: 0.1, crop_bottom: 0.1, crop_left: 0.1, crop_right: 0.1 })
 * // Returns: 64 (0.8 × 0.8 × 100)
 */
export function getCropAreaPercentage(profile: PartialCropData): number {
  const crop = normalizeCropValues(profile);
  const widthRatio = 1.0 - crop.crop_left - crop.crop_right;
  const heightRatio = 1.0 - crop.crop_top - crop.crop_bottom;
  return widthRatio * heightRatio * 100;
}

/**
 * Clamp crop coordinates to prevent floating-point edge cases
 *
 * Ensures all crop values are within safe bounds (0.000-0.999) to prevent
 * validation failures from floating-point rounding (e.g., 0.9999 → 1.000).
 *
 * Why Needed:
 * - JavaScript floating-point arithmetic can cause rounding issues
 * - Values exactly equal to 1.0 fail validation (>= 1.0 check)
 * - Clamping to 0.999 max prevents edge case validation failures
 *
 * Performance Note:
 * - Called before validation in PhotoCropEditor.handleSave()
 * - Prevents user-facing error from floating-point precision
 *
 * @param crop - Crop data to clamp
 * @returns Clamped crop data with all values in 0.000-0.999 range
 *
 * @example
 * const crop = { crop_top: 0.9999, crop_bottom: 1.001, crop_left: -0.01, crop_right: 0.5 };
 * const clamped = clampCropCoordinates(crop);
 * // Returns: { crop_top: 0.999, crop_bottom: 0.999, crop_left: 0.0, crop_right: 0.5 }
 */
export function clampCropCoordinates(crop: CropData): CropData {
  const clamp = (value: number) => Math.max(0.0, Math.min(0.999, value));

  return {
    crop_top: clamp(crop.crop_top),
    crop_bottom: clamp(crop.crop_bottom),
    crop_left: clamp(crop.crop_left),
    crop_right: clamp(crop.crop_right),
  };
}

/**
 * Validate crop values are within bounds
 *
 * Checks that:
 * 1. All values are between 0.0 and 1.0
 * 2. Horizontal crop (left + right) < 1.0
 * 3. Vertical crop (top + bottom) < 1.0
 * 4. Remaining visible area >= 10%
 *
 * @param crop - Crop data to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidCrop({ crop_top: 0.5, crop_bottom: 0.5, crop_left: 0.0, crop_right: 0.0 })
 * // Returns: false (top + bottom = 1.0, exceeds bounds)
 */
export function isValidCrop(crop: CropData): boolean {
  // Range check (0.0-1.0)
  if (crop.crop_top < 0 || crop.crop_top > 1) return false;
  if (crop.crop_bottom < 0 || crop.crop_bottom > 1) return false;
  if (crop.crop_left < 0 || crop.crop_left > 1) return false;
  if (crop.crop_right < 0 || crop.crop_right > 1) return false;

  // Bounds check (sum must be < 1.0)
  if (crop.crop_left + crop.crop_right >= 1.0) return false;
  if (crop.crop_top + crop.crop_bottom >= 1.0) return false;

  // Minimum visible area check (10%)
  const widthRatio = 1.0 - crop.crop_left - crop.crop_right;
  const heightRatio = 1.0 - crop.crop_top - crop.crop_bottom;
  if (widthRatio < 0.1 || heightRatio < 0.1) return false;

  return true;
}
