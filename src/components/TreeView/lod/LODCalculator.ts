/**
 * LODCalculator - Level of Detail tier calculation
 *
 * Phase 2 Day 1 - Extracted from TreeView.js (lines 750-783)
 *
 * Calculates LOD tier based on zoom level with hysteresis to prevent thrashing.
 *
 * Tiers:
 * - T1 (Tier 1): Full card with photo, name, badges (>48px node size)
 * - T2 (Tier 2): Text pill with name only (24-48px node size)
 * - T3 (Tier 3): Aggregation chip with count (<24px node size)
 *
 * KNOWN ISSUES (Deferred to Phase 3):
 * - Size jumping during zoom (hysteresis not preventing thrashing)
 * - Scale quantum calculations inconsistent
 * - Visual flicker when transitioning between tiers
 *
 * Phase 2 Strategy: Extract AS-IS, preserve bugs, fix in Phase 3
 */

import { PixelRatio } from 'react-native';
import { NODE_WIDTH_WITH_PHOTO } from '../utils';

// LOD System Constants
// Note: These remain in TreeView.js as they're specific to LOD system logic
const SCALE_QUANTUM = 0.05; // 5% quantization steps
const HYSTERESIS = 0.15; // ±15% hysteresis to prevent tier thrashing
const T1_BASE = 48; // Full card threshold (px)
const T2_BASE = 24; // Text pill threshold (px)
const LOD_ENABLED = true; // Kill switch for LOD system

export type LODTier = 1 | 2 | 3;

export interface TierState {
  current: LODTier;
  lastQuantizedScale: number;
}

/**
 * Calculate LOD tier based on current scale
 *
 * Uses hysteresis to prevent rapid tier switching (thrashing).
 * Quantizes scale changes to reduce unnecessary recalculations.
 *
 * @param scale - Current camera zoom level (1.0 = default)
 * @param tierState - Mutable state object tracking current tier
 * @returns LOD tier (1, 2, or 3)
 *
 * @example
 * const state = { current: 1, lastQuantizedScale: 1.0 };
 * const tier = calculateLODTier(0.8, state);
 * // Returns 1 or 2 depending on hysteresis
 */
export function calculateLODTier(
  scale: number,
  tierState: TierState
): LODTier {
  if (!LOD_ENABLED) return 1; // Always use full detail if disabled

  // Quantize scale to reduce recalculations
  const quantizedScale = Math.round(scale / SCALE_QUANTUM) * SCALE_QUANTUM;

  // Only recalculate if scale changed significantly
  if (Math.abs(quantizedScale - tierState.lastQuantizedScale) < SCALE_QUANTUM) {
    return tierState.current;
  }

  // Calculate node size in physical pixels
  const nodePx = NODE_WIDTH_WITH_PHOTO * PixelRatio.get() * scale;
  let newTier: LODTier = tierState.current;

  // Apply hysteresis boundaries to prevent thrashing
  if (tierState.current === 1) {
    // Currently at T1 (full cards)
    if (nodePx < T1_BASE * (1 - HYSTERESIS)) newTier = 2;
  } else if (tierState.current === 2) {
    // Currently at T2 (text pills)
    if (nodePx >= T1_BASE * (1 + HYSTERESIS)) newTier = 1;
    else if (nodePx < T2_BASE * (1 - HYSTERESIS)) newTier = 3;
  } else {
    // Currently at T3 (aggregation)
    if (nodePx >= T2_BASE * (1 + HYSTERESIS)) newTier = 2;
  }

  // Update state if tier changed
  if (newTier !== tierState.current) {
    tierState.current = newTier;
    tierState.lastQuantizedScale = quantizedScale;
  }

  return newTier;
}

/**
 * Create initial tier state
 *
 * @param initialScale - Starting scale (default 1.0)
 * @returns Initial tier state object
 */
export function createTierState(initialScale: number = 1.0): TierState {
  return {
    current: 1, // Start at full detail
    lastQuantizedScale: initialScale,
  };
}

/**
 * Get tier description for debugging
 */
export function getTierDescription(tier: LODTier): string {
  switch (tier) {
    case 1:
      return 'T1: Full Cards';
    case 2:
      return 'T2: Text Pills';
    case 3:
      return 'T3: Aggregation';
  }
}

// Export constants for testing
export const LOD_CONSTANTS = {
  SCALE_QUANTUM,
  HYSTERESIS,
  T1_BASE,
  T2_BASE,
  LOD_ENABLED,
};
