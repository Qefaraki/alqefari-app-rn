/**
 * ParagraphCacheProvider Tests
 *
 * Test suite for singleton paragraph cache context provider.
 *
 * Coverage:
 * - Cache API (get, set, delete, clear, has, size)
 * - LRU eviction
 * - Singleton behavior
 * - Cleanup on unmount
 * - Context provision
 * - Cache key generation
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  ParagraphCacheProvider,
  useParagraphCache,
  generateParagraphCacheKey,
  getCacheStats,
} from '../../../../src/components/TreeView/contexts/ParagraphCacheProvider';

describe('ParagraphCacheProvider', () => {
  // ============================================================================
  // CACHE API
  // ============================================================================

  describe('Cache API', () => {
    test('should provide get/set/delete/clear/has/size methods', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      expect(cacheAPI.get).toBeInstanceOf(Function);
      expect(cacheAPI.set).toBeInstanceOf(Function);
      expect(cacheAPI.delete).toBeInstanceOf(Function);
      expect(cacheAPI.clear).toBeInstanceOf(Function);
      expect(cacheAPI.has).toBeInstanceOf(Function);
      expect(cacheAPI.size).toBeInstanceOf(Function);
    });

    test('should store and retrieve values', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      const mockParagraph = { width: 100, height: 20 };
      cacheAPI.set('test-key', mockParagraph);

      expect(cacheAPI.get('test-key')).toBe(mockParagraph);
      expect(cacheAPI.has('test-key')).toBe(true);
      expect(cacheAPI.size()).toBe(1);
    });

    test('should delete values', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      cacheAPI.set('test-key', { width: 100 });
      expect(cacheAPI.has('test-key')).toBe(true);

      cacheAPI.delete('test-key');
      expect(cacheAPI.has('test-key')).toBe(false);
      expect(cacheAPI.size()).toBe(0);
    });

    test('should clear all values', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      cacheAPI.set('key1', { width: 100 });
      cacheAPI.set('key2', { width: 200 });
      expect(cacheAPI.size()).toBe(2);

      cacheAPI.clear();
      expect(cacheAPI.size()).toBe(0);
      expect(cacheAPI.has('key1')).toBe(false);
      expect(cacheAPI.has('key2')).toBe(false);
    });

    test('should return undefined for missing keys', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      expect(cacheAPI.get('non-existent')).toBeUndefined();
      expect(cacheAPI.has('non-existent')).toBe(false);
    });
  });

  // ============================================================================
  // LRU EVICTION
  // ============================================================================

  describe('LRU eviction', () => {
    test('should evict oldest entry when maxSize reached', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider maxSize={3}>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      cacheAPI.set('key1', { width: 100 });
      cacheAPI.set('key2', { width: 200 });
      cacheAPI.set('key3', { width: 300 });
      expect(cacheAPI.size()).toBe(3);

      // Adding 4th entry should evict key1 (oldest)
      cacheAPI.set('key4', { width: 400 });
      expect(cacheAPI.size()).toBe(3);
      expect(cacheAPI.has('key1')).toBe(false); // Evicted
      expect(cacheAPI.has('key2')).toBe(true);
      expect(cacheAPI.has('key3')).toBe(true);
      expect(cacheAPI.has('key4')).toBe(true);
    });

    test('should use default maxSize of 500', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      // Add 501 entries
      for (let i = 0; i < 501; i++) {
        cacheAPI.set(`key${i}`, { width: i });
      }

      // Should have evicted first entry
      expect(cacheAPI.size()).toBe(500);
      expect(cacheAPI.has('key0')).toBe(false); // Evicted
      expect(cacheAPI.has('key500')).toBe(true); // Latest
    });

    test('should handle eviction with empty cache', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider maxSize={1}>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      // First set should work without eviction
      cacheAPI.set('key1', { width: 100 });
      expect(cacheAPI.size()).toBe(1);
    });
  });

  // ============================================================================
  // SINGLETON BEHAVIOR
  // ============================================================================

  describe('Singleton behavior', () => {
    test('should persist cache across re-renders', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return <Text>Test</Text>;
      };

      const { rerender } = render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      cacheAPI.set('key1', { width: 100 });
      expect(cacheAPI.size()).toBe(1);

      // Re-render
      rerender(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      // Cache should persist
      expect(cacheAPI.has('key1')).toBe(true);
      expect(cacheAPI.size()).toBe(1);
    });

    test('should provide stable API reference', () => {
      let cacheAPI1, cacheAPI2;
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        const api = useParagraphCache();
        if (renderCount === 1) cacheAPI1 = api;
        if (renderCount === 2) cacheAPI2 = api;
        return <Text>Render {renderCount}</Text>;
      };

      const { rerender } = render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      rerender(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      // API reference should be stable
      expect(cacheAPI1).toBe(cacheAPI2);
    });
  });

  // ============================================================================
  // CLEANUP ON UNMOUNT
  // ============================================================================

  describe('Cleanup on unmount', () => {
    test('should clear cache when provider unmounts', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      const { unmount } = render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      cacheAPI.set('key1', { width: 100 });
      expect(cacheAPI.size()).toBe(1);

      // Unmount provider
      unmount();

      // Cache should be cleared
      expect(cacheAPI.size()).toBe(0);
    });
  });

  // ============================================================================
  // CONTEXT PROVISION
  // ============================================================================

  describe('Context provision', () => {
    test('should throw error when used outside provider', () => {
      const TestComponent = () => {
        useParagraphCache();
        return null;
      };

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useParagraphCache must be used within ParagraphCacheProvider');
    });

    test('should provide cache to nested consumers', () => {
      let nestedCacheAPI;
      const NestedConsumer = () => {
        nestedCacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <Text>
            <NestedConsumer />
          </Text>
        </ParagraphCacheProvider>
      );

      expect(nestedCacheAPI).toBeDefined();
      expect(nestedCacheAPI.set).toBeInstanceOf(Function);
    });
  });

  // ============================================================================
  // CACHE KEY GENERATION
  // ============================================================================

  describe('generateParagraphCacheKey', () => {
    test('should generate consistent keys for same inputs', () => {
      const key1 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);
      const key2 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);

      expect(key1).toBe(key2);
    });

    test('should generate different keys for different text', () => {
      const key1 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);
      const key2 = generateParagraphCacheKey('محمد', 'bold', 14, '#242121', 100);

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for different weights', () => {
      const key1 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);
      const key2 = generateParagraphCacheKey('سليمان', 'regular', 14, '#242121', 100);

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for different sizes', () => {
      const key1 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);
      const key2 = generateParagraphCacheKey('سليمان', 'bold', 16, '#242121', 100);

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for different colors', () => {
      const key1 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);
      const key2 = generateParagraphCacheKey('سليمان', 'bold', 14, '#FFFFFF', 100);

      expect(key1).not.toBe(key2);
    });

    test('should generate different keys for different widths', () => {
      const key1 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 100);
      const key2 = generateParagraphCacheKey('سليمان', 'bold', 14, '#242121', 200);

      expect(key1).not.toBe(key2);
    });
  });

  // ============================================================================
  // CACHE STATISTICS
  // ============================================================================

  describe('getCacheStats', () => {
    test('should return cache size', () => {
      let cacheAPI;
      const TestComponent = () => {
        cacheAPI = useParagraphCache();
        return null;
      };

      render(
        <ParagraphCacheProvider>
          <TestComponent />
        </ParagraphCacheProvider>
      );

      cacheAPI.set('key1', { width: 100 });
      cacheAPI.set('key2', { width: 200 });

      const stats = getCacheStats(cacheAPI);
      expect(stats.size).toBe(2);
    });
  });
});
