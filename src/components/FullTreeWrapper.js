import React, { useEffect } from "react";
import TreeView from "./TreeView";
import { useTreeStore } from "../stores/useTreeStore";
import { SettingsProvider } from "../contexts/SettingsContext";

/**
 * Simple wrapper that shows the FULL tree (no filtering)
 * Just centers on the focus person and highlights them
 * INSTANT - no loading needed!
 */
const FullTreeWrapper = ({ focusPersonId, onConfirm, onClose }) => {
  const treeData = useTreeStore((s) => s.treeData);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);

  useEffect(() => {
    // Just select the person - TreeView will handle centering
    if (focusPersonId) {
      setSelectedPersonId(focusPersonId);
    }
  }, [focusPersonId, setSelectedPersonId]);

  // If no tree data, we need to load main tree first
  if (!treeData || treeData.length === 0) {
    // Could show a message or load tree
    return null;
  }

  return (
    <SettingsProvider>
      <TreeView
        isFilteredView={true} // This disables certain interactions
        focusPersonId={focusPersonId} // For permanent highlight
        initialFocusId={focusPersonId} // For auto-centering
      />
    </SettingsProvider>
  );
};

export default FullTreeWrapper;
