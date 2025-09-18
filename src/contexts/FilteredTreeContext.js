import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { create } from "zustand";
import profilesService from "../services/profiles";
import {
  filterTreeForPerson,
  calculateFilteredBounds,
  calculateInitialZoom,
} from "../utils/treeFilter";
import { calculateTreeLayout } from "../utils/treeLayout";
import { useTreeStore } from "../stores/useTreeStore";

// Create context for the filtered store
const FilteredTreeContext = createContext(null);

/**
 * Provider that creates a temporary tree store with filtered data
 * This allows TreeView to work with a subset of data without modifications
 */
export function FilteredTreeProvider({ children, focusPersonId }) {
  const [isReady, setIsReady] = useState(false);
  const storeRef = useRef(null);

  useEffect(() => {
    if (!focusPersonId) return;

    // Create a temporary store that mimics the global tree store
    const createFilteredStore = create((set, get) => ({
      // Copy all the necessary state from global store
      treeData: [],
      nodesMap: new Map(),
      stage: { x: 0, y: 0, scale: 1 }, // Initialize with proper transform object
      setStage: (stage) => set({ stage }),
      selectedPersonId: focusPersonId, // Start with focus person selected
      setSelectedPersonId: (id) => set({ selectedPersonId: id }),
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      minZoom: 0.1,
      maxZoom: 3,

      // Add properties for filtered view
      focusPersonId: focusPersonId, // The person we're verifying
      isFilteredView: true, // Flag to indicate this is a filtered context
      permanentHighlight: focusPersonId, // Keep this person always highlighted

      // Tree data setters
      setTreeData: (data) => {
        const nodesMap = new Map(data.map((node) => [node.id, node]));
        set({ treeData: data, nodesMap });
      },

      // Copy other necessary methods from global store
      initializeProfileSheetProgress: () => {},
      profileSheetProgress: null,
    }));

    storeRef.current = createFilteredStore;
    loadFilteredData();
  }, [focusPersonId]);

  const loadFilteredData = async () => {
    if (!focusPersonId || !storeRef.current) return;

    try {
      // First try to get data from global store if available
      const globalTreeData = useTreeStore.getState().treeData;

      let allData = [];

      if (globalTreeData && globalTreeData.length > 0) {
        // Use existing data from global store
        allData = globalTreeData;
      } else {
        // Load fresh data - get the person's branch with good depth
        const { data: branchData, error } = await profilesService.getBranchData(
          focusPersonId,
          5, // depth
          500, // limit
        );

        if (!branchData || error) {
          // Fallback: load from root and filter
          const { data: rootData } = await profilesService.getBranchData(
            null,
            8,
            1000,
          );
          allData = rootData || [];
        } else {
          // Also load ancestors to root if not included
          const focusNode = branchData.find((n) => n.id === focusPersonId);
          if (focusNode && focusNode.father_id) {
            // Load ancestor chain
            let currentId = focusNode.father_id;
            const ancestorsToLoad = [];

            while (currentId && !branchData.some((n) => n.id === currentId)) {
              ancestorsToLoad.push(currentId);
              const parent = branchData.find((n) => n.id === currentId);
              currentId = parent?.father_id;
            }

            // Load missing ancestors
            if (ancestorsToLoad.length > 0) {
              const { data: ancestorData } =
                await profilesService.getBranchData(
                  ancestorsToLoad[ancestorsToLoad.length - 1], // Start from highest ancestor
                  10,
                  200,
                );

              if (ancestorData) {
                // Merge with branch data
                const mergedData = [...branchData];
                ancestorData.forEach((ancestor) => {
                  if (!mergedData.some((n) => n.id === ancestor.id)) {
                    mergedData.push(ancestor);
                  }
                });
                allData = mergedData;
              } else {
                allData = branchData;
              }
            } else {
              allData = branchData;
            }
          } else {
            allData = branchData;
          }
        }
      }

      // Apply filtering
      const filteredData = filterTreeForPerson(allData, focusPersonId);

      // Ensure we have valid data with positions
      let layoutData = filteredData;

      // Check if filtered data has x/y positions already
      const hasPositions = filteredData.some(
        (node) => node.x !== undefined && node.y !== undefined,
      );

      if (!hasPositions) {
        // Try to calculate layout
        try {
          layoutData = calculateTreeLayout(filteredData);

          // If calculateTreeLayout returns empty or invalid, use filtered data with dummy positions
          if (!layoutData || layoutData.length === 0) {
            console.log(
              "Layout calculation failed, using filtered data with estimated positions",
            );
            layoutData = filteredData.map((node, index) => ({
              ...node,
              x: (index % 10) * 100,
              y: Math.floor(index / 10) * 100,
            }));
          }
        } catch (error) {
          console.error("Error calculating layout:", error);
          // Fallback: assign basic positions
          layoutData = filteredData.map((node, index) => ({
            ...node,
            x: (index % 10) * 100,
            y: Math.floor(index / 10) * 100,
          }));
        }
      }

      // Ensure every node has x/y positions
      const validatedData = layoutData.map((node, index) => {
        if (
          node.x === undefined ||
          node.y === undefined ||
          isNaN(node.x) ||
          isNaN(node.y)
        ) {
          console.warn(`Node ${node.id} missing position, assigning default`);
          return {
            ...node,
            x: node.x || (index % 10) * 100,
            y: node.y || Math.floor(index / 10) * 100,
          };
        }
        return node;
      });

      // Update the filtered store
      storeRef.current.getState().setTreeData(validatedData);

      // Calculate initial viewport
      const bounds = calculateFilteredBounds(layoutData);

      // Could set initial zoom here if TreeView supported it
      // For now TreeView will handle its own zoom

      setIsReady(true);
    } catch (error) {
      console.error("Error loading filtered data:", error);
      setIsReady(true); // Still set ready to prevent infinite loading
    }
  };

  if (!isReady || !storeRef.current) {
    return null; // Or a loading indicator
  }

  return (
    <FilteredTreeContext.Provider value={storeRef.current}>
      {children}
    </FilteredTreeContext.Provider>
  );
}

/**
 * Hook to use either filtered store or global store
 * This is what TreeView will use instead of directly using useTreeStore
 */
export function useFilteredTreeStore(selector) {
  const filteredStore = useContext(FilteredTreeContext);
  const globalStore = useTreeStore(selector);

  if (filteredStore) {
    // We're in a filtered context, use the filtered store
    return filteredStore(selector);
  }

  // No filtered context, use global store
  return globalStore;
}
