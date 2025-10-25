/**
 * Unified Highlighting System for Alqefari Family Tree
 *
 * Registry-based architecture for managing all tree highlighting features.
 * Supports single-path, dual-path, and multi-path highlights with priority-based
 * conflict resolution and extensible rendering.
 *
 * Features:
 * - Centralized highlight type registry
 * - Priority-based rendering (higher priority = rendered on top)
 * - Color palette management per highlight type
 * - Animation configuration per highlight type
 * - Support for unlimited highlight types without state explosion
 *
 * Usage:
 *   import { HIGHLIGHT_TYPES, getHighlightConfig } from './highlightingService';
 *   const config = getHighlightConfig('COUSIN_MARRIAGE');
 */

import tokens from '../components/ui/tokens';

const palette = tokens.colors.najdi;

/**
 * Primary color palette for ancestry paths (warm tones)
 * Used for single paths and Path 1 of dual paths
 */
export const ANCESTRY_COLORS = [
  '#C73E3E', // Bright crimson
  '#E38740', // Vivid orange
  '#F5C555', // Warm gold
  '#9FB885', // Sage green
  '#6A9AA6', // Teal
  '#8E7AB8', // Purple
  '#D58C4A', // Desert ochre
  '#C3B872', // Olive
  '#AA7970', // Dusty rose
  '#B78F81', // Taupe
];

/**
 * Secondary color palette for dual paths (cool tones)
 * Used for Path 2 of dual paths to create visual distinction
 */
export const ANCESTRY_COLORS_SECONDARY = [
  '#6A9AA6', // Teal
  '#8E7AB8', // Purple
  '#9FB885', // Sage green
  '#AA7970', // Dusty rose
  '#B78F81', // Taupe
  '#7B9E87', // Forest green
  '#8B7D94', // Mauve
  '#A68E7B', // Clay
  '#6B8FA3', // Steel blue
  '#94A68D', // Olive sage
];

/**
 * Highlight Type Registry
 *
 * Each highlight type defines:
 * - id: Unique identifier for state management
 * - priority: Lower number = higher priority (1 = highest)
 * - multiPath: false | 'dual' | 'multi'
 * - colorPalette: Color configuration for rendering
 * - animationConfig: Timing and opacity settings
 * - pathCalculator: Function to calculate path data (injected at runtime)
 */
export const HIGHLIGHT_TYPES = {
  /**
   * Search Result Highlight
   * Highest priority - always visible when active
   * Single path from selected profile to root ancestor
   */
  SEARCH: {
    id: 'search',
    priority: 1,
    multiPath: false,
    colorPalette: ANCESTRY_COLORS,
    animationConfig: {
      duration: 400,
      opacity: 0.65,
      delay: 600, // Wait for camera to settle
    },
  },

  /**
   * Cousin Marriage Dual Path Highlight
   * Medium priority - visible unless search active
   * Two paths from both spouses to common ancestor
   */
  COUSIN_MARRIAGE: {
    id: 'cousinMarriage',
    priority: 2,
    multiPath: 'dual',
    colorPalette: {
      path1: ANCESTRY_COLORS,
      path2: ANCESTRY_COLORS_SECONDARY,
      intersection: palette.primary, // Najdi Crimson for common ancestor
    },
    animationConfig: {
      duration: 600,
      opacity: 0.6,
      delay: 600,
      stagger: 100, // Path 1 → wait 100ms → Path 2
    },
  },

  /**
   * User Lineage Highlight
   * Lowest priority - background highlight of user's own ancestry
   * Single path from current user to root ancestor
   */
  USER_LINEAGE: {
    id: 'userLineage',
    priority: 3,
    multiPath: false,
    colorPalette: ANCESTRY_COLORS,
    animationConfig: {
      duration: 400,
      opacity: 0.52,
      delay: 0, // No delay for background highlight
    },
  },

  // Future highlight types can be added here:
  // SIBLING_GROUP: { ... },
  // DESCENDANTS: { ... },
  // MATERNAL_LINE: { ... },
};

/**
 * Get highlight configuration by type ID or key
 * @param {string} typeKey - Highlight type key (e.g., 'SEARCH', 'COUSIN_MARRIAGE')
 * @returns {Object|null} Highlight configuration object or null if not found
 */
export function getHighlightConfig(typeKey) {
  const config = HIGHLIGHT_TYPES[typeKey];
  if (!config) {
    console.warn(`Unknown highlight type: ${typeKey}`);
    return null;
  }
  return config;
}

/**
 * Get all highlight types sorted by priority (highest first)
 * @returns {Array<Object>} Array of highlight configs sorted by priority
 */
export function getHighlightTypesByPriority() {
  return Object.entries(HIGHLIGHT_TYPES)
    .map(([key, config]) => ({ key, ...config }))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Check if a highlight type supports multiple paths
 * @param {string} typeKey - Highlight type key
 * @returns {boolean} True if multi-path type
 */
export function isMultiPathType(typeKey) {
  const config = getHighlightConfig(typeKey);
  return config && config.multiPath !== false;
}

/**
 * Get color for a specific depth in the ancestry path
 * @param {number} depthDiff - Depth difference from selected node
 * @param {Array<string>} palette - Color palette to use
 * @returns {string} Hex color code
 */
export function getColorForDepth(depthDiff, palette = ANCESTRY_COLORS) {
  return palette[depthDiff % palette.length];
}

/**
 * Resolve highlight priority conflicts
 * Returns the highlight type with highest priority (lowest number)
 * @param {Array<string>} activeTypeKeys - Array of currently active highlight type keys
 * @returns {string|null} Highest priority type key or null if no active highlights
 */
export function resolveHighlightPriority(activeTypeKeys) {
  if (!activeTypeKeys || activeTypeKeys.length === 0) return null;

  const configs = activeTypeKeys
    .map(key => ({ key, config: getHighlightConfig(key) }))
    .filter(({ config }) => config !== null)
    .sort((a, b) => a.config.priority - b.config.priority);

  return configs.length > 0 ? configs[0].key : null;
}

export default {
  HIGHLIGHT_TYPES,
  ANCESTRY_COLORS,
  ANCESTRY_COLORS_SECONDARY,
  getHighlightConfig,
  getHighlightTypesByPriority,
  isMultiPathType,
  getColorForDepth,
  resolveHighlightPriority,
};
