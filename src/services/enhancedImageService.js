import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "expo-image";
import { supabase } from "../config/supabase";

/**
 * Enhanced Image Service with transformation fallback and editing
 */
class EnhancedImageService {
  constructor() {
    this.transformationEnabled = null; // Will be checked on first use
    this.baseStorageUrl = `${supabase.storage.url}/object/public/profile-photos`;
  }

  /**
   * Get optimized image URL with fallback
   * @param {string} photoPath - Storage path of the photo
   * @param {Object} options - Transformation options
   * @returns {string} - Optimized image URL
   */
  getOptimizedImageUrl(photoPath, options = {}) {
    if (!photoPath) return null;

    const {
      width = 400,
      height = 400,
      quality = 75,
      format = "webp",
    } = options;

    // If photo is already a full URL, return it
    if (photoPath.startsWith("http")) {
      return photoPath;
    }

    // Build the base URL
    const baseUrl = `${this.baseStorageUrl}/${photoPath}`;

    // Try Supabase transformation first (if enabled)
    if (this.transformationEnabled !== false) {
      const transformUrl = `${supabase.storage.url}/render/image/public/profile-photos/${photoPath}?width=${width}&height=${height}&quality=${quality}&format=${format}`;

      // Return transform URL - will fallback to base if it fails
      return transformUrl;
    }

    // Return base URL without transformations
    return baseUrl;
  }

  /**
   * Check if Supabase image transformation is available
   * @returns {Promise<boolean>}
   */
  async checkTransformationSupport() {
    if (this.transformationEnabled !== null) {
      return this.transformationEnabled;
    }

    try {
      // Try to fetch a test transformation
      const testUrl = `${supabase.storage.url}/render/image/public/profile-photos/test.jpg?width=1&height=1`;
      const response = await fetch(testUrl, { method: "HEAD" });

      this.transformationEnabled = response.status !== 400;
      return this.transformationEnabled;
    } catch (error) {
      console.log("Image transformation not available, using fallback");
      this.transformationEnabled = false;
      return false;
    }
  }

  /**
   * Process image locally as fallback
   * @param {string} uri - Local image URI
   * @param {Object} options - Processing options
   * @returns {Promise<{uri: string, width: number, height: number}>}
   */
  async processImageLocally(uri, options = {}) {
    const {
      width = 800,
      height = 800,
      compress = 0.8,
      format = ImageManipulator.SaveFormat.JPEG,
    } = options;

    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width, height } }],
        { compress, format },
      );

      return result;
    } catch (error) {
      console.error("Local image processing failed:", error);
      throw error;
    }
  }

  /**
   * Image editor with crop and rotate
   * @param {string} uri - Image URI to edit
   * @param {Object} editOptions - Edit options
   * @returns {Promise<{uri: string, cancelled: boolean}>}
   */
  async editImage(uri, editOptions = {}) {
    const {
      allowsCropping = true,
      allowsRotating = true,
      aspectRatio = [1, 1],
      initialCropRegion = null,
    } = editOptions;

    try {
      const actions = [];

      // Apply initial crop if provided
      if (initialCropRegion) {
        actions.push({
          crop: initialCropRegion,
        });
      }

      // Process the image with edits
      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      return { uri: result.uri, cancelled: false };
    } catch (error) {
      console.error("Image editing failed:", error);
      return { uri: null, cancelled: true };
    }
  }

  /**
   * Advanced image editor UI
   * @param {string} imageUri - Image to edit
   * @returns {Promise<{uri: string, edits: Object}>}
   */
  async openAdvancedEditor(imageUri) {
    // This would integrate with a more advanced editor component
    // For now, we'll provide basic editing

    const edits = {
      rotation: 0,
      cropRegion: null,
      brightness: 1.0,
      contrast: 1.0,
    };

    try {
      const actions = [];

      // Apply rotation
      if (edits.rotation !== 0) {
        actions.push({ rotate: edits.rotation });
      }

      // Apply crop
      if (edits.cropRegion) {
        actions.push({ crop: edits.cropRegion });
      }

      // Process image with all edits
      const result = await ImageManipulator.manipulateAsync(imageUri, actions, {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      return {
        uri: result.uri,
        edits,
      };
    } catch (error) {
      console.error("Advanced editing failed:", error);
      throw error;
    }
  }

  /**
   * Rotate image by 90 degree increments
   * @param {string} uri - Image URI
   * @param {number} degrees - Rotation degrees (90, 180, 270)
   * @returns {Promise<string>} - New image URI
   */
  async rotateImage(uri, degrees = 90) {
    if (![90, 180, 270, -90, -180, -270].includes(degrees)) {
      throw new Error("Rotation must be in 90 degree increments");
    }

    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ rotate: degrees }],
        {
          compress: 1.0,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      return result.uri;
    } catch (error) {
      console.error("Image rotation failed:", error);
      throw error;
    }
  }

  /**
   * Crop image with aspect ratio
   * @param {string} uri - Image URI
   * @param {Object} cropData - Crop data {originX, originY, width, height}
   * @param {Array} aspectRatio - [width, height] aspect ratio
   * @returns {Promise<string>} - New image URI
   */
  async cropImage(uri, cropData, aspectRatio = null) {
    try {
      // Get image dimensions first
      const imageAsset = await Image.getSize(uri);
      const { width: imageWidth, height: imageHeight } = imageAsset;

      // Calculate crop region
      let cropRegion = cropData;

      if (aspectRatio) {
        const [aspectWidth, aspectHeight] = aspectRatio;
        const targetRatio = aspectWidth / aspectHeight;

        // Adjust crop to maintain aspect ratio
        const cropRatio = cropData.width / cropData.height;

        if (cropRatio > targetRatio) {
          // Too wide, adjust width
          cropRegion.width = cropData.height * targetRatio;
        } else if (cropRatio < targetRatio) {
          // Too tall, adjust height
          cropRegion.height = cropData.width / targetRatio;
        }
      }

      // Ensure crop region is within bounds
      cropRegion = {
        originX: Math.max(
          0,
          Math.min(cropRegion.originX, imageWidth - cropRegion.width),
        ),
        originY: Math.max(
          0,
          Math.min(cropRegion.originY, imageHeight - cropRegion.height),
        ),
        width: Math.min(cropRegion.width, imageWidth),
        height: Math.min(cropRegion.height, imageHeight),
      };

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: cropRegion }],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      return result.uri;
    } catch (error) {
      console.error("Image cropping failed:", error);
      throw error;
    }
  }

  /**
   * Apply filters to image
   * @param {string} uri - Image URI
   * @param {Object} filters - Filter options
   * @returns {Promise<string>} - New image URI
   */
  async applyFilters(uri, filters = {}) {
    const {
      brightness = 1.0, // 0-2, 1 is normal
      contrast = 1.0, // 0-2, 1 is normal
      saturation = 1.0, // 0-2, 1 is normal
    } = filters;

    try {
      // Note: expo-image-manipulator doesn't support filters directly
      // This would need a custom implementation or third-party library
      // For now, return the original image

      console.log(
        "Filter application requested but not yet implemented",
        filters,
      );
      return uri;
    } catch (error) {
      console.error("Filter application failed:", error);
      throw error;
    }
  }

  /**
   * Generate thumbnail from image
   * @param {string} uri - Image URI
   * @param {number} size - Thumbnail size
   * @returns {Promise<string>} - Thumbnail URI
   */
  async generateThumbnail(uri, size = 150) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: size, height: size } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      return result.uri;
    } catch (error) {
      console.error("Thumbnail generation failed:", error);
      throw error;
    }
  }

  /**
   * Optimize image for upload
   * @param {string} uri - Image URI
   * @param {Object} options - Optimization options
   * @returns {Promise<{uri: string, size: number}>}
   */
  async optimizeForUpload(uri, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      quality = 0.8,
      format = ImageManipulator.SaveFormat.JPEG,
    } = options;

    try {
      // Get current image dimensions
      const imageAsset = await Image.getSize(uri);
      const { width: currentWidth, height: currentHeight } = imageAsset;

      // Calculate resize dimensions maintaining aspect ratio
      let newWidth = currentWidth;
      let newHeight = currentHeight;

      if (currentWidth > maxWidth || currentHeight > maxHeight) {
        const widthRatio = maxWidth / currentWidth;
        const heightRatio = maxHeight / currentHeight;
        const ratio = Math.min(widthRatio, heightRatio);

        newWidth = Math.floor(currentWidth * ratio);
        newHeight = Math.floor(currentHeight * ratio);
      }

      // Process image
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: newWidth, height: newHeight } }],
        {
          compress: quality,
          format,
        },
      );

      // Get file size (approximate)
      const response = await fetch(result.uri);
      const blob = await response.blob();

      return {
        uri: result.uri,
        size: blob.size,
        width: newWidth,
        height: newHeight,
      };
    } catch (error) {
      console.error("Image optimization failed:", error);
      throw error;
    }
  }

  /**
   * Create a collage from multiple images
   * @param {Array<string>} imageUris - Array of image URIs
   * @param {Object} options - Collage options
   * @returns {Promise<string>} - Collage image URI
   */
  async createCollage(imageUris, options = {}) {
    const {
      layout = "grid", // grid, horizontal, vertical
      spacing = 10,
      backgroundColor = "#ffffff",
      maxImages = 9,
    } = options;

    // This would require a more complex implementation
    // with canvas manipulation or a specialized library
    console.log("Collage creation requested but not yet implemented");

    // For now, return the first image
    return imageUris[0] || null;
  }
}

export default new EnhancedImageService();
