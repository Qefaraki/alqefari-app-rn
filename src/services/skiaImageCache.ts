import { Skia, SkImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

interface CacheEntry {
  img: SkImage;
  bytes: number;
  ttl?: number;
}

interface LoadOptions {
  fetchOptions?: RequestInit;
  ttlMs?: number;
}

class SkiaImageCache {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<SkImage>>();
  private totalBytes = 0;
  private budget = Platform.OS === 'ios' ? 64 * 1024 * 1024 : 48 * 1024 * 1024;

  /**
   * Transform URL to request specific size variant
   */
  urlForBucket(url: string, bucket: number): string {
    // Guard against undefined/null URLs
    if (!url || typeof url !== 'string') {
      return '';
    }
    
    if (url.includes('supabase.co/storage/')) {
      try {
        // Transform from /object/ to /render/image/ for transformations
        const transformedUrl = url.replace(
          '/storage/v1/object/public/',
          '/storage/v1/render/image/public/'
        );
        
        const urlObj = new URL(transformedUrl);
        // Try multiple parameter combinations
        urlObj.searchParams.set('width', bucket.toString());
        urlObj.searchParams.set('height', bucket.toString());
        urlObj.searchParams.set('resize', 'contain');
        urlObj.searchParams.set('quality', '80');
        
        const finalUrl = urlObj.toString();
        
        // Removed console.log for cleaner output
        
        return finalUrl;
      } catch (error) {
        if (__DEV__) {
          console.log(`🌳 TREE CACHE: Failed to transform URL`, error.message);
        }
        return url;
      }
    }
    return url;
  }

  /**
   * Get cached image if available and not expired
   */
  get(key: string): SkImage | null {
    const entry = this.cache.get(key);
    if (!entry) {
      if (__DEV__) {
        console.log(`🌳 TREE CACHE: Key not found in cache`);
        console.log(`  Looking for: ${key}`);
        console.log(`  Cache keys: ${Array.from(this.cache.keys()).map(k => k ? k.substring(k.lastIndexOf('/') + 1).split('?')[0] : 'unknown').join(', ')}`);
      }
      return null;
    }
    
    // Check TTL
    if (entry.ttl && Date.now() > entry.ttl) {
      this.evict(key);
      return null;
    }
    
    // Move to end (MRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    if (__DEV__) {
      const filename = key ? key.substring(key.lastIndexOf('/') + 1).split('?')[0] : 'unknown';
      console.log(`🌳 TREE CACHE HIT: ${filename}`);
    }
    
    return entry.img;
  }

  /**
   * Get from cache or load from network
   */
  async getOrLoad(url: string, bucket = 256, options?: LoadOptions): Promise<SkImage> {
    const finalUrl = this.urlForBucket(url, bucket);
    const key = finalUrl;
    
    if (__DEV__) {
      console.log(`🌳 TREE CACHE: getOrLoad called`);
      console.log(`  URL: ${url}`);
      console.log(`  Bucket: ${bucket}`);
      console.log(`  Key: ${key}`);
      console.log(`  Cache entries: ${this.cache.size}`);
    }
    
    // Check cache first
    const cached = this.get(key);
    if (cached) return cached;
    
    // Check if already loading
    if (this.inflight.has(key)) {
      return this.inflight.get(key)!;
    }
    
    // Start loading
    const loadPromise = this.load(finalUrl, options);
    this.inflight.set(key, loadPromise);
    
    try {
      const img = await loadPromise;
      const bytes = img.width() * img.height() * 4;
      
      // Add to cache
      this.cache.set(key, {
        img,
        bytes,
        ttl: options?.ttlMs ? Date.now() + options.ttlMs : undefined
      });
      this.totalBytes += bytes;
      
      // Evict if needed
      this.evictIfNeeded();
      
      if (__DEV__) {
        const filename = key ? key.substring(key.lastIndexOf('/') + 1).split('?')[0] : 'unknown';
        console.log(`🌳 TREE CACHE MISS: Loaded ${filename} (${img.width()}x${img.height()}, ${(bytes/1024/1024).toFixed(1)}MB)`);
      }
      
      return img;
    } catch (error) {
      if (__DEV__) {
        const filename = key ? key.substring(key.lastIndexOf('/') + 1).split('?')[0] : 'unknown';
        console.log(`🌳 TREE CACHE ERROR: Failed to load ${filename}`, error.message);
      }
      throw error;
    } finally {
      this.inflight.delete(key);
    }
  }

  /**
   * Prefetch an image without blocking
   */
  async prefetch(url: string, bucket = 256): Promise<void> {
    try {
      await this.getOrLoad(url, bucket);
    } catch {
      // Prefetch errors are non-fatal
    }
  }

  /**
   * Load image from network
   */
  private async load(url: string, options?: LoadOptions): Promise<SkImage> {
    if (__DEV__) {
      console.log(`🌳 TREE CACHE: Fetching URL: ${url}`);
    }
    
    let response = await fetch(url, options?.fetchOptions);
    
    // If transformation endpoint fails, try original URL
    if (!response.ok && url.includes('/render/image/')) {
      const fallbackUrl = url.replace(
        '/storage/v1/render/image/public/',
        '/storage/v1/object/public/'
      ).split('?')[0]; // Remove transformation params
      
      if (__DEV__) {
        console.log(`🌳 TREE CACHE: Transformation failed (${response.status}), falling back to original`);
      }
      
      response = await fetch(fallbackUrl, options?.fetchOptions);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const data = Skia.Data.fromBytes(new Uint8Array(arrayBuffer));
    const img = Skia.Image.MakeImageFromEncoded(data);
    
    if (!img) {
      throw new Error('Failed to decode image');
    }
    
    if (__DEV__) {
      console.log(`🌳 TREE CACHE: Image decoded - ${img.width()}x${img.height()}`);
      if (img.width() > 512) {
        console.warn(`⚠️ TREE CACHE: Large image loaded! Expected ≤512px, got ${img.width()}x${img.height()}`);
      }
    }
    
    return img;
  }

  /**
   * Evict oldest entries if over budget
   */
  private evictIfNeeded() {
    while (this.totalBytes > this.budget && this.cache.size > 0) {
      // Get first key (oldest due to insertion order)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.evict(firstKey);
      }
    }
  }

  /**
   * Evict a specific entry
   */
  private evict(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return;
    
    this.cache.delete(key);
    this.totalBytes -= entry.bytes;
    
    // Dispose native memory
    try {
      if (entry.img.dispose && typeof entry.img.dispose === 'function') {
        entry.img.dispose();
      }
    } catch (error) {
      // Ignore disposal errors
    }
    
    if (__DEV__) {
      const filename = key ? key.substring(key.lastIndexOf('/') + 1).split('?')[0] : 'unknown';
      console.log(`🌳 TREE CACHE: Evicted ${filename} (${(entry.bytes/1024/1024).toFixed(1)}MB)`);
    }
  }

  /**
   * Clear all cached images
   */
  clear() {
    for (const entry of this.cache.values()) {
      try {
        if (entry.img.dispose && typeof entry.img.dispose === 'function') {
          entry.img.dispose();
        }
      } catch {}
    }
    
    this.cache.clear();
    this.inflight.clear();
    this.totalBytes = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      totalBytes: this.totalBytes,
      totalMB: (this.totalBytes / 1024 / 1024).toFixed(1),
      budgetMB: (this.budget / 1024 / 1024).toFixed(1),
      utilization: ((this.totalBytes / this.budget) * 100).toFixed(0) + '%'
    };
  }
}

export default new SkiaImageCache();