import * as ImageManipulator from 'expo-image-manipulator';

class ImageOptimizationService {
  /**
   * Maximum dimensions for profile photos
   */
  static MAX_DIMENSIONS = {
    width: 1200,
    height: 1200,
  };

  /**
   * Thumbnail dimensions for performance
   */
  static THUMBNAIL_SIZE = 50;
  static PREVIEW_SIZE = 280;

  /**
   * Compress and optimize image for upload
   * @param {string} uri - The image URI from ImagePicker
   * @param {Object} options - Optimization options
   * @returns {Promise<{uri: string, base64Thumbnail: string}>}
   */
  async optimizeForUpload(uri, options = {}) {
    try {
      const {
        maxWidth = ImageOptimizationService.MAX_DIMENSIONS.width,
        maxHeight = ImageOptimizationService.MAX_DIMENSIONS.height,
        quality = 0.85,
        format = ImageManipulator.SaveFormat.JPEG,
      } = options;

      // First, get image info
      const imageInfo = await this.getImageInfo(uri);
      
      // Calculate resize dimensions maintaining aspect ratio
      const resizeDimensions = this.calculateResizeDimensions(
        imageInfo.width,
        imageInfo.height,
        maxWidth,
        maxHeight
      );

      // Array of manipulations to apply
      const manipulations = [];

      // Add resize if needed
      if (resizeDimensions.width < imageInfo.width || resizeDimensions.height < imageInfo.height) {
        manipulations.push({
          resize: resizeDimensions
        });
      }

      // Process the image
      const optimizedImage = await ImageManipulator.manipulateAsync(
        uri,
        manipulations,
        {
          compress: quality,
          format,
          // This removes EXIF data automatically
          base64: false,
        }
      );

      // Generate base64 thumbnail for blur-up effect
      const thumbnail = await this.generateThumbnail(optimizedImage.uri);

      return {
        uri: optimizedImage.uri,
        width: optimizedImage.width,
        height: optimizedImage.height,
        base64Thumbnail: thumbnail,
      };
    } catch (error) {
      console.error('Image optimization error:', error);
      throw new Error('فشل في معالجة الصورة');
    }
  }

  /**
   * Generate a small base64 thumbnail for progressive loading
   * @param {string} uri - The image URI
   * @returns {Promise<string>} Base64 encoded thumbnail
   */
  async generateThumbnail(uri) {
    try {
      const thumbnail = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 20, height: 20 } }
        ],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      return `data:image/jpeg;base64,${thumbnail.base64}`;
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      return null;
    }
  }

  /**
   * Generate URL with Supabase transformation parameters
   * @param {string} originalUrl - The original image URL
   * @param {Object} options - Transformation options
   * @returns {string} Transformed image URL
   */
  getTransformedUrl(originalUrl, options = {}) {
    if (!originalUrl || !originalUrl.includes('supabase')) {
      return originalUrl;
    }

    const {
      width,
      height,
      resize = 'cover', // cover, contain, fill
      quality = 80,
      format = 'webp', // webp, png, jpg
    } = options;

    // Parse the original URL
    const url = new URL(originalUrl);
    
    // Replace /object/public/ with /render/image/public/
    const transformedPath = url.pathname.replace('/object/public/', '/render/image/public/');
    
    // Build transformation parameters
    const params = new URLSearchParams();
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    if (resize) params.append('resize', resize);
    if (quality) params.append('quality', quality);
    if (format) params.append('format', format);

    return `${url.origin}${transformedPath}?${params.toString()}`;
  }

  /**
   * Get optimized URLs for different use cases
   * @param {string} originalUrl - The original image URL
   * @returns {Object} Object with different optimized URLs
   */
  getOptimizedUrls(originalUrl) {
    if (!originalUrl) return null;

    return {
      thumbnail: this.getTransformedUrl(originalUrl, {
        width: ImageOptimizationService.THUMBNAIL_SIZE,
        height: ImageOptimizationService.THUMBNAIL_SIZE,
        quality: 70,
        format: 'webp',
      }),
      preview: this.getTransformedUrl(originalUrl, {
        width: ImageOptimizationService.PREVIEW_SIZE,
        height: ImageOptimizationService.PREVIEW_SIZE,
        quality: 85,
        format: 'webp',
      }),
      full: this.getTransformedUrl(originalUrl, {
        width: ImageOptimizationService.MAX_DIMENSIONS.width,
        height: ImageOptimizationService.MAX_DIMENSIONS.height,
        quality: 90,
        format: 'webp',
      }),
      original: originalUrl,
    };
  }

  /**
   * Calculate resize dimensions maintaining aspect ratio
   * @private
   */
  calculateResizeDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    const aspectRatio = originalWidth / originalHeight;
    
    let newWidth = originalWidth;
    let newHeight = originalHeight;

    // Check if resize is needed
    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      if (originalWidth / maxWidth > originalHeight / maxHeight) {
        // Width is the limiting factor
        newWidth = maxWidth;
        newHeight = Math.round(maxWidth / aspectRatio);
      } else {
        // Height is the limiting factor
        newHeight = maxHeight;
        newWidth = Math.round(maxHeight * aspectRatio);
      }
    }

    return { width: newWidth, height: newHeight };
  }

  /**
   * Get image information
   * @private
   */
  async getImageInfo(uri) {
    try {
      // For now, we'll use a default since expo doesn't provide direct image info
      // In production, you might want to use a native module for this
      return {
        width: 2000,
        height: 2000,
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      return { width: 1200, height: 1200 };
    }
  }

  /**
   * Validate image before processing
   * @param {Object} imageAsset - The image asset from ImagePicker
   * @returns {Object} Validation result
   */
  validateImage(imageAsset) {
    const errors = [];
    const warnings = [];

    // Check file size (before compression)
    if (imageAsset.fileSize) {
      const sizeMB = imageAsset.fileSize / (1024 * 1024);
      if (sizeMB > 20) {
        errors.push('حجم الصورة كبير جداً (أكثر من 20 ميجابايت)');
      } else if (sizeMB > 10) {
        warnings.push('حجم الصورة كبير، قد يستغرق التحميل وقتاً أطول');
      }
    }

    // Check dimensions
    if (imageAsset.width && imageAsset.height) {
      if (imageAsset.width < 200 || imageAsset.height < 200) {
        warnings.push('دقة الصورة منخفضة، قد تظهر بجودة ضعيفة');
      }
      
      // Check aspect ratio
      const aspectRatio = imageAsset.width / imageAsset.height;
      if (aspectRatio < 0.5 || aspectRatio > 2) {
        warnings.push('نسبة أبعاد الصورة غير مناسبة، سيتم قصها');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default new ImageOptimizationService();