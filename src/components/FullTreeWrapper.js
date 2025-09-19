import React, { useEffect, useState } from "react";
import TreeView from "./TreeView";
import { useTreeStore } from "../stores/useTreeStore";
import { SettingsProvider } from "../contexts/SettingsContext";
import TreeSkeleton from "./TreeSkeleton";
import profilesService from "../services/profiles";

/**
 * Simple wrapper that shows the FULL tree (no filtering)
 * Loads tree if needed, then centers on focus person
 */
const FullTreeWrapper = ({ focusPersonId, onConfirm, onClose }) => {
  const treeData = useTreeStore((s) => s.treeData);
  const setTreeData = useTreeStore((s) => s.setTreeData);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load tree data if not available
    const loadTreeIfNeeded = async () => {
      if (!treeData || treeData.length === 0) {
        setIsLoading(true);
        try {
          // Load from root with good depth
          const { data } = await profilesService.getBranchData(null, 8, 1000);
          if (data) {
            setTreeData(data);
          }
        } catch (error) {
          console.error("Error loading tree:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadTreeIfNeeded();
  }, [treeData, setTreeData]);

  useEffect(() => {
    // Select the person once tree is loaded
    if (focusPersonId && treeData && treeData.length > 0) {
      setSelectedPersonId(focusPersonId);
    }
  }, [focusPersonId, treeData, setSelectedPersonId]);

  // Show skeleton while loading
  if (isLoading || !treeData || treeData.length === 0) {
    return <TreeSkeleton />;
  }

  return (
    <SettingsProvider>
      <TreeView
        isFilteredView={true} // This disables certain interactions
        permanentHighlightId={focusPersonId} // For permanent highlight
        initialFocusId={focusPersonId} // For auto-centering
      />
    </SettingsProvider>
  );
};

export default FullTreeWrapper;
