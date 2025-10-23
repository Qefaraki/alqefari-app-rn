/**
 * Performance monitoring utilities for TreeView
 * Phase 1 Day 2 - Utility extraction
 */

// Performance thresholds
const DEFAULT_FPS = 60;
const SLOW_LAYOUT_THRESHOLD_MS = 200;
const TARGET_FRAME_TIME_MS = 16.67; // 60fps = 16.67ms per frame
const BYTES_TO_MB = 1024 * 1024;
const HIGH_MEMORY_THRESHOLD_MB = 25;

interface PerformanceMetrics {
  layoutTime: number;
  renderTime: number;
  memoryUsage: number;
  nodeCount: number;
  fps: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    layoutTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    fps: DEFAULT_FPS,
  };

  /**
   * Log layout calculation time
   * Warns if layout exceeds threshold
   */
  logLayoutTime(duration: number, nodeCount: number) {
    this.metrics.layoutTime = duration;
    this.metrics.nodeCount = nodeCount;

    if (duration > SLOW_LAYOUT_THRESHOLD_MS) {
      console.warn(`[TreeView] ⚠️ Slow layout: ${duration}ms for ${nodeCount} nodes`);
    } else if (__DEV__) {
      console.log(`[TreeView] ✅ Layout: ${duration}ms for ${nodeCount} nodes`);
    }
  }

  /**
   * Log render time and calculate FPS
   * Warns if frame time exceeds target (below 60fps)
   */
  logRenderTime(duration: number) {
    this.metrics.renderTime = duration;

    const fps = 1000 / duration;
    this.metrics.fps = Math.round(fps);

    if (duration > TARGET_FRAME_TIME_MS) {
      console.warn(`[TreeView] ⚠️ Frame drop: ${duration.toFixed(2)}ms (${fps.toFixed(1)} fps)`);
    }
  }

  /**
   * Log memory usage in megabytes
   * Warns if memory exceeds threshold
   */
  logMemory(bytes: number) {
    const mb = bytes / BYTES_TO_MB;
    this.metrics.memoryUsage = mb;

    if (mb > HIGH_MEMORY_THRESHOLD_MB) {
      console.warn(`[TreeView] ⚠️ High memory: ${mb.toFixed(1)}MB`);
    } else if (__DEV__) {
      console.log(`[TreeView] ✅ Memory: ${mb.toFixed(1)}MB`);
    }
  }

  /**
   * Get current metrics snapshot
   * Returns a copy to prevent mutation
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Log comprehensive performance summary
   * Useful for debugging and optimization
   */
  logSummary() {
    if (__DEV__) {
      console.log('[TreeView] 📊 Performance Summary:', {
        layout: `${this.metrics.layoutTime}ms`,
        render: `${this.metrics.renderTime.toFixed(2)}ms`,
        memory: `${this.metrics.memoryUsage.toFixed(1)}MB`,
        nodes: this.metrics.nodeCount,
        fps: this.metrics.fps,
      });
    }
  }
}

// Export singleton instance
export default new PerformanceMonitor();
