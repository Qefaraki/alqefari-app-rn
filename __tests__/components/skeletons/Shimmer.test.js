/**
 * Shimmer Component Test Suite
 *
 * Tests the animated loading shimmer component with Najdi Sadu colors
 */

import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import Shimmer from '../../../src/components/ui/skeletons/Shimmer';
import tokens from '../../../src/components/ui/tokens';

// Mock LinearGradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

describe('Shimmer Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<Shimmer />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with default props', () => {
      const { getByTestId } = render(<Shimmer testID="shimmer" />);
      expect(getByTestId('shimmer')).toBeTruthy();
    });
  });

  describe('Props Application', () => {
    it('applies custom width prop (numeric)', () => {
      const { UNSAFE_root } = render(<Shimmer width={120} height={20} />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      // Find the style object that contains width
      const widthStyle = Array.isArray(style)
        ? style.find(s => s && s.width !== undefined)
        : style;

      expect(widthStyle.width).toBe(120);
    });

    it('applies custom width prop (percentage)', () => {
      const { UNSAFE_root } = render(<Shimmer width="80%" height={20} />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const widthStyle = Array.isArray(style)
        ? style.find(s => s && s.width !== undefined)
        : style;

      expect(widthStyle.width).toBe('80%');
    });

    it('applies custom height prop', () => {
      const { UNSAFE_root } = render(<Shimmer width="100%" height={40} />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const heightStyle = Array.isArray(style)
        ? style.find(s => s && s.height !== undefined)
        : style;

      expect(heightStyle.height).toBe(40);
    });

    it('applies custom borderRadius prop', () => {
      const { UNSAFE_root } = render(<Shimmer borderRadius={16} />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const borderStyle = Array.isArray(style)
        ? style.find(s => s && s.borderRadius !== undefined)
        : style;

      expect(borderStyle.borderRadius).toBe(16);
    });

    it('uses default borderRadius from tokens', () => {
      const { UNSAFE_root } = render(<Shimmer />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const borderStyle = Array.isArray(style)
        ? style.find(s => s && s.borderRadius !== undefined)
        : style;

      expect(borderStyle.borderRadius).toBe(tokens.radii.sm);
    });

    it('merges custom style prop', () => {
      const customStyle = { marginTop: 20, opacity: 0.5 };
      const { UNSAFE_root } = render(<Shimmer style={customStyle} />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const mergedStyle = Array.isArray(style)
        ? style.find(s => s && (s.marginTop !== undefined || s.opacity !== undefined))
        : style;

      expect(mergedStyle).toMatchObject(customStyle);
    });
  });

  describe('Color System', () => {
    it('uses Najdi Sadu colors', () => {
      const { UNSAFE_root } = render(<Shimmer />);

      // Find LinearGradient component
      const gradient = UNSAFE_root.findByType('LinearGradient');

      // Check that gradient colors use Camel Hair Beige from tokens
      expect(gradient.props.colors).toEqual([
        tokens.colors.najdi.container + '40', // 25% opacity
        tokens.colors.najdi.container + '80', // 50% opacity
        tokens.colors.najdi.container + '40', // 25% opacity
      ]);
    });

    it('uses correct base container color', () => {
      const { UNSAFE_root } = render(<Shimmer />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const bgStyle = Array.isArray(style)
        ? style.find(s => s && s.backgroundColor !== undefined)
        : style;

      expect(bgStyle.backgroundColor).toBe(tokens.colors.najdi.container + '20');
    });
  });

  describe('Animation', () => {
    beforeEach(() => {
      // Reset animation mocks
      jest.clearAllMocks();
    });

    it('starts animation on mount', () => {
      const startSpy = jest.spyOn(Animated, 'loop');
      render(<Shimmer />);

      expect(startSpy).toHaveBeenCalled();
    });

    it('uses native driver for animations', () => {
      const timingSpy = jest.spyOn(Animated, 'timing');
      render(<Shimmer />);

      // Check that timing calls include useNativeDriver: true
      const calls = timingSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      calls.forEach(call => {
        const config = call[1];
        expect(config.useNativeDriver).toBe(true);
      });
    });

    it('creates looping animation sequence', () => {
      const loopSpy = jest.spyOn(Animated, 'loop');
      render(<Shimmer />);

      expect(loopSpy).toHaveBeenCalled();
    });

    it('animates with correct duration (1200ms)', () => {
      const timingSpy = jest.spyOn(Animated, 'timing');
      render(<Shimmer />);

      const calls = timingSpy.mock.calls;
      calls.forEach(call => {
        const config = call[1];
        expect(config.duration).toBe(1200);
      });
    });

    it('stops animation on unmount', () => {
      const { unmount } = render(<Shimmer />);

      // Create a spy on the animation stop method
      const stopSpy = jest.fn();
      Animated.loop = jest.fn(() => ({
        start: jest.fn(),
        stop: stopSpy,
      }));

      // Re-render and unmount
      const { unmount: unmount2 } = render(<Shimmer />);
      unmount2();

      // Animation cleanup should be called
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('renders as View with proper accessibility', () => {
      const { UNSAFE_root } = render(<Shimmer />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });

      expect(container.type).toBe('View');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero width', () => {
      const { toJSON } = render(<Shimmer width={0} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles zero height', () => {
      const { toJSON } = render(<Shimmer height={0} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles very large dimensions', () => {
      const { toJSON } = render(<Shimmer width={9999} height={9999} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles zero borderRadius (sharp corners)', () => {
      const { UNSAFE_root } = render(<Shimmer borderRadius={0} />);
      const container = UNSAFE_root.findByProps({ style: expect.anything() });
      const style = container.props.style;

      const borderStyle = Array.isArray(style)
        ? style.find(s => s && s.borderRadius !== undefined)
        : style;

      expect(borderStyle.borderRadius).toBe(0);
    });
  });

  describe('Performance', () => {
    it('renders within performance budget', () => {
      const start = performance.now();
      render(<Shimmer />);
      const end = performance.now();

      const renderTime = end - start;

      // Should render in less than 16ms (60fps budget)
      expect(renderTime).toBeLessThan(16);
    });

    it('handles multiple instances efficiently', () => {
      const start = performance.now();

      render(
        <>
          <Shimmer width={100} height={20} />
          <Shimmer width={120} height={20} />
          <Shimmer width={80} height={20} />
          <Shimmer width={100} height={20} />
        </>
      );

      const end = performance.now();
      const renderTime = end - start;

      // 4 shimmers should render in less than 50ms
      expect(renderTime).toBeLessThan(50);
    });
  });
});
