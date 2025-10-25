/**
 * ImageBuckets tests
 * Phase 2 Day 1
 */

import {
  selectBucket,
  selectBucketWithHysteresis,
  clearBucketTimer,
  clearAllBucketTimers,
  BUCKET_CONSTANTS,
} from '../../../../src/components/TreeView/lod/ImageBuckets';

describe('ImageBuckets', () => {
  describe('selectBucket', () => {
    it('should select 40px bucket for very small sizes', () => {
      expect(selectBucket(30)).toBe(40);
      expect(selectBucket(40)).toBe(40);
    });

    it('should select 60px bucket for small sizes', () => {
      expect(selectBucket(50)).toBe(60);
      expect(selectBucket(60)).toBe(60);
    });

    it('should select 80px bucket for medium sizes', () => {
      expect(selectBucket(70)).toBe(80);
      expect(selectBucket(80)).toBe(80);
    });

    it('should select 120px bucket for large sizes', () => {
      expect(selectBucket(100)).toBe(120);
      expect(selectBucket(120)).toBe(120);
    });

    it('should select 256px bucket for very large sizes', () => {
      expect(selectBucket(200)).toBe(256);
      expect(selectBucket(256)).toBe(256);
    });

    it('should use default bucket (80) for sizes exceeding max', () => {
      expect(selectBucket(300)).toBe(80); // Falls back to DEFAULT_IMAGE_BUCKET
    });
  });

  describe('selectBucketWithHysteresis', () => {
    let bucketStates;
    let bucketTimers;

    beforeEach(() => {
      bucketStates = new Map();
      bucketTimers = new Map();
      jest.useFakeTimers();
    });

    afterEach(() => {
      // Clear all timers
      bucketTimers.forEach((timer) => clearTimeout(timer));
      bucketTimers.clear();
      jest.useRealTimers();
    });

    it('should select initial bucket', () => {
      // No prior state: starts at DEFAULT_BUCKET (80)
      // For 100px (target 120, outside hysteresis zone)
      const bucket = selectBucketWithHysteresis('n1', 100, bucketStates, bucketTimers);

      expect(bucket).toBe(80); // Returns current while debouncing

      // After debounce, state updated to 120
      jest.advanceTimersByTime(150);
      expect(bucketStates.get('n1')).toBe(120);
    });

    it('should apply hysteresis when upgrading within threshold', () => {
      // Start at 80px bucket
      bucketStates.set('n1', 80);

      // Zoom in slightly (90px) - target is 120, but within hysteresis
      // 80 * (1 + 0.15) = 92, so 90 < 92 → stay at 80
      const bucket = selectBucketWithHysteresis('n1', 90, bucketStates, bucketTimers);

      expect(bucket).toBe(80); // Stays at current
    });

    it('should apply hysteresis when downgrading within threshold', () => {
      // Start at 120px bucket
      bucketStates.set('n1', 120);

      // Zoom out slightly (105px) - target is 120, stay at 120
      // 120 * (1 - 0.15) = 102, so 105 > 102 → stay at 120
      const bucket = selectBucketWithHysteresis('n1', 105, bucketStates, bucketTimers);

      expect(bucket).toBe(120); // Stays at current
    });

    it('should debounce upgrades', () => {
      // Start at 80px bucket
      bucketStates.set('n1', 80);

      // Zoom in significantly (150px) - target is 180
      const bucket1 = selectBucketWithHysteresis('n1', 150, bucketStates, bucketTimers);

      expect(bucket1).toBe(80); // Still at 80 (debouncing)
      expect(bucketStates.get('n1')).toBe(80); // State not updated yet

      // Fast forward 150ms
      jest.advanceTimersByTime(150);

      expect(bucketStates.get('n1')).toBe(180); // State updated after debounce
    });

    it('should downgrade immediately', () => {
      // Start at 120px bucket
      bucketStates.set('n1', 120);

      // Zoom out significantly (50px) - target is 60
      const bucket = selectBucketWithHysteresis('n1', 50, bucketStates, bucketTimers);

      expect(bucket).toBe(60); // Immediate downgrade
      expect(bucketStates.get('n1')).toBe(60); // State updated immediately
    });

    it('should cancel previous upgrade timer when upgrading again', () => {
      // Start at 80px bucket
      bucketStates.set('n1', 80);

      // First upgrade request (150px → 180)
      selectBucketWithHysteresis('n1', 150, bucketStates, bucketTimers);
      expect(bucketTimers.has('n1')).toBe(true);

      // Second upgrade request before first timer fires (200px → 256)
      selectBucketWithHysteresis('n1', 200, bucketStates, bucketTimers);
      expect(bucketTimers.has('n1')).toBe(true); // New timer set

      // Only one timer should exist
      expect(bucketTimers.size).toBe(1);

      // Fast forward 150ms
      jest.advanceTimersByTime(150);

      // Should upgrade to 256 (second request takes precedence)
      expect(bucketStates.get('n1')).toBe(256);
    });

    it('should handle multiple nodes independently', () => {
      // Node 1: 80px bucket
      bucketStates.set('n1', 80);
      // Node 2: 120px bucket
      bucketStates.set('n2', 120);

      // Node 1: upgrade to 256 (debounced, 200px → 256)
      const bucket1 = selectBucketWithHysteresis('n1', 200, bucketStates, bucketTimers);
      // Node 2: stay at 120 (hysteresis, 110px within threshold)
      const bucket2 = selectBucketWithHysteresis('n2', 110, bucketStates, bucketTimers);

      expect(bucket1).toBe(80); // Still debouncing
      expect(bucket2).toBe(120); // Hysteresis

      // Fast forward 150ms
      jest.advanceTimersByTime(150);

      expect(bucketStates.get('n1')).toBe(256); // Upgraded
      expect(bucketStates.get('n2')).toBe(120); // Unchanged
    });

    it('should use default bucket (80) when no prior state', () => {
      // No prior state for 'n1'
      const bucket = selectBucketWithHysteresis('n1', 50, bucketStates, bucketTimers);

      // Should start at default (80) and downgrade to 60
      expect(bucket).toBe(60);
    });
  });

  describe('clearBucketTimer', () => {
    let bucketTimers;

    beforeEach(() => {
      bucketTimers = new Map();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clear timer for specific node', () => {
      const timer = setTimeout(() => {}, 1000);
      bucketTimers.set('n1', timer);

      clearBucketTimer('n1', bucketTimers);

      expect(bucketTimers.has('n1')).toBe(false);
    });

    it('should handle clearing non-existent timer', () => {
      clearBucketTimer('n1', bucketTimers); // Should not throw
      expect(bucketTimers.has('n1')).toBe(false);
    });

    it('should not affect other timers', () => {
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setTimeout(() => {}, 1000);
      bucketTimers.set('n1', timer1);
      bucketTimers.set('n2', timer2);

      clearBucketTimer('n1', bucketTimers);

      expect(bucketTimers.has('n1')).toBe(false);
      expect(bucketTimers.has('n2')).toBe(true);
    });
  });

  describe('clearAllBucketTimers', () => {
    let bucketTimers;

    beforeEach(() => {
      bucketTimers = new Map();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clear all timers', () => {
      const timer1 = setTimeout(() => {}, 1000);
      const timer2 = setTimeout(() => {}, 1000);
      const timer3 = setTimeout(() => {}, 1000);
      bucketTimers.set('n1', timer1);
      bucketTimers.set('n2', timer2);
      bucketTimers.set('n3', timer3);

      clearAllBucketTimers(bucketTimers);

      expect(bucketTimers.size).toBe(0);
    });

    it('should handle empty timer map', () => {
      clearAllBucketTimers(bucketTimers); // Should not throw
      expect(bucketTimers.size).toBe(0);
    });
  });

  describe('BUCKET_CONSTANTS', () => {
    it('should export DEBOUNCE_MS', () => {
      expect(BUCKET_CONSTANTS.DEBOUNCE_MS).toBe(150);
    });

    it('should export HYSTERESIS', () => {
      expect(BUCKET_CONSTANTS.HYSTERESIS).toBe(0.15);
    });

    it('should export DEFAULT_BUCKET', () => {
      expect(BUCKET_CONSTANTS.DEFAULT_BUCKET).toBe(80);
    });

    it('should export BUCKETS array', () => {
      expect(BUCKET_CONSTANTS.BUCKETS).toEqual([40, 60, 80, 120, 180, 256]);
    });
  });
});
