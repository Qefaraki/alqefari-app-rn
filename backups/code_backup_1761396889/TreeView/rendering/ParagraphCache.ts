/**
 * ParagraphCache - LRU cache for Skia Paragraph objects
 *
 * Phase 2 Day 2 - Extracted from TreeView.js (lines 301-339)
 *
 * Caches created Skia Paragraph objects to avoid expensive recreation.
 * Uses LRU (Least Recently Used) eviction strategy with 500 entry cap.
 *
 * Performance Impact:
 * - Paragraph creation: ~2-5ms per call (font shaping, layout)
 * - Cache hit: ~0.1ms (Map lookup + reordering)
 * - Typical tree: 70-80% cache hit rate
 *
 * Cache Strategy:
 * - Key: `${text}-${fontWeight}-${fontSize}-${color}-${maxWidth}`
 * - Size: 500 entries (covers ~2 full tree views @ 250 nodes each)
 * - Eviction: LRU (removes oldest entry when exceeding size limit)
 * - Reordering: Move accessed entries to end (most recently used)
 */

import { Paragraph } from '@shopify/react-native-skia';
import { createArabicParagraph } from './ArabicTextRenderer';

// Cache configuration
const PARAGRAPH_CACHE_SIZE = 500;

// Cache storage (Map preserves insertion order for LRU)
const paragraphCache = new Map<string, Paragraph>();

// Cache statistics
let paragraphCacheHits = 0;
let paragraphCacheMisses = 0;

/**
 * Create cache key from paragraph parameters
 *
 * @param text - Text content
 * @param fontWeight - Font weight ('normal' or 'bold')
 * @param fontSize - Font size in pixels
 * @param color - Text color (hex string)
 * @param maxWidth - Maximum width in pixels
 * @returns Cache key string
 */
function createCacheKey(
  text: string,
  fontWeight: 'normal' | 'bold',
  fontSize: number,
  color: string,
  maxWidth: number
): string {
  return `${text}-${fontWeight}-${fontSize}-${color}-${maxWidth}`;
}

/**
 * Get cached paragraph or create new one
 *
 * Checks cache first. If found, moves entry to end (most recently used).
 * If not found, creates new paragraph and adds to cache with LRU eviction.
 *
 * @param text - Arabic text to render
 * @param fontWeight - Font weight: 'normal' or 'bold'
 * @param fontSize - Font size in pixels
 * @param color - Text color (hex string)
 * @param maxWidth - Maximum paragraph width in pixels
 * @returns Skia Paragraph object or null if creation fails
 *
 * @example
 * const paragraph = getCachedParagraph('محمد', 'bold', 14, '#242121', 120);
 * if (paragraph) {
 *   // Render with <Paragraph paragraph={paragraph} x={100} y={50} />
 * }
 */
export function getCachedParagraph(
  text: string,
  fontWeight: 'normal' | 'bold',
  fontSize: number,
  color: string,
  maxWidth: number
): Paragraph | null {
  if (!text) return null;

  // Create cache key
  const key = createCacheKey(text, fontWeight, fontSize, color, maxWidth);

  // Check cache first
  if (paragraphCache.has(key)) {
    paragraphCacheHits++;

    // Move to end (most recently used) - LRU reordering
    const paragraph = paragraphCache.get(key)!;
    paragraphCache.delete(key);
    paragraphCache.set(key, paragraph);

    return paragraph;
  }

  // Cache miss - create new paragraph
  paragraphCacheMisses++;
  const paragraph = createArabicParagraph(text, fontWeight, fontSize, color, maxWidth);

  if (paragraph) {
    paragraphCache.set(key, paragraph);

    // LRU eviction if cache exceeds size limit
    if (paragraphCache.size > PARAGRAPH_CACHE_SIZE) {
      const firstKey = paragraphCache.keys().next().value;
      if (firstKey) {
        paragraphCache.delete(firstKey);
      }
    }
  }

  return paragraph;
}

/**
 * Clear paragraph cache
 *
 * Removes all cached paragraphs. Useful for memory cleanup or testing.
 */
export function clearParagraphCache(): void {
  paragraphCache.clear();
  paragraphCacheHits = 0;
  paragraphCacheMisses = 0;
}

/**
 * Get cache statistics
 *
 * Returns cache performance metrics for debugging and optimization.
 *
 * @returns Cache stats object
 */
export function getCacheStats() {
  const totalRequests = paragraphCacheHits + paragraphCacheMisses;
  const hitRate = totalRequests > 0 ? paragraphCacheHits / totalRequests : 0;

  return {
    size: paragraphCache.size,
    maxSize: PARAGRAPH_CACHE_SIZE,
    hits: paragraphCacheHits,
    misses: paragraphCacheMisses,
    hitRate: hitRate,
    hitRatePercent: (hitRate * 100).toFixed(1),
  };
}

/**
 * Remove specific entry from cache
 *
 * Useful for invalidating cache when text parameters change.
 *
 * @param text - Text content
 * @param fontWeight - Font weight
 * @param fontSize - Font size
 * @param color - Text color
 * @param maxWidth - Maximum width
 * @returns True if entry was removed, false if not found
 */
export function removeCachedParagraph(
  text: string,
  fontWeight: 'normal' | 'bold',
  fontSize: number,
  color: string,
  maxWidth: number
): boolean {
  const key = createCacheKey(text, fontWeight, fontSize, color, maxWidth);
  return paragraphCache.delete(key);
}

/**
 * Prewarm cache with common paragraphs
 *
 * Useful for preloading frequently used text (names, titles).
 * Reduces initial render latency.
 *
 * @param entries - Array of paragraph parameter sets to prewarm
 */
export function prewarmCache(
  entries: Array<{
    text: string;
    fontWeight: 'normal' | 'bold';
    fontSize: number;
    color: string;
    maxWidth: number;
  }>
): void {
  entries.forEach((entry) => {
    getCachedParagraph(
      entry.text,
      entry.fontWeight,
      entry.fontSize,
      entry.color,
      entry.maxWidth
    );
  });
}

// Export constants for testing
export const PARAGRAPH_CACHE_CONSTANTS = {
  CACHE_SIZE: PARAGRAPH_CACHE_SIZE,
};
