/**
 * Unit tests for performanceMonitor
 * Phase 1 Day 0 - Test infrastructure
 */

describe('performanceMonitor', () => {
  // Tests will run after performanceMonitor.ts is created in Day 2
  let performanceMonitor;

  beforeAll(() => {
    try {
      performanceMonitor = require('../../src/components/TreeView/utils/performanceMonitor').default;
    } catch (error) {
      // Utils don't exist yet - will be created in Day 2
      console.warn('performanceMonitor not found - will be created in Phase 1 Day 2');
    }
  });

  beforeEach(() => {
    // Clear console spies before each test
    jest.clearAllMocks();
  });

  describe('logLayoutTime', () => {
    it('should log success message for fast layout (<200ms)', () => {
      if (!performanceMonitor) return;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      performanceMonitor.logLayoutTime(150, 100);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TreeView]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Layout: 150ms for 100 nodes')
      );

      consoleSpy.mockRestore();
    });

    it('should warn for slow layout (>200ms)', () => {
      if (!performanceMonitor) return;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      performanceMonitor.logLayoutTime(250, 100);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TreeView]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Slow layout: 250ms')
      );

      consoleSpy.mockRestore();
    });

    it('should update metrics with layout time', () => {
      if (!performanceMonitor) return;

      performanceMonitor.logLayoutTime(100, 50);
      const metrics = performanceMonitor.getMetrics();

      expect(metrics.layoutTime).toBe(100);
      expect(metrics.nodeCount).toBe(50);
    });

    it('should handle edge case: exactly 200ms', () => {
      if (!performanceMonitor) return;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      performanceMonitor.logLayoutTime(200, 100);

      // 200ms should NOT warn (threshold is >200ms)
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('logRenderTime', () => {
    it('should calculate FPS correctly for 60fps', () => {
      if (!performanceMonitor) return;

      performanceMonitor.logRenderTime(16.67); // 1000ms / 60fps
      const metrics = performanceMonitor.getMetrics();

      expect(metrics.fps).toBe(60);
    });

    it('should calculate FPS correctly for 30fps', () => {
      if (!performanceMonitor) return;

      performanceMonitor.logRenderTime(33.33); // 1000ms / 30fps
      const metrics = performanceMonitor.getMetrics();

      expect(metrics.fps).toBe(30);
    });

    it('should warn on frame drops (<60fps)', () => {
      if (!performanceMonitor) return;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      performanceMonitor.logRenderTime(20); // 50fps

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Frame drop')
      );

      consoleSpy.mockRestore();
    });

    it('should not warn for 60fps', () => {
      if (!performanceMonitor) return;

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      performanceMonitor.logRenderTime(16.67);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('logMemory', () => {
    it('should convert bytes to megabytes correctly', () => {
      if (!performanceMonitor) return;

      performanceMonitor.logMemory(1048576); // 1MB in bytes
      const metrics = performanceMonitor.getMetrics();

      expect(metrics.memoryUsage).toBeCloseTo(1.0, 2);
    });

    it('should warn for high memory usage (>25MB)', () => {
      if (!performanceMonitor) return;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      performanceMonitor.logMemory(30 * 1024 * 1024); // 30MB

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ High memory: 30')
      );

      consoleSpy.mockRestore();
    });

    it('should log success for normal memory usage (<25MB)', () => {
      if (!performanceMonitor) return;

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      performanceMonitor.logMemory(10 * 1024 * 1024); // 10MB

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Memory: 10')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics snapshot', () => {
      if (!performanceMonitor) return;

      performanceMonitor.logLayoutTime(100, 50);
      performanceMonitor.logRenderTime(16.67);
      performanceMonitor.logMemory(5 * 1024 * 1024);

      const metrics = performanceMonitor.getMetrics();

      expect(metrics.layoutTime).toBe(100);
      expect(metrics.nodeCount).toBe(50);
      expect(metrics.fps).toBe(60);
      expect(metrics.memoryUsage).toBeCloseTo(5.0, 2);
    });

    it('should return a copy (not reference)', () => {
      if (!performanceMonitor) return;

      const metrics1 = performanceMonitor.getMetrics();
      metrics1.layoutTime = 999;

      const metrics2 = performanceMonitor.getMetrics();
      expect(metrics2.layoutTime).not.toBe(999);
    });
  });

  describe('logSummary', () => {
    it('should log all metrics in summary format', () => {
      if (!performanceMonitor) return;

      performanceMonitor.logLayoutTime(85, 56);
      performanceMonitor.logRenderTime(16.67);
      performanceMonitor.logMemory(0.5 * 1024 * 1024);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      performanceMonitor.logSummary();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TreeView] 📊 Performance Summary:',
        expect.objectContaining({
          layout: expect.stringContaining('85ms'),
          nodes: 56,
          fps: 60,
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
