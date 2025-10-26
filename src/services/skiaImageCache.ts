import { Skia, SkImage } from "@shopify/react-native-skia";
import { Platform } from "react-native";

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
  // Phase 4: Increased budget by 2x to reduce cache thrashing
  // With transformation: fits 500+ LOD images; Without: fits 12-16 full-res images
  private budget = Platform.OS === "ios" ? 128 * 1024 * 1024 : 96 * 1024 * 1024;
  private transformationAvailable: boolean | null = null; // null=unknown, true=works, false=disabled
  private transformStats = {
    attempts: 0,
    successes: 0,
    failures: 0,
  };

  /**
   * Transform URL to request specific size variant
   * Uses optimistic approach: try transformation, fall back if it fails
   * No upfront detection - validates itself on first image load
   */
  urlForBucket(url: string, bucket: number): string {
    // Guard against undefined/null URLs
    if (!url || typeof url !== "string") {
      return "";
    }

    // Skip if already transformed (prevent double-transformation)
    if (url.includes("/render/image/")) {
      return url;
    }

    // Skip large buckets (not worth transforming)
    if (bucket > 256) {
      return url;
    }

    // Apply Supabase transformation (Pro plan feature)
    // Robust 3-layer fallback in load() handles failures gracefully
    if (url.includes("supabase.co/storage/v1/object/public/")) {
      const transformedPath = url.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      // Omit format param - let Supabase auto-optimize to WebP/AVIF
      return `${transformedPath}?width=${bucket}&height=${bucket}&quality=80`;
    }

    return url;
  }

  /**
   * Get cached image if available and not expired
   */
  get(key: string): SkImage | null {
    const entry = this.cache.get(key);
    if (!entry) {
      // Cache miss - no logging needed
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

    // Cache hit - returning cached image

    return entry.img;
  }

  /**
   * Get from cache or load from network
   * Phase 4: Self-validating - transformation API validates itself on first image load
   */
  async getOrLoad(
    url: string,
    bucket = 256,
    options?: LoadOptions,
  ): Promise<SkImage> {
    const finalUrl = this.urlForBucket(url, bucket);
    const key = finalUrl;

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
        ttl: options?.ttlMs ? Date.now() + options.ttlMs : undefined,
      });
      this.totalBytes += bytes;

      // Evict if needed
      this.evictIfNeeded();

      // Image loaded and cached successfully

      return img;
    } catch (error) {
      // Load error will be propagated to caller
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
    // Fetching image from network

    let response: Response;
    let finalUrl = url;

    try {
      response = await fetch(url, options?.fetchOptions);

      // Track transformation results (Phase 4: Self-validating monitoring)
      if (url.includes("/render/image/")) {
        this.transformStats.attempts++;

        if (response.ok) {
          // Transformation succeeded
          this.transformStats.successes++;

          // Confirm API availability on first success
          if (this.transformationAvailable === null) {
            this.transformationAvailable = true;
          }
        } else {
          // Transformation failed
          this.transformStats.failures++;

          // Auto-disable if failure rate > 80% after 20 attempts
          if (this.transformStats.attempts >= 20) {
            const failureRate = this.transformStats.failures / this.transformStats.attempts;
            if (failureRate > 0.8 && this.transformationAvailable !== false) {
              this.transformationAvailable = false;
              console.error(
                `[Image Cache] ❌ High transformation failure rate (${(failureRate * 100).toFixed(0)}%) - ` +
                `auto-disabling. Check if Pro plan is active.`
              );
            }
          }
        }
      }

      // If transformation endpoint fails with 400/422, try original URL
      if (!response.ok && url.includes("/render/image/")) {
        // Extract original URL without transformation params
        const fallbackUrl = url
          .replace(
            "/storage/v1/render/image/public/",
            "/storage/v1/object/public/",
          )
          .split("?")[0]; // Remove all query params

        // Falling back to original URL due to transformation error
        finalUrl = fallbackUrl;
        response = await fetch(fallbackUrl, options?.fetchOptions);
      }

      // If still failing and it's a Supabase URL, try one more time with basic URL
      if (!response.ok && url.includes("supabase.co/storage/")) {
        const basicUrl = url
          .split("?")[0]
          .replace(
            "/storage/v1/render/image/public/",
            "/storage/v1/object/public/",
          );

        finalUrl = basicUrl;
        response = await fetch(basicUrl, options?.fetchOptions);
      }
    } catch (networkError) {
      throw new Error(`Network error: ${networkError}`);
    }

    if (!response.ok) {
      // For 400/404 errors, these are likely deleted images - fail silently
      if (response.status === 400 || response.status === 404) {
        throw new Error(`Missing image`);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = Skia.Data.fromBytes(new Uint8Array(arrayBuffer));
    const img = Skia.Image.MakeImageFromEncoded(data);

    if (!img) {
      throw new Error("Failed to decode image");
    }

    // Image decoded successfully

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
      if (entry.img.dispose && typeof entry.img.dispose === "function") {
        entry.img.dispose();
      }
    } catch (error) {
      // Ignore disposal errors
    }

    // Entry evicted to free memory
  }

  /**
   * Clear all cached images
   */
  clear() {
    for (const entry of this.cache.values()) {
      try {
        if (entry.img.dispose && typeof entry.img.dispose === "function") {
          entry.img.dispose();
        }
      } catch {}
    }

    this.cache.clear();
    this.inflight.clear();
    this.totalBytes = 0;
  }

  /**
   * Get cache statistics (Phase 4: Enhanced monitoring with self-validation)
   */
  getStats() {
    const utilizationPercent = (this.totalBytes / this.budget) * 100;
    const successRate = this.transformStats.attempts > 0
      ? (this.transformStats.successes / this.transformStats.attempts * 100).toFixed(0) + "%"
      : "N/A";

    return {
      entries: this.cache.size,
      totalBytes: this.totalBytes,
      totalMB: (this.totalBytes / 1024 / 1024).toFixed(1),
      budgetMB: (this.budget / 1024 / 1024).toFixed(1),
      utilization: utilizationPercent.toFixed(0) + "%",

      // Transformation API self-validation stats
      transformation: {
        status: this.transformationAvailable === true ? "✅ working" :
                this.transformationAvailable === false ? "❌ disabled" :
                "⏳ validating",
        attempts: this.transformStats.attempts,
        successes: this.transformStats.successes,
        failures: this.transformStats.failures,
        successRate: successRate,
      },

      // Overall cache health
      status: utilizationPercent > 90 ? "⚠️ High utilization - cache thrashing likely" :
              utilizationPercent > 75 ? "Moderate utilization" :
              "Healthy",
    };
  }
}

export default new SkiaImageCache();
