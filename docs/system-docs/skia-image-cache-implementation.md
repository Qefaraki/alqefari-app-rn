# Minimal LOD-Ready Skia Image Cache Implementation

## Overview
Implementing a lightweight image cache for React Native Skia to improve TreeView performance by caching decoded SkImage objects.

## Goals
- Cache SkImage objects used in TreeView
- Fixed bucket=256 for now; API supports future LOD by passing bucket
- Keep current gestures/UX untouched
- No fades, no RAF/ticker, no complex queues

## Architecture

### 1. Cache Service (`src/services/skiaImageCache.ts`)
- **Storage**: Map-based LRU with reorder on get
- **Deduplication**: `inflight` Map to prevent concurrent loads of same image
- **Memory Management**: 
  - Budget: iOS 64MB, Android 48MB
  - Size calculation: width * height * 4 bytes
  - Eviction: Remove oldest (first key), dispose native memory
- **LOD Support**: `urlForBucket(url, bucket)` transforms URL for size variants
- **Key Strategy**: Use final URL from urlForBucket as cache key

### 2. React Hook (`src/hooks/useCachedSkiaImage.ts`)
- Simple hook that returns `SkImage | null`
- Synchronous cache check first
- Async load if not cached
- Mounted ref to prevent state updates after unmount
- Dependencies: Only url and bucket

### 3. TreeView Integration
- Replace `useImage` with `useCachedSkiaImage` in ImageNode
- Keep existing skeleton loader
- Prefetch up to 6 neighbor nodes on visibility change
- No opacity changes or fade animations

## Implementation Details

### Cache API
```typescript
class SkiaImageCache {
  get(key: string): SkImage | null
  async getOrLoad(url: string, bucket?: number, options?: LoadOptions): Promise<SkImage>
  async prefetch(url: string, bucket?: number): Promise<void>
  urlForBucket(url: string, bucket: number): string
}
```

### Memory Management
- Evict oldest entries when over budget
- Call `img.dispose?.()` in try/catch to free native memory
- Track total bytes used

### URL Transformation
- Supabase: Add `?width={bucket}` parameter
- Preserve existing query parameters
- Future: Support other CDN patterns

### Logging
- Minimal __DEV__ logs: hits/misses/evictions
- Format: `🎯 CACHE HIT`, `🌐 CACHE MISS`, `🗑️ CACHE: Evicted`

## Testing Plan
1. Launch app and navigate tree
2. Check console for cache hits on revisited nodes
3. Verify faster loading times
4. Monitor memory usage stays under budget
5. Test with rapid pan/zoom

## Future Enhancements (Not in this implementation)
- Dynamic bucket calculation based on zoom level
- Network-aware prefetching
- Priority queue for on-screen vs prefetch
- Cache persistence across sessions