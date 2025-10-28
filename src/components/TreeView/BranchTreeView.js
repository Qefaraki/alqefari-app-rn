import React, { useMemo } from 'react';
import TreeViewCoreWithProviders from './TreeView.core';
import useBranchTreeStore from '../../hooks/useBranchTreeStore';

/**
 * BranchTreeView - Read-only tree view for modals
 *
 * Wraps TreeView.core.js with useBranchTreeStore for branch tree modals.
 * Provides read-only visualization with pan/zoom gestures but no editing.
 *
 * Features:
 * - Isolated state (useBranchTreeStore, not main tree)
 * - Read-only mode (no node taps, no profile sheets)
 * - Hidden controls (no SearchBar)
 * - Auto-highlighting (uses existing ANCESTRY_COLORS system)
 * - Smaller navigation button (40x40 vs 56x56)
 *
 * Usage:
 *   <BranchTreeProvider focusPersonId={profile.id}>
 *     <BranchTreeView focusPersonId={profile.id} user={user} />
 *   </BranchTreeProvider>
 */
const BranchTreeView = ({
  focusPersonId,
  user,
  modalView = true,
  ...restProps
}) => {
  // Map branch store to prop interface
  // This creates isolated state separate from main tree
  //
  // IMPORTANT: All hooks MUST be called at top level (React Rules of Hooks)
  // We use a plain object instead of useMemo() because Zustand hooks already
  // have built-in selector optimization. The store object reference doesn't
  // need memoization - only the selectors inside each hook call are optimized.
  // This pattern matches TreeView.js and is production-proven.
  const store = {
    state: {
      // Tree data and stage
      treeData: useBranchTreeStore(s => s.treeData),
      stage: useBranchTreeStore(s => s.stage),
      isTreeLoaded: useBranchTreeStore(s => s.treeData.length > 0),

      // Selection and linking
      selectedPersonId: useBranchTreeStore(s => s.selectedPersonId),
      linkedProfileId: useBranchTreeStore(s => s.linkedProfileId),

      // Zoom constraints
      minZoom: useBranchTreeStore(s => s.minZoom || 0.1),
      maxZoom: useBranchTreeStore(s => s.maxZoom || 3),

      // Data structures
      nodesMap: useBranchTreeStore(s => s.nodesMap || new Map()),
      indices: useBranchTreeStore(s => s.indices || { byId: new Map(), byHid: new Map() }),

      // UI state (mostly unused in branch tree)
      showPhotos: useBranchTreeStore(s => s.showPhotos !== undefined ? s.showPhotos : true),
      highlightMyLine: false,  // Not used in branch tree
      focusOnProfile: null,    // Not used in branch tree
      loadingState: useBranchTreeStore(s => s.loadingState || { isLoading: false, message: null }),

      // Highlighting system (NEW - required by TreeView.core.js autoHighlight)
      highlights: useBranchTreeStore(s => s.highlights || {}),
      pendingCousinHighlight: null,

      // Profile sheet
      profileSheetProgress: null,  // Not used in branch tree
    },
    actions: {
      // Tree data mutations (no-ops for read-only mode)
      setTreeData: useBranchTreeStore(s => s.setTreeData),
      updateNode: () => {}, // No-op (read-only)
      addNode: () => {},    // No-op (read-only)
      removeNode: () => {},  // No-op (read-only)

      // Stage management
      setStage: useBranchTreeStore(s => s.setStage || (() => {})),

      // Selection and linking
      setSelectedPersonId: () => {}, // No-op (read-only)
      setLinkedProfileId: useBranchTreeStore(s => s.setLinkedProfileId || (() => {})),

      // UI toggles
      setShowPhotos: useBranchTreeStore(s => s.setShowPhotos || (() => {})),
      setHighlightMyLine: () => {}, // No-op (no toggle in modal)
      setFocusOnProfile: () => {},  // No-op
      setLoadingState: useBranchTreeStore(s => s.setLoadingState || (() => {})),

      // Highlighting actions (NEW - required by TreeView.core.js autoHighlight)
      addHighlight: useBranchTreeStore(s => s.addHighlight || (() => null)),
      removeHighlight: useBranchTreeStore(s => s.removeHighlight || (() => {})),
      clearHighlights: useBranchTreeStore(s => s.clearHighlights || (() => {})),
      getHighlightRenderData: useBranchTreeStore(s => s.getHighlightRenderData || (() => [])),
      setPendingCousinHighlight: () => {}, // No-op

      // Profile sheet
      initializeProfileSheetProgress: () => {}, // No-op
    }
  };

  // Auto-highlight configuration
  // Uses existing SEARCH highlight type with ANCESTRY_COLORS palette
  // This activates the existing highlighting system in TreeView.core
  const autoHighlight = useMemo(() => {
    if (!focusPersonId) return null;
    return {
      type: 'SEARCH',
      nodeId: focusPersonId
    };
  }, [focusPersonId]);

  return (
    <TreeViewCoreWithProviders
      store={store}
      readOnly={true}            // No node taps, no editing
      hideControls={true}        // No SearchBar
      navigationTarget={focusPersonId}  // Nav button points to focus person
      initialFocusId={focusPersonId}    // Center on this node after layout
      autoHighlight={autoHighlight}     // Activate ANCESTRY_COLORS path
      user={user}
      {...restProps}
    />
  );
};

export default BranchTreeView;
