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
  // Call all Zustand selectors at top level (React Rules of Hooks)
  // Zustand selectors are optimized and return stable references
  const treeData = useBranchTreeStore(s => s.treeData);
  const stage = useBranchTreeStore(s => s.stage);
  const selectedPersonId = useBranchTreeStore(s => s.selectedPersonId);
  const linkedProfileId = useBranchTreeStore(s => s.linkedProfileId);
  const minZoom = useBranchTreeStore(s => s.minZoom || 0.1);
  const maxZoom = useBranchTreeStore(s => s.maxZoom || 3);
  const nodesMap = useBranchTreeStore(s => s.nodesMap || new Map());
  const indices = useBranchTreeStore(s => s.indices || { byId: new Map(), byHid: new Map() });
  const showPhotos = useBranchTreeStore(s => s.showPhotos !== undefined ? s.showPhotos : true);
  const loadingState = useBranchTreeStore(s => s.loadingState || { isLoading: false, message: null });
  const highlights = useBranchTreeStore(s => s.highlights || {});

  // Actions
  const setTreeData = useBranchTreeStore(s => s.setTreeData);
  const setStage = useBranchTreeStore(s => s.setStage || (() => {}));
  const setLinkedProfileId = useBranchTreeStore(s => s.setLinkedProfileId || (() => {}));
  const setShowPhotos = useBranchTreeStore(s => s.setShowPhotos || (() => {}));
  const setLoadingState = useBranchTreeStore(s => s.setLoadingState || (() => {}));
  const addHighlight = useBranchTreeStore(s => s.addHighlight || (() => null));
  const removeHighlight = useBranchTreeStore(s => s.removeHighlight || (() => {}));
  const clearHighlights = useBranchTreeStore(s => s.clearHighlights || (() => {}));
  const getHighlightRenderData = useBranchTreeStore(s => s.getHighlightRenderData || (() => []));

  // Memoize store object to prevent infinite render loops
  // TreeView.core.js useEffect depends on store.actions - must be stable reference
  const store = useMemo(() => ({
    state: {
      // Tree data and stage
      treeData,
      stage,
      isTreeLoaded: treeData.length > 0,

      // Selection and linking
      selectedPersonId,
      linkedProfileId,

      // Zoom constraints
      minZoom,
      maxZoom,

      // Data structures
      nodesMap,
      indices,

      // UI state (mostly unused in branch tree)
      showPhotos,
      highlightMyLine: false,  // Not used in branch tree
      focusOnProfile: null,    // Not used in branch tree
      loadingState,

      // Highlighting system (NEW - required by TreeView.core.js autoHighlight)
      highlights,
      pendingCousinHighlight: null,

      // Profile sheet
      profileSheetProgress: null,  // Not used in branch tree
    },
    actions: {
      // Tree data mutations (no-ops for read-only mode)
      setTreeData,
      updateNode: () => {}, // No-op (read-only)
      addNode: () => {},    // No-op (read-only)
      removeNode: () => {},  // No-op (read-only)

      // Stage management
      setStage,

      // Selection and linking
      setSelectedPersonId: () => {}, // No-op (read-only)
      setLinkedProfileId,

      // UI toggles
      setShowPhotos,
      setHighlightMyLine: () => {}, // No-op (no toggle in modal)
      setFocusOnProfile: () => {},  // No-op
      setLoadingState,

      // Highlighting actions (NEW - required by TreeView.core.js autoHighlight)
      addHighlight,
      removeHighlight,
      clearHighlights,
      getHighlightRenderData,
      setPendingCousinHighlight: () => {}, // No-op

      // Profile sheet
      initializeProfileSheetProgress: () => {}, // No-op
    }
  }), [
    // State dependencies (Zustand selectors return stable references)
    treeData,
    stage,
    selectedPersonId,
    linkedProfileId,
    minZoom,
    maxZoom,
    nodesMap,
    indices,
    showPhotos,
    loadingState,
    highlights,
    // Action dependencies
    setTreeData,
    setStage,
    setLinkedProfileId,
    setShowPhotos,
    setLoadingState,
    addHighlight,
    removeHighlight,
    clearHighlights,
    getHighlightRenderData,
  ]);

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
