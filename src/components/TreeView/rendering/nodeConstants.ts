/**
 * Node Rendering Constants - Single Source of Truth
 *
 * Centralized constants for all tree node dimensions, padding, and styling.
 * Used by both renderer (NodeRenderer, TextPillRenderer) and layout system (treeLayout.js).
 *
 * Phase 1 Consolidation (Oct 25 - Audited & Fixed):
 * - Standard node width: 54px (54px photo + 0px padding)
 * - Unified layout system and renderer dimensions
 * - Eliminated 31px delta between d3 (85px) and renderer (54px)
 * - Selection border: 2.5px for visibility
 *
 * Oct 26 Updates:
 * - Reduced sibling spacing by 25% for denser layout
 * - Removed horizontal padding (0px) - photo fills card width
 * - Increased photo size from 50px to 54px for better visual density
 */

// Padding - single configurable source (compact spacing)
export const NODE_PADDING = {
  HORIZONTAL: 0,  // No horizontal padding - photo fills card width
  VERTICAL: 4,    // Vertical padding maintains visual balance
} as const;

// Photo dimensions
export const PHOTO_SIZE = 54; // Circle diameter in pixels (fills 54px card width)

// Standard node (photo + text nodes at regular zoom)
export const STANDARD_NODE = {
  // Photo nodes: 54px photo + 0px padding (photo fills card width)
  WIDTH: PHOTO_SIZE + NODE_PADDING.HORIZONTAL * 2,  // 54px (54 + 0×2)
  HEIGHT: PHOTO_SIZE + NODE_PADDING.VERTICAL * 2 + 17,  // 75px (photo + padding + name space)

  // Text-only nodes: same width for consistency
  WIDTH_TEXT_ONLY: PHOTO_SIZE + NODE_PADDING.HORIZONTAL * 2,  // 54px (matches photo)
  HEIGHT_TEXT_ONLY: 35,

  CORNER_RADIUS: 10,
  SELECTION_BORDER: 2.5,  // Fits within 2px padding
} as const;

// Root node (generation 1, no father) - unchanged
export const ROOT_NODE = {
  WIDTH: 120,
  HEIGHT: 100,
  BORDER_RADIUS: 20,
  SELECTION_BORDER: 2.5,  // Larger border for prominent root
} as const;

// G2 Parent (generation 2 with children) - unchanged
export const G2_NODE = {
  WIDTH_PHOTO: 95,
  WIDTH_TEXT: 75,
  HEIGHT_PHOTO: 75,
  HEIGHT_TEXT: 35,
  BORDER_RADIUS: 16,
  SELECTION_BORDER: 2,
} as const;

// LOD Tier 2 (compact text pills)
export const TEXT_PILL = {
  WIDTH: 54,  // Matches standard node width for visual consistency
  HEIGHT: 26,
  CORNER_RADIUS: 4,
  FONT_SIZE: 10,
  TEXT_OFFSET_Y: 4,

  // Colors (Najdi Sadu palette)
  BACKGROUND_COLOR: '#FFFFFF',
  TEXT_COLOR: '#242121',  // Sadu Night
  DEFAULT_BORDER_COLOR: '#D1BBA360',  // Camel Hair Beige 60%
  SELECTED_BORDER_COLOR: '#A13333',  // Najdi Crimson

  // Border widths
  DEFAULT_BORDER_WIDTH: 1,
  SELECTED_BORDER_WIDTH: 1.5,  // KNOWN ISSUE: Causes 0.5px jump when selected
} as const;

// Shadow styling (Najdi Sadu palette)
export const SHADOW_STYLES = {
  STANDARD_DX: 0,
  STANDARD_DY: 2,
  STANDARD_BLUR: 8,
  STANDARD_COLOR: '#D1BBA370',  // Camel Hair Beige 25% opacity

  T2_DX: 0,
  T2_DY: 1,
  T2_BLUR: 4,
  T2_COLOR: '#D1BBA320',  // Camel Hair Beige 20% opacity
} as const;

// Color constants
export const COLORS = {
  NODE_BACKGROUND: '#FFFFFF',
  SELECTION_BORDER: '#A13333',  // Najdi Crimson
  SKELETON: '#D1BBA320',  // Camel Hair Beige 20%
  TEXT: '#242121',  // Sadu Night
} as const;

// Export all as namespace for convenience
export const NODE_CONSTANTS = {
  PADDING: NODE_PADDING,
  PHOTO_SIZE,
  STANDARD_NODE,
  ROOT_NODE,
  G2_NODE,
  TEXT_PILL,
  SHADOW_STYLES,
  COLORS,
} as const;

// Legacy exports for backwards compatibility (older imports should migrate to STANDARD_NODE, ROOT_NODE)
export const NODE_WIDTH_WITH_PHOTO = STANDARD_NODE.WIDTH;
export const NODE_WIDTH_TEXT_ONLY = STANDARD_NODE.WIDTH_TEXT_ONLY;
export const NODE_HEIGHT_WITH_PHOTO = STANDARD_NODE.HEIGHT;
export const NODE_HEIGHT_TEXT_ONLY = STANDARD_NODE.HEIGHT_TEXT_ONLY;

// Image bucket constants (from old constants/nodes.ts)
export const IMAGE_BUCKETS = [40, 60, 80, 120, 180, 256] as const;
export const DEFAULT_IMAGE_BUCKET = 80;
export const BUCKET_HYSTERESIS = 0.15; // ±15% prevents bucket thrashing

// Connection line styling (Najdi Sadu palette)
export const CONNECTION_STYLES = {
  LINE_COLOR: '#D1BBA340',  // Camel Hair Beige 40%
  LINE_WIDTH: 2,
  CORNER_RADIUS: 8,
} as const;

// d3 Tree Layout spacing (used by layout and connection rendering)
export const LAYOUT_SPACING = {
  DEFAULT_SIBLING_GAP: 60,      // Reduced 25% from 80px
  DEFAULT_GENERATION_GAP: 180,
  MIN_SIBLING_GAP: 45,          // Reduced 25% from 60px
  MAX_SIBLING_GAP: 112,         // Reduced 25% from 150px (112.5 → 112)
  MIN_GENERATION_GAP: 120,
  MAX_GENERATION_GAP: 240,
} as const;

// Rendering shadow styling (used by node and connection rendering)
export const RENDERING_SHADOWS = {
  OPACITY: 0.05,
  RADIUS: 8,
  OFFSET_Y: 2,
} as const;

// Legacy flat exports for TreeView.js backwards compatibility
// TODO (Phase 2): Update TreeView.js to use structured exports (CONNECTION_STYLES, LAYOUT_SPACING, RENDERING_SHADOWS)
export const LINE_COLOR = CONNECTION_STYLES.LINE_COLOR;
export const LINE_WIDTH = CONNECTION_STYLES.LINE_WIDTH;
export const CORNER_RADIUS = CONNECTION_STYLES.CORNER_RADIUS;
export const SHADOW_OPACITY = RENDERING_SHADOWS.OPACITY;
export const SHADOW_RADIUS = RENDERING_SHADOWS.RADIUS;
export const SHADOW_OFFSET_Y = RENDERING_SHADOWS.OFFSET_Y;
export const DEFAULT_SIBLING_GAP = LAYOUT_SPACING.DEFAULT_SIBLING_GAP;
export const DEFAULT_GENERATION_GAP = LAYOUT_SPACING.DEFAULT_GENERATION_GAP;
export const MIN_SIBLING_GAP = LAYOUT_SPACING.MIN_SIBLING_GAP;
export const MAX_SIBLING_GAP = LAYOUT_SPACING.MAX_SIBLING_GAP;
export const MIN_GENERATION_GAP = LAYOUT_SPACING.MIN_GENERATION_GAP;
export const MAX_GENERATION_GAP = LAYOUT_SPACING.MAX_GENERATION_GAP;
