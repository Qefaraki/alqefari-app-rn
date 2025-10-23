/**
 * ParagraphCache tests
 * Phase 2 Day 2
 */

import {
  getCachedParagraph,
  clearParagraphCache,
  getCacheStats,
  removeCachedParagraph,
  prewarmCache,
  PARAGRAPH_CACHE_CONSTANTS,
} from '../../../../src/components/TreeView/rendering/ParagraphCache';

// Mock ArabicTextRenderer
const mockParagraph = {
  layout: jest.fn(),
  getHeight: jest.fn(() => 14),
};

jest.mock('../../../../src/components/TreeView/rendering/ArabicTextRenderer', () => ({
  createArabicParagraph: jest.fn((text, fontWeight, fontSize, color, maxWidth) => {
    if (!text) return null;
    return { ...mockParagraph, text, fontWeight, fontSize, color, maxWidth };
  }),
}));

describe('ParagraphCache', () => {
  beforeEach(() => {
    clearParagraphCache();
    jest.clearAllMocks();
  });

  describe('getCachedParagraph', () => {
    it('should create paragraph on first call (cache miss)', () => {
      const paragraph = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeTruthy();
      expect(paragraph.text).toBe('محمد');
    });

    it('should return cached paragraph on second call (cache hit)', () => {
      const { createArabicParagraph } = require('../../../../src/components/TreeView/rendering/ArabicTextRenderer');

      // First call - cache miss
      const para1 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      expect(createArabicParagraph).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const para2 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      expect(createArabicParagraph).toHaveBeenCalledTimes(1); // Still 1 (cached)
      expect(para2).toBe(para1); // Same object
    });

    it('should return null for empty text', () => {
      const paragraph = getCachedParagraph('', 'normal', 14, '#242121', 120);

      expect(paragraph).toBeNull();
    });

    it('should create different cache entries for different text', () => {
      const para1 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      const para2 = getCachedParagraph('أحمد', 'normal', 14, '#242121', 120);

      expect(para1).not.toBe(para2);
      expect(para1.text).toBe('محمد');
      expect(para2.text).toBe('أحمد');
    });

    it('should create different cache entries for different font weights', () => {
      const para1 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      const para2 = getCachedParagraph('محمد', 'bold', 14, '#242121', 120);

      expect(para1).not.toBe(para2);
      expect(para1.fontWeight).toBe('normal');
      expect(para2.fontWeight).toBe('bold');
    });

    it('should create different cache entries for different font sizes', () => {
      const para1 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      const para2 = getCachedParagraph('محمد', 'normal', 16, '#242121', 120);

      expect(para1).not.toBe(para2);
    });

    it('should create different cache entries for different colors', () => {
      const para1 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      const para2 = getCachedParagraph('محمد', 'normal', 14, '#A13333', 120);

      expect(para1).not.toBe(para2);
    });

    it('should create different cache entries for different max widths', () => {
      const para1 = getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      const para2 = getCachedParagraph('محمد', 'normal', 14, '#242121', 150);

      expect(para1).not.toBe(para2);
    });

    it('should move accessed entry to end (LRU reordering)', () => {
      // Create 3 entries
      getCachedParagraph('نص1', 'normal', 14, '#242121', 120);
      getCachedParagraph('نص2', 'normal', 14, '#242121', 120);
      getCachedParagraph('نص3', 'normal', 14, '#242121', 120);

      // Access first entry again (moves to end)
      getCachedParagraph('نص1', 'normal', 14, '#242121', 120);

      const stats = getCacheStats();
      expect(stats.size).toBe(3);
    });

    it('should evict oldest entry when exceeding cache size', () => {
      const { createArabicParagraph } = require('../../../../src/components/TreeView/rendering/ArabicTextRenderer');

      // Fill cache to limit + 1
      const cacheSize = PARAGRAPH_CACHE_CONSTANTS.CACHE_SIZE;
      for (let i = 0; i <= cacheSize; i++) {
        getCachedParagraph(`نص${i}`, 'normal', 14, '#242121', 120);
      }

      const stats = getCacheStats();
      expect(stats.size).toBe(cacheSize); // Should be capped at max size

      // First entry should be evicted
      getCachedParagraph('نص0', 'normal', 14, '#242121', 120);
      expect(createArabicParagraph).toHaveBeenCalledTimes(cacheSize + 2); // +1 for evicted, +1 for new
    });
  });

  describe('clearParagraphCache', () => {
    it('should clear all cached paragraphs', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      getCachedParagraph('أحمد', 'normal', 14, '#242121', 120);

      let stats = getCacheStats();
      expect(stats.size).toBe(2);

      clearParagraphCache();

      stats = getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should reset cache statistics', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Miss
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Hit

      let stats = getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      clearParagraphCache();

      stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache size', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      getCachedParagraph('أحمد', 'normal', 14, '#242121', 120);

      const stats = getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(PARAGRAPH_CACHE_CONSTANTS.CACHE_SIZE);
    });

    it('should track cache hits and misses', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Miss
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Hit
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Hit
      getCachedParagraph('أحمد', 'normal', 14, '#242121', 120); // Miss

      const stats = getCacheStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Miss
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Hit
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Hit
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120); // Hit

      const stats = getCacheStats();

      expect(stats.hitRate).toBe(0.75); // 3 hits / 4 total
      expect(stats.hitRatePercent).toBe('75.0');
    });

    it('should handle zero requests', () => {
      const stats = getCacheStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('removeCachedParagraph', () => {
    it('should remove specific entry from cache', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      getCachedParagraph('أحمد', 'normal', 14, '#242121', 120);

      let stats = getCacheStats();
      expect(stats.size).toBe(2);

      const removed = removeCachedParagraph('محمد', 'normal', 14, '#242121', 120);

      expect(removed).toBe(true);
      stats = getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should return false if entry not found', () => {
      const removed = removeCachedParagraph('nonexistent', 'normal', 14, '#242121', 120);

      expect(removed).toBe(false);
    });

    it('should not affect other entries', () => {
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      getCachedParagraph('أحمد', 'normal', 14, '#242121', 120);

      removeCachedParagraph('محمد', 'normal', 14, '#242121', 120);

      // أحمد should still be cached
      const { createArabicParagraph } = require('../../../../src/components/TreeView/rendering/ArabicTextRenderer');
      createArabicParagraph.mockClear();

      getCachedParagraph('أحمد', 'normal', 14, '#242121', 120);
      expect(createArabicParagraph).not.toHaveBeenCalled(); // Cache hit
    });
  });

  describe('prewarmCache', () => {
    it('should prewarm cache with provided entries', () => {
      const entries = [
        { text: 'محمد', fontWeight: 'normal', fontSize: 14, color: '#242121', maxWidth: 120 },
        { text: 'أحمد', fontWeight: 'bold', fontSize: 16, color: '#A13333', maxWidth: 100 },
      ];

      prewarmCache(entries);

      const stats = getCacheStats();
      expect(stats.size).toBe(2);
    });

    it('should reduce cache misses for prewarmed entries', () => {
      const entries = [
        { text: 'محمد', fontWeight: 'normal', fontSize: 14, color: '#242121', maxWidth: 120 },
      ];

      prewarmCache(entries);

      const { createArabicParagraph } = require('../../../../src/components/TreeView/rendering/ArabicTextRenderer');
      createArabicParagraph.mockClear();

      // Should hit cache
      getCachedParagraph('محمد', 'normal', 14, '#242121', 120);
      expect(createArabicParagraph).not.toHaveBeenCalled();
    });

    it('should handle empty entries array', () => {
      prewarmCache([]);

      const stats = getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('PARAGRAPH_CACHE_CONSTANTS', () => {
    it('should export CACHE_SIZE', () => {
      expect(PARAGRAPH_CACHE_CONSTANTS.CACHE_SIZE).toBe(500);
    });
  });

  describe('LRU eviction', () => {
    it('should preserve frequently accessed entries', () => {
      const { createArabicParagraph } = require('../../../../src/components/TreeView/rendering/ArabicTextRenderer');

      // Create 3 entries
      getCachedParagraph('نص1', 'normal', 14, '#242121', 120);
      getCachedParagraph('نص2', 'normal', 14, '#242121', 120);
      getCachedParagraph('نص3', 'normal', 14, '#242121', 120);

      // Access نص1 multiple times (moves to end)
      getCachedParagraph('نص1', 'normal', 14, '#242121', 120);
      getCachedParagraph('نص1', 'normal', 14, '#242121', 120);

      // Add one more entry (should evict نص2, not نص1)
      getCachedParagraph('نص4', 'normal', 14, '#242121', 120);

      createArabicParagraph.mockClear();

      // نص1 should still be cached
      getCachedParagraph('نص1', 'normal', 14, '#242121', 120);
      expect(createArabicParagraph).not.toHaveBeenCalled(); // Cache hit
    });
  });
});
