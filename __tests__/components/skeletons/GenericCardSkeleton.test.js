/**
 * GenericCardSkeleton Component Test Suite
 *
 * Tests the generic card loading skeleton used for multiple card types
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import GenericCardSkeleton from '../../../src/components/ui/skeletons/GenericCardSkeleton';
import tokens from '../../../src/components/ui/tokens';

// Mock dependencies
jest.mock('../../../src/components/ui/skeletons/Shimmer', () => 'Shimmer');

describe('GenericCardSkeleton Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<GenericCardSkeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with default rows (3)', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      // Find all row containers
      const rows = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ gap: tokens.spacing.xs }) });

      expect(rows).toHaveLength(3);
    });

    it('renders with custom row count', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={5} />);

      const rows = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ gap: tokens.spacing.xs }) });

      expect(rows).toHaveLength(5);
    });

    it('renders with rows=1', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={1} />);

      const rows = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ gap: tokens.spacing.xs }) });

      expect(rows).toHaveLength(1);
    });

    it('renders with rows=0 (edge case)', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={0} />);

      const rows = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ gap: tokens.spacing.xs }) });

      expect(rows).toHaveLength(0);
    });
  });

  describe('Card Structure', () => {
    it('renders title shimmer', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title: default width 100, height 22
      const titleShimmer = shimmers.find(s =>
        s.props.width === 100 && s.props.height === 22
      );

      expect(titleShimmer).toBeTruthy();
    });

    it('renders title with custom width', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton titleWidth={150} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      const titleShimmer = shimmers.find(s =>
        s.props.width === 150 && s.props.height === 22
      );

      expect(titleShimmer).toBeTruthy();
    });

    it('renders divider element', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      const divider = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          height: 1,
          backgroundColor: tokens.colors.najdi.container + '20'
        })
      });

      expect(divider).toBeTruthy();
    });

    it('renders body container', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      const body = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          gap: tokens.spacing.md
        })
      });

      expect(body).toBeTruthy();
    });
  });

  describe('Row Structure', () => {
    it('renders label shimmer for each row', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={3} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Labels: varying width (80 + index*10), height 17
      const labels = shimmers.filter(s =>
        s.props.height === 17 && typeof s.props.width === 'number'
      );

      // Should have 3 labels + 3 values
      expect(labels.length).toBeGreaterThanOrEqual(3);
    });

    it('renders value shimmer for each row', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={3} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Values: width 100%, height 17
      const values = shimmers.filter(s =>
        s.props.width === '100%' && s.props.height === 17
      );

      expect(values).toHaveLength(3);
    });

    it('varies label width progressively', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={3} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Row 0: width 80, Row 1: width 90, Row 2: width 100
      const label0 = shimmers.find(s => s.props.width === 80 && s.props.height === 17);
      const label1 = shimmers.find(s => s.props.width === 90 && s.props.height === 17);
      const label2 = shimmers.find(s => s.props.width === 100 && s.props.height === 17);

      expect(label0).toBeTruthy();
      expect(label1).toBeTruthy();
      expect(label2).toBeTruthy();
    });
  });

  describe('Design System Compliance', () => {
    it('uses Najdi background color', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          backgroundColor: tokens.colors.najdi.background
        })
      });

      expect(container).toBeTruthy();
    });

    it('uses correct border radius (md)', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          borderRadius: tokens.radii.md
        })
      });

      expect(container).toBeTruthy();
    });

    it('uses correct padding (tokens.spacing)', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

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
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

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
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      const container = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          borderWidth: 1,
          borderColor: tokens.colors.najdi.container + '40'
        })
      });

      expect(container).toBeTruthy();
    });

    it('uses tokens.radii.sm for shimmers', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // All shimmers should use sm radius
      shimmers.forEach(shimmer => {
        expect(shimmer.props.borderRadius).toBe(tokens.radii.sm);
      });
    });
  });

  describe('Shimmer Count', () => {
    it('calculates correct shimmer count for 3 rows', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={3} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title(1) + (Label + Value) × 3 rows = 7
      expect(shimmers).toHaveLength(7);
    });

    it('calculates correct shimmer count for 5 rows', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={5} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title(1) + (Label + Value) × 5 rows = 11
      expect(shimmers).toHaveLength(11);
    });

    it('calculates correct shimmer count for 1 row', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={1} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Title(1) + Label(1) + Value(1) = 3
      expect(shimmers).toHaveLength(3);
    });

    it('only renders title when rows=0', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={0} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Only title shimmer
      expect(shimmers).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('handles rows=0', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={0} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles negative rows (edge case)', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={-1} />);
      const rows = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ gap: tokens.spacing.xs }) });

      // Negative length should create empty array
      expect(rows).toHaveLength(0);
    });

    it('handles very large row count (20 rows)', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={20} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles undefined rows (uses default 3)', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Default 3 rows: 1 title + 6 row shimmers = 7
      expect(shimmers).toHaveLength(7);
    });

    it('handles null rows', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={null} />);
      const rows = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ gap: tokens.spacing.xs }) });

      // null should be coerced to 0
      expect(rows).toHaveLength(0);
    });

    it('handles titleWidth=0', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton titleWidth={0} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      const titleShimmer = shimmers.find(s => s.props.width === 0);
      expect(titleShimmer).toBeTruthy();
    });

    it('handles very large titleWidth', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton titleWidth={500} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      const titleShimmer = shimmers.find(s => s.props.width === 500);
      expect(titleShimmer).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('renders within performance budget (< 16ms)', () => {
      const start = performance.now();
      render(<GenericCardSkeleton />);
      const end = performance.now();

      const renderTime = end - start;
      expect(renderTime).toBeLessThan(16);
    });

    it('renders 10 rows efficiently', () => {
      const start = performance.now();
      render(<GenericCardSkeleton rows={10} />);
      const end = performance.now();

      // 10 rows should still render quickly
      expect(end - start).toBeLessThan(30);
    });

    it('handles multiple instances efficiently', () => {
      const start = performance.now();

      render(
        <>
          <GenericCardSkeleton rows={3} titleWidth={80} />
          <GenericCardSkeleton rows={2} titleWidth={100} />
          <GenericCardSkeleton rows={3} titleWidth={90} />
          <GenericCardSkeleton rows={2} titleWidth={100} />
        </>
      );

      const end = performance.now();

      // 4 cards should render quickly
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('Responsive Layout', () => {
    it('uses gap for row spacing', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton />);

      const body = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          gap: tokens.spacing.md
        })
      });

      expect(body).toBeTruthy();
    });

    it('uses gap between label and value', () => {
      const { UNSAFE_root } = render(<GenericCardSkeleton rows={1} />);

      const row = UNSAFE_root.findByProps({
        style: expect.objectContaining({
          gap: tokens.spacing.xs
        })
      });

      expect(row).toBeTruthy();
    });
  });

  describe('Snapshot Tests', () => {
    it('matches snapshot with default props', () => {
      const { toJSON } = render(<GenericCardSkeleton />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('matches snapshot with 5 rows', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={5} titleWidth={120} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('Use Cases', () => {
    it('works for PersonalCard (3 rows)', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={3} titleWidth={80} />);
      expect(toJSON()).toBeTruthy();
    });

    it('works for DatesCard (2 rows)', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={2} titleWidth={100} />);
      expect(toJSON()).toBeTruthy();
    });

    it('works for ProfessionalCard (3 rows)', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={3} titleWidth={90} />);
      expect(toJSON()).toBeTruthy();
    });

    it('works for ContactCard (2 rows)', () => {
      const { toJSON } = render(<GenericCardSkeleton rows={2} titleWidth={100} />);
      expect(toJSON()).toBeTruthy();
    });
  });
});
