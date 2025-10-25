/**
 * Node dimensions and styling constants
 * Phase 1 Day 2 - Constants extraction
 *
 * DEPRECATED: This file is legacy. Prefer importing from rendering/nodeConstants.ts
 * Maintained for backwards compatibility only.
 */

// Node Dimensions (now from nodeConstants.ts as authoritative source)
export const NODE_WIDTH_WITH_PHOTO = 58;  // 50px photo + 4px padding × 2
export const NODE_WIDTH_TEXT_ONLY = 58;   // Matches photo width for consistency
export const NODE_HEIGHT_WITH_PHOTO = 75; // 50px photo + 4px padding × 2 + 17px name
export const NODE_HEIGHT_TEXT_ONLY = 35;
export const PHOTO_SIZE = 50;  // Matches authoritative nodeConstants.ts

// Visual Styling
export const LINE_COLOR = '#D1BBA340'; // Camel Hair Beige 40%
export const LINE_WIDTH = 2;
export const CORNER_RADIUS = 8;
export const SHADOW_OPACITY = 0.05; // Updated from 0.08 (2024 design trend)
export const SHADOW_RADIUS = 8;
export const SHADOW_OFFSET_Y = 2;

// Layout Spacing
export const DEFAULT_SIBLING_GAP = 80;  // TEMP: Reduced from 120 for tighter spacing
export const DEFAULT_GENERATION_GAP = 180;
export const MIN_SIBLING_GAP = 60;      // TEMP: Reduced from 80
export const MAX_SIBLING_GAP = 150;     // TEMP: Reduced from 200
export const MIN_GENERATION_GAP = 120;
export const MAX_GENERATION_GAP = 240;

// Image Buckets for LOD
// Added 180 for optimal sizing at 1.2x multiplier (PHOTO_SIZE * 3x retina * 1.2)
export const IMAGE_BUCKETS = [40, 60, 80, 120, 180, 256] as const;
export const DEFAULT_IMAGE_BUCKET = 80;
export const BUCKET_HYSTERESIS = 0.15; // ±15% prevents bucket thrashing
