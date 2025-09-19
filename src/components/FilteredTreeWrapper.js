import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { FilteredTreeProvider } from "../contexts/FilteredTreeContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import TreeView from "./TreeView";
import TreeSkeleton from "./TreeSkeleton";

/**
 * Wrapper that ensures FilteredTreeProvider is ready before rendering TreeView
 * This prevents hook order issues
 */
const FilteredTreeWrapper = ({ focusPersonId, isFilteredView }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Give FilteredTreeProvider time to initialize
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SettingsProvider>
      <FilteredTreeProvider focusPersonId={focusPersonId}>
        {isReady ? (
          <TreeView isFilteredView={isFilteredView} />
        ) : (
          <TreeSkeleton />
        )}
      </FilteredTreeProvider>
    </SettingsProvider>
  );
};

export default FilteredTreeWrapper;
