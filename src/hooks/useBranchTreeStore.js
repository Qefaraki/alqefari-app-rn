import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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

    // Highlighted ancestry for path rendering
    highlightedAncestry: [],
    
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