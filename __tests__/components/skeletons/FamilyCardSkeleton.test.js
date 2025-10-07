/**
 * FamilyCardSkeleton Component Test Suite
 *
 * Tests the family card loading skeleton with tile layout
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import FamilyCardSkeleton from '../../../src/components/ui/skeletons/FamilyCardSkeleton';
import tokens from '../../../src/components/ui/tokens';

// Mock dependencies
jest.mock('../../../src/components/ui/skeletons/Shimmer', () => 'Shimmer');

describe('FamilyCardSkeleton Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<FamilyCardSkeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with default tileCount (4)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      // Find all tile containers
      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      expect(tiles).toHaveLength(4);
    });

    it('renders with custom tileCount', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={6} />);

      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      expect(tiles).toHaveLength(6);
    });

    it('renders with tileCount=1', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={1} />);

      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      expect(tiles).toHaveLength(1);
    });

    it('renders with tileCount=0 (edge case)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={0} />);

      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      expect(tiles).toHaveLength(0);
    });
  });

  describe('Card Structure', () => {
    it('renders title shimmer', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title: width 80, height 22
      const titleShimmer = shimmers.find(s =>
        s.props.width === 80 && s.props.height === 22
      );

      expect(titleShimmer).toBeTruthy();
    });

    it('renders divider element', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const divider = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          height: 1,
          backgroundColor: tokens.colors.najdi.container + '20'
        })
      });

      expect(divider).toBeTruthy();
    });

    it('renders family row container', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const familyRow = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          flexDirection: 'row',
          gap: 12
        })
      });

      expect(familyRow).toBeTruthy();
    });
  });

  describe('Tile Structure', () => {
    it('renders avatar shimmer for each tile', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={4} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Avatar: 40x40, borderRadius 20 (circular)
      const avatars = shimmers.filter(s =>
        s.props.width === 40 &&
        s.props.height === 40 &&
        s.props.borderRadius === 20
      );

      expect(avatars).toHaveLength(4);
    });

    it('renders name shimmer for each tile', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={4} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Name: width 70, height 16
      const names = shimmers.filter(s =>
        s.props.width === 70 && s.props.height === 16
      );

      expect(names).toHaveLength(4);
    });

    it('renders optional label shimmer (alternating)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={6} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Label: width 50, height 14 (only for index % 3 === 0)
      const labels = shimmers.filter(s =>
        s.props.width === 50 && s.props.height === 14
      );

      // Tiles at index 0 and 3 should have labels (2 labels)
      expect(labels).toHaveLength(2);
    });

    it('alternates labels correctly for 9 tiles', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={9} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Labels at index 0, 3, 6 (3 labels)
      const labels = shimmers.filter(s =>
        s.props.width === 50 && s.props.height === 14
      );

      expect(labels).toHaveLength(3);
    });
  });

  describe('Design System Compliance', () => {
    it('uses Najdi background color', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          backgroundColor: tokens.colors.najdi.background
        })
      });

      expect(container).toBeTruthy();
    });

    it('uses correct border radius (md)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          borderRadius: tokens.radii.md
        })
      });

      expect(container).toBeTruthy();
    });

    it('uses correct padding (tokens.spacing)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          paddingHorizontal: tokens.spacing.md,
          paddingTop: tokens.spacing.md,
          paddingBottom: tokens.spacing.lg
        })
      });

      expect(container).toBeTruthy();
    });

    it('applies iOS shadow', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          shadowColor: tokens.shadow.ios.shadowColor,
          shadowOpacity: tokens.shadow.ios.shadowOpacity,
          shadowRadius: tokens.shadow.ios.shadowRadius
        })
      });

      expect(container).toBeTruthy();
    });

    it('uses Najdi border color (40% opacity)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          borderWidth: 1,
          borderColor: tokens.colors.najdi.container + '40'
        })
      });

      expect(container).toBeTruthy();
    });
  });

  describe('Shimmer Count', () => {
    it('calculates correct shimmer count for 4 tiles', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={4} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title(1) + [Avatar(1) + Name(1) + Label(1 if index%3===0)] × 4 tiles
      // Title(1) + Tile0(3) + Tile1(2) + Tile2(2) + Tile3(3) = 11
      expect(shimmers).toHaveLength(11);
    });

    it('calculates correct shimmer count for 3 tiles', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={3} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title(1) + Tile0(3) + Tile1(2) + Tile2(2) = 8
      expect(shimmers).toHaveLength(8);
    });

    it('calculates correct shimmer count for 1 tile', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={1} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title(1) + Tile0(Avatar + Name + Label) = 4
      expect(shimmers).toHaveLength(4);
    });
  });

  describe('Edge Cases', () => {
    it('handles tileCount=0', () => {
      const { toJSON } = render(<FamilyCardSkeleton tileCount={0} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles negative tileCount (edge case)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={-1} />);
      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      // Negative length should create empty array
      expect(tiles).toHaveLength(0);
    });

    it('handles very large tileCount (20 tiles)', () => {
      const { toJSON } = render(<FamilyCardSkeleton tileCount={20} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles undefined tileCount (uses default)', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);
      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      expect(tiles).toHaveLength(4);
    });

    it('handles null tileCount', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton tileCount={null} />);
      const tiles = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ width: 80 }) });

      // null should be coerced to 0
      expect(tiles).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('renders within performance budget (< 16ms)', () => {
      const start = performance.now();
      render(<FamilyCardSkeleton />);
      const end = performance.now();

      const renderTime = end - start;
      expect(renderTime).toBeLessThan(16);
    });

    it('renders 10 tiles efficiently', () => {
      const start = performance.now();
      render(<FamilyCardSkeleton tileCount={10} />);
      const end = performance.now();

      // 10 tiles should still render quickly
      expect(end - start).toBeLessThan(30);
    });
  });

  describe('Responsive Layout', () => {
    it('maintains horizontal layout', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const familyRow = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          flexDirection: 'row'
        })
      });

      expect(familyRow).toBeTruthy();
    });

    it('uses gap for spacing', () => {
      const { UNSAFE_root } = render(<FamilyCardSkeleton />);

      const familyRow = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          gap: 12
        })
      });

      expect(familyRow).toBeTruthy();
    });
  });

  describe('Snapshot Tests', () => {
    it('matches snapshot with default props', () => {
      const { toJSON } = render(<FamilyCardSkeleton />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('matches snapshot with 6 tiles', () => {
      const { toJSON } = render(<FamilyCardSkeleton tileCount={6} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
