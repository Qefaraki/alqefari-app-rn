import skiaImageCache from "./skiaImageCache";

/**
 * Priority-based image loading queue
 * Batches image loads to prevent cascade of state updates
 * Phase 2 Performance Optimization
 */

type Priority = "visible" | "prefetch";

interface QueueItem {
  url: string;
  bucket: number;
  priority: Priority;
  callback: (error?: Error) => void;
}

class ImageLoadQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  // Phase 4: Reduced from 15 to 6 for smoother progressive loading
  // Benefits even without LOD: 240MB spike → 96MB, 1.5s decode → 600ms
  private batchSize = 6; // Load 6 images per batch
  private batchDelay = 50; // 50ms between batches (smooth loading)

  /**
   * Enqueue image load request
   */
  enqueue(
    url: string,
    bucket: number,
    priority: Priority,
    callback: (error?: Error) => void
  ) {
    // Don't enqueue if already in queue
    const exists = this.queue.some(
      (item) => item.url === url && item.bucket === bucket
    );
    if (exists) return;

    // Add to queue based on priority
    const item: QueueItem = { url, bucket, priority, callback };

    if (priority === "visible") {
      // Insert at beginning (high priority)
      this.queue.unshift(item);
    } else {
      // Append to end (low priority)
      this.queue.push(item);
    }

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
  }

  /**
   * Start batch processing loop
   */
  private startProcessing() {
    this.processing = true;
    this.processBatch();
  }

  /**
   * Process next batch of images
   */
  private async processBatch() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    // Take next batch from queue
    const batch = this.queue.splice(0, this.batchSize);

    // Load all images in batch concurrently
    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          await skiaImageCache.getOrLoad(item.url, item.bucket);
          item.callback(); // Success
        } catch (error) {
          item.callback(error as Error); // Error
        }
      })
    );

    // Schedule next batch
    if (this.queue.length > 0) {
      setTimeout(() => this.processBatch(), this.batchDelay);
    } else {
      this.processing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      visibleCount: this.queue.filter((i) => i.priority === "visible").length,
      prefetchCount: this.queue.filter((i) => i.priority === "prefetch").length,
    };
  }

  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
    this.processing = false;
  }
}

export default new ImageLoadQueue();
