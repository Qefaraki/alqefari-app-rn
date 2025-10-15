import { useCallback } from "react";
import { useTreeStore } from "../stores/useTreeStore";
import profilesService from "../services/profiles";

const useStore = () => {
  const setTreeData = useTreeStore((state) => state.setTreeData);

  const refreshProfile = useCallback(
    async (profileId) => {
      try {
        // For now, we'll reload the entire tree
        // In the future, this could be optimized to reload only the affected branch
        console.log("Refreshing profile:", profileId);

        // Get root node
        const { data: rootData, error: rootError } =
          await profilesService.getBranchData(null, 1, 1);
        if (rootError || !rootData || rootData.length === 0) {
          console.error("Error loading root node:", rootError);
          return;
        }

        const rootNode = rootData[0];

        // Load full tree - use higher depth to see more generations
        const { data: fullTreeData, error } =
          await profilesService.getBranchData(rootNode.hid, 10, 2000); // Increased from 500 to 2000
        if (error) {
          console.error("Error loading tree data:", error);
          return;
        }

        // Monitor tree size
        const profileCount = fullTreeData?.length || 0;
        console.log(`✅ Store refresh: ${profileCount} profiles`);

        if (profileCount > 1500) {
          console.warn(`⚠️ Tree size: ${profileCount}/2000 profiles. Consider progressive loading.`);
        }

        if (profileCount >= 1900) {
          console.error(`🚨 CRITICAL: ${profileCount}/2000 profiles. Progressive loading required.`);
        }

        // Process and update tree data
        const processedData = (fullTreeData || []).map((person) => ({
          ...person,
          name: person.name || "بدون اسم",
          marriages:
            person.marriages?.map((marriage) => ({
              ...marriage,
              start_date: marriage.start_date || null,
            })) || [],
        }));

        setTreeData(processedData);

        return true;
      } catch (error) {
        console.error("Error refreshing profile:", error);
        return false;
      }
    },
    [setTreeData],
  );

  return {
    refreshProfile,
  };
};

export default useStore;
