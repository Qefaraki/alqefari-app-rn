/**
 * ImageNode - Photo avatar rendering with LOD
 *
 * Phase 2 Day 5 - Extracted from TreeView.js (lines 350-428)
 *
 * Renders square avatar photos with rounded corners for tree nodes with LOD-aware loading.
 * Integrates with ImageBuckets for resolution selection and batched loading.
 *
 * LOD Integration:
 * - Tier 1: Load image at appropriate bucket size
 * - Tier 2/3: Return null (photos hidden)
 *
 * Loading States:
 * 1. **Hidden**: showPhotos=false or tier > 1 → returns null
 * 2. **Skeleton**: Image loading → Shows placeholder rounded square
 * 3. **Loaded**: Image ready → Displays with rounded square mask
 *
 * Performance Optimizations:
 * - Bucket selection: 40/60/80/120/256px based on screen pixels
 * - Hysteresis: Prevents bucket thrashing during zoom
 * - Batched loading: useBatchedSkiaImage with priority
 * - Rounded square mask: RoundedRect with 10px corner radius (matches card)
 *
 * Design Constraints (Najdi Sadu):
 * - Skeleton: Camel Hair Beige with 20% opacity (#D1BBA320)
 * - Corner radius: 10px (matches card corner radius)
 * - Fit: cover (maintains aspect ratio, fills square)
 *
 * KNOWN PATTERNS (AS-IS for Phase 2):
 * - Uses useBatchedSkiaImage (custom hook from TreeView)
 * - Needs to be imported or extracted separately
 * - Debug logging with 1% sample rate (Math.random)
 */

import React from 'react';
import { PixelRatio } from 'react-native';
import { Group, RoundedRect, rrect, rect, Image as SkiaImage } from '@shopify/react-native-skia';
import { IMAGE_BUCKETS } from './nodeConstants';
import { usePhotoMorphTransition } from '../../../hooks/usePhotoMorphTransition';
import { blurhashToSkiaImage } from '../../../utils/blurhashToSkia';
import { featureFlags } from '../../../config/featureFlags';

export interface ImageNodeProps {
  // Image source
  url: string;

  // BlurHash placeholder string (optional, for progressive loading)
  blurhash?: string;

  // Position and size (top-left corner)
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number; // Corner radius for rounded square

  // LOD tier (1, 2, or 3)
  tier: number;

  // Current scale for bucket selection and morph animation threshold
  scale: number;

  // Node ID for hysteresis tracking
  nodeId: string;

  // Bucket selection function (optional, for hysteresis)
  selectBucket?: (nodeId: string, pixelSize: number) => number;

  // Global photo visibility toggle
  showPhotos?: boolean;

  // Batched image loading hook with morph tracking
  useBatchedSkiaImage: (
    url: string,
    bucket: number | null,
    priority: string
  ) => any;
}

/**
 * Calculate pixel size for bucket selection
 *
 * Determines physical screen pixels needed for image.
 * Used to select appropriate image resolution bucket.
 *
 * Formula: width * device_pixel_ratio * zoom_scale
 *
 * @param width - Image width in logical pixels
 * @param scale - Current zoom scale
 * @returns Physical pixel size
 */
export function calculatePixelSize(width: number, scale: number): number {
  return width * PixelRatio.get() * scale;
}

/**
 * Select image bucket size
 *
 * Chooses closest bucket that meets or exceeds pixel size.
 * Uses 1.2x multiplier to balance quality with performance.
 *
 * @param pixelSize - Required pixel size
 * @param imageBuckets - Available bucket sizes (default: imported from constants)
 * @returns Selected bucket size
 */
export function selectImageBucket(
  pixelSize: number,
  imageBuckets: readonly number[] = IMAGE_BUCKETS
): number {
  // Use 1.2x multiplier instead of 2x to avoid over-fetching
  // PixelRatio.get() already accounts for device retina, don't double-apply
  const targetSize = pixelSize * 1.2;
  return imageBuckets.find((b) => b >= targetSize) || 1024;
}

/**
 * Should load image
 *
 * Determines whether to load image based on LOD tier and visibility settings.
 *
 * Loading criteria:
 * - Tier must be 1 (full detail)
 * - URL must be provided
 * - showPhotos must be true
 *
 * @param tier - LOD tier (1, 2, or 3)
 * @param url - Image URL
 * @param showPhotos - Global photo visibility toggle
 * @returns True if image should be loaded
 */
export function shouldLoadImage(
  tier: number,
  url: string | undefined,
  showPhotos: boolean
): boolean {
  return tier === 1 && !!url && showPhotos;
}

/**
 * Render image skeleton placeholder
 *
 * Shows placeholder while image loads.
 * Uses Najdi design colors for consistency.
 *
 * @param x - Top-left X position
 * @param y - Top-left Y position
 * @param size - Square size (width and height)
 * @param cornerRadius - Corner radius for rounded square
 * @returns Group with skeleton rounded square
 */
export function renderImageSkeleton(
  x: number,
  y: number,
  size: number,
  cornerRadius: number
): JSX.Element {
  return (
    <Group>
      {/* Base rounded square background */}
      <RoundedRect
        x={x}
        y={y}
        width={size}
        height={size}
        r={cornerRadius}
        color={IMAGE_NODE_CONSTANTS.SKELETON_COLOR}
      />
      {/* Inner stroke for depth */}
      <RoundedRect
        x={x + 1}
        y={y + 1}
        width={size - 2}
        height={size - 2}
        r={cornerRadius - 1}
        color={IMAGE_NODE_CONSTANTS.SKELETON_STROKE_COLOR}
        style="stroke"
        strokeWidth={IMAGE_NODE_CONSTANTS.SKELETON_STROKE_WIDTH}
      />
    </Group>
  );
}

/**
 * Render loaded image with rounded square clipping
 *
 * Displays image clipped to rounded square shape.
 * Uses Group.clip for clean edge rendering.
 *
 * @param image - Loaded Skia image
 * @param x - Top-left X position
 * @param y - Top-left Y position
 * @param width - Image width
 * @param height - Image height
 * @param cornerRadius - Corner radius for rounded square clipping
 * @param opacity - Optional opacity shared value for animations
 * @returns Group with clipped image
 */
export function renderLoadedImage(
  image: any,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
  opacity?: any
): JSX.Element {
  const clipPath = rrect(rect(x, y, width, height), cornerRadius, cornerRadius);
  return (
    <Group clip={clipPath} opacity={opacity}>
      <SkiaImage
        image={image}
        x={x}
        y={y}
        width={width}
        height={height}
        fit="cover"
      />
    </Group>
  );
}

/**
 * Render dual images with crossfade + scale pop morph transition
 *
 * Shows low-res image fading out while high-res image fades in with subtle scale animation.
 * Creates smooth quality upgrade effect at extreme zoom levels.
 *
 * @param lowResImage - Current lower-quality image
 * @param highResImage - Higher-quality image that loaded
 * @param x - Top-left X position
 * @param y - Top-left Y position
 * @param width - Image width
 * @param height - Image height
 * @param cornerRadius - Corner radius for rounded square clipping
 * @param lowResOpacity - Animated opacity for low-res (1 → 0)
 * @param highResOpacity - Animated opacity for high-res (0 → 1)
 * @param highResScale - Animated scale for high-res (0.98 → 1.0)
 * @returns Group with both images and animations
 */
export function renderMorphTransition(
  lowResImage: any,
  highResImage: any,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
  lowResOpacity: any,
  highResOpacity: any,
  highResScale: any
): JSX.Element {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const clipPath = rrect(rect(x, y, width, height), cornerRadius, cornerRadius);

  return (
    <Group>
      {/* Low-res image fading out */}
      <Group clip={clipPath} opacity={lowResOpacity}>
        <SkiaImage
          image={lowResImage}
          x={x}
          y={y}
          width={width}
          height={height}
          fit="cover"
        />
      </Group>

      {/* High-res image fading in with scale pop */}
      <Group opacity={highResOpacity}>
        <Group
          clip={clipPath}
          origin={{
            x: centerX,
            y: centerY,
          }}
          transform={[{ scaleX: highResScale }, { scaleY: highResScale }]}
        >
          <SkiaImage
            image={highResImage}
            x={x}
            y={y}
            width={width}
            height={height}
            fit="cover"
          />
        </Group>
      </Group>
    </Group>
  );
}

/**
 * ImageNode component
 *
 * Renders square avatar photo with rounded corners (10px radius matching card).
 * Features LOD-aware loading and morph transitions.
 * Features:
 * - Progressive loading: thumbnail → high-res
 * - Morph animation: smooth crossfade + scale pop at extreme zoom (scale >= 3.0)
 * - Returns null if photos hidden or tier > 1
 *
 * @param props - ImageNode props
 * @returns Group with image/skeleton/morph animation or null
 */
export const ImageNode: React.FC<ImageNodeProps> = React.memo(
  ({
    url,
    blurhash,
    x,
    y,
    width,
    height,
    cornerRadius,
    tier,
    scale,
    nodeId,
    selectBucket,
    showPhotos = true,
    useBatchedSkiaImage,
  }) => {
    const renderCountRef = React.useRef(0);
    const lastBucketRef = React.useRef<number | null>(null);
    const lastIsUpgradingRef = React.useRef(false);
    const previousImageRef = React.useRef<any>(null); // Track previous image for morph transitions
    const blurhashImageRef = React.useRef<any>(null); // BlurHash Skia Image

    // Determine if image should load
    const shouldLoad = shouldLoadImage(tier, url, showPhotos);

    // Convert blurhash to Skia Image (only if feature enabled and no photo loaded yet)
    React.useEffect(() => {
      if (featureFlags.enableBlurhash && blurhash && !blurhashImageRef.current && shouldLoad) {
        blurhashToSkiaImage(blurhash, 32, 32).then((img) => {
          if (img) {
            blurhashImageRef.current = img;
            // Verbose log disabled to reduce console spam
            // if (__DEV__) {
            //   console.log(`[BlurHash] ${nodeId}: Converted blurhash to Skia Image`);
            // }
          }
        });
      }
    }, [blurhash, shouldLoad, nodeId]);

    // Calculate physical pixel size
    const pixelSize = calculatePixelSize(width, scale);

    // Select bucket (with hysteresis if function provided)
    const bucket = shouldLoad
      ? selectBucket && nodeId
        ? selectBucket(nodeId, pixelSize)
        : selectImageBucket(pixelSize)
      : null;

    // Log bucket selection changes - debug only
    React.useEffect(() => {
      if (__DEV__ && false && bucket !== lastBucketRef.current) { // Disabled to reduce spam
        console.log(
          `[ImageNode] ${nodeId}: Bucket changed: ${lastBucketRef.current || 'init'} → ${bucket}px (pixelSize: ${pixelSize.toFixed(0)}, scale: ${scale.toFixed(1)})`
        );
      }
      lastBucketRef.current = bucket;
    }, [bucket, nodeId, pixelSize, scale]);

    // Debug bucket math at high zoom levels (disabled to reduce spam)
    React.useEffect(() => {
      if (__DEV__ && false && scale >= 2.5) {
        const targetSize = pixelSize * 1.2;
        console.log(
          `[ImageNode] ${nodeId}: HIGH ZOOM scale=${scale.toFixed(2)}, width=${width}, pixelSize=${pixelSize.toFixed(0)}, targetSize=${targetSize.toFixed(0)}, bucket=${bucket}px`
        );
      }
    }, [scale, bucket, pixelSize, nodeId, width]);

    // Load image with batched loading and upgrade tracking
    const imageResult = shouldLoad ? useBatchedSkiaImage(url, bucket, 'visible') : null;

    // Handle different return types from hook
    // Support both old signature (SkImage | null) and new signature ({ image, isUpgrading, currentBucket })
    const image = imageResult?.image !== undefined ? imageResult.image : imageResult;
    const isUpgrading = imageResult?.isUpgrading || false;
    const currentBucket = imageResult?.currentBucket || null;

    // Track previous image for morph transitions
    React.useEffect(() => {
      if (isUpgrading && image) {
        // When upgrade happens, the current image becomes the "high-res" image
        // We need to get the previous lower-res image from cache
        const previousBucket = lastBucketRef.current;
        if (previousBucket && previousBucket < (currentBucket || 0)) {
          // Try to get the previous bucket's image from cache for crossfade
          import('../../../services/skiaImageCache').then((module) => {
            const skiaImageCache = module.default;
            const previousUrl = skiaImageCache.urlForBucket(url, previousBucket);
            const previousImage = skiaImageCache.get(previousUrl);
            if (previousImage) {
              previousImageRef.current = previousImage;
              // Verbose log disabled to reduce console spam
              // if (__DEV__) {
              //   console.log(
              //     `[PhotoMorph] ${nodeId}: Transition ready: ${previousBucket}px → ${currentBucket}px`
              //   );
              // }
            }
          });
        }
      }
      
      // Log upgrade flag changes - debug only (disabled to reduce spam)
      if (__DEV__ && false && isUpgrading !== lastIsUpgradingRef.current) {
        console.log(
          `[ImageNode] ${nodeId}: Upgrade flag: ${lastIsUpgradingRef.current} → ${isUpgrading} (currentBucket: ${currentBucket}px)`
        );
      }
      lastIsUpgradingRef.current = isUpgrading;
    }, [isUpgrading, nodeId, currentBucket, image, url]);

    // Morph animation - only triggers at extreme zoom
    const { lowResOpacity, highResOpacity, highResScale, isAnimating } =
      usePhotoMorphTransition(isUpgrading, scale, true);
    
    // Clear previous image after animation completes to prevent memory leaks
    React.useEffect(() => {
      if (!isAnimating && previousImageRef.current) {
        const timer = setTimeout(() => {
          previousImageRef.current = null;
          // Verbose log disabled to reduce console spam
          // if (__DEV__) {
          //   console.log(`[PhotoMorph] ${nodeId}: Cleared previous image after transition`);
          // }
        }, 100); // Small delay to ensure animation finished
        return () => clearTimeout(timer);
      }
    }, [isAnimating, nodeId]);

    // Render count logging disabled to reduce spam
    // React.useEffect(() => {
    //   renderCountRef.current++;
    //   if (__DEV__ && renderCountRef.current % 20 === 0) {
    //     console.log(
    //       `[ImageNode] ${nodeId}: Render #${renderCountRef.current} (image loaded: ${!!image}, isAnimating: ${isAnimating})`
    //     );
    //   }
    // });

    // For morph animation: we need to render two versions of the image
    // Low-res: the currently displayed image (fading out)
    // High-res: the new higher-quality image (fading in with scale)
    // This only matters when bucket increased and animation is happening

    // Return null if photos hidden
    if (!shouldLoad) {
      return null;
    }

    // State 1: Skeleton (no blurhash, no image)
    // Show gray placeholder while both blurhash and image are loading
    if (!image && !blurhashImageRef.current) {
      return renderImageSkeleton(x, y, width, cornerRadius);
    }

    // State 2: Blurhash (has blurhash, no image yet)
    // Show blurred placeholder while high-res image loads
    if (!image && blurhashImageRef.current) {
      // Verbose log disabled to reduce console spam
      // if (__DEV__) {
      //   console.log(`[BlurHash] ${nodeId}: Rendering blurhash placeholder`);
      // }
      // Render blurhash with 90% opacity to distinguish from final photo
      return renderLoadedImage(
        blurhashImageRef.current,
        x,
        y,
        width,
        height,
        cornerRadius,
        0.9
      );
    }

    // State 3: Photo loaded
    // Show loaded image with optional morph animation
    // Use morph transition if we have both images and animation is active
    const previousImage = previousImageRef.current;
    if (isAnimating && previousImage && image && previousImage !== image) {
      // Verbose log disabled to reduce console spam
      // if (__DEV__) {
      //   console.log(`[PhotoMorph] ${nodeId}: 🎬 ANIMATING morph transition (scale: ${scale.toFixed(1)})`);
      // }
      return renderMorphTransition(
        previousImage, // Low-res image (fading out)
        image, // High-res image (fading in)
        x,
        y,
        width,
        height,
        cornerRadius,
        lowResOpacity,
        highResOpacity,
        highResScale
      );
    }

    // Default: render single image (full opacity)
    return renderLoadedImage(image, x, y, width, height, cornerRadius);
  }
);

ImageNode.displayName = 'ImageNode';

// Export constants for testing
export const IMAGE_NODE_CONSTANTS = {
  DEFAULT_BUCKETS: [40, 60, 80, 120, 180, 256, 512, 1024],
  FALLBACK_BUCKET: 1024,
  RETINA_MULTIPLIER: 1.2,
  SKELETON_COLOR: '#D1BBA320', // Camel Hair Beige 20%
  SKELETON_STROKE_COLOR: '#D1BBA310', // Camel Hair Beige 10%
  SKELETON_STROKE_WIDTH: 0.5,
  DEBUG_SAMPLE_RATE: 0.01, // Log 1% of renders
};
