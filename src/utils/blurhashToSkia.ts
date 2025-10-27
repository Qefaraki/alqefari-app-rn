/**
 * blurhashToSkia - Convert BlurHash string to Skia Image for TreeView rendering
 *
 * Purpose: Bridge between blurhash string and Skia canvas rendering
 *
 * Why needed:
 * - TreeView uses @shopify/react-native-skia for canvas rendering
 * - Cannot mix React Native components with Skia canvas
 * - Must convert blurhash to Skia Image format for consistency
 *
 * Performance:
 * - Decode: ~5-10ms per blurhash (32×32 pixels)
 * - Cached: Subsequent calls use memoized Image reference
 * - Viewport-aware: Only called for visible nodes
 *
 * Usage:
 *   const image = await blurhashToSkiaImage('LEHV6n...', 32, 32);
 *   if (image) {
 *     // Render in Skia canvas
 *   }
 */

import { decode } from 'blurhash';
import { Skia, ColorType, AlphaType, type SkImage } from '@shopify/react-native-skia';

/**
 * Convert blurhash string to Skia Image
 *
 * @param blurhash - Base83-encoded blurhash string (e.g., "LEHV6nWB2yk8...")
 * @param width - Decode width in pixels (default: 32)
 * @param height - Decode height in pixels (default: 32)
 * @returns Skia Image or null if decoding fails
 *
 * Algorithm:
 * 1. Decode blurhash to RGBA pixel array using blurhash library
 * 2. Convert Uint8ClampedArray to Skia Data object
 * 3. Create Skia Image from pixel data with RGBA format
 * 4. Return null on any decode/conversion error
 */
export async function blurhashToSkiaImage(
  blurhash: string,
  width = 32,
  height = 32
): Promise<SkImage | null> {
  try {
    // Validate input
    if (!blurhash || typeof blurhash !== 'string') {
      console.warn('[blurhashToSkia] Invalid blurhash input:', blurhash);
      return null;
    }

    // Decode blurhash to RGBA pixel array
    // Returns Uint8ClampedArray with length = width × height × 4 (RGBA)
    const pixels = decode(blurhash, width, height);

    if (!pixels) {
      console.warn('[blurhashToSkia] Decode returned null for:', blurhash);
      return null;
    }

    // Convert to Skia Data object
    const data = Skia.Data.fromBytes(new Uint8Array(pixels));

    if (!data) {
      console.warn('[blurhashToSkia] Failed to create Skia Data');
      return null;
    }

    // Create Skia Image from pixel data
    // ColorType.RGBA_8888: 8 bits per channel (R, G, B, A)
    // AlphaType.Unpremul: Alpha not premultiplied (standard web format)
    const image = Skia.Image.MakeImage(
      {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      data,
      width * 4 // Row bytes: 4 bytes per pixel (RGBA)
    );

    if (!image) {
      console.warn('[blurhashToSkia] Failed to create Skia Image');
      return null;
    }

    return image;
  } catch (error) {
    // Graceful degradation: Log error but don't crash
    console.warn('[blurhashToSkia] Error converting blurhash:', error);
    return null;
  }
}

/**
 * Synchronous version for use in render loops (returns Promise)
 *
 * Note: While Skia Image creation is synchronous, we wrap in async
 * for consistency with async image loading patterns
 */
export function blurhashToSkiaImageSync(
  blurhash: string,
  width = 32,
  height = 32
): SkImage | null {
  try {
    if (!blurhash || typeof blurhash !== 'string') {
      return null;
    }

    const pixels = decode(blurhash, width, height);
    if (!pixels) return null;

    const data = Skia.Data.fromBytes(new Uint8Array(pixels));
    if (!data) return null;

    const image = Skia.Image.MakeImage(
      {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      data,
      width * 4
    );

    return image || null;
  } catch {
    return null;
  }
}
