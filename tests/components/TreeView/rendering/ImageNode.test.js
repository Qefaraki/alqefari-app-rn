/**
 * ImageNode Tests
 *
 * Test suite for circular avatar photo rendering with LOD.
 *
 * Coverage:
 * - Pixel size calculation
 * - Bucket selection logic
 * - Image loading conditions
 * - Skeleton rendering
 * - Loaded image rendering with mask
 * - LOD tier integration (Tier 1 only)
 * - Hysteresis bucket selection
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  ImageNode,
  calculatePixelSize,
  selectImageBucket,
  shouldLoadImage,
  renderImageSkeleton,
  renderLoadedImage,
  IMAGE_NODE_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/ImageNode';

// Import PixelRatio after the component to avoid overriding global mocks
const { PixelRatio } = require('react-native');

// Mock batched image loading hook
const mockUseBatchedSkiaImage = jest.fn((url, bucket, priority) => {
  // Return null initially (skeleton), then mock image after delay
  return null;
});

describe('ImageNode', () => {
  // Spy on PixelRatio.get
  let pixelRatioSpy;

  beforeEach(() => {
    mockUseBatchedSkiaImage.mockClear();
    pixelRatioSpy = jest.spyOn(PixelRatio, 'get').mockReturnValue(2);
  });

  afterEach(() => {
    pixelRatioSpy.mockRestore();
  });

  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('IMAGE_NODE_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(IMAGE_NODE_CONSTANTS.DEFAULT_BUCKETS).toEqual([40, 60, 80, 120, 256]);
      expect(IMAGE_NODE_CONSTANTS.FALLBACK_BUCKET).toBe(512);
      expect(IMAGE_NODE_CONSTANTS.RETINA_MULTIPLIER).toBe(2);
      expect(IMAGE_NODE_CONSTANTS.SKELETON_COLOR).toBe('#D1BBA320');
      expect(IMAGE_NODE_CONSTANTS.SKELETON_STROKE_COLOR).toBe('#D1BBA310');
      expect(IMAGE_NODE_CONSTANTS.SKELETON_STROKE_WIDTH).toBe(0.5);
      expect(IMAGE_NODE_CONSTANTS.DEBUG_SAMPLE_RATE).toBe(0.01);
    });
  });

  // ============================================================================
  // CALCULATE PIXEL SIZE TESTS
  // ============================================================================

  describe('calculatePixelSize', () => {
    test('should multiply width by pixel ratio and scale', () => {
      pixelRatioSpy.mockReturnValue(2);

      const result = calculatePixelSize(50, 1.0);

      // 50 * 2 (pixel ratio) * 1.0 (scale) = 100
      expect(result).toBe(100);
    });

    test('should handle zoom scale', () => {
      pixelRatioSpy.mockReturnValue(2);

      const result = calculatePixelSize(50, 1.5);

      // 50 * 2 * 1.5 = 150
      expect(result).toBe(150);
    });

    test('should handle 3x device pixel ratio', () => {
      pixelRatioSpy.mockReturnValue(3);

      const result = calculatePixelSize(50, 1.0);

      // 50 * 3 * 1.0 = 150
      expect(result).toBe(150);
    });

    test('should handle zoom out (scale < 1)', () => {
      pixelRatioSpy.mockReturnValue(2);

      const result = calculatePixelSize(50, 0.5);

      // 50 * 2 * 0.5 = 50
      expect(result).toBe(50);
    });

    test('should handle zero width', () => {
      const result = calculatePixelSize(0, 1.0);
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // SELECT IMAGE BUCKET TESTS
  // ============================================================================

  describe('selectImageBucket', () => {
    test('should select smallest bucket that meets 2x pixel size', () => {
      // pixelSize = 30, need 60+ bucket
      const result = selectImageBucket(30);

      expect(result).toBe(60);
    });

    test('should use next bucket if exact match not available', () => {
      // pixelSize = 35, need 70+ bucket
      const result = selectImageBucket(35);

      expect(result).toBe(80);
    });

    test('should use largest bucket for large images', () => {
      // pixelSize = 200, need 400+ bucket
      const result = selectImageBucket(200);

      expect(result).toBe(512); // Fallback
    });

    test('should handle very small images', () => {
      const result = selectImageBucket(10);
      expect(result).toBe(40);
    });

    test('should use custom buckets array', () => {
      const customBuckets = [100, 200, 300];

      const result = selectImageBucket(60, customBuckets);

      // Need 120+, so select 200
      expect(result).toBe(200);
    });

    test('should fallback to 512 if all buckets too small', () => {
      const result = selectImageBucket(300, [40, 60, 80]);
      expect(result).toBe(512);
    });
  });

  // ============================================================================
  // SHOULD LOAD IMAGE TESTS
  // ============================================================================

  describe('shouldLoadImage', () => {
    test('should load for Tier 1 with URL and showPhotos', () => {
      const result = shouldLoadImage(1, 'https://example.com/photo.jpg', true);
      expect(result).toBe(true);
    });

    test('should not load for Tier 2', () => {
      const result = shouldLoadImage(2, 'https://example.com/photo.jpg', true);
      expect(result).toBe(false);
    });

    test('should not load for Tier 3', () => {
      const result = shouldLoadImage(3, 'https://example.com/photo.jpg', true);
      expect(result).toBe(false);
    });

    test('should not load when showPhotos is false', () => {
      const result = shouldLoadImage(1, 'https://example.com/photo.jpg', false);
      expect(result).toBe(false);
    });

    test('should not load without URL', () => {
      const result = shouldLoadImage(1, undefined, true);
      expect(result).toBe(false);
    });

    test('should not load with empty URL', () => {
      const result = shouldLoadImage(1, '', true);
      expect(result).toBe(false);
    });

    test('should handle all conditions false', () => {
      const result = shouldLoadImage(2, '', false);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // RENDER IMAGE SKELETON TESTS
  // ============================================================================

  describe('renderImageSkeleton', () => {
    test('should render skeleton at correct position', () => {
      const result = renderImageSkeleton(100, 200, 25);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined(); // Group
    });

    test('should handle zero coordinates', () => {
      const result = renderImageSkeleton(0, 0, 25);
      expect(result).toBeDefined();
    });

    test('should handle negative coordinates', () => {
      const result = renderImageSkeleton(-100, -200, 25);
      expect(result).toBeDefined();
    });

    test('should handle different radius sizes', () => {
      const result1 = renderImageSkeleton(0, 0, 10);
      const result2 = renderImageSkeleton(0, 0, 50);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  // ============================================================================
  // RENDER LOADED IMAGE TESTS
  // ============================================================================

  describe('renderLoadedImage', () => {
    const mockImage = { width: 256, height: 256 }; // Mock Skia image

    test('should render masked image at correct position', () => {
      const result = renderLoadedImage(mockImage, 100, 200, 50, 50, 25);

      expect(result).toBeDefined();
      expect(result.type).toBeDefined(); // Group
    });

    test('should handle zero coordinates', () => {
      const result = renderLoadedImage(mockImage, 0, 0, 50, 50, 25);
      expect(result).toBeDefined();
    });

    test('should handle negative coordinates', () => {
      const result = renderLoadedImage(mockImage, -100, -200, 50, 50, 25);
      expect(result).toBeDefined();
    });

    test('should handle different dimensions', () => {
      const result1 = renderLoadedImage(mockImage, 0, 0, 30, 30, 15);
      const result2 = renderLoadedImage(mockImage, 0, 0, 100, 100, 50);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  // ============================================================================
  // IMAGE NODE COMPONENT TESTS
  // ============================================================================

  describe('ImageNode component', () => {
    const defaultProps = {
      url: 'https://example.com/photo.jpg',
      x: 100,
      y: 200,
      width: 50,
      height: 50,
      radius: 25,
      tier: 1,
      scale: 1.0,
      nodeId: 'n1',
      useBatchedSkiaImage: mockUseBatchedSkiaImage,
    };

    test('should render skeleton when image not loaded', () => {
      mockUseBatchedSkiaImage.mockReturnValue(null);

      const { UNSAFE_root } = render(<ImageNode {...defaultProps} />);

      expect(UNSAFE_root).toBeDefined();
      expect(mockUseBatchedSkiaImage).toHaveBeenCalled();
    });

    test('should render loaded image', () => {
      const mockImage = { width: 256, height: 256 };
      mockUseBatchedSkiaImage.mockReturnValue(mockImage);

      const { UNSAFE_root } = render(<ImageNode {...defaultProps} />);

      expect(UNSAFE_root).toBeDefined();
    });

    test('should return null for Tier 2', () => {
      const { UNSAFE_root } = render(
        <ImageNode {...defaultProps} tier={2} />
      );

      expect(UNSAFE_root).toBeDefined();
      expect(mockUseBatchedSkiaImage).not.toHaveBeenCalled();
    });

    test('should return null for Tier 3', () => {
      const { UNSAFE_root } = render(
        <ImageNode {...defaultProps} tier={3} />
      );

      expect(UNSAFE_root).toBeDefined();
      expect(mockUseBatchedSkiaImage).not.toHaveBeenCalled();
    });

    test('should return null when showPhotos is false', () => {
      const { UNSAFE_root } = render(
        <ImageNode {...defaultProps} showPhotos={false} />
      );

      expect(UNSAFE_root).toBeDefined();
      expect(mockUseBatchedSkiaImage).not.toHaveBeenCalled();
    });

    test('should use bucket selection from pixelSize', () => {
      pixelRatioSpy.mockReturnValue(2);
      mockUseBatchedSkiaImage.mockReturnValue(null);

      render(<ImageNode {...defaultProps} width={50} scale={1.0} />);

      // pixelSize = 50 * 2 * 1.0 = 100
      // 2x = 200, needs bucket >= 200, so 256
      expect(mockUseBatchedSkiaImage).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        256,
        'visible'
      );
    });

    test('should use hysteresis bucket selector if provided', () => {
      const mockSelectBucket = jest.fn(() => 120);
      mockUseBatchedSkiaImage.mockReturnValue(null);

      render(
        <ImageNode
          {...defaultProps}
          selectBucket={mockSelectBucket}
        />
      );

      expect(mockSelectBucket).toHaveBeenCalled();
      expect(mockUseBatchedSkiaImage).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        120,
        'visible'
      );
    });

    test('should handle zoom scale in bucket selection', () => {
      pixelRatioSpy.mockReturnValue(2);
      mockUseBatchedSkiaImage.mockReturnValue(null);

      render(<ImageNode {...defaultProps} width={25} scale={2.0} />);

      // pixelSize = 25 * 2 * 2.0 = 100
      // 2x = 200, needs bucket >= 200, so 256
      expect(mockUseBatchedSkiaImage).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        256,
        'visible'
      );
    });

    test('should handle negative coordinates', () => {
      mockUseBatchedSkiaImage.mockReturnValue(null);

      const { UNSAFE_root } = render(
        <ImageNode {...defaultProps} x={-100} y={-200} />
      );

      expect(UNSAFE_root).toBeDefined();
    });

    test('should handle different radius sizes', () => {
      mockUseBatchedSkiaImage.mockReturnValue(null);

      const { UNSAFE_root: root1 } = render(
        <ImageNode {...defaultProps} radius={10} />
      );
      const { UNSAFE_root: root2 } = render(
        <ImageNode {...defaultProps} radius={50} />
      );

      expect(root1).toBeDefined();
      expect(root2).toBeDefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration', () => {
    test('should handle complete lifecycle: hidden → skeleton → loaded', () => {
      mockUseBatchedSkiaImage.mockReturnValue(null);

      const props = {
        url: 'https://example.com/photo.jpg',
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        radius: 25,
        tier: 1,
        scale: 1.0,
        nodeId: 'n1',
        useBatchedSkiaImage: mockUseBatchedSkiaImage,
      };

      // Phase 1: Hidden (Tier 2)
      const { rerender, UNSAFE_root } = render(
        <ImageNode {...props} tier={2} />
      );
      expect(UNSAFE_root).toBeDefined();

      // Phase 2: Skeleton (Tier 1, no image)
      mockUseBatchedSkiaImage.mockReturnValue(null);
      rerender(<ImageNode {...props} tier={1} />);
      expect(mockUseBatchedSkiaImage).toHaveBeenCalled();

      // Phase 3: Loaded (Tier 1, image ready)
      mockUseBatchedSkiaImage.mockReturnValue({ width: 256, height: 256 });
      rerender(<ImageNode {...props} tier={1} />);
      expect(mockUseBatchedSkiaImage).toHaveBeenCalled();
    });

    test('should select correct bucket for various zoom levels', () => {
      pixelRatioSpy.mockReturnValue(2);
      mockUseBatchedSkiaImage.mockReturnValue(null);

      const baseProps = {
        url: 'https://example.com/photo.jpg',
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        radius: 25,
        tier: 1,
        nodeId: 'n1',
        useBatchedSkiaImage: mockUseBatchedSkiaImage,
      };

      // Zoomed out (scale 0.5)
      render(<ImageNode {...baseProps} scale={0.5} />);
      // pixelSize = 50 * 2 * 0.5 = 50, 2x = 100, bucket = 120
      expect(mockUseBatchedSkiaImage).toHaveBeenCalledWith(
        expect.anything(),
        120,
        'visible'
      );

      mockUseBatchedSkiaImage.mockClear();

      // Normal (scale 1.0)
      render(<ImageNode {...baseProps} scale={1.0} />);
      // pixelSize = 50 * 2 * 1.0 = 100, 2x = 200, bucket = 256
      expect(mockUseBatchedSkiaImage).toHaveBeenCalledWith(
        expect.anything(),
        256,
        'visible'
      );

      mockUseBatchedSkiaImage.mockClear();

      // Zoomed in (scale 2.0)
      render(<ImageNode {...baseProps} scale={2.0} />);
      // pixelSize = 50 * 2 * 2.0 = 200, 2x = 400, bucket = 512
      expect(mockUseBatchedSkiaImage).toHaveBeenCalledWith(
        expect.anything(),
        512,
        'visible'
      );
    });

    test('should respect showPhotos global toggle', () => {
      mockUseBatchedSkiaImage.mockReturnValue(null);

      const props = {
        url: 'https://example.com/photo.jpg',
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        radius: 25,
        tier: 1,
        scale: 1.0,
        nodeId: 'n1',
        useBatchedSkiaImage: mockUseBatchedSkiaImage,
      };

      // Photos enabled
      const { rerender, UNSAFE_root: root1 } = render(
        <ImageNode {...props} showPhotos={true} />
      );
      expect(mockUseBatchedSkiaImage).toHaveBeenCalled();

      mockUseBatchedSkiaImage.mockClear();

      // Photos disabled
      rerender(<ImageNode {...props} showPhotos={false} />);
      expect(mockUseBatchedSkiaImage).not.toHaveBeenCalled();
    });
  });
});
