/**
 * Color utility functions for TreeView
 * Phase 1 Day 2 - Utility extraction
 */

/**
 * Convert hex color to rgba string
 * @param hex - Hex color (e.g., '#A13333')
 * @param alpha - Alpha value 0-1
 * @returns RGBA string (e.g., 'rgba(161, 51, 51, 0.5)')
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create ColorMatrix for dimming images (dark mode)
 * @param factor - Dimming factor (0.85 = 15% darker)
 * @returns ColorMatrix array for Skia ColorMatrix filter
 */
export function createDimMatrix(factor: number = 0.85): number[] {
  return [
    factor, 0,      0,      0, 0,
    0,      factor, 0,      0, 0,
    0,      0,      factor, 0, 0,
    0,      0,      0,      1, 0,
  ];
}

/**
 * Create ColorMatrix for grayscale conversion (deceased photos)
 * Uses ITU-R BT.709 luminosity method for perceptually accurate grayscale
 * @returns ColorMatrix array for Skia ColorMatrix filter
 */
export function createGrayscaleMatrix(): number[] {
  // ITU-R BT.709 coefficients (perceptually weighted)
  const r = 0.2126;
  const g = 0.7152;
  const b = 0.0722;

  return [
    r, g, b, 0, 0, // Red channel
    r, g, b, 0, 0, // Green channel
    r, g, b, 0, 0, // Blue channel
    0, 0, 0, 1, 0, // Alpha channel (preserved)
  ];
}

/**
 * Interpolate between two hex colors
 * @param color1 - Start color (hex)
 * @param color2 - End color (hex)
 * @param progress - Interpolation progress (0-1)
 * @returns Interpolated hex color
 */
export function interpolateColor(
  color1: string,
  color2: string,
  progress: number
): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
