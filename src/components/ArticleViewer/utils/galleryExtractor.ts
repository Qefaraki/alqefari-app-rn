/**
 * Smart gallery extraction from HTML content
 * Detects bulk image galleries at the end of articles
 */

interface ExtractedContent {
  content: string;
  galleryImages: string[];
}

/**
 * Extracts gallery images from HTML content using regex
 * Rules:
 * 1. 3+ consecutive images with no significant text between them
 * 2. Images after a separator (hr, ---, specific class)
 * 3. Images in containers with gallery-related classes
 */
export function extractGalleryImages(html: string): ExtractedContent {
  if (!html) {
    return { content: '', galleryImages: [] };
  }

  const galleryImages: string[] = [];
  let processedContent = html;

  // Strategy 1: Look for gallery containers
  const galleryContainerRegex = /<div[^>]*class="[^"]*(?:gallery|photos|image-gallery|wp-block-gallery)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const galleryMatches = html.match(galleryContainerRegex);

  if (galleryMatches) {
    galleryMatches.forEach(match => {
      // Extract images from gallery container
      const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/gi;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(match)) !== null) {
        galleryImages.push(imgMatch[1]);
      }
      // Remove gallery container from content
      processedContent = processedContent.replace(match, '');
    });

    if (galleryImages.length >= 3) {
      return { content: processedContent, galleryImages };
    }
  }

  // Strategy 2: Find consecutive images at the end
  // Split content into blocks
  const blocks = html.split(/(<[^>]+>)/);
  const elements: { type: string; content: string }[] = [];

  let currentElement = '';
  blocks.forEach(block => {
    if (block.startsWith('<')) {
      if (block.startsWith('<img')) {
        // Extract image src
        const srcMatch = block.match(/src="([^"]+)"/);
        if (srcMatch) {
          elements.push({ type: 'img', content: srcMatch[1] });
        }
      } else if (block === '<hr>' || block === '<hr/>') {
        elements.push({ type: 'separator', content: block });
      } else if (!block.startsWith('</')) {
        currentElement = block;
      }
    } else {
      const text = block.trim();
      if (text && text.length > 20) {
        elements.push({ type: 'text', content: text });
      }
    }
  });

  // Find consecutive images at the end
  let consecutiveImages: string[] = [];
  let foundGallery = false;

  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i];

    if (element.type === 'img') {
      consecutiveImages.unshift(element.content);
    } else if (element.type === 'separator') {
      // Images after separator could be a gallery
      if (consecutiveImages.length >= 3) {
        foundGallery = true;
        break;
      }
    } else if (element.type === 'text') {
      // If we hit significant text and have 3+ images, it's a gallery
      if (consecutiveImages.length >= 3) {
        foundGallery = true;
        break;
      }
      // Reset if not enough images
      consecutiveImages = [];
    }
  }

  if (foundGallery && consecutiveImages.length >= 3) {
    // Remove gallery images from content
    consecutiveImages.forEach(imgUrl => {
      const imgRegex = new RegExp(`<img[^>]*src="${imgUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'gi');
      processedContent = processedContent.replace(imgRegex, '');
    });

    // Clean up empty paragraphs and extra whitespace
    processedContent = processedContent
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/\s+<\//, '</')
      .trim();

    return { content: processedContent, galleryImages: consecutiveImages };
  }

  // Strategy 3: Look for images after <hr> separator
  const hrIndex = html.lastIndexOf('<hr');
  if (hrIndex !== -1) {
    const afterHr = html.substring(hrIndex);
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/gi;
    let imgMatch;
    const imagesAfterHr: string[] = [];

    while ((imgMatch = imgRegex.exec(afterHr)) !== null) {
      imagesAfterHr.push(imgMatch[1]);
    }

    if (imagesAfterHr.length >= 3) {
      // Remove everything after <hr>
      processedContent = html.substring(0, hrIndex);
      return { content: processedContent, galleryImages: imagesAfterHr };
    }
  }

  // No gallery detected
  return { content: html, galleryImages: [] };
}

/**
 * Optimizes image URLs for better performance
 */
export function optimizeImageUrl(url: string, width?: number): string {
  // If it's a WordPress site, use their image sizing
  if (url.includes('alqefari.com')) {
    // Add width parameter for WordPress
    if (width && !url.includes('-scaled')) {
      const extension = url.substring(url.lastIndexOf('.'));
      const base = url.substring(0, url.lastIndexOf('.'));
      return `${base}-${width}x${Math.round(width * 1.5)}${extension}`;
    }
  }

  // For other sources, try to add size parameters
  if (width) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}`;
  }

  return url;
}

/**
 * Groups images by aspect ratio for masonry layout
 */
export function groupImagesByAspectRatio(images: string[]): {
  landscape: string[];
  portrait: string[];
  square: string[];
} {
  // This would need actual image dimension checking
  // For now, return a simple split
  const third = Math.floor(images.length / 3);

  return {
    landscape: images.slice(0, third),
    portrait: images.slice(third, third * 2),
    square: images.slice(third * 2),
  };
}

/**
 * Validates image URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  // Check for common image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
  if (imageExtensions.test(url)) {
    return true;
  }

  // Check for image service URLs (WordPress, CDNs, etc.)
  const imageServices = [
    'wp-content/uploads',
    'cloudinary.com',
    'imgix.net',
    'images.unsplash.com',
  ];

  return imageServices.some(service => url.includes(service));
}