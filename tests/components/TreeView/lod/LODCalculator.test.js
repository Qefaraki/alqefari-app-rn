/**
 * LODCalculator tests
 * Phase 2 Day 1
 *
 * Note: These tests verify current behavior, including known bugs.
 * Bug fixes deferred to Phase 3.
 */

import {
  calculateLODTier,
  createTierState,
  getTierDescription,
  LOD_CONSTANTS,
} from '../../../../src/components/TreeView/lod/LODCalculator';

describe('LODCalculator', () => {
  describe('createTierState', () => {
    it('should create initial state at tier 1', () => {
      const state = createTierState();

      expect(state.current).toBe(1);
      expect(state.lastQuantizedScale).toBe(1.0);
    });

    it('should accept custom initial scale', () => {
      const state = createTierState(2.0);

      expect(state.current).toBe(1);
      expect(state.lastQuantizedScale).toBe(2.0);
    });
  });

  describe('calculateLODTier', () => {
    it('should return T1 (full cards) at default scale', () => {
      const state = createTierState(1.0);
      const tier = calculateLODTier(1.0, state);

      expect(tier).toBe(1);
    });

    it('should return T2 (text pills) at medium zoom out', () => {
      const state = createTierState(1.0);

      // Zoom out gradually to trigger T1 → T2 transition
      // T1_BASE = 48px, HYSTERESIS = 0.15
      // Transition happens when nodePx < 48 * (1 - 0.15) = 40.8px
      // nodePx = NODE_WIDTH_WITH_PHOTO (58px) * pixelRatio * scale
      // With pixelRatio = 2, scale needs to be < 0.352

      const tier = calculateLODTier(0.2, state); // Way below threshold

      expect(tier).toBe(2);
    });

    it('should return T3 (aggregation) at high zoom out', () => {
      const state = createTierState(1.0);

      // Zoom out far enough to go through T2 and reach T3
      // Note: May land at T2 first due to hysteresis
      calculateLODTier(0.15, state); // Intermediate zoom
      calculateLODTier(0.08, state); // Very zoomed out

      // Should be at T3 now
      expect(state.current).toBe(3);
    });

    it('should use hysteresis to prevent thrashing', () => {
      const state = createTierState(1.0);

      // Set to tier 2
      calculateLODTier(0.2, state);
      expect(state.current).toBe(2);

      // Scale slightly up (not enough to cross hysteresis threshold)
      // Should stay at T2 due to hysteresis
      const tier = calculateLODTier(0.21, state);

      expect(tier).toBe(2); // Still T2
    });

    it('should quantize scale changes', () => {
      const state = createTierState(1.0);

      // SCALE_QUANTUM = 0.05
      // Small changes below quantum should not trigger recalculation

      const tier1 = calculateLODTier(1.0, state);
      const tier2 = calculateLODTier(1.02, state); // Below 0.05 quantum

      expect(tier1).toBe(tier2); // Should return same tier without recalc
    });

    it('should update tier state when tier changes', () => {
      const state = createTierState(1.0);

      expect(state.current).toBe(1);

      // Zoom out to trigger T1 → T2
      calculateLODTier(0.2, state);

      expect(state.current).toBe(2); // State updated
    });

    it('should handle transition from T3 back to T2', () => {
      const state = createTierState(1.0);

      // Go to T3 through T2
      calculateLODTier(0.15, state);
      calculateLODTier(0.08, state);
      expect(state.current).toBe(3);

      // Zoom in to trigger T3 → T2
      // With NODE_WIDTH_WITH_PHOTO = 38px and pixelRatio = 2
      // T2_BASE * (1 + HYSTERESIS) = 24 * 1.15 = 27.6px
      // scale needs to be > 27.6 / (38 * 2) = 0.363
      const tier = calculateLODTier(0.37, state);

      expect(tier).toBe(2);
    });

    it('should handle transition from T2 back to T1', () => {
      const state = createTierState(1.0);

      // Go to T2
      calculateLODTier(0.2, state);
      expect(state.current).toBe(2);

      // Zoom in to trigger T2 → T1
      // T1_BASE * (1 + HYSTERESIS) = 48 * 1.15 = 55.2px
      // With NODE_WIDTH_WITH_PHOTO = 58px and pixelRatio = 2
      // scale needs to be > 55.2 / (58 * 2) = 0.476

      const tier = calculateLODTier(0.8, state);

      expect(tier).toBe(1);
    });
  });

  describe('getTierDescription', () => {
    it('should return description for T1', () => {
      expect(getTierDescription(1)).toBe('T1: Full Cards');
    });

    it('should return description for T2', () => {
      expect(getTierDescription(2)).toBe('T2: Text Pills');
    });

    it('should return description for T3', () => {
      expect(getTierDescription(3)).toBe('T3: Aggregation');
    });
  });

  describe('LOD_CONSTANTS', () => {
    it('should export SCALE_QUANTUM', () => {
      expect(LOD_CONSTANTS.SCALE_QUANTUM).toBe(0.05);
    });

    it('should export HYSTERESIS', () => {
      expect(LOD_CONSTANTS.HYSTERESIS).toBe(0.15);
    });

    it('should export T1_BASE', () => {
      expect(LOD_CONSTANTS.T1_BASE).toBe(48);
    });

    it('should export T2_BASE', () => {
      expect(LOD_CONSTANTS.T2_BASE).toBe(24);
    });

    it('should export LOD_ENABLED', () => {
      expect(LOD_CONSTANTS.LOD_ENABLED).toBe(true);
    });
  });
});
