/**
 * Extracts external gallery links from article HTML
 * Priority: Google Drive > Google Photos > Other services > Article permalink
 */

import { NewsArticle } from '../../../services/news';

export type LinkType = 'drive' | 'photos' | 'article' | 'other';

interface ExtractedLink {
  url: string;
  type: LinkType;
}

/**
 * Extract external gallery link with smart fallbacks
 */
export function extractGalleryLink(html: string, article: NewsArticle): ExtractedLink {
  console.log('Starting link extraction, HTML length:', html.length);

  // Strategy: First search for "drive" keyword, then extract URL around it
  const driveIndex = html.toLowerCase().lastIndexOf('drive.google.com');

  if (driveIndex !== -1) {
    console.log('Found "drive.google.com" at index:', driveIndex);

    // Extract a window around the drive mention (2KB before and after)
    const windowStart = Math.max(0, driveIndex - 2000);
    const windowEnd = Math.min(html.length, driveIndex + 2000);
    const searchWindow = html.substring(windowStart, windowEnd);

    // Pattern 1: Google Drive folder links (highest priority)
    const driveFolderRegex = /https?:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+(?:\?[^"'\s<>]*)*/gi;
    const driveFolderMatch = searchWindow.match(driveFolderRegex);
    if (driveFolderMatch && driveFolderMatch[0]) {
      console.log('Found Drive folder link:', driveFolderMatch[0]);
      return {
        url: driveFolderMatch[0].replace(/&amp;/g, '&'),
        type: 'drive'
      };
    }

    // Pattern 2: Google Drive file/open links
    const driveFileRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)[a-zA-Z0-9_-]+(?:\/[^"'\s<>]*)*/gi;
    const driveFileMatch = searchWindow.match(driveFileRegex);
    if (driveFileMatch && driveFileMatch[0]) {
      console.log('Found Drive file link:', driveFileMatch[0]);
      return {
        url: driveFileMatch[0].replace(/&amp;/g, '&'),
        type: 'drive'
      };
    }

    // Pattern 3: Any other drive.google.com link format
    const anyDriveRegex = /https?:\/\/drive\.google\.com\/[^"'\s<>]+/gi;
    const anyDriveMatch = searchWindow.match(anyDriveRegex);
    if (anyDriveMatch && anyDriveMatch[0]) {
      console.log('Found generic Drive link:', anyDriveMatch[0]);
      return {
        url: anyDriveMatch[0].replace(/&amp;/g, '&'),
        type: 'drive'
      };
    }
  }

  // Search for Google Photos links
  const photosIndex = html.toLowerCase().indexOf('photos.google.com');
  if (photosIndex !== -1) {
    console.log('Found "photos.google.com" at index:', photosIndex);

    const windowStart = Math.max(0, photosIndex - 1000);
    const windowEnd = Math.min(html.length, photosIndex + 1000);
    const searchWindow = html.substring(windowStart, windowEnd);

    const photosRegex = /https?:\/\/photos\.google\.com\/share\/[^"'\s<>]+/gi;
    const photosMatch = searchWindow.match(photosRegex);
    if (photosMatch && photosMatch[0]) {
      console.log('Found Photos link:', photosMatch[0]);
      return {
        url: photosMatch[0].replace(/&amp;/g, '&'),
        type: 'photos'
      };
    }
  }

  // Search for photos.app.goo.gl links
  const photosAppIndex = html.toLowerCase().indexOf('photos.app.goo.gl');
  if (photosAppIndex !== -1) {
    console.log('Found "photos.app.goo.gl" at index:', photosAppIndex);

    const windowStart = Math.max(0, photosAppIndex - 500);
    const windowEnd = Math.min(html.length, photosAppIndex + 500);
    const searchWindow = html.substring(windowStart, windowEnd);

    const photosAppRegex = /https?:\/\/photos\.app\.goo\.gl\/[^"'\s<>]+/gi;
    const photosAppMatch = searchWindow.match(photosAppRegex);
    if (photosAppMatch && photosAppMatch[0]) {
      console.log('Found Photos app link:', photosAppMatch[0]);
      return {
        url: photosAppMatch[0].replace(/&amp;/g, '&'),
        type: 'photos'
      };
    }
  }

  // Other photo services
  const otherPhotoServices = /https?:\/\/(www\.)?(flickr\.com|imgur\.com)\/[^"'\s<>]+/gi;
  const otherMatch = html.match(otherPhotoServices);
  if (otherMatch && otherMatch[0]) {
    console.log('Found other photo service:', otherMatch[0]);
    return {
      url: otherMatch[0].replace(/&amp;/g, '&'),
      type: 'other'
    };
  }

  // Fallback: Link to original WordPress article
  const fallbackUrl = article.permalink || `https://alqefari.com/?p=${article.id}`;
  console.log('No external gallery found, using article URL:', fallbackUrl);
  return {
    url: fallbackUrl,
    type: 'article'
  };
}

/**
 * Get appropriate button text based on link type
 */
export function getLinkButtonText(type: LinkType, imageCount: number): string {
  const countText = imageCount > 0 ? ` (${imageCount} صورة)` : '';

  switch(type) {
    case 'drive':
      return `📁 فتح في Google Drive${countText}`;
    case 'photos':
      return `📷 فتح في Google Photos${countText}`;
    case 'other':
      return `🖼️ عرض المعرض الكامل${countText}`;
    case 'article':
    default:
      return `🌐 عرض على الموقع${countText}`;
  }
}

/**
 * Extract first N image URLs from HTML for preview
 */
export function extractPreviewImages(html: string, limit: number = 6): string[] {
  const images: string[] = [];

  // For very large HTML, limit the search to first portion
  const searchLimit = Math.min(html.length, 50000); // Only search first 50KB
  const searchHtml = html.substring(0, searchLimit);

  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let match;

  while ((match = imgRegex.exec(searchHtml)) !== null && images.length < limit) {
    const imageUrl = match[1];
    // Skip tiny images (likely icons)
    if (!imageUrl.includes('20x20') && !imageUrl.includes('32x32')) {
      images.push(imageUrl.replace(/&amp;/g, '&'));
    }
  }

  // If we didn't find enough images in the first portion, try a bit more
  if (images.length < limit && html.length > searchLimit) {
    const additionalSearch = html.substring(searchLimit, Math.min(html.length, 100000));
    const additionalRegex = /<img[^>]+src="([^"]+)"/gi;

    while ((match = additionalRegex.exec(additionalSearch)) !== null && images.length < limit) {
      const imageUrl = match[1];
      if (!imageUrl.includes('20x20') && !imageUrl.includes('32x32')) {
        images.push(imageUrl.replace(/&amp;/g, '&'));
      }
    }
  }

  return images;
}

/**
 * Count total images in HTML
 */
export function countImages(html: string): number {
  const matches = html.match(/<img/gi);
  return matches ? matches.length : 0;
}

/**
 * Analyze content to determine type
 */
export type ContentType = 'article' | 'mixed' | 'photo-event';

export interface ContentAnalysis {
  type: ContentType;
  isHeavy: boolean;
  imageCount: number;
  contentLength: number;
  hasGoogleDriveLink: boolean;
}

export function analyzeContent(html: string): ContentAnalysis {
  const contentLength = html.length;
  const imageCount = countImages(html);
  const hasGoogleDriveLink = /drive\.google\.com/i.test(html);

  // Determine content type based on thresholds
  let type: ContentType;
  let isHeavy: boolean;

  // Temporarily lower threshold for testing
  console.log(`Analyzing: ${contentLength} chars, ${imageCount} images`);

  if (contentLength > 100000 || imageCount > 30) {
    type = 'photo-event';
    isHeavy = true;
  } else if (imageCount > 10) {
    type = 'mixed';
    isHeavy = false;
  } else {
    type = 'article';
    isHeavy = false;
  }

  return {
    type,
    isHeavy,
    imageCount,
    contentLength,
    hasGoogleDriveLink
  };
}