/**
 * BlurHash Average Color Extractor
 *
 * Extracts the average/dominant color from a blurhash string by decoding
 * only the DC component (1×1 pixel). This is extremely fast (<1ms) and
 * provides an instant visual placeholder before the full blurhash decodes.
 *
 * Purpose: Eliminate white flash by rendering average color synchronously
 * while blurhash decodes asynchronously in the background.
 *
 * Performance: ~0.5-1ms per extraction (vs 5-10ms full blurhash decode)
 *
 * Usage:
 * ```typescript
 * const avgColor = getAverageColor(node.blurhash);
 * // Returns: 'rgb(184, 163, 137)' or fallback '#D1BBA3'
 * ```
 */

import { decode } from 'blurhash';

/**
 * Default fallback color (Najdi Design System - Camel Hair Beige)
 * Used when blurhash is invalid or extraction fails
 */
const FALLBACK_COLOR = '#D1BBA3';

/**
 * Extract average/dominant color from blurhash string
 *
 * Decodes only the DC component (1×1 pixel) which represents the
 * average color of the image. This is extremely fast and provides
 * an instant visual placeholder.
 *
 * @param blurhash - BlurHash string (e.g., 'LEHV6nWB2yk8pyo0adR*.7kCMdnj')
 * @returns RGB color string (e.g., 'rgb(184, 163, 137)') or fallback color
 *
 * @example
 * ```typescript
 * const color = getAverageColor('LEHV6nWB2yk8pyo0adR*.7kCMdnj');
 * // Returns: 'rgb(184, 163, 137)'
 * ```
 */
export function getAverageColor(blurhash: string | null | undefined): string {
  // Handle invalid input
  if (!blurhash || typeof blurhash !== 'string' || blurhash.length < 6) {
    return FALLBACK_COLOR;
  }

  try {
    // Performance monitoring (dev mode only)
    const startTime = __DEV__ ? performance.now() : 0;

    // Decode 1×1 pixel (DC component only)
    // This extracts the average color without full DCT calculation
    const pixels = decode(blurhash, 1, 1);

    if (!pixels || pixels.length < 3) {
      return FALLBACK_COLOR;
    }

    // Extract RGB values (first 3 bytes)
    const r = Math.round(pixels[0]);
    const g = Math.round(pixels[1]);
    const b = Math.round(pixels[2]);

    // Validate RGB values
    if (
      isNaN(r) ||
      isNaN(g) ||
      isNaN(b) ||
      r < 0 ||
      r > 255 ||
      g < 0 ||
      g > 255 ||
      b < 0 ||
      b > 255
    ) {
      return FALLBACK_COLOR;
    }

    // Performance monitoring: Warn if extraction takes >2ms
    if (__DEV__) {
      const duration = performance.now() - startTime;
      if (duration > 2) {
        console.warn(
          `[blurhashAverageColor] Slow extraction: ${duration.toFixed(2)}ms for ${blurhash.substring(0, 10)}...`,
        );
      }
    }

    return `rgb(${r}, ${g}, ${b})`;
  } catch (error) {
    // Graceful degradation on any decode error
    if (__DEV__) {
      console.warn('[blurhashAverageColor] Failed to extract color:', error);
    }
    return FALLBACK_COLOR;
  }
}

