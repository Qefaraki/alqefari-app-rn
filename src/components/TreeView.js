import React, { useMemo } from 'react';
import TreeViewCoreWithProviders from './TreeView/TreeView.core';
import { useTreeStore } from '../stores/useTreeStore';

/**
 * TreeView - Main tree wrapper component
 *
 * Wraps TreeView.core.js with useTreeStore for the main family tree view.
 * This is a thin wrapper that maps Zustand store to the store prop interface.
 *
 * All tree rendering logic lives in TreeView.core.js.
 */
const TreeView = (props) => {
  // Map Zustand store to prop interface
  // Call all hooks at top level (Zustand selectors are already optimized)
  const store = {
    state: {
      // Tree data and stage
      treeData: useTreeStore(s => s.treeData),
      stage: useTreeStore(s => s.stage),
      isTreeLoaded: useTreeStore(s => s.isTreeLoaded),

      // Selection and linking
      selectedPersonId: useTreeStore(s => s.selectedPersonId),
      linkedProfileId: useTreeStore(s => s.linkedProfileId),

      // Navigation target for automatic camera movement
      navigationTarget: useTreeStore(s => s.navigationTarget),

      // Zoom constraints
      minZoom: useTreeStore(s => s.minZoom),
      maxZoom: useTreeStore(s => s.maxZoom),

      // Data structures
      nodesMap: useTreeStore(s => s.nodesMap),
      indices: useTreeStore(s => s.indices),

      // UI state
      showPhotos: useTreeStore(s => s.showPhotos),
      highlightMyLine: useTreeStore(s => s.highlightMyLine),
      focusOnProfile: useTreeStore(s => s.focusOnProfile),
      loadingState: useTreeStore(s => s.loadingState),

      // Highlighting (legacy cousin highlight)
      pendingCousinHighlight: useTreeStore(s => s.pendingCousinHighlight),

      // Enhanced Highlighting System (Phase 3E)
      highlights: useTreeStore(s => s.highlights),

      // Profile sheet
      profileSheetProgress: useTreeStore(s => s.profileSheetProgress),
    },
    actions: {
      // Tree data mutations
      setTreeData: useTreeStore(s => s.setTreeData),
      updateNode: useTreeStore(s => s.updateNode),
      addNode: useTreeStore(s => s.addNode),
      removeNode: useTreeStore(s => s.removeNode),

      // Stage management
      setStage: useTreeStore(s => s.setStage),

      // Selection and linking
      setSelectedPersonId: useTreeStore(s => s.setSelectedPersonId),
      setLinkedProfileId: useTreeStore(s => s.setLinkedProfileId),

      // Navigation
      setNavigationTarget: useTreeStore(s => s.setNavigationTarget),

      // UI toggles
      setShowPhotos: useTreeStore(s => s.setShowPhotos),
      setHighlightMyLine: useTreeStore(s => s.setHighlightMyLine),
      setFocusOnProfile: useTreeStore(s => s.setFocusOnProfile),
      setLoadingState: useTreeStore(s => s.setLoadingState),

      // Highlighting (legacy cousin highlight)
      setPendingCousinHighlight: useTreeStore(s => s.setPendingCousinHighlight),

      // Enhanced Highlighting System (Phase 3E)
      addHighlight: useTreeStore(s => s.addHighlight),
      removeHighlight: useTreeStore(s => s.removeHighlight),
      updateHighlight: useTreeStore(s => s.updateHighlight),
      clearHighlights: useTreeStore(s => s.clearHighlights),
      getHighlightRenderData: useTreeStore(s => s.getHighlightRenderData),
      getHighlightStats: useTreeStore(s => s.getHighlightStats),

      // Profile sheet
      initializeProfileSheetProgress: useTreeStore(s => s.initializeProfileSheetProgress),
    }
  };

  return <TreeViewCoreWithProviders store={store} {...props} />;
};

export default TreeView;
