/**
 * Viewport and culling constants
 * Phase 1 Day 2 - Constants extraction
 */

// Viewport Culling Margins
export const VIEWPORT_MARGIN_X = 3000; // Covers ~30 siblings + gesture buffer
export const VIEWPORT_MARGIN_Y = 1200; // Covers ~10 generations + gesture buffer

// Tree Size Limits
export const MAX_TREE_SIZE = 10000; // Frontend limit (database supports 10K)
export const WARNING_THRESHOLD = 7500; // 75% of max (3K target + 67% buffer)
export const CRITICAL_THRESHOLD = 9500; // 95% of max

// LOD (Level of Detail) Thresholds
export const LOD_T1_THRESHOLD = 0.48; // Full cards at scale > 0.48
export const LOD_T2_THRESHOLD = 0.24; // Text pills at scale 0.24-0.48
// Below LOD_T2_THRESHOLD = Aggregation chips (T3)
