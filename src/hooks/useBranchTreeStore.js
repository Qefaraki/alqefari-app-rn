import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { highlightingServiceV2 } from '../services/highlightingServiceV2';

/**
 * Isolated Zustand store for branch tree functionality in modals.
 *
 * This store is completely separate from the main useTreeStore to prevent
 * state conflicts when showing tree modals alongside the main tree view.
 *
 * Key differences from main tree store:
 * - No admin features, edit modes, or complex UI state
 * - Simplified viewport management for modal use
 * - Lightweight data structure for small branch datasets
 * - Independent lifecycle management
 */
const useBranchTreeStore = create(
  subscribeWithSelector((set, get) => ({
    // Core data
    treeData: [],
    isLoading: false,
    error: null,

    // Tree stage
    stage: 'idle',

    // Selection and linking
    selectedPersonId: null,
    linkedProfileId: null,

    // Focus and highlighting
    focusPersonId: null,
    highlightProfileId: null,

    // Viewport state (simplified)
    translateX: 0,
    translateY: 0,
    scale: 1,

    // Zoom constraints
    minZoom: 0.1,
    maxZoom: 3,

    // Data structures (for compatibility with TreeView.core)
    nodesMap: new Map(),
    indices: { byId: new Map(), byHid: new Map() },

    // UI state
    showPhotos: true,
    loadingState: { isLoading: false, message: null },

    // Highlighted ancestry for path rendering (legacy - kept for compatibility)
    highlightedAncestry: [],

    // Highlighting system (NEW - required by TreeView.core.js autoHighlight feature)
    highlights: {},

    // Actions
    setTreeData: (data) => set({ treeData: data }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    setStage: (stage) => set({ stage }),

    setSelectedPersonId: (id) => set({ selectedPersonId: id }),

    setLinkedProfileId: (id) => set({ linkedProfileId: id }),

    setFocusPersonId: (id) => set({ focusPersonId: id }),

    setHighlightProfileId: (id) => set({ highlightProfileId: id }),

    setShowPhotos: (showPhotos) => set({ showPhotos }),

    setLoadingState: (loadingState) => set({ loadingState }),

    setViewport: (viewport) => set((state) => ({
      translateX: viewport.translateX ?? state.translateX,
      translateY: viewport.translateY ?? state.translateY,
      scale: viewport.scale ?? state.scale,
    })),

    setHighlightedAncestry: (ancestry) => set({ highlightedAncestry: ancestry }),

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HIGHLIGHTING SYSTEM (TreeView.core.js autoHighlight feature)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Required by TreeView.core.js when using autoHighlight prop.
    // Branch tree typically creates 1 highlight (ancestry path).
    //
    // PATTERN: Pure service functions (highlightingServiceV2)
    // - State in, new state out (no side effects)
    // - Service validates definitions, returns unchanged state on error
    // - Store enforces MAX_HIGHLIGHTS safety limit (20)
    //
    // DESIGN DECISIONS:
    // - MAX_HIGHLIGHTS: 20 (vs 200 in main tree) - branch tree is smaller
    // - NO updateHighlight(): Not needed (only add/remove for autoHighlight)
    // - NO getHighlightRenderData(): Not needed (small dataset, no viewport culling)
    //
    // COMPARISON WITH MAIN TREE (useTreeStore.js):
    // - Main tree: 200 limit, viewport culling, updateHighlight()
    // - Branch tree: 20 limit, render all highlights (10-50 nodes max)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /**
     * Add a highlight to the tree
     * @param {Object} definition - Highlight definition (type, nodeId, style)
     * @returns {string|null} Generated highlight ID, or null if failed/limit reached
     */
    addHighlight: (definition) => {
      const currentState = get();

      // SAFETY: Enforce 20-highlight limit (branch tree uses 1, but defensive)
      const MAX_HIGHLIGHTS = 20;
      const currentCount = Object.keys(currentState.highlights).length;

      if (currentCount >= MAX_HIGHLIGHTS) {
        console.warn(
          `[BranchTreeStore] Cannot add highlight: Maximum limit (${MAX_HIGHLIGHTS}) reached. ` +
          `This should not happen in normal branch tree usage (only 1 expected).`
        );
        return null;
      }

      const newHighlights = highlightingServiceV2.addHighlight(
        currentState.highlights,
        definition
      );

      // Get the newly added highlight ID
      const newId = Object.keys(newHighlights).find(
        id => !currentState.highlights[id]
      );

      // CRITICAL: Check validation BEFORE state update (plan-validator correction)
      if (!newId) {
        console.warn('[BranchTreeStore] Failed to add highlight (service validation failed)');
        return null;
      }

      set({ highlights: newHighlights });

      if (__DEV__) {
        console.log(`[BranchTreeStore] Added highlight ${newId}`, definition);
      }

      return newId;
    },

    /**
     * Remove a highlight from the tree
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
        console.log(`[BranchTreeStore] Removed highlight ${id}`);
      }
    },

    /**
     * Clear all highlights
     */
    clearHighlights: () => {
      set({ highlights: {} });

      if (__DEV__) {
        console.log('[BranchTreeStore] Cleared all highlights');
      }
    },

    // Reset all state (for cleanup)
    reset: () => set({
      treeData: [],
      isLoading: false,
      error: null,
      stage: 'idle',
      selectedPersonId: null,
      linkedProfileId: null,
      focusPersonId: null,
      highlightProfileId: null,
      translateX: 0,
      translateY: 0,
      scale: 1,
      minZoom: 0.1,
      maxZoom: 3,
      nodesMap: new Map(),
      indices: { byId: new Map(), byHid: new Map() },
      showPhotos: true,
      loadingState: { isLoading: false, message: null },
      highlightedAncestry: [],
      highlights: {},  // Clear highlights on reset
    }),
    
    // Helper methods for tree navigation
    getPersonById: (id) => {
      const { treeData } = get();
      return treeData.find(person => person.id === id);
    },
    
    getChildrenOf: (parentId) => {
      const { treeData } = get();
      return treeData.filter(person => person.father_id === parentId);
    },
    
    // Get current viewport bounds (for debugging)
    getViewportInfo: () => {
      const { translateX, translateY, scale, treeData } = get();
      return {
        translateX,
        translateY,
        scale,
        nodeCount: treeData.length,
      };
    },
  }))
);

export default useBranchTreeStore;