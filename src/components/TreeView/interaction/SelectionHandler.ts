/**
 * SelectionHandler - Node selection and hit detection
 *
 * Phase 2 Day 3 - Extracted from TreeView.js (lines 2328-2430)
 *
 * Manages profile selection via tap gestures with coordinate transformation
 * and hit detection across different LOD tiers (T1/T2 nodes, T3 aggregation chips).
 *
 * Hit Detection Strategy:
 * - T3 Mode: Check aggregation chip bounds first (hero nodes with centroids)
 * - T1/T2 Mode: Check individual node bounds (photo cards or text pills)
 * - Transform screen coords → canvas coords using current transform
 * - Iterate visible nodes to find first hit (z-order dependent)
 *
 * Node Dimensions:
 * - Root: 120x100px
 * - With Photo: 90x90px (NODE_WIDTH/HEIGHT_WITH_PHOTO)
 * - Text Only: 90x35px (NODE_WIDTH/HEIGHT_TEXT_ONLY)
 * - T3 Chips: 100x36px (root: 1.3x scale)
 *
 * Performance:
 * - Only checks visible nodes (viewport culled)
 * - Early return on first hit
 * - Chip detection before node iteration
 */

import {
  NODE_WIDTH_WITH_PHOTO,
  NODE_HEIGHT_WITH_PHOTO,
  NODE_WIDTH_TEXT_ONLY,
  NODE_HEIGHT_TEXT_ONLY,
} from '../utils/constants/nodes';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  father_id: string | null;
  photo_url: string | null;
  name: string;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface Centroid {
  x: number;
  y: number;
}

export interface HeroNode extends LayoutNode {
  // Hero node is a LayoutNode representing an aggregation cluster in T3 mode
}

export interface GestureState {
  tier: number; // LOD tier (1, 2, or 3)
  transform: Transform;
  visibleNodes: LayoutNode[];
  indices?: {
    heroNodes?: HeroNode[];
    centroids?: Record<string, Centroid>;
  };
}

export interface TapEvent {
  x: number;
  y: number;
}

export interface SelectionCallbacks {
  onNodeSelect: (nodeId: string | null) => void;
  onChipSelect?: (heroNode: HeroNode) => void;
}

export interface SelectionConfig {
  aggregationEnabled?: boolean;
  rootNodeWidth?: number;
  rootNodeHeight?: number;
}

/**
 * Handle node selection callback
 *
 * Called when a node is tapped. Triggers profile sheet and clears highlights.
 *
 * @param nodeId - ID of tapped node (null if no hit)
 * @param callbacks - Selection callbacks
 * @param isAdminMode - Whether admin mode is active
 * @param clearHighlights - Function to clear search highlights
 */
export function handleNodeSelection(
  nodeId: string | null,
  callbacks: SelectionCallbacks,
  isAdminMode: boolean = false,
  clearHighlights?: () => void
): void {
  // Clear search highlight when tapping any node
  if (clearHighlights) {
    clearHighlights();
  }

  // Trigger node selection callback
  callbacks.onNodeSelect(nodeId);

  // Note: profileEditMode is set by parent component based on isAdminMode
  // This keeps SelectionHandler pure and decoupled from React state
}

/**
 * Detect chip tap in T3 aggregation mode
 *
 * Checks if tap coordinates hit any aggregation chip bounds.
 * Chips are transformed from world space to screen space.
 *
 * @param tapEvent - Tap coordinates in screen space
 * @param state - Current gesture state with hero nodes and centroids
 * @param config - Selection configuration
 * @returns Hero node if hit, null otherwise
 */
export function detectChipTap(
  tapEvent: TapEvent,
  state: GestureState,
  config: SelectionConfig = {}
): HeroNode | null {
  const { aggregationEnabled = true } = config;

  // Only check chips if in T3 mode with aggregation enabled
  if (state.tier !== 3 || !aggregationEnabled) return null;
  if (!state.indices?.heroNodes || !state.indices?.centroids) return null;

  for (const hero of state.indices.heroNodes) {
    const centroid = state.indices.centroids[hero.id];
    if (!centroid) continue;

    // Transform centroid to screen space
    const screenX = centroid.x * state.transform.scale + state.transform.x;
    const screenY = centroid.y * state.transform.scale + state.transform.y;

    const isRoot = !hero.father_id;
    const chipScale = isRoot ? 1.3 : 1.0;
    const chipWidth = 100 * chipScale;
    const chipHeight = 36 * chipScale;

    // Check if tap is within chip bounds
    if (
      tapEvent.x >= screenX - chipWidth / 2 &&
      tapEvent.x <= screenX + chipWidth / 2 &&
      tapEvent.y >= screenY - chipHeight / 2 &&
      tapEvent.y <= screenY + chipHeight / 2
    ) {
      return hero;
    }
  }

  return null;
}

/**
 * Detect node tap in T1/T2 mode
 *
 * Transforms tap coordinates from screen space to canvas space,
 * then checks visible nodes for hit detection.
 *
 * @param tapEvent - Tap coordinates in screen space
 * @param state - Current gesture state with visible nodes
 * @param config - Selection configuration
 * @returns Node ID if hit, null otherwise
 */
export function detectNodeTap(
  tapEvent: TapEvent,
  state: GestureState,
  config: SelectionConfig = {}
): string | null {
  const {
    rootNodeWidth = 120,
    rootNodeHeight = 100,
  } = config;

  // Transform screen coordinates to canvas coordinates
  const canvasX = (tapEvent.x - state.transform.x) / state.transform.scale;
  const canvasY = (tapEvent.y - state.transform.y) / state.transform.scale;

  // Iterate visible nodes to find hit
  for (const node of state.visibleNodes) {
    const isRoot = !node.father_id;
    const nodeWidth = isRoot
      ? rootNodeWidth
      : node.photo_url
      ? NODE_WIDTH_WITH_PHOTO
      : NODE_WIDTH_TEXT_ONLY;
    const nodeHeight = isRoot
      ? rootNodeHeight
      : node.photo_url
      ? NODE_HEIGHT_WITH_PHOTO
      : NODE_HEIGHT_TEXT_ONLY;

    // Check if tap is within node bounds
    if (
      canvasX >= node.x - nodeWidth / 2 &&
      canvasX <= node.x + nodeWidth / 2 &&
      canvasY >= node.y - nodeHeight / 2 &&
      canvasY <= node.y + nodeHeight / 2
    ) {
      return node.id;
    }
  }

  return null; // No hit
}

/**
 * Handle tap gesture for node selection
 *
 * Main entry point for tap gesture handling. Performs hit detection
 * for both T3 chips and T1/T2 nodes, then triggers appropriate callback.
 *
 * Order of operations:
 * 1. Check T3 chip tap (if in T3 mode)
 * 2. Check T1/T2 node tap (if not in T3 or no chip hit)
 * 3. Trigger selection callback
 *
 * @param tapEvent - Tap coordinates in screen space
 * @param state - Current gesture state
 * @param callbacks - Selection callbacks
 * @param isAdminMode - Whether admin mode is active
 * @param clearHighlights - Function to clear search highlights
 * @param config - Selection configuration
 */
export function handleTapGesture(
  tapEvent: TapEvent,
  state: GestureState,
  callbacks: SelectionCallbacks,
  isAdminMode: boolean = false,
  clearHighlights?: () => void,
  config: SelectionConfig = {}
): void {
  // Check for chip tap first (T3 mode)
  const chipHit = detectChipTap(tapEvent, state, config);
  if (chipHit) {
    if (callbacks.onChipSelect) {
      callbacks.onChipSelect(chipHit);
    }
    return;
  }

  // If no chip tapped and we're in T3, ignore
  if (state.tier === 3 && config.aggregationEnabled) {
    return;
  }

  // Original node tap logic for T1/T2
  const nodeId = detectNodeTap(tapEvent, state, config);
  handleNodeSelection(nodeId, callbacks, isAdminMode, clearHighlights);
}

// Export constants for testing
export const SELECTION_CONSTANTS = {
  ROOT_NODE_WIDTH: 120,
  ROOT_NODE_HEIGHT: 100,
  T3_CHIP_WIDTH: 100,
  T3_CHIP_HEIGHT: 36,
  T3_CHIP_SCALE_ROOT: 1.3,
  T3_CHIP_SCALE_NORMAL: 1.0,
};
