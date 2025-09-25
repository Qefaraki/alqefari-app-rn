/**
 * Image optimization utilities for WordPress images
 * Handles progressive loading with thumbnails and quality detection
 */

interface ImageSize {
  width: number;
  height: number;
  quality: 'thumbnail' | 'medium' | 'large' | 'full';
}

/**
 * Parse WordPress image URL to get different sizes
 * WordPress typically adds size suffix like -150x150.jpg for thumbnails
 */
export function getWordPressImageSizes(imageUrl: string): {
  thumbnail: string;
  medium: string;
  large: string;
  full: string;
} {
  // Remove any existing size suffix
  const baseUrl = imageUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');
  const extension = baseUrl.match(/\.(\w+)$/)?.[1] || 'jpg';
  const urlWithoutExt = baseUrl.replace(/\.\w+$/, '');

  return {
    thumbnail: `${urlWithoutExt}-150x150.${extension}`,
    medium: `${urlWithoutExt}-300x300.${extension}`,
    large: `${urlWithoutExt}-1024x1024.${extension}`,
    full: baseUrl,
  };
}

/**
 * Get optimal image URL based on screen width and pixel density
 */
export function getOptimalImageUrl(
  imageUrl: string,
  targetWidth: number,
  pixelDensity: number = 2
): string {
  const targetSize = targetWidth * pixelDensity;
  const sizes = getWordPressImageSizes(imageUrl);

  // Choose appropriate size based on target
  if (targetSize <= 300) {
    return sizes.thumbnail;
  } else if (targetSize <= 600) {
    return sizes.medium;
  } else if (targetSize <= 2048) {
    return sizes.large;
  }

  return sizes.full;
}

/**
 * Extract srcset from WordPress HTML img tags
 * Returns array of image sources with their widths
 */
export function extractSrcSet(imgTag: string): Array<{ url: string; width: number }> {
  const srcsetMatch = imgTag.match(/srcset="([^"]+)"/);
  if (!srcsetMatch) return [];

  const srcset = srcsetMatch[1];
  const sources: Array<{ url: string; width: number }> = [];

  // Parse srcset format: "url1 300w, url2 768w, url3 1024w"
  const pairs = srcset.split(',').map(s => s.trim());

  for (const pair of pairs) {
    const [url, widthStr] = pair.split(/\s+/);
    const width = parseInt(widthStr?.replace('w', '') || '0');

    if (url && width > 0) {
      sources.push({ url, width });
    }
  }

  // Sort by width ascending
  return sources.sort((a, b) => a.width - b.width);
}

/**
 * Get placeholder/blur hash for progressive loading
 * This would ideally come from WordPress API or be generated server-side
 */
export function getImagePlaceholder(imageUrl: string): string {
  // For now, return a low quality version
  // In production, this could be a base64 encoded blur hash
  const sizes = getWordPressImageSizes(imageUrl);
  return sizes.thumbnail;
}

/**
 * Progressive image loading strategy
 */
export class ProgressiveImageLoader {
  private loadingImages = new Map<string, Promise<void>>();

  /**
   * Load image progressively: placeholder → thumbnail → full
   */
  async loadProgressive(
    imageUrl: string,
    onProgress?: (stage: 'placeholder' | 'thumbnail' | 'full', url: string) => void
  ): Promise<void> {
    // Check if already loading
    const existing = this.loadingImages.get(imageUrl);
    if (existing) return existing;

    const loadPromise = this.performProgressiveLoad(imageUrl, onProgress);
    this.loadingImages.set(imageUrl, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadingImages.delete(imageUrl);
    }
  }

  private async performProgressiveLoad(
    imageUrl: string,
    onProgress?: (stage: 'placeholder' | 'thumbnail' | 'full', url: string) => void
  ): Promise<void> {
    const sizes = getWordPressImageSizes(imageUrl);

    // Stage 1: Show placeholder immediately
    onProgress?.('placeholder', sizes.thumbnail);

    // Stage 2: Load thumbnail
    try {
      await this.preloadImage(sizes.thumbnail);
      onProgress?.('thumbnail', sizes.thumbnail);
    } catch {
      // Thumbnail might not exist, continue
    }

    // Stage 3: Load full image
    try {
      await this.preloadImage(imageUrl);
      onProgress?.('full', imageUrl);
    } catch (error) {
      console.warn('Failed to load full image:', imageUrl);
      throw error;
    }
  }

  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  }
}

// Singleton instance
export const progressiveImageLoader = new ProgressiveImageLoader();

/**
 * Get responsive image props for React Native Image component
 */
export function getResponsiveImageProps(
  imageUrl: string,
  containerWidth: number
): {
  source: { uri: string };
  placeholder?: { uri: string };
  cachePolicy: 'memory-disk' | 'memory' | 'disk' | 'none';
  priority: 'low' | 'normal' | 'high';
  contentFit: 'cover' | 'contain';
  transition: number;
} {
  const optimalUrl = getOptimalImageUrl(imageUrl, containerWidth);
  const placeholderUrl = getImagePlaceholder(imageUrl);

  return {
    source: { uri: optimalUrl },
    placeholder: { uri: placeholderUrl },
    cachePolicy: 'memory-disk',
    priority: 'normal',
    contentFit: 'cover',
    transition: 300,
  };
}