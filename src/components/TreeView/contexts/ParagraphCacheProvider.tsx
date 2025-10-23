/**
 * ParagraphCacheProvider - Context provider for singleton paragraph cache
 *
 * Phase 2 Infrastructure - Component for Phase 0
 *
 * Provides a singleton Map for caching Skia Paragraph objects to avoid
 * expensive re-creation on every render.
 *
 * Features:
 * - Singleton behavior with useRef (survives re-renders)
 * - LRU eviction to prevent memory leaks (max 500 entries)
 * - Stable API reference (no unnecessary re-renders)
 * - Cleanup on unmount
 * - Type-safe cache key generation
 *
 * Usage:
 * ```tsx
 * <ParagraphCacheProvider>
 *   <TreeView />
 * </ParagraphCacheProvider>
 * ```
 *
 * Best Practices (from React Context optimization):
 * - Use useRef for singleton (not useMemo - can be recalculated)
 * - Wrap API in second useRef to prevent new object creation
 * - Implement LRU eviction to prevent unlimited growth
 * - Clear cache on unmount to prevent memory leaks
 */

import React, { createContext, useContext, useRef, useEffect } from 'react';
import { Paragraph } from '@shopify/react-native-skia';

export interface CacheAPI {
  get: (key: string) => Paragraph | undefined;
  set: (key: string, value: Paragraph) => void;
  delete: (key: string) => void;
  clear: () => void;
  has: (key: string) => boolean;
  size: () => number;
}

export const ParagraphCacheContext = createContext<CacheAPI | null>(null);

export interface ParagraphCacheProviderProps {
  children: React.ReactNode;
  maxSize?: number; // Max cache entries before LRU eviction
}

/**
 * ParagraphCacheProvider component
 *
 * Provides singleton cache for Skia Paragraph objects with LRU eviction.
 * Cache persists across renders but clears on unmount.
 *
 * @param props - Provider props
 * @returns Provider with children
 */
export const ParagraphCacheProvider: React.FC<ParagraphCacheProviderProps> = ({
  children,
  maxSize = 500, // Default: max visible nodes on screen
}) => {
  // useRef for singleton behavior - creates once, persists across renders
  const cacheRef = useRef(new Map<string, Paragraph>());

  // Wrap API in second useRef - prevents new object creation on each render
  // This ensures stable reference and no consumer re-renders
  const cacheAPI = useRef<CacheAPI>({
    get: (key: string) => cacheRef.current.get(key),

    set: (key: string, value: Paragraph) => {
      // LRU eviction: Remove oldest entry if cache is full
      if (cacheRef.current.size >= maxSize) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) {
          cacheRef.current.delete(firstKey);
        }
      }
      cacheRef.current.set(key, value);
    },

    delete: (key: string) => cacheRef.current.delete(key),

    clear: () => cacheRef.current.clear(),

    has: (key: string) => cacheRef.current.has(key),

    size: () => cacheRef.current.size,
  }).current; // .current ensures stable reference

  // Clear cache on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cacheRef.current.clear();
    };
  }, []);

  return <ParagraphCacheContext.Provider value={cacheAPI}>{children}</ParagraphCacheContext.Provider>;
};

/**
 * useParagraphCache hook
 *
 * Access paragraph cache from context.
 * Throws error if used outside ParagraphCacheProvider.
 *
 * @returns CacheAPI
 * @throws Error if used outside provider
 */
export const useParagraphCache = (): CacheAPI => {
  const cache = useContext(ParagraphCacheContext);

  if (!cache) {
    throw new Error('useParagraphCache must be used within ParagraphCacheProvider');
  }

  return cache;
};

/**
 * Generate cache key for paragraph
 *
 * Creates consistent cache key from paragraph parameters.
 * Used to ensure cache hits for identical paragraphs.
 *
 * @param text - Paragraph text
 * @param weight - Font weight (regular, bold)
 * @param size - Font size in points
 * @param color - Text color hex
 * @param maxWidth - Maximum paragraph width
 * @returns Cache key string
 */
export const generateParagraphCacheKey = (
  text: string,
  weight: string,
  size: number,
  color: string,
  maxWidth: number,
): string => {
  return `${text}-${weight}-${size}-${color}-${maxWidth}`;
};

/**
 * Cache statistics for debugging
 *
 * Get cache performance metrics.
 *
 * @param cache - CacheAPI instance
 * @returns Cache stats object
 */
export const getCacheStats = (cache: CacheAPI) => {
  return {
    size: cache.size(),
    // Note: Hit/miss tracking would require wrapper functions
    // Can be added if needed for performance monitoring
  };
};
