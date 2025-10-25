/**
 * Node constants - Re-export compatibility layer
 *
 * Maintains Phase 1 export chain while respecting rendering/nodeConstants.ts
 * as the single source of truth for node dimensions and styling.
 *
 * THIS FILE: Re-exports authoritative constants from nodeConstants.ts
 * FUTURE: Consolidate to direct imports (Phase 1 backlog task)
 *
 * Accidental deletion on Oct 25, 2025 broke TreeView.js import chain.
 * This file restores the export chain until proper consolidation occurs.
 */

// Re-export from rendering/nodeConstants.ts (authoritative source)
export {
  NODE_WIDTH_WITH_PHOTO,
  NODE_WIDTH_TEXT_ONLY,
  NODE_HEIGHT_WITH_PHOTO,
  NODE_HEIGHT_TEXT_ONLY,
  PHOTO_SIZE,
  IMAGE_BUCKETS,
  DEFAULT_IMAGE_BUCKET,
  BUCKET_HYSTERESIS,
} from '../../rendering/nodeConstants';

// Layout spacing constants (currently orphaned - proper home TBD)
// These are used by TreeView.js connection rendering and d3 layout system
// TODO (Phase 1 Cleanup): Move to rendering/connectionConstants.ts or rendering/nodeConstants.ts
export const LINE_COLOR = '#D1BBA340'; // Camel Hair Beige 40%
export const LINE_WIDTH = 2;
export const CORNER_RADIUS = 8;
export const SHADOW_OPACITY = 0.05;
export const SHADOW_RADIUS = 8;
export const SHADOW_OFFSET_Y = 2;

// d3 Tree Layout spacing
export const DEFAULT_SIBLING_GAP = 80; // Horizontal gap between siblings
export const DEFAULT_GENERATION_GAP = 180; // Vertical gap between generations
export const MIN_SIBLING_GAP = 60;
export const MAX_SIBLING_GAP = 150;
export const MIN_GENERATION_GAP = 120;
export const MAX_GENERATION_GAP = 240;
