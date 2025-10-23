/**
 * Performance monitoring utilities for TreeView
 * Phase 1 Day 2 - Utility extraction
 */

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
    fps: 60,
  };

  /**
   * Log layout calculation time
   * Warns if layout exceeds 200ms threshold
   */
  logLayoutTime(duration: number, nodeCount: number) {
    this.metrics.layoutTime = duration;
    this.metrics.nodeCount = nodeCount;

    if (duration > 200) {
      console.warn(`[TreeView] ⚠️ Slow layout: ${duration}ms for ${nodeCount} nodes`);
    } else {
      console.log(`[TreeView] ✅ Layout: ${duration}ms for ${nodeCount} nodes`);
    }
  }

  /**
   * Log render time and calculate FPS
   * Warns if frame time exceeds 16.67ms (below 60fps)
   */
  logRenderTime(duration: number) {
    this.metrics.renderTime = duration;

    const fps = 1000 / duration;
    this.metrics.fps = Math.round(fps);

    if (duration > 16.67) { // 60fps = 16.67ms per frame
      console.warn(`[TreeView] ⚠️ Frame drop: ${duration.toFixed(2)}ms (${fps.toFixed(1)} fps)`);
    }
  }

  /**
   * Log memory usage in megabytes
   * Warns if memory exceeds 25MB threshold
   */
  logMemory(bytes: number) {
    const mb = bytes / 1024 / 1024;
    this.metrics.memoryUsage = mb;

    if (mb > 25) {
      console.warn(`[TreeView] ⚠️ High memory: ${mb.toFixed(1)}MB`);
    } else {
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
    console.log('[TreeView] 📊 Performance Summary:', {
      layout: `${this.metrics.layoutTime}ms`,
      render: `${this.metrics.renderTime.toFixed(2)}ms`,
      memory: `${this.metrics.memoryUsage.toFixed(1)}MB`,
      nodes: this.metrics.nodeCount,
      fps: this.metrics.fps,
    });
  }
}

// Export singleton instance
export default new PerformanceMonitor();
