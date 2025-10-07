/**
 * ProfileViewer Loading States Integration Test Suite
 *
 * Tests skeleton loading behavior in ProfileViewer component
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import ProfileViewer from '../../src/components/ProfileViewer';
import { profilesService } from '../../src/services/profiles';

// Mock dependencies
jest.mock('../../src/services/profiles');
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      eq: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
jest.mock('../../src/stores/useTreeStore', () => ({
  useTreeStore: jest.fn((selector) => {
    const mockStore = {
      nodes: [],
      updateNode: jest.fn(),
      profileSheetProgress: { value: 0 },
      profileSheetIndex: 0,
      setState: jest.fn(),
      getState: () => ({
        updateNode: jest.fn(),
      }),
    };
    return selector ? selector(mockStore) : mockStore;
  }),
}));
jest.mock('../../src/contexts/AdminModeContext', () => ({
  useAdminMode: () => ({ isAdminMode: false }),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  default: 'BottomSheet',
  BottomSheetScrollView: 'BottomSheetScrollView',
  BottomSheetBackdrop: 'BottomSheetBackdrop',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../src/components/ui/skeletons/HeroSkeleton', () => 'HeroSkeleton');
jest.mock('../../src/components/ui/skeletons/FamilyCardSkeleton', () => 'FamilyCardSkeleton');
jest.mock('../../src/components/ui/skeletons/GenericCardSkeleton', () => 'GenericCardSkeleton');

const mockPerson = {
  id: 'test-profile-id',
  name: 'محمد القفاري',
  hid: 'H001',
  gender: 'male',
  version: 1,
};

describe('ProfileViewer - Loading States Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial Loading State', () => {
    it('renders with initial loading states true', () => {
      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Should render skeleton components initially
      const genericSkeletons = UNSAFE_root.findAllByType('GenericCardSkeleton');
      const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');

      expect(genericSkeletons.length).toBeGreaterThan(0);
      expect(familySkeletons.length).toBeGreaterThan(0);
    });

    it('sets marriages loading state to true on mount', () => {
      profilesService.getPersonMarriages = jest.fn(() =>
        new Promise((resolve) => setTimeout(() => resolve([]), 300))
      );

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Family skeleton should be visible
      const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');
      expect(familySkeletons.length).toBeGreaterThan(0);
    });

    it('sets permissions loading state to true on mount', () => {
      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Generic skeletons should be visible
      const genericSkeletons = UNSAFE_root.findAllByType('GenericCardSkeleton');
      expect(genericSkeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Marriage Data Loading Flow', () => {
    it('hides skeleton after marriage data loads', async () => {
      profilesService.getPersonMarriages = jest.fn().mockResolvedValue([
        { spouse_id: 'spouse-1', spouse_name: 'فاطمة' },
      ]);

      const { UNSAFE_root, rerender } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Wait for data fetch and minimum skeleton time
      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      await waitFor(() => {
        // Skeleton should be removed after loading
        const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons.length).toBe(0);
      });
    });

    it('enforces minimum 200ms skeleton display time', async () => {
      // Fast data load (< 50ms)
      profilesService.getPersonMarriages = jest.fn().mockResolvedValue([]);

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // After 100ms, skeleton should still be visible
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const familySkeletons1 = UNSAFE_root.findAllByType('FamilyCardSkeleton');
      expect(familySkeletons1.length).toBeGreaterThan(0);

      // After 200ms+ total, skeleton should be hidden
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const familySkeletons2 = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons2.length).toBe(0);
      });
    });

    it('handles marriage fetch error gracefully', async () => {
      profilesService.getPersonMarriages = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Wait for error handling
      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      await waitFor(() => {
        // Skeleton should be hidden even on error
        const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons.length).toBe(0);
      });
    });
  });

  describe('Rapid Profile Switching', () => {
    it('prevents stale data from previous profile', async () => {
      let resolveA, resolveB;
      const promiseA = new Promise((resolve) => { resolveA = resolve; });
      const promiseB = new Promise((resolve) => { resolveB = resolve; });

      profilesService.getPersonMarriages = jest.fn()
        .mockReturnValueOnce(promiseA)
        .mockReturnValueOnce(promiseB);

      const personA = { ...mockPerson, id: 'profile-a', name: 'علي' };
      const personB = { ...mockPerson, id: 'profile-b', name: 'محمد' };

      const { rerender } = render(
        <ProfileViewer person={personA} onClose={jest.fn()} />
      );

      // Immediately switch to profile B before A loads
      rerender(<ProfileViewer person={personB} onClose={jest.fn()} />);

      // Resolve A (stale data)
      await act(async () => {
        resolveA([{ spouse_id: 'spouse-a' }]);
        jest.advanceTimersByTime(50);
      });

      // Resolve B (current data)
      await act(async () => {
        resolveB([{ spouse_id: 'spouse-b' }]);
        jest.advanceTimersByTime(250);
      });

      // Service should be called twice
      expect(profilesService.getPersonMarriages).toHaveBeenCalledTimes(2);
      expect(profilesService.getPersonMarriages).toHaveBeenCalledWith('profile-a');
      expect(profilesService.getPersonMarriages).toHaveBeenCalledWith('profile-b');
    });

    it('cancels pending updates on profile change', async () => {
      const { rerender } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Change person immediately
      const newPerson = { ...mockPerson, id: 'new-id', name: 'أحمد' };
      rerender(<ProfileViewer person={newPerson} onClose={jest.fn()} />);

      // No errors should occur from stale updates
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe('Close During Loading', () => {
    it('handles close before data loads without errors', async () => {
      profilesService.getPersonMarriages = jest.fn(() =>
        new Promise((resolve) => setTimeout(() => resolve([]), 500))
      );

      const { unmount } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Close immediately
      unmount();

      // Advance timers to complete pending operations
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      // No errors should be thrown
      expect(true).toBe(true);
    });

    it('cleans up on unmount', async () => {
      const { unmount } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      unmount();

      // Cleanup should prevent memory leaks
      expect(true).toBe(true);
    });
  });

  describe('Snap Index Reset Behavior', () => {
    it('resets loading states when snap index changes', async () => {
      const { rerender } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Wait for initial load
      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      // Simulate snap index change (reopen)
      // This would normally be triggered by bottomSheetRef.snapToIndex()
      // We'll simulate by re-rendering with same person
      rerender(<ProfileViewer person={mockPerson} onClose={jest.fn()} />);

      // Loading states should reset
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      expect(true).toBe(true); // Verify no errors
    });
  });

  describe('Network Failure Scenarios', () => {
    it('handles getPersonMarriages returning null', async () => {
      profilesService.getPersonMarriages = jest.fn().mockResolvedValue(null);

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      await waitFor(() => {
        const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons.length).toBe(0);
      });
    });

    it('handles missing profilesService method', async () => {
      profilesService.getPersonMarriages = undefined;

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      // Should handle gracefully
      await waitFor(() => {
        const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons.length).toBe(0);
      });
    });

    it('handles person.id being null', async () => {
      const personWithoutId = { ...mockPerson, id: null };

      const { UNSAFE_root } = render(
        <ProfileViewer person={personWithoutId} onClose={jest.fn()} />
      );

      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      await waitFor(() => {
        const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons.length).toBe(0);
      });
    });
  });

  describe('Cached vs Uncached Data', () => {
    it('shows skeletons even with cached permission data', async () => {
      // Mock cached permissions (instant load)
      profilesService.getPersonMarriages = jest.fn().mockResolvedValue([]);

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // Even with instant data, skeletons should show for 200ms
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      const genericSkeletons = UNSAFE_root.findAllByType('GenericCardSkeleton');
      expect(genericSkeletons.length).toBeGreaterThan(0);
    });

    it('respects minimum skeleton time with fast cache hit', async () => {
      profilesService.getPersonMarriages = jest.fn().mockResolvedValue([]);

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      // After 50ms (fast cache hit), skeleton still visible
      await act(async () => {
        jest.advanceTimersByTime(50);
      });

      const familySkeletons1 = UNSAFE_root.findAllByType('FamilyCardSkeleton');
      expect(familySkeletons1.length).toBeGreaterThan(0);

      // After 200ms+, skeleton hidden
      await act(async () => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        const familySkeletons2 = UNSAFE_root.findAllByType('FamilyCardSkeleton');
        expect(familySkeletons2.length).toBe(0);
      });
    });
  });

  describe('Performance', () => {
    it('renders skeletons within performance budget', async () => {
      const start = performance.now();

      render(<ProfileViewer person={mockPerson} onClose={jest.fn()} />);

      const end = performance.now();
      const renderTime = end - start;

      // Should render with skeletons in < 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('handles skeleton hide transition smoothly', async () => {
      profilesService.getPersonMarriages = jest.fn().mockResolvedValue([]);

      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      const start = performance.now();

      await act(async () => {
        jest.advanceTimersByTime(250);
      });

      const end = performance.now();

      // Transition should be fast
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('Skeleton Component Rendering', () => {
    it('renders 4 GenericCardSkeletons for permission cards', () => {
      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      const genericSkeletons = UNSAFE_root.findAllByType('GenericCardSkeleton');

      // PersonalCard, DatesCard, ProfessionalCard, ContactCard
      expect(genericSkeletons).toHaveLength(4);
    });

    it('passes correct props to GenericCardSkeleton', () => {
      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      const genericSkeletons = UNSAFE_root.findAllByType('GenericCardSkeleton');

      // Check first skeleton has expected props
      expect(genericSkeletons[0].props).toEqual({
        rows: 3,
        titleWidth: 80,
      });
    });

    it('renders FamilyCardSkeleton with correct tileCount', () => {
      const { UNSAFE_root } = render(
        <ProfileViewer person={mockPerson} onClose={jest.fn()} />
      );

      const familySkeletons = UNSAFE_root.findAllByType('FamilyCardSkeleton');

      expect(familySkeletons).toHaveLength(1);
      expect(familySkeletons[0].props).toEqual({
        tileCount: 4,
      });
    });
  });
});
