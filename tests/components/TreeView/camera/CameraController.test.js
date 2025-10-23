/**
 * CameraController Tests
 *
 * Test suite for viewport transformation and camera navigation.
 *
 * Coverage:
 * - Visible bounds calculation with dynamic margins
 * - Center transform calculation
 * - Target zoom determination
 * - Camera state synchronization
 * - Node navigation with animation
 */

import {
  calculateVisibleBounds,
  calculateCenterTransform,
  determineTargetZoom,
  syncCameraState,
  navigateToNode,
  CAMERA_CONSTANTS,
} from '../../../../src/components/TreeView/camera/CameraController';

// Mock Reanimated functions
jest.mock('react-native-reanimated', () => {
  const actualReanimated = jest.requireActual('react-native-reanimated');
  return {
    ...actualReanimated,
    cancelAnimation: jest.fn(),
    withSpring: jest.fn((value, config, callback) => {
      if (callback) callback(true); // Simulate finished = true
      return value;
    }),
    withTiming: jest.fn((value) => value),
    runOnJS: jest.fn((fn) => (...args) => fn(...args)),
  };
});

const { cancelAnimation, withSpring, withTiming, runOnJS } = require('react-native-reanimated');

describe('CameraController', () => {
  let mockSharedValues;
  let mockCallbacks;
  let mockViewport;
  let mockNavigationIdRef;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();

    // Create mock shared values
    mockSharedValues = {
      translateX: { value: 0 },
      translateY: { value: 0 },
      scale: { value: 1.0 },
      savedTranslateX: { value: 0 },
      savedTranslateY: { value: 0 },
      savedScale: { value: 1.0 },
    };

    // Create mock callbacks
    mockCallbacks = {
      onTransformUpdate: jest.fn(),
      onBoundsUpdate: jest.fn(),
      onNavigationComplete: jest.fn(),
    };

    // Create mock viewport
    mockViewport = {
      width: 800,
      height: 600,
    };

    // Create mock navigation ID ref
    mockNavigationIdRef = { current: null };
  });

  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('CAMERA_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(CAMERA_CONSTANTS.DEFAULT_MARGIN_X).toBe(100);
      expect(CAMERA_CONSTANTS.DEFAULT_MARGIN_Y).toBe(100);
      expect(CAMERA_CONSTANTS.DEFAULT_SPRING_DAMPING).toBe(20);
      expect(CAMERA_CONSTANTS.DEFAULT_SPRING_STIFFNESS).toBe(90);
      expect(CAMERA_CONSTANTS.DEFAULT_SPRING_MASS).toBe(1);
      expect(CAMERA_CONSTANTS.DEFAULT_ZOOM_DURATION).toBe(600);
      expect(CAMERA_CONSTANTS.DEFAULT_MIN_AUTO_ZOOM).toBe(0.8);
      expect(CAMERA_CONSTANTS.DEFAULT_MAX_AUTO_ZOOM).toBe(3.0);
      expect(CAMERA_CONSTANTS.DEFAULT_ZOOM).toBe(1.5);
    });
  });

  // ============================================================================
  // CALCULATE VISIBLE BOUNDS TESTS
  // ============================================================================

  describe('calculateVisibleBounds', () => {
    test('should calculate bounds with identity transform', () => {
      const transform = { x: 0, y: 0, scale: 1.0 };

      const bounds = calculateVisibleBounds(transform, mockViewport);

      // With 100px margins and 1.0 scale:
      // minX = (0 - 100) / 1.0 = -100
      // maxX = (0 + 800 + 100) / 1.0 = 900
      // minY = (0 - 100) / 1.0 = -100
      // maxY = (0 + 600 + 100) / 1.0 = 700
      expect(bounds.minX).toBe(-100);
      expect(bounds.maxX).toBe(900);
      expect(bounds.minY).toBe(-100);
      expect(bounds.maxY).toBe(700);
    });

    test('should handle positive translation (panned right/down)', () => {
      const transform = { x: 200, y: 150, scale: 1.0 };

      const bounds = calculateVisibleBounds(transform, mockViewport);

      // minX = (-200 - 100) / 1.0 = -300
      // maxX = (-200 + 800 + 100) / 1.0 = 700
      expect(bounds.minX).toBe(-300);
      expect(bounds.maxX).toBe(700);
      expect(bounds.minY).toBe(-250);
      expect(bounds.maxY).toBe(550);
    });

    test('should handle negative translation (panned left/up)', () => {
      const transform = { x: -200, y: -150, scale: 1.0 };

      const bounds = calculateVisibleBounds(transform, mockViewport);

      // minX = (200 - 100) / 1.0 = 100
      // maxX = (200 + 800 + 100) / 1.0 = 1100
      expect(bounds.minX).toBe(100);
      expect(bounds.maxX).toBe(1100);
      expect(bounds.minY).toBe(50);
      expect(bounds.maxY).toBe(850);
    });

    test('should scale margins inversely with zoom', () => {
      const transform = { x: 0, y: 0, scale: 2.0 };

      const bounds = calculateVisibleBounds(transform, mockViewport);

      // Dynamic margins: 100 / 2.0 = 50
      // minX = (0 - 50) / 2.0 = -25
      // maxX = (0 + 800 + 50) / 2.0 = 425
      expect(bounds.minX).toBe(-25);
      expect(bounds.maxX).toBe(425);
      expect(bounds.minY).toBe(-25);
      expect(bounds.maxY).toBe(325);
    });

    test('should handle zoom out (scale < 1)', () => {
      const transform = { x: 0, y: 0, scale: 0.5 };

      const bounds = calculateVisibleBounds(transform, mockViewport);

      // Dynamic margins: 100 / 0.5 = 200
      // minX = (0 - 200) / 0.5 = -400
      // maxX = (0 + 800 + 200) / 0.5 = 2000
      expect(bounds.minX).toBe(-400);
      expect(bounds.maxX).toBe(2000);
      expect(bounds.minY).toBe(-400);
      expect(bounds.maxY).toBe(1600);
    });

    test('should use custom margins', () => {
      const transform = { x: 0, y: 0, scale: 1.0 };
      const marginX = 200;
      const marginY = 150;

      const bounds = calculateVisibleBounds(transform, mockViewport, marginX, marginY);

      expect(bounds.minX).toBe(-200);
      expect(bounds.maxX).toBe(1000);
      expect(bounds.minY).toBe(-150);
      expect(bounds.maxY).toBe(750);
    });

    test('should handle combined translation and zoom', () => {
      const transform = { x: 100, y: 50, scale: 1.5 };

      const bounds = calculateVisibleBounds(transform, mockViewport);

      // Dynamic margins: 100 / 1.5 ≈ 66.67
      // minX = (-100 - 66.67) / 1.5 ≈ -111.11
      // maxX = (-100 + 800 + 66.67) / 1.5 ≈ 511.11
      // minY = (-50 - 66.67) / 1.5 ≈ -77.78
      // maxY = (-50 + 600 + 66.67) / 1.5 ≈ 411.11
      expect(bounds.minX).toBeCloseTo(-111.11, 1);
      expect(bounds.maxX).toBeCloseTo(511.11, 1);
      expect(bounds.minY).toBeCloseTo(-77.78, 1);
      expect(bounds.maxY).toBeCloseTo(411.11, 1);
    });
  });

  // ============================================================================
  // CALCULATE CENTER TRANSFORM TESTS
  // ============================================================================

  describe('calculateCenterTransform', () => {
    test('should center node at origin', () => {
      const node = { id: 'n1', x: 0, y: 0, name: 'Node 1' };
      const targetScale = 1.0;

      const transform = calculateCenterTransform(node, mockViewport, targetScale);

      // translateX = 800/2 - 0*1.0 = 400
      // translateY = 600/2 - 0*1.0 = 300
      expect(transform.x).toBe(400);
      expect(transform.y).toBe(300);
      expect(transform.scale).toBe(1.0);
    });

    test('should center node at positive coordinates', () => {
      const node = { id: 'n1', x: 200, y: 150, name: 'Node 1' };
      const targetScale = 1.0;

      const transform = calculateCenterTransform(node, mockViewport, targetScale);

      // translateX = 800/2 - 200*1.0 = 200
      // translateY = 600/2 - 150*1.0 = 150
      expect(transform.x).toBe(200);
      expect(transform.y).toBe(150);
      expect(transform.scale).toBe(1.0);
    });

    test('should center node at negative coordinates', () => {
      const node = { id: 'n1', x: -100, y: -50, name: 'Node 1' };
      const targetScale = 1.0;

      const transform = calculateCenterTransform(node, mockViewport, targetScale);

      // translateX = 800/2 - (-100)*1.0 = 500
      // translateY = 600/2 - (-50)*1.0 = 350
      expect(transform.x).toBe(500);
      expect(transform.y).toBe(350);
      expect(transform.scale).toBe(1.0);
    });

    test('should handle zoom in (scale > 1)', () => {
      const node = { id: 'n1', x: 200, y: 150, name: 'Node 1' };
      const targetScale = 2.0;

      const transform = calculateCenterTransform(node, mockViewport, targetScale);

      // translateX = 800/2 - 200*2.0 = 0
      // translateY = 600/2 - 150*2.0 = 0
      expect(transform.x).toBe(0);
      expect(transform.y).toBe(0);
      expect(transform.scale).toBe(2.0);
    });

    test('should handle zoom out (scale < 1)', () => {
      const node = { id: 'n1', x: 200, y: 150, name: 'Node 1' };
      const targetScale = 0.5;

      const transform = calculateCenterTransform(node, mockViewport, targetScale);

      // translateX = 800/2 - 200*0.5 = 300
      // translateY = 600/2 - 150*0.5 = 225
      expect(transform.x).toBe(300);
      expect(transform.y).toBe(225);
      expect(transform.scale).toBe(0.5);
    });

    test('should handle different viewport sizes', () => {
      const node = { id: 'n1', x: 100, y: 100, name: 'Node 1' };
      const smallViewport = { width: 400, height: 300 };
      const targetScale = 1.0;

      const transform = calculateCenterTransform(node, smallViewport, targetScale);

      expect(transform.x).toBe(100); // 400/2 - 100*1.0
      expect(transform.y).toBe(50); // 300/2 - 100*1.0
      expect(transform.scale).toBe(1.0);
    });
  });

  // ============================================================================
  // DETERMINE TARGET ZOOM TESTS
  // ============================================================================

  describe('determineTargetZoom', () => {
    test('should keep current zoom if within reasonable range', () => {
      const result = determineTargetZoom(1.0);
      expect(result).toBe(1.0);
    });

    test('should keep current zoom at min boundary', () => {
      const result = determineTargetZoom(0.8);
      expect(result).toBe(0.8);
    });

    test('should keep current zoom at max boundary', () => {
      const result = determineTargetZoom(3.0);
      expect(result).toBe(3.0);
    });

    test('should use default zoom if too zoomed out', () => {
      const result = determineTargetZoom(0.5);
      expect(result).toBe(1.5);
    });

    test('should use default zoom if too zoomed in', () => {
      const result = determineTargetZoom(4.0);
      expect(result).toBe(1.5);
    });

    test('should use custom zoom bounds from config', () => {
      const config = {
        minAutoZoom: 1.0,
        maxAutoZoom: 2.0,
        defaultZoom: 1.2,
      };

      expect(determineTargetZoom(0.8, config)).toBe(1.2); // Below min
      expect(determineTargetZoom(1.5, config)).toBe(1.5); // Within range
      expect(determineTargetZoom(2.5, config)).toBe(1.2); // Above max
    });

    test('should use custom default zoom', () => {
      const config = { defaultZoom: 2.0 };
      const result = determineTargetZoom(0.5, config);
      expect(result).toBe(2.0);
    });
  });

  // ============================================================================
  // SYNC CAMERA STATE TESTS
  // ============================================================================

  describe('syncCameraState', () => {
    test('should trigger onTransformUpdate callback', () => {
      mockSharedValues.translateX.value = 100;
      mockSharedValues.translateY.value = 50;
      mockSharedValues.scale.value = 1.5;

      syncCameraState(mockSharedValues, mockViewport, mockCallbacks);

      expect(mockCallbacks.onTransformUpdate).toHaveBeenCalledWith({
        x: 100,
        y: 50,
        scale: 1.5,
      });
    });

    test('should trigger onBoundsUpdate callback', () => {
      mockSharedValues.translateX.value = 0;
      mockSharedValues.translateY.value = 0;
      mockSharedValues.scale.value = 1.0;

      syncCameraState(mockSharedValues, mockViewport, mockCallbacks);

      expect(mockCallbacks.onBoundsUpdate).toHaveBeenCalledWith({
        minX: -100,
        maxX: 900,
        minY: -100,
        maxY: 700,
      });
    });

    test('should work without callbacks', () => {
      expect(() =>
        syncCameraState(mockSharedValues, mockViewport, {})
      ).not.toThrow();
    });

    test('should use custom margins', () => {
      syncCameraState(mockSharedValues, mockViewport, mockCallbacks, 200, 150);

      expect(mockCallbacks.onBoundsUpdate).toHaveBeenCalledWith({
        minX: -200,
        maxX: 1000,
        minY: -150,
        maxY: 750,
      });
    });
  });

  // ============================================================================
  // NAVIGATE TO NODE TESTS
  // ============================================================================

  describe('navigateToNode', () => {
    let mockNode;

    beforeEach(() => {
      mockNode = { id: 'n1', x: 200, y: 150, name: 'Node 1' };
    });

    test('should cancel ongoing animations', () => {
      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      expect(cancelAnimation).toHaveBeenCalledWith(mockSharedValues.translateX);
      expect(cancelAnimation).toHaveBeenCalledWith(mockSharedValues.translateY);
      expect(cancelAnimation).toHaveBeenCalledWith(mockSharedValues.scale);
    });

    test('should set navigation ID if ref provided', () => {
      navigateToNode(
        mockNode,
        mockSharedValues,
        mockViewport,
        mockCallbacks,
        {},
        mockNavigationIdRef
      );

      expect(mockNavigationIdRef.current).not.toBeNull();
      expect(typeof mockNavigationIdRef.current).toBe('number');
    });

    test('should immediately update transform via callback', () => {
      // Set current scale outside reasonable range to trigger default zoom
      mockSharedValues.scale.value = 0.5;

      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      expect(mockCallbacks.onTransformUpdate).toHaveBeenCalled();
      const transform = mockCallbacks.onTransformUpdate.mock.calls[0][0];
      expect(transform.scale).toBe(1.5); // Default zoom
    });

    test('should immediately update bounds via callback', () => {
      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      expect(mockCallbacks.onBoundsUpdate).toHaveBeenCalled();
    });

    test('should animate translateX with spring', () => {
      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      expect(withSpring).toHaveBeenCalled();
      const springCalls = withSpring.mock.calls.filter(
        (call) => call[1].damping === 20
      );
      expect(springCalls.length).toBeGreaterThan(0);
    });

    test('should animate translateY with spring', () => {
      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      expect(withSpring).toHaveBeenCalledTimes(2); // X and Y
    });

    test('should animate scale with timing', () => {
      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      expect(withTiming).toHaveBeenCalled();
    });

    test('should update saved values', () => {
      // Set current scale outside reasonable range to trigger default zoom
      mockSharedValues.scale.value = 0.5;

      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      // Saved values should match the target transform
      expect(mockSharedValues.savedScale.value).toBe(1.5);
    });

    test('should call onNavigationComplete after spring finishes', () => {
      navigateToNode(
        mockNode,
        mockSharedValues,
        mockViewport,
        mockCallbacks,
        {},
        mockNavigationIdRef
      );

      // Spring callback should trigger onNavigationComplete
      expect(mockCallbacks.onNavigationComplete).toHaveBeenCalled();
    });

    test('should use custom spring config', () => {
      const config = {
        springDamping: 15,
        springStiffness: 100,
        springMass: 0.8,
      };

      navigateToNode(
        mockNode,
        mockSharedValues,
        mockViewport,
        mockCallbacks,
        config
      );

      expect(withSpring).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          damping: 15,
          stiffness: 100,
          mass: 0.8,
        }),
        expect.any(Function)
      );
    });

    test('should use custom zoom config', () => {
      const config = {
        zoomDuration: 800,
      };

      navigateToNode(
        mockNode,
        mockSharedValues,
        mockViewport,
        mockCallbacks,
        config
      );

      expect(withTiming).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          duration: 800,
        })
      );
    });

    test('should keep current zoom if reasonable', () => {
      mockSharedValues.scale.value = 1.0; // Within 0.8-3.0 range

      navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks);

      // Should use current scale (1.0) instead of default (1.5)
      expect(mockSharedValues.savedScale.value).toBe(1.0);
    });

    test('should center node at origin', () => {
      const nodeAtOrigin = { id: 'n1', x: 0, y: 0, name: 'Origin' };

      navigateToNode(nodeAtOrigin, mockSharedValues, mockViewport, mockCallbacks);

      // Expected: translateX = 800/2 - 0*1.5 = 400
      expect(mockSharedValues.savedTranslateX.value).toBe(400);
      expect(mockSharedValues.savedTranslateY.value).toBe(300);
    });

    test('should work without navigation ID ref', () => {
      expect(() =>
        navigateToNode(mockNode, mockSharedValues, mockViewport, mockCallbacks)
      ).not.toThrow();
    });

    test('should work without onNavigationComplete callback', () => {
      const callbacksWithoutComplete = {
        onTransformUpdate: jest.fn(),
        onBoundsUpdate: jest.fn(),
      };

      expect(() =>
        navigateToNode(
          mockNode,
          mockSharedValues,
          mockViewport,
          callbacksWithoutComplete,
          {},
          mockNavigationIdRef
        )
      ).not.toThrow();
    });
  });
});
