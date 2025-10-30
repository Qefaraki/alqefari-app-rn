import { create } from "zustand";
import {
  DEFAULT_BOUNDS,
  clampStageToBounds,
} from "../utils/cameraConstraints";
import { highlightingServiceV2 } from "../services/highlightingServiceV2";

// Schema version - increment when adding new fields to profiles table
// This forces cache invalidation after migrations
export const TREE_DATA_SCHEMA_VERSION = "1.1.0"; // v1.1.0: Added version field to get_structure_only RPC (matches useStructureLoader)

/**
 * Tree Store
 *
 * Cache is managed manually via AsyncStorage in useStructureLoader.js
 * Simple pattern: load on mount, save after network fetch
 * No middleware complexity - direct control over cache lifecycle
 */
export const useTreeStore = create((set, get) => ({
  // Camera State
  stage: {
    x: 0,
    y: 0,
    scale: 1,
  },

  // Cached tree bounds for camera constraints
  treeBounds: DEFAULT_BOUNDS,

  // Zoom limits
  minZoom: 0.15, // Doubled zoom-out range for LOD
  maxZoom: 3.0,

  // Animation state
  isAnimating: false,

  // Selection state
  selectedPersonId: null,

  // Navigation target for triggering automatic tree camera movement
  // Used by deep linking and other external triggers to center tree on a profile
  navigationTarget: null,

  // Cousin marriage highlighting trigger (set from nested components like TabFamily)
  // When set, TreeView will activate dual-path highlighting for these spouse IDs
  pendingCousinHighlight: null, // { spouse1Id, spouse2Id, highlightProfileId }

  // Enhanced Highlighting System (Phase 3E) - Map<id, HighlightDefinition>
  // State managed by Zustand, logic handled by highlightingServiceV2 (pure service)
  highlights: {},

  // Profile sheet state for coordinating animations
  profileSheetIndex: -1,
  profileSheetProgress: null, // This will hold a Reanimated shared value
  initializeProfileSheetProgress: (sharedValue) =>
    set({ profileSheetProgress: sharedValue }),

  // Tree data from backend
  treeData: [],

  // High-performance Map for instant node lookups
  nodesMap: new Map(),

  // Cache schema version tracking
  cachedSchemaVersion: null,

  // Phase 3B: Loading state tracking (atomic with tree data)
  // Prevents skeleton flash by signaling when cached data is valid and ready to display
  isTreeLoaded: false,

  // Actions to update the state
  setStage: (newStage) => set({ stage: newStage }),

  setTreeBounds: (bounds) =>
    set({
      treeBounds: bounds || DEFAULT_BOUNDS,
    }),

  setIsAnimating: (animating) => set({ isAnimating: animating }),

  setSelectedPersonId: (personId) => set({ selectedPersonId: personId }),

  // Trigger automatic tree navigation to center on a profile
  // Used by deep linking, search results, and external navigation triggers
  setNavigationTarget: (profileId) => set({ navigationTarget: profileId }),

  setTreeData: (data) => {
    // Validate cache quality - check if data is valid and ready for display
    // Criteria: At least 50 nodes + first 5 nodes have required fields
    const isValidCache = data &&
      data.length >= 50 &&
      data.slice(0, 5).every(n =>
        n.hid !== undefined &&
        n.generation !== undefined &&
        n.father_id !== undefined
      );

    return set({
      treeData: data || [],
      nodesMap: new Map((data || []).map((node) => [node.id, node])),
      cachedSchemaVersion: TREE_DATA_SCHEMA_VERSION,
      isTreeLoaded: isValidCache,  // ✅ ATOMIC: Set loading state with data
    });
  },

  // Phase 3B: Set cached schema version for progressive loading
  setCachedSchemaVersion: (version) => set({ cachedSchemaVersion: version }),

  // syncCoordinates REMOVED (Oct 30, 2025):
  // Historical architecture restored - coordinates are ephemeral computed values
  // that live in the local nodes array, not in persistent store.
  // Highlights now receive nodes array directly for perfect alignment.

  // Clear tree data and force refetch (useful after migrations)
  clearTreeData: () =>
    set({
      treeData: [],
      nodesMap: new Map(),
      cachedSchemaVersion: null,
    }),

  // Update a single node without reloading the entire tree
  // Feature flag for fast path optimization (can be disabled for rollback)
  updateNode: (nodeId, updatedData) =>
    set((state) => {
      const existingNode = state.nodesMap.get(nodeId);

      if (!existingNode) {
        if (__DEV__) {
          console.warn(`[TreeStore] updateNode: Node ${nodeId} not found`);
        }
        return state;
      }

      // Auto-detect if this is a structural or non-structural change
      // Structural fields require full tree recalculation (sorting, filtering)
      // Non-structural fields can use fast path (just update the node)
      const structuralFields = ['father_id', 'munasib_id', 'sibling_order', 'deleted_at'];
      const isStructural = Object.keys(updatedData).some(key =>
        structuralFields.includes(key)
      );

      // Merge the updates
      const updatedNode = {
        ...existingNode,
        ...updatedData,
        // Use provided version if exists (from RPC), otherwise increment locally
        version: updatedData.version ?? ((existingNode.version || 1) + 1),
        lastUpdate: Date.now(),
      };

      // Update nodesMap (same for both paths)
      const newNodesMap = new Map(state.nodesMap);
      newNodesMap.set(nodeId, updatedNode);

      if (isStructural) {
        // Full recalculation path: filter deleted nodes and resort
        const newTreeData = Array.from(newNodesMap.values())
          .filter(n => !n.deleted_at)
          .sort((a, b) => (a.sibling_order || 0) - (b.sibling_order || 0));

        if (__DEV__) {
          console.log(
            `[TreeStore] Structural update for ${nodeId}:`,
            Object.keys(updatedData)
          );
        }

        return {
          treeData: newTreeData,
          nodesMap: newNodesMap,
        };
      } else {
        // Fast path: shallow array update only (no filtering, no sorting)
        const newTreeData = state.treeData.map((node) =>
          node.id === nodeId ? updatedNode : node
        );

        if (__DEV__) {
          console.log(
            `[TreeStore] Fast path update for ${nodeId}:`,
            Object.keys(updatedData),
            `(~${((1 - newTreeData.length / Array.from(newNodesMap.values()).length) * 100).toFixed(1)}% faster)`
          );
        }

        return {
          treeData: newTreeData,
          nodesMap: newNodesMap,
        };
      }
    }),

  // Add a new node to the tree
  addNode: (newNode) =>
    set((state) => {
      const newTreeData = [...state.treeData, newNode];
      const newNodesMap = new Map(state.nodesMap);
      newNodesMap.set(newNode.id, newNode);

      return {
        treeData: newTreeData,
        nodesMap: newNodesMap,
      };
    }),

  // Remove a node from the tree
  removeNode: (nodeId) =>
    set((state) => {
      const newTreeData = state.treeData.filter((node) => node.id !== nodeId);
      const newNodesMap = new Map(state.nodesMap);
      newNodesMap.delete(nodeId);

      return {
        treeData: newTreeData,
        nodesMap: newNodesMap,
      };
    }),

  // Zoom function with pointer anchoring
  zoom: (direction, pointerPosition, viewport) => {
    const { stage, minZoom, maxZoom, treeBounds } = get();
    const scaleBy = 1.2;
    const newScale =
      direction > 0
        ? Math.min(stage.scale * scaleBy, maxZoom)
        : Math.max(stage.scale / scaleBy, minZoom);

    if (newScale === stage.scale) return; // No change needed

    // Calculate pointer position relative to stage
    const pointer = pointerPosition || {
      x: viewport.width / 2,
      y: viewport.height / 2,
    };

    // Calculate new position to keep zoom anchored to pointer
    const mousePointTo = {
      x: (pointer.x - stage.x) / stage.scale,
      y: (pointer.y - stage.y) / stage.scale,
    };

    const proposedStage = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
      scale: newScale,
    };

    const clamped = clampStageToBounds(
      proposedStage,
      viewport,
      treeBounds,
      minZoom,
      maxZoom,
    );

    set({
      stage: clamped.stage,
    });
  },

  // Pan function with momentum support
  pan: (deltaX, deltaY, withMomentum = false) => {
    const { stage } = get();
    const newStage = {
      ...stage,
      x: stage.x + deltaX,
      y: stage.y + deltaY,
    };

    set({
      stage: newStage,
    });

    // If momentum is requested, apply inertia effect
    if (withMomentum) {
      get().applyMomentum(deltaX, deltaY);
    }
  },

  // Store momentum animation ID for cancellation
  momentumAnimationId: null,

  // Apply momentum/inertia effect
  applyMomentum: (velocityX, velocityY) => {
    const { stage, momentumAnimationId } = get();

    // Cancel any existing momentum animation
    if (momentumAnimationId) {
      cancelAnimationFrame(momentumAnimationId);
      set({ momentumAnimationId: null });
    }

    // Calculate initial velocity (scale it down for natural feel)
    const friction = 0.92; // Slightly more friction for smoother deceleration
    const minVelocity = 0.5;

    let currentVelX = velocityX * 0.25; // Reduced initial velocity for smoother motion
    let currentVelY = velocityY * 0.25;

    // Only apply momentum if velocity is significant
    if (
      Math.abs(currentVelX) < minVelocity &&
      Math.abs(currentVelY) < minVelocity
    ) {
      return;
    }

    const animate = () => {
      const { stage: currentStage } = get();

      // Apply friction
      currentVelX *= friction;
      currentVelY *= friction;

      // Update position
      const newStage = {
        ...currentStage,
        x: currentStage.x + currentVelX,
        y: currentStage.y + currentVelY,
      };

      set({ stage: newStage });

      // Continue animation if velocity is still significant
      if (
        Math.abs(currentVelX) > minVelocity ||
        Math.abs(currentVelY) > minVelocity
      ) {
        const animId = requestAnimationFrame(animate);
        set({ momentumAnimationId: animId });
      } else {
        set({ momentumAnimationId: null });
      }
    };

    const animId = requestAnimationFrame(animate);
    set({ momentumAnimationId: animId });
  },

  // Cancel momentum animation
  cancelMomentum: () => {
    const { momentumAnimationId } = get();
    if (momentumAnimationId) {
      cancelAnimationFrame(momentumAnimationId);
      set({ momentumAnimationId: null });
    }
  },

  // Smooth animated reset to initial view
  resetView: (viewport, treeBoundsOverride, limits) => {
    const { stage, cancelMomentum, treeBounds, minZoom, maxZoom } = get();

    const safeViewport = viewport || { width: 1, height: 1 };
    const bounds = treeBoundsOverride || treeBounds || DEFAULT_BOUNDS;
    const min = limits?.minZoom ?? minZoom;
    const max = limits?.maxZoom ?? maxZoom;

    // Cancel any ongoing momentum
    cancelMomentum();

    // Calculate target position to center the tree
    const targetX =
      safeViewport.width / 2 - (bounds.minX + bounds.maxX) / 2;
    const targetY = 80; // Top padding
    const targetScale = 1;

    const clampedTarget = clampStageToBounds(
      { x: targetX, y: targetY, scale: targetScale },
      safeViewport,
      bounds,
      min,
      max,
    );

    // Set animating state
    set({ isAnimating: true });

    // Smooth animate with requestAnimationFrame
    const startX = stage.x;
    const startY = stage.y;
    const startScale = stage.scale;
    const durationMs = 400;
    const startTs = Date.now();

    const easeOut = (t) => 1 - Math.pow(1 - t, 2);

    const tick = () => {
      const elapsed = Date.now() - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const e = easeOut(t);

      const next = {
        x: startX + (clampedTarget.stage.x - startX) * e,
        y: startY + (clampedTarget.stage.y - startY) * e,
        scale: startScale + (clampedTarget.stage.scale - startScale) * e,
      };

      set({ stage: next });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        set({
          isAnimating: false,
          stage: clampedTarget.stage,
        });
      }
    };

    requestAnimationFrame(tick);
  },

  // Smooth zoom animation for UI controls
  animatedZoom: (direction, viewport) => {
    const { stage, minZoom, maxZoom } = get();
    const scaleBy = 1.2;
    const targetScale =
      direction > 0
        ? Math.min(stage.scale * scaleBy, maxZoom)
        : Math.max(stage.scale / scaleBy, minZoom);

    if (targetScale === stage.scale) return;

    // Center the zoom on viewport center
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    const mousePointTo = {
      x: (centerX - stage.x) / stage.scale,
      y: (centerY - stage.y) / stage.scale,
    };

    const clampedTarget = clampStageToBounds(
      {
        x: centerX - mousePointTo.x * targetScale,
        y: centerY - mousePointTo.y * targetScale,
        scale: targetScale,
      },
      viewport,
      get().treeBounds,
      minZoom,
      maxZoom,
    );

    set({ isAnimating: true });

    const startX = stage.x;
    const startY = stage.y;
    const startScale = stage.scale;
    const durationMs = 300;
    const startTs = Date.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 2);

    const tick = () => {
      const elapsed = Date.now() - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const e = easeOut(t);

      const next = {
        x: startX + (clampedTarget.stage.x - startX) * e,
        y: startY + (clampedTarget.stage.y - startY) * e,
        scale: startScale + (clampedTarget.stage.scale - startScale) * e,
      };

      set({ stage: next });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        set({
          isAnimating: false,
          stage: clampedTarget.stage,
        });
      }
    };

    requestAnimationFrame(tick);
  },

  // ============================================
  // ENHANCED HIGHLIGHTING SYSTEM ACTIONS (Phase 3E)
  // ============================================

  /**
   * Add highlight definition to state
   * @param {Object} definition - Highlight definition (type, style, etc.)
   * @returns {string} Generated highlight ID
   */
  addHighlight: (definition) => {
    const currentState = get();

    // CRITICAL: Enforce 200-highlight limit to prevent performance issues
    const MAX_HIGHLIGHTS = 200;
    const currentCount = Object.keys(currentState.highlights).length;

    if (currentCount >= MAX_HIGHLIGHTS) {
      console.warn(
        `[TreeStore] Cannot add highlight: Maximum limit (${MAX_HIGHLIGHTS}) reached. ` +
        `Remove existing highlights before adding new ones.`
      );
      return null; // Return null to indicate failure
    }

    const newHighlights = highlightingServiceV2.addHighlight(
      currentState.highlights,
      definition
    );

    // Get the newly added highlight ID
    const newId = Object.keys(newHighlights).find(
      id => !currentState.highlights[id]
    );

    set({ highlights: newHighlights });

    if (__DEV__) {
      console.log(`[TreeStore] Added highlight ${newId}:`, definition.type);
    }

    return newId;
  },

  /**
   * Remove highlight by ID
   * @param {string} id - Highlight ID
   */
  removeHighlight: (id) => {
    const currentState = get();
    const newHighlights = highlightingServiceV2.removeHighlight(
      currentState.highlights,
      id
    );

    set({ highlights: newHighlights });

    if (__DEV__) {
      console.log(`[TreeStore] Removed highlight ${id}`);
    }
  },

  /**
   * Update highlight definition
   * @param {string} id - Highlight ID
   * @param {Object} updates - Fields to update
   */
  updateHighlight: (id, updates) => {
    const currentState = get();
    const newHighlights = highlightingServiceV2.updateHighlight(
      currentState.highlights,
      id,
      updates
    );

    set({ highlights: newHighlights });

    if (__DEV__) {
      console.log(`[TreeStore] Updated highlight ${id}:`, Object.keys(updates));
    }
  },

  /**
   * Clear all highlights
   */
  clearHighlights: () => {
    set({ highlights: {} });

    if (__DEV__) {
      console.log('[TreeStore] Cleared all highlights');
    }
  },

  /**
   * Get render data for highlights (viewport-culled)
   * @param {Object} viewport - Current viewport bounds { minX, maxX, minY, maxY }
   * @returns {Array<SegmentData>} Visible segments with highlight info
   */
  getHighlightRenderData: (viewport, nodesArray = null) => {
    const { highlights } = get();

    if (Object.keys(highlights).length === 0) {
      return [];
    }

    // HISTORICAL ARCHITECTURE RESTORED (Oct 30, 2025):
    // Accept nodes array with coordinates from TreeView's layout calculation.
    // This ensures highlights use SAME coordinate source as tree rendering.
    if (!nodesArray || nodesArray.length === 0) {
      if (__DEV__) {
        console.warn('[Highlighting] No nodes array provided (layout not ready yet)');
      }
      return [];
    }

    // Convert array to Map for highlightingServiceV2
    const nodesMap = new Map(nodesArray.map(n => [n.id, n]));

    return highlightingServiceV2.getRenderData(highlights, nodesMap, viewport);
  },

  /**
   * Get highlighting statistics (for debugging/monitoring)
   * @param {Object} viewport - Current viewport bounds
   * @returns {Object} Statistics about current highlights
   */
  getHighlightStats: (viewport) => {
    const { highlights, nodesMap } = get();
    return highlightingServiceV2.getStats(highlights, nodesMap, viewport);
  },

  /**
   * Set cousin highlight (convenience method for existing feature)
   * This wraps the existing pendingCousinHighlight with new highlighting system
   * @param {Object} cousinData - { spouse1Id, spouse2Id, highlightProfileId }
   */
  setPendingCousinHighlight: (cousinData) => {
    set({ pendingCousinHighlight: cousinData });
  },
}));
