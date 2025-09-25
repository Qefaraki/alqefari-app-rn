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
  // Pattern 1: Google Drive folder links (highest priority)
  const driveFolderRegex = /https?:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+(?:\?[^"'\s<>]*)*/gi;
  const driveFolderMatch = html.match(driveFolderRegex);
  if (driveFolderMatch && driveFolderMatch[0]) {
    return {
      url: driveFolderMatch[0].replace(/&amp;/g, '&'),
      type: 'drive'
    };
  }

  // Pattern 2: Google Drive file/open links
  const driveFileRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)[a-zA-Z0-9_-]+(?:\/[^"'\s<>]*)*/gi;
  const driveFileMatch = html.match(driveFileRegex);
  if (driveFileMatch && driveFileMatch[0]) {
    return {
      url: driveFileMatch[0].replace(/&amp;/g, '&'),
      type: 'drive'
    };
  }

  // Pattern 3: Google Photos shared albums
  const photosRegex = /https?:\/\/photos\.google\.com\/share\/[^"'\s<>]+/gi;
  const photosMatch = html.match(photosRegex);
  if (photosMatch && photosMatch[0]) {
    return {
      url: photosMatch[0].replace(/&amp;/g, '&'),
      type: 'photos'
    };
  }

  // Pattern 4: Google Photos app links
  const photosAppRegex = /https?:\/\/photos\.app\.goo\.gl\/[^"'\s<>]+/gi;
  const photosAppMatch = html.match(photosAppRegex);
  if (photosAppMatch && photosAppMatch[0]) {
    return {
      url: photosAppMatch[0].replace(/&amp;/g, '&'),
      type: 'photos'
    };
  }

  // Pattern 5: Other photo services (Flickr, Imgur, etc)
  const otherPhotoServices = /https?:\/\/(www\.)?(flickr\.com|imgur\.com)\/[^"'\s<>]+/gi;
  const otherMatch = html.match(otherPhotoServices);
  if (otherMatch && otherMatch[0]) {
    return {
      url: otherMatch[0].replace(/&amp;/g, '&'),
      type: 'other'
    };
  }

  // Fallback: Link to original WordPress article
  const fallbackUrl = article.permalink || `https://alqefari.com/?p=${article.id}`;
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
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null && images.length < limit) {
    const imageUrl = match[1];
    // Skip tiny images (likely icons)
    if (!imageUrl.includes('20x20') && !imageUrl.includes('32x32')) {
      images.push(imageUrl.replace(/&amp;/g, '&'));
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