/**
 * GestureHandler Tests
 *
 * Test suite for gesture management (pan, pinch, tap, long-press).
 *
 * Coverage:
 * - Pan gesture with momentum decay
 * - Pinch gesture with focal point anchoring
 * - Tap gesture configuration
 * - Long press gesture configuration
 * - Composed gesture behavior
 * - Gesture guards and conflict prevention
 */

import { Gesture } from 'react-native-gesture-handler';
import {
  createPanGesture,
  createPinchGesture,
  createTapGesture,
  createLongPressGesture,
  createComposedGesture,
  GESTURE_CONSTANTS,
} from '../../../../src/components/TreeView/interaction/GestureHandler';

// Mock Reanimated functions
const mockCancelAnimation = jest.fn();
const mockWithDecay = jest.fn((config, callback) => {
  if (callback) callback();
  return 'decay-animation';
});
const mockWithTiming = jest.fn(() => 'timing-animation');
const mockRunOnJS = jest.fn((fn) => fn);

jest.mock('react-native-reanimated', () => ({
  cancelAnimation: mockCancelAnimation,
  withDecay: mockWithDecay,
  withTiming: mockWithTiming,
  runOnJS: mockRunOnJS,
}));

describe('GestureHandler', () => {
  let sharedValues;
  let callbacks;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock shared values
    sharedValues = {
      translateX: { value: 0 },
      translateY: { value: 0 },
      scale: { value: 1.0 },
      savedTranslateX: { value: 0 },
      savedTranslateY: { value: 0 },
      savedScale: { value: 1.0 },
      isPinching: { value: false },
      initialFocalX: { value: 0 },
      initialFocalY: { value: 0 },
    };

    // Create mock callbacks
    callbacks = {
      onGestureEnd: jest.fn(),
      onTap: jest.fn(),
      onLongPress: jest.fn(),
    };
  });

  // ============================================================================
  // CONSTANTS TESTS
  // ============================================================================

  describe('GESTURE_CONSTANTS', () => {
    test('should export expected constants', () => {
      expect(GESTURE_CONSTANTS.MIN_ZOOM).toBe(0.1);
      expect(GESTURE_CONSTANTS.MAX_ZOOM).toBe(5.0);
      expect(GESTURE_CONSTANTS.DEFAULT_DECELERATION).toBe(0.995);
      expect(GESTURE_CONSTANTS.DEFAULT_TAP_MAX_DURATION).toBe(250);
      expect(GESTURE_CONSTANTS.DEFAULT_TAP_MAX_DISTANCE).toBe(10);
      expect(GESTURE_CONSTANTS.DEFAULT_LONG_PRESS_MIN_DURATION).toBe(500);
      expect(GESTURE_CONSTANTS.DEFAULT_LONG_PRESS_MAX_DISTANCE).toBe(10);
    });
  });

  // ============================================================================
  // PAN GESTURE TESTS
  // ============================================================================

  describe('createPanGesture', () => {
    test('should create pan gesture with default config', () => {
      const gesture = createPanGesture(sharedValues, callbacks);
      expect(Gesture.Pan).toHaveBeenCalled();
      expect(gesture).toBeDefined();
    });

    test('should cancel animations on pan start', () => {
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onStartHandler = panMock.onStart.mock.calls[0][0];

      // Simulate pan start
      onStartHandler();

      expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValues.translateX);
      expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValues.translateY);
      expect(sharedValues.savedTranslateX.value).toBe(0);
      expect(sharedValues.savedTranslateY.value).toBe(0);
    });

    test('should not start pan if pinching', () => {
      sharedValues.isPinching.value = true;
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onStartHandler = panMock.onStart.mock.calls[0][0];

      // Clear mock calls
      mockCancelAnimation.mockClear();

      // Simulate pan start during pinch
      onStartHandler();

      // Should not cancel animations or save state
      expect(mockCancelAnimation).not.toHaveBeenCalled();
    });

    test('should update translation during pan', () => {
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onUpdateHandler = panMock.onUpdate.mock.calls[0][0];

      sharedValues.savedTranslateX.value = 100;
      sharedValues.savedTranslateY.value = 200;

      // Simulate pan update
      onUpdateHandler({ translationX: 50, translationY: -30 });

      expect(sharedValues.translateX.value).toBe(150);
      expect(sharedValues.translateY.value).toBe(170);
    });

    test('should not update translation during pinch', () => {
      sharedValues.isPinching.value = true;
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onUpdateHandler = panMock.onUpdate.mock.calls[0][0];

      const initialX = sharedValues.translateX.value;
      const initialY = sharedValues.translateY.value;

      // Simulate pan update during pinch
      onUpdateHandler({ translationX: 50, translationY: -30 });

      // Values should not change
      expect(sharedValues.translateX.value).toBe(initialX);
      expect(sharedValues.translateY.value).toBe(initialY);
    });

    test('should apply momentum decay on pan end', () => {
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onEndHandler = panMock.onEnd.mock.calls[0][0];

      // Simulate pan end with velocity
      onEndHandler({ velocityX: 500, velocityY: -300 });

      expect(mockWithDecay).toHaveBeenCalledWith(
        expect.objectContaining({
          velocity: 500,
          deceleration: 0.995,
        }),
        expect.any(Function)
      );

      expect(mockWithDecay).toHaveBeenCalledWith(
        expect.objectContaining({
          velocity: -300,
          deceleration: 0.995,
        })
      );
    });

    test('should call onGestureEnd callback after decay', () => {
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onEndHandler = panMock.onEnd.mock.calls[0][0];

      // Simulate pan end
      onEndHandler({ velocityX: 500, velocityY: -300 });

      // Decay callback should be called (mocked to execute immediately)
      expect(callbacks.onGestureEnd).toHaveBeenCalled();
    });

    test('should not apply momentum if pinching', () => {
      sharedValues.isPinching.value = true;
      const gesture = createPanGesture(sharedValues, callbacks);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onEndHandler = panMock.onEnd.mock.calls[0][0];

      mockWithDecay.mockClear();

      // Simulate pan end during pinch
      onEndHandler({ velocityX: 500, velocityY: -300 });

      // Should not apply decay
      expect(mockWithDecay).not.toHaveBeenCalled();
    });

    test('should use custom deceleration rate from config', () => {
      const customConfig = { decelerationRate: 0.99 };
      const gesture = createPanGesture(sharedValues, callbacks, customConfig);
      const panMock = Gesture.Pan.mock.results[0].value;
      const onEndHandler = panMock.onEnd.mock.calls[0][0];

      // Simulate pan end
      onEndHandler({ velocityX: 500, velocityY: -300 });

      expect(mockWithDecay).toHaveBeenCalledWith(
        expect.objectContaining({
          velocity: 500,
          deceleration: 0.99,
        }),
        expect.any(Function)
      );
    });
  });

  // ============================================================================
  // PINCH GESTURE TESTS
  // ============================================================================

  describe('createPinchGesture', () => {
    test('should create pinch gesture with default config', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      expect(Gesture.Pinch).toHaveBeenCalled();
      expect(gesture).toBeDefined();
    });

    test('should set pinching flag and cancel animations on pinch start', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onStartHandler = pinchMock.onStart.mock.calls[0][0];

      sharedValues.translateX.value = 100;
      sharedValues.translateY.value = 200;
      sharedValues.scale.value = 1.5;

      // Simulate pinch start with 2 fingers
      onStartHandler({ numberOfPointers: 2, focalX: 300, focalY: 400 });

      expect(sharedValues.isPinching.value).toBe(true);
      expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValues.translateX);
      expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValues.translateY);
      expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValues.scale);
      expect(sharedValues.savedTranslateX.value).toBe(100);
      expect(sharedValues.savedTranslateY.value).toBe(200);
      expect(sharedValues.savedScale.value).toBe(1.5);
      expect(sharedValues.initialFocalX.value).toBe(300);
      expect(sharedValues.initialFocalY.value).toBe(400);
    });

    test('should not start pinch with only 1 finger', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onStartHandler = pinchMock.onStart.mock.calls[0][0];

      // Simulate pinch start with 1 finger
      onStartHandler({ numberOfPointers: 1, focalX: 300, focalY: 400 });

      expect(sharedValues.isPinching.value).toBe(false);
    });

    test('should update scale with focal point anchoring', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onUpdateHandler = pinchMock.onUpdate.mock.calls[0][0];

      // Setup initial state
      sharedValues.savedScale.value = 1.0;
      sharedValues.savedTranslateX.value = 0;
      sharedValues.savedTranslateY.value = 0;
      sharedValues.initialFocalX.value = 200;
      sharedValues.initialFocalY.value = 300;

      // Simulate pinch update (2x zoom, no focal movement)
      onUpdateHandler({
        numberOfPointers: 2,
        scale: 2.0,
        focalX: 200,
        focalY: 300
      });

      // World coordinates: worldX = (200 - 0) / 1.0 = 200
      // After zoom: translateX = 200 - 200 * 2.0 + 0 = -200
      expect(sharedValues.scale.value).toBe(2.0);
      expect(sharedValues.translateX.value).toBe(-200);
      expect(sharedValues.translateY.value).toBe(-300);
    });

    test('should handle pan during pinch (two-finger drag)', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onUpdateHandler = pinchMock.onUpdate.mock.calls[0][0];

      // Setup initial state
      sharedValues.savedScale.value = 1.0;
      sharedValues.savedTranslateX.value = 0;
      sharedValues.savedTranslateY.value = 0;
      sharedValues.initialFocalX.value = 200;
      sharedValues.initialFocalY.value = 300;

      // Simulate pinch with focal point movement (2-finger drag)
      onUpdateHandler({
        numberOfPointers: 2,
        scale: 1.0, // No zoom
        focalX: 250, // Moved +50px right
        focalY: 350  // Moved +50px down
      });

      // Should add focal delta to translation
      expect(sharedValues.translateX.value).toBe(50);
      expect(sharedValues.translateY.value).toBe(50);
    });

    test('should clamp scale to min zoom', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onUpdateHandler = pinchMock.onUpdate.mock.calls[0][0];

      sharedValues.savedScale.value = 0.2;
      sharedValues.initialFocalX.value = 100;
      sharedValues.initialFocalY.value = 100;

      // Simulate pinch to very small scale
      onUpdateHandler({
        numberOfPointers: 2,
        scale: 0.1, // Would result in 0.02
        focalX: 100,
        focalY: 100
      });

      // Should clamp to MIN_ZOOM (0.1)
      expect(sharedValues.scale.value).toBe(0.1);
    });

    test('should clamp scale to max zoom', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onUpdateHandler = pinchMock.onUpdate.mock.calls[0][0];

      sharedValues.savedScale.value = 3.0;
      sharedValues.initialFocalX.value = 100;
      sharedValues.initialFocalY.value = 100;

      // Simulate pinch to very large scale
      onUpdateHandler({
        numberOfPointers: 2,
        scale: 3.0, // Would result in 9.0
        focalX: 100,
        focalY: 100
      });

      // Should clamp to MAX_ZOOM (5.0)
      expect(sharedValues.scale.value).toBe(5.0);
    });

    test('should not update with only 1 finger', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onUpdateHandler = pinchMock.onUpdate.mock.calls[0][0];

      const initialScale = sharedValues.scale.value;

      // Simulate update with 1 finger
      onUpdateHandler({
        numberOfPointers: 1,
        scale: 2.0,
        focalX: 100,
        focalY: 100
      });

      // Should not change scale
      expect(sharedValues.scale.value).toBe(initialScale);
    });

    test('should save final values and reset flag on pinch end', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onEndHandler = pinchMock.onEnd.mock.calls[0][0];

      sharedValues.scale.value = 2.5;
      sharedValues.translateX.value = 150;
      sharedValues.translateY.value = 250;
      sharedValues.isPinching.value = true;

      // Simulate pinch end
      onEndHandler();

      expect(sharedValues.savedScale.value).toBe(2.5);
      expect(sharedValues.savedTranslateX.value).toBe(150);
      expect(sharedValues.savedTranslateY.value).toBe(250);
      expect(sharedValues.isPinching.value).toBe(false);
    });

    test('should call onGestureEnd callback after pinch', () => {
      const gesture = createPinchGesture(sharedValues, callbacks);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onEndHandler = pinchMock.onEnd.mock.calls[0][0];

      onEndHandler();

      expect(callbacks.onGestureEnd).toHaveBeenCalled();
    });

    test('should use custom zoom limits from config', () => {
      const customConfig = { minZoom: 0.5, maxZoom: 3.0 };
      const gesture = createPinchGesture(sharedValues, callbacks, customConfig);
      const pinchMock = Gesture.Pinch.mock.results[0].value;
      const onUpdateHandler = pinchMock.onUpdate.mock.calls[0][0];

      sharedValues.savedScale.value = 1.0;
      sharedValues.initialFocalX.value = 100;
      sharedValues.initialFocalY.value = 100;

      // Test min clamp
      onUpdateHandler({
        numberOfPointers: 2,
        scale: 0.1,
        focalX: 100,
        focalY: 100
      });
      expect(sharedValues.scale.value).toBe(0.5);

      // Test max clamp
      onUpdateHandler({
        numberOfPointers: 2,
        scale: 10.0,
        focalX: 100,
        focalY: 100
      });
      expect(sharedValues.scale.value).toBe(3.0);
    });
  });

  // ============================================================================
  // TAP GESTURE TESTS
  // ============================================================================

  describe('createTapGesture', () => {
    test('should create tap gesture with default config', () => {
      const gesture = createTapGesture(callbacks);
      expect(Gesture.Tap).toHaveBeenCalled();

      const tapMock = Gesture.Tap.mock.results[0].value;
      expect(tapMock.maxDistance).toHaveBeenCalledWith(10);
      expect(tapMock.maxDuration).toHaveBeenCalledWith(250);
      expect(tapMock.runOnJS).toHaveBeenCalledWith(true);
    });

    test('should call onTap callback with coordinates', () => {
      const gesture = createTapGesture(callbacks);
      const tapMock = Gesture.Tap.mock.results[0].value;
      const onEndHandler = tapMock.onEnd.mock.calls[0][0];

      onEndHandler({ x: 150, y: 200 });

      expect(callbacks.onTap).toHaveBeenCalledWith(150, 200);
    });

    test('should use custom tap config', () => {
      const customConfig = {
        tapMaxDistance: 15,
        tapMaxDuration: 300
      };
      const gesture = createTapGesture(callbacks, customConfig);

      const tapMock = Gesture.Tap.mock.results[0].value;
      expect(tapMock.maxDistance).toHaveBeenCalledWith(15);
      expect(tapMock.maxDuration).toHaveBeenCalledWith(300);
    });

    test('should not crash if onTap callback is missing', () => {
      const gesture = createTapGesture({});
      const tapMock = Gesture.Tap.mock.results[0].value;
      const onEndHandler = tapMock.onEnd.mock.calls[0][0];

      // Should not throw
      expect(() => onEndHandler({ x: 150, y: 200 })).not.toThrow();
    });
  });

  // ============================================================================
  // LONG PRESS GESTURE TESTS
  // ============================================================================

  describe('createLongPressGesture', () => {
    test('should create long press gesture with default config', () => {
      const gesture = createLongPressGesture(callbacks);
      expect(Gesture.LongPress).toHaveBeenCalled();

      const longPressMock = Gesture.LongPress.mock.results[0].value;
      expect(longPressMock.minDuration).toHaveBeenCalledWith(500);
      expect(longPressMock.maxDistance).toHaveBeenCalledWith(10);
      expect(longPressMock.runOnJS).toHaveBeenCalledWith(true);
    });

    test('should call onLongPress callback with coordinates', () => {
      const gesture = createLongPressGesture(callbacks);
      const longPressMock = Gesture.LongPress.mock.results[0].value;
      const onStartHandler = longPressMock.onStart.mock.calls[0][0];

      onStartHandler({ x: 175, y: 225 });

      expect(callbacks.onLongPress).toHaveBeenCalledWith(175, 225);
    });

    test('should use custom long press config', () => {
      const customConfig = {
        longPressMinDuration: 700,
        longPressMaxDistance: 15
      };
      const gesture = createLongPressGesture(callbacks, customConfig);

      const longPressMock = Gesture.LongPress.mock.results[0].value;
      expect(longPressMock.minDuration).toHaveBeenCalledWith(700);
      expect(longPressMock.maxDistance).toHaveBeenCalledWith(15);
    });

    test('should not crash if onLongPress callback is missing', () => {
      const gesture = createLongPressGesture({});
      const longPressMock = Gesture.LongPress.mock.results[0].value;
      const onStartHandler = longPressMock.onStart.mock.calls[0][0];

      // Should not throw
      expect(() => onStartHandler({ x: 175, y: 225 })).not.toThrow();
    });
  });

  // ============================================================================
  // COMPOSED GESTURE TESTS
  // ============================================================================

  describe('createComposedGesture', () => {
    test('should create composed gesture with all components', () => {
      const gesture = createComposedGesture(sharedValues, callbacks);

      // Should create all 4 gesture types
      expect(Gesture.Pan).toHaveBeenCalled();
      expect(Gesture.Pinch).toHaveBeenCalled();
      expect(Gesture.Tap).toHaveBeenCalled();
      expect(Gesture.LongPress).toHaveBeenCalled();

      // Should compose with Simultaneous and Exclusive
      expect(Gesture.Exclusive).toHaveBeenCalled();
      expect(mockGesture.Simultaneous).toHaveBeenCalled();
    });

    test('should compose tap and long press exclusively', () => {
      createComposedGesture(sharedValues, callbacks);

      // Exclusive should be called with long press and tap (in that order)
      expect(Gesture.Exclusive).toHaveBeenCalledWith(
        expect.anything(), // longPress gesture
        expect.anything()  // tap gesture
      );
    });

    test('should compose pan, pinch, and tap/longPress simultaneously', () => {
      createComposedGesture(sharedValues, callbacks);

      // Simultaneous should be called with pan, pinch, and exclusive(tap/longPress)
      expect(mockGesture.Simultaneous).toHaveBeenCalledWith(
        expect.anything(), // pan gesture
        expect.anything(), // pinch gesture
        expect.objectContaining({ type: 'exclusive' }) // exclusive(longPress, tap)
      );
    });

    test('should pass config to all sub-gestures', () => {
      const customConfig = {
        minZoom: 0.5,
        maxZoom: 3.0,
        decelerationRate: 0.99,
        tapMaxDuration: 300,
        tapMaxDistance: 15,
        longPressMinDuration: 700,
        longPressMaxDistance: 15,
      };

      createComposedGesture(sharedValues, callbacks, customConfig);

      // Verify config was passed to gestures
      const tapMock = Gesture.Tap.mock.results[Gesture.Tap.mock.results.length - 1].value;
      expect(tapMock.maxDuration).toHaveBeenCalledWith(300);
      expect(tapMock.maxDistance).toHaveBeenCalledWith(15);

      const longPressMock = Gesture.LongPress.mock.results[Gesture.LongPress.mock.results.length - 1].value;
      expect(longPressMock.minDuration).toHaveBeenCalledWith(700);
      expect(longPressMock.maxDistance).toHaveBeenCalledWith(15);
    });
  });
});
