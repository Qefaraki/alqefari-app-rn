/**
 * ImageNode - Photo avatar rendering with LOD
 *
 * Phase 2 Day 5 - Extracted from TreeView.js (lines 350-428)
 *
 * Renders circular avatar photos for tree nodes with LOD-aware loading.
 * Integrates with ImageBuckets for resolution selection and batched loading.
 *
 * LOD Integration:
 * - Tier 1: Load image at appropriate bucket size
 * - Tier 2/3: Return null (photos hidden)
 *
 * Loading States:
 * 1. **Hidden**: showPhotos=false or tier > 1 → returns null
 * 2. **Skeleton**: Image loading → Shows placeholder squircle
 * 3. **Loaded**: Image ready → Displays with squircle mask
 *
 * Performance Optimizations:
 * - Bucket selection: 40/60/80/120/256px based on screen pixels
 * - Hysteresis: Prevents bucket thrashing during zoom
 * - Batched loading: useBatchedSkiaImage with priority
 * - Squircle mask: RoundedRect with 14px radius (42% of size)
 *
 * Design Constraints (Najdi Sadu):
 * - Skeleton: Camel Hair Beige with 20% opacity (#D1BBA320)
 * - Squircle radius: 14px (42% of 50px size)
 * - Fit: cover (maintains aspect ratio, fills squircle)
 *
 * KNOWN PATTERNS (AS-IS for Phase 2):
 * - Uses useBatchedSkiaImage (custom hook from TreeView)
 * - Needs to be imported or extracted separately
 * - Debug logging with 1% sample rate (Math.random)
 */

import React from 'react';
import { PixelRatio } from 'react-native';
import { Group, Circle, Mask, Image as SkiaImage } from '@shopify/react-native-skia';
import { IMAGE_BUCKETS } from './nodeConstants';
import { usePhotoMorphTransition } from '../../../hooks/usePhotoMorphTransition';

export interface ImageNodeProps {
  // Image source
  url: string;

  // Position and size (top-left corner)
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;

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
 * @param radius - Circle radius
 * @returns Group with skeleton circles
 */
export function renderImageSkeleton(
  x: number,
  y: number,
  radius: number
): JSX.Element {
  return (
    <Group>
      {/* Base circle background */}
      <Circle
        cx={x + radius}
        cy={y + radius}
        r={radius}
        color={IMAGE_NODE_CONSTANTS.SKELETON_COLOR}
      />
      {/* Inner stroke for depth */}
      <Circle
        cx={x + radius}
        cy={y + radius}
        r={radius - 1}
        color={IMAGE_NODE_CONSTANTS.SKELETON_STROKE_COLOR}
        style="stroke"
        strokeWidth={IMAGE_NODE_CONSTANTS.SKELETON_STROKE_WIDTH}
      />
    </Group>
  );
}

/**
 * Render loaded image with circular mask
 *
 * Displays image clipped to circular shape.
 * Uses alpha mask for clean edge rendering.
 *
 * @param image - Loaded Skia image
 * @param x - Top-left X position
 * @param y - Top-left Y position
 * @param width - Image width
 * @param height - Image height
 * @param radius - Circle radius (for mask)
 * @param opacity - Optional opacity shared value for animations
 * @returns Group with masked image
 */
export function renderLoadedImage(
  image: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  opacity?: any
): JSX.Element {
  return (
    <Group opacity={opacity}>
      <Mask
        mode="alpha"
        mask={<Circle cx={x + radius} cy={y + radius} r={radius} color="white" />}
      >
        <SkiaImage
          image={image}
          x={x}
          y={y}
          width={width}
          height={height}
          fit="cover"
        />
      </Mask>
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
 * @param radius - Circle radius (for mask)
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
  radius: number,
  lowResOpacity: any,
  highResOpacity: any,
  highResScale: any
): JSX.Element {
  const centerX = x + radius;
  const centerY = y + radius;

  return (
    <Group>
      {/* Low-res image fading out */}
      <Group opacity={lowResOpacity}>
        <Mask
          mode="alpha"
          mask={<Circle cx={centerX} cy={centerY} r={radius} color="white" />}
        >
          <SkiaImage
            image={lowResImage}
            x={x}
            y={y}
            width={width}
            height={height}
            fit="cover"
          />
        </Mask>
      </Group>

      {/* High-res image fading in with scale pop */}
      <Group opacity={highResOpacity}>
        <Group
          origin={{
            x: centerX,
            y: centerY,
          }}
          transform={[{ scaleX: highResScale }, { scaleY: highResScale }]}
        >
          <Mask
            mode="alpha"
            mask={<Circle cx={centerX} cy={centerY} r={radius} color="white" />}
          >
            <SkiaImage
              image={highResImage}
              x={x}
              y={y}
              width={width}
              height={height}
              fit="cover"
            />
          </Mask>
        </Group>
      </Group>
    </Group>
  );
}

/**
 * ImageNode component
 *
 * Renders circular avatar photo with LOD-aware loading and morph transitions.
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
    x,
    y,
    width,
    height,
    radius,
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

    // Determine if image should load
    const shouldLoad = shouldLoadImage(tier, url, showPhotos);

    // Calculate physical pixel size
    const pixelSize = calculatePixelSize(width, scale);

    // Select bucket (with hysteresis if function provided)
    const bucket = shouldLoad
      ? selectBucket && nodeId
        ? selectBucket(nodeId, pixelSize)
        : selectImageBucket(pixelSize)
      : null;

    // Log bucket selection changes
    React.useEffect(() => {
      if (bucket !== lastBucketRef.current) {
        console.log(
          `[ImageNode] ${nodeId}: Bucket changed: ${lastBucketRef.current || 'init'} → ${bucket}px (pixelSize: ${pixelSize.toFixed(0)}, scale: ${scale.toFixed(1)})`
        );
        lastBucketRef.current = bucket;
      }
    }, [bucket, nodeId, pixelSize, scale]);

    // Load image with batched loading and upgrade tracking
    const imageResult = shouldLoad ? useBatchedSkiaImage(url, bucket, 'visible') : null;

    // Handle different return types from hook
    // Support both old signature (SkImage | null) and new signature ({ image, isUpgrading, currentBucket })
    const image = imageResult?.image !== undefined ? imageResult.image : imageResult;
    const isUpgrading = imageResult?.isUpgrading || false;
    const currentBucket = imageResult?.currentBucket || null;

    // Log upgrade flag changes
    React.useEffect(() => {
      if (isUpgrading !== lastIsUpgradingRef.current) {
        console.log(
          `[ImageNode] ${nodeId}: Upgrade flag: ${lastIsUpgradingRef.current} → ${isUpgrading} (currentBucket: ${currentBucket}px)`
        );
        lastIsUpgradingRef.current = isUpgrading;
      }
    }, [isUpgrading, nodeId, currentBucket]);

    // Morph animation - only triggers at extreme zoom
    const { lowResOpacity, highResOpacity, highResScale, isAnimating } =
      usePhotoMorphTransition(isUpgrading, scale, true);

    // Log render count for debugging
    React.useEffect(() => {
      renderCountRef.current++;
      if (renderCountRef.current % 20 === 0) {
        console.log(
          `[ImageNode] ${nodeId}: Render #${renderCountRef.current} (image loaded: ${!!image}, isAnimating: ${isAnimating})`
        );
      }
    });

    // For morph animation: we need to render two versions of the image
    // Low-res: the currently displayed image (fading out)
    // High-res: the new higher-quality image (fading in with scale)
    // This only matters when bucket increased and animation is happening

    // Return null if photos hidden
    if (!shouldLoad) {
      return null;
    }

    // Show skeleton if image not loaded
    if (!image) {
      return renderImageSkeleton(x, y, radius);
    }

    // Show loaded image with optional morph animation
    // For now: render single image normally (morph requires keeping track of previous bucket's image)
    // Enhanced version will render dual images during transition
    return renderLoadedImage(image, x, y, width, height, radius);
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
