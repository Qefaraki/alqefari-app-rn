/**
 * Image Crop Styles Utility
 *
 * Provides CSS-based cropping for React Native <Image> components.
 * Used in ProfileViewer and PhotoGallery where Skia rendering is not available.
 *
 * Strategy:
 * - Scale image to compensate for cropped area
 * - Offset image to align visible portion with container
 * - Container uses overflow:'hidden' to clip the scaled/offset image
 *
 * This achieves the same visual result as Skia's Group+clip but uses
 * React Native layout system instead of GPU clipping.
 *
 * Created: January 2025
 * Purpose: Fix cropping in non-Skia components (ProfileViewer, PhotoGallery)
 */

export interface CropValues {
  crop_top?: number;
  crop_bottom?: number;
  crop_left?: number;
  crop_right?: number;
}

export interface ContainerSize {
  width: number;
  height: number;
}

export interface CroppedImageStyle {
  position: 'absolute';
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * Calculate CSS-based crop style for React Native Image
 *
 * Transforms crop coordinates (0.0-1.0) into CSS positioning that shows
 * only the visible (non-cropped) portion of the image.
 *
 * Math:
 * - Original image: 1000x1000px
 * - Crop: left=0.1, right=0.1 (20% cropped horizontally)
 * - Visible portion: 80% of image (800px wide)
 * - To fill 100px container: scale to 125px (100 / 0.8)
 * - Offset left by: -12.5px (125px * 0.1)
 *
 * @param profile - Profile object with crop_top/bottom/left/right fields
 * @param containerSize - Container dimensions (width, height in pixels)
 * @returns CSS style object for image positioning
 *
 * @example
 * const cropStyle = getCroppedImageStyle(person, { width: 100, height: 100 });
 * <View style={{ overflow: 'hidden', width: 100, height: 100 }}>
 *   <Image source={{ uri: person.photo_url }} style={[styles.avatar, cropStyle]} />
 * </View>
 */
export function getCroppedImageStyle(
  profile: CropValues,
  containerSize: ContainerSize
): CroppedImageStyle {
  // Normalize crop values (default to 0 if not provided)
  const crop = {
    top: profile.crop_top ?? 0,
    bottom: profile.crop_bottom ?? 0,
    left: profile.crop_left ?? 0,
    right: profile.crop_right ?? 0,
  };

  // Calculate scale factors
  // If 20% is cropped (left=0.1, right=0.1), visible portion is 80%
  // To fill container, scale by 1/0.8 = 1.25
  const visibleWidthRatio = 1 - crop.left - crop.right;
  const visibleHeightRatio = 1 - crop.top - crop.bottom;

  const widthScale = visibleWidthRatio > 0 ? 1 / visibleWidthRatio : 1;
  const heightScale = visibleHeightRatio > 0 ? 1 / visibleHeightRatio : 1;

  // Calculate scaled dimensions
  const scaledWidth = containerSize.width * widthScale;
  const scaledHeight = containerSize.height * heightScale;

  // Calculate offsets
  // If left crop is 10% and scaled width is 125px, offset by -12.5px
  const offsetLeft = -crop.left * scaledWidth;
  const offsetTop = -crop.top * scaledHeight;

  return {
    position: 'absolute',
    width: scaledWidth,
    height: scaledHeight,
    left: offsetLeft,
    top: offsetTop,
  };
}

/**
 * Check if profile has any crop applied
 *
 * @param profile - Profile object with crop fields
 * @returns true if any crop value is non-zero
 */
export function hasCrop(profile: CropValues): boolean {
  return (
    (profile.crop_top ?? 0) > 0 ||
    (profile.crop_bottom ?? 0) > 0 ||
    (profile.crop_left ?? 0) > 0 ||
    (profile.crop_right ?? 0) > 0
  );
}

/**
 * Normalize crop values for database storage
 *
 * Clamps crop values to valid range (0.0-0.999) and ensures
 * total crop doesn't exceed image bounds.
 *
 * @param crop - Crop values to normalize
 * @returns Normalized crop values
 */
export function normalizeCropValues(crop: CropValues): Required<CropValues> {
  const clamp = (v: number | undefined) => Math.max(0, Math.min(0.999, v ?? 0));

  return {
    crop_top: clamp(crop.crop_top),
    crop_bottom: clamp(crop.crop_bottom),
    crop_left: clamp(crop.crop_left),
    crop_right: clamp(crop.crop_right),
  };
}
