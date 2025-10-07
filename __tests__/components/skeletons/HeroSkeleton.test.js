/**
 * HeroSkeleton Component Test Suite
 *
 * Tests the hero section loading skeleton
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import HeroSkeleton from '../../../src/components/ui/skeletons/HeroSkeleton';
import tokens from '../../../src/components/ui/tokens';

// Mock dependencies
jest.mock('../../../src/components/ui/skeletons/Shimmer', () => 'Shimmer');

describe('HeroSkeleton Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<HeroSkeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with photo by default', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // With photo: photo shimmer + name + lineage + 3 bio lines + 3 metrics = 9 shimmers
      expect(shimmers.length).toBeGreaterThanOrEqual(7);
    });

    it('renders without photo when withPhoto=false', () => {
      const { UNSAFE_root } = render(<HeroSkeleton withPhoto={false} />);

      // Find photo wrapper - should not exist
      const photoWrappers = UNSAFE_root.findAllByProps({ style: expect.objectContaining({ height: 220 }) });

      // Should not find photo wrapper with exact height of 220
      const hasPhotoShimmer = photoWrappers.some(wrapper => {
        try {
          wrapper.findByType('Shimmer');
          return true;
        } catch {
          return false;
        }
      });

      expect(hasPhotoShimmer).toBe(false);
    });

    it('renders action button placeholder when withPhoto=false', () => {
      const { UNSAFE_root } = render(<HeroSkeleton withPhoto={false} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Find circular shimmer (action button) - 40x40 with borderRadius 20
      const actionButton = shimmers.find(s =>
        s.props.width === 40 &&
        s.props.height === 40 &&
        s.props.borderRadius === 20
      );

      expect(actionButton).toBeTruthy();
    });
  });

  describe('Structure and Layout', () => {
    it('renders name row with correct shimmer dimensions', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Name shimmer: 60% width, 32 height
      const nameShimmer = shimmers.find(s =>
        s.props.width === '60%' && s.props.height === 32
      );

      expect(nameShimmer).toBeTruthy();
    });

    it('renders lineage row with correct dimensions', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Lineage shimmer: 75% width, 18 height
      const lineageShimmer = shimmers.find(s =>
        s.props.width === '75%' && s.props.height === 18
      );

      expect(lineageShimmer).toBeTruthy();
    });

    it('renders bio lines with varying widths', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Bio lines: 100%, 90%, 70% width, all 16 height
      const bioLine1 = shimmers.find(s =>
        s.props.width === '100%' && s.props.height === 16
      );
      const bioLine2 = shimmers.find(s =>
        s.props.width === '90%' && s.props.height === 16
      );
      const bioLine3 = shimmers.find(s =>
        s.props.width === '70%' && s.props.height === 16
      );

      expect(bioLine1).toBeTruthy();
      expect(bioLine2).toBeTruthy();
      expect(bioLine3).toBeTruthy();
    });

    it('renders three metric pills', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Metric pills: 100 width, 64 height, md borderRadius
      const metricPills = shimmers.filter(s =>
        s.props.width === 100 &&
        s.props.height === 64 &&
        s.props.borderRadius === tokens.radii.md
      );

      expect(metricPills).toHaveLength(3);
    });

    it('renders photo shimmer with correct dimensions', () => {
      const { UNSAFE_root } = render(<HeroSkeleton withPhoto={true} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Photo shimmer: 100% width, 220 height, 0 borderRadius
      const photoShimmer = shimmers.find(s =>
        s.props.width === '100%' &&
        s.props.height === 220 &&
        s.props.borderRadius === 0
      );

      expect(photoShimmer).toBeTruthy();
    });
  });

  describe('Design System Compliance', () => {
    it('uses Najdi background color', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const container = UNSAFE_root.findByProps({ style: expect.objectContaining({ backgroundColor: tokens.colors.najdi.background }) });

      expect(container).toBeTruthy();
    });

    it('uses correct border radius (20)', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const container = UNSAFE_root.findByProps({ style: expect.objectContaining({ borderRadius: 20 }) });

      expect(container).toBeTruthy();
    });

    it('uses tokens.radii.sm for small shimmers', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Name and lineage use sm radius
      const nameShimmer = shimmers.find(s =>
        s.props.width === '60%' && s.props.borderRadius === tokens.radii.sm
      );
      const lineageShimmer = shimmers.find(s =>
        s.props.width === '75%' && s.props.borderRadius === tokens.radii.sm
      );

      expect(nameShimmer).toBeTruthy();
      expect(lineageShimmer).toBeTruthy();
    });

    it('uses tokens.radii.md for metric pills', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      const metricPills = shimmers.filter(s =>
        s.props.borderRadius === tokens.radii.md
      );

      expect(metricPills.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Responsive Behavior', () => {
    it('maintains structure with photo', () => {
      const { toJSON } = render(<HeroSkeleton withPhoto={true} />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('maintains structure without photo', () => {
      const { toJSON } = render(<HeroSkeleton withPhoto={false} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('Edge Cases', () => {
    it('handles withPhoto=undefined (defaults to true)', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Should include photo shimmer by default
      const photoShimmer = shimmers.find(s =>
        s.props.height === 220
      );

      expect(photoShimmer).toBeTruthy();
    });

    it('handles withPhoto=null', () => {
      const { toJSON } = render(<HeroSkeleton withPhoto={null} />);
      expect(toJSON()).toBeTruthy();
    });

    it('handles withPhoto=true explicitly', () => {
      const { UNSAFE_root } = render(<HeroSkeleton withPhoto={true} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      const photoShimmer = shimmers.find(s => s.props.height === 220);
      expect(photoShimmer).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('renders within performance budget (< 16ms)', () => {
      const start = performance.now();
      render(<HeroSkeleton />);
      const end = performance.now();

      const renderTime = end - start;
      expect(renderTime).toBeLessThan(16);
    });

    it('renders efficiently with photo', () => {
      const start = performance.now();
      render(<HeroSkeleton withPhoto={true} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(20);
    });

    it('renders efficiently without photo', () => {
      const start = performance.now();
      render(<HeroSkeleton withPhoto={false} />);
      const end = performance.now();

      expect(end - start).toBeLessThan(20);
    });
  });

  describe('Component Count', () => {
    it('renders correct number of shimmers with photo', () => {
      const { UNSAFE_root } = render(<HeroSkeleton withPhoto={true} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Photo(1) + Name(1) + Lineage(1) + Bio(3) + Metrics(3) = 9
      expect(shimmers).toHaveLength(9);
    });

    it('renders correct number of shimmers without photo', () => {
      const { UNSAFE_root } = render(<HeroSkeleton withPhoto={false} />);
      const shimmers = UNSAFE_root.findAllByType('Shimmer');

      // Name(1) + Action(1) + Lineage(1) + Bio(3) + Metrics(3) = 9
      expect(shimmers).toHaveLength(9);
    });
  });

  describe('Accessibility', () => {
    it('renders with proper container structure', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const container = UNSAFE_root.findByProps({ style: expect.objectContaining({ position: 'relative' }) });

      expect(container).toBeTruthy();
    });

    it('includes overflow:hidden on container', () => {
      const { UNSAFE_root } = render(<HeroSkeleton />);
      const container = UNSAFE_root.findByProps({ style: expect.objectContaining({ overflow: 'hidden' }) });

      expect(container).toBeTruthy();
    });
  });
});
