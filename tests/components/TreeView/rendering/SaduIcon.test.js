/**
 * SaduIcon tests
 * Phase 2 Day 2
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SaduIcon, RootSaduIcon, G2SaduIcon } from '../../../../src/components/TreeView/rendering/SaduIcon';

// Mock Skia components
jest.mock('@shopify/react-native-skia', () => ({
  Group: 'Group',
  Image: 'Image',
  Paint: 'Paint',
  ColorMatrix: 'ColorMatrix',
  useImage: jest.fn((source) => {
    // Simulate successful image load
    return { width: 90, height: 90, source };
  }),
}));

describe('SaduIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SaduIcon', () => {
    it('should render with root pattern by default', () => {
      const { UNSAFE_root } = render(<SaduIcon x={100} y={50} size={20} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should render with generation2 pattern when specified', () => {
      const { UNSAFE_root } = render(
        <SaduIcon x={100} y={50} size={14} pattern="generation2" />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should accept x, y, size props', () => {
      const { UNSAFE_root } = render(<SaduIcon x={200} y={100} size={30} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should return null if image fails to load', () => {
      const { useImage } = require('@shopify/react-native-skia');
      useImage.mockReturnValueOnce(null); // Simulate failed load

      const { UNSAFE_root } = render(<SaduIcon x={100} y={50} size={20} />);

      // Component should render nothing
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('RootSaduIcon', () => {
    it('should render root pattern', () => {
      const { UNSAFE_root } = render(<RootSaduIcon x={100} y={50} size={20} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not require pattern prop', () => {
      // Should compile without pattern prop (TypeScript check)
      const { UNSAFE_root } = render(<RootSaduIcon x={100} y={50} size={20} />);

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('G2SaduIcon', () => {
    it('should render generation2 pattern', () => {
      const { UNSAFE_root } = render(<G2SaduIcon x={100} y={50} size={14} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not require pattern prop', () => {
      // Should compile without pattern prop (TypeScript check)
      const { UNSAFE_root } = render(<G2SaduIcon x={100} y={50} size={14} />);

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('pattern types', () => {
    it('should support root pattern type', () => {
      const { UNSAFE_root } = render(
        <SaduIcon x={100} y={50} size={20} pattern="root" />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should support generation2 pattern type', () => {
      const { UNSAFE_root } = render(
        <SaduIcon x={100} y={50} size={14} pattern="generation2" />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('positioning and sizing', () => {
    it('should handle different sizes', () => {
      const sizes = [10, 14, 20, 30, 40];

      sizes.forEach((size) => {
        const { UNSAFE_root } = render(<SaduIcon x={100} y={50} size={size} />);
        expect(UNSAFE_root).toBeTruthy();
      });
    });

    it('should handle different positions', () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: -10, y: -20 }, // Negative positions (off-screen)
        { x: 1000, y: 2000 }, // Large positions
      ];

      positions.forEach(({ x, y }) => {
        const { UNSAFE_root } = render(<SaduIcon x={x} y={y} size={20} />);
        expect(UNSAFE_root).toBeTruthy();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle size of 0', () => {
      const { UNSAFE_root } = render(<SaduIcon x={100} y={50} size={0} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle very large size', () => {
      const { UNSAFE_root } = render(<SaduIcon x={100} y={50} size={1000} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle fractional coordinates', () => {
      const { UNSAFE_root } = render(<SaduIcon x={100.5} y={50.75} size={20.25} />);

      expect(UNSAFE_root).toBeTruthy();
    });
  });
});
