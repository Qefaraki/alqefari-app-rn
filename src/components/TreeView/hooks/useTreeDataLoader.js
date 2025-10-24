/**
 * useTreeDataLoader - Tree data loading and real-time synchronization
 *
 * Extracted from TreeView.js (Phase 2 Day 10)
 *
 * Manages:
 * - Initial tree loading with schema version checking
 * - Supabase real-time subscriptions for profile updates
 * - Network error handling and retry logic
 * - Skeleton fade animations
 * - Cache invalidation on schema changes
 */

import { useEffect } from 'react';
import { Alert, Animated as RNAnimated } from 'react-native';
import { useTreeStore, TREE_DATA_SCHEMA_VERSION } from '../../../stores/useTreeStore';
import profilesService from '../../../services/profiles';
import { supabase } from '../../../services/supabase';
import { formatDateByPreference } from '../../../utils/dateDisplay';
import { familyData } from '../../../data/family-data';

// Debounce helper for real-time updates
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export function useTreeDataLoader({
  setTreeData,
  setIsLoading,
  setNetworkError,
  setShowSkeleton,
  setIsRetrying,
  skeletonFadeAnim,
  contentFadeAnim,
  settingsRef,
}) {
  const loadTreeData = async () => {
    const startTime = Date.now();

    // Check if we already have adequate data (at least 5000 nodes means we have the full tree)
    const storeState = useTreeStore.getState();
    const existingData = storeState.treeData;
    const cachedVersion = storeState.cachedSchemaVersion;

    // Use cache only if version matches current schema
    if (existingData && existingData.length >= 5000 && cachedVersion === TREE_DATA_SCHEMA_VERSION) {
      const loadTime = Date.now() - startTime;
      console.log('🚀 Using preloaded tree data:', existingData.length, `nodes (schema v${TREE_DATA_SCHEMA_VERSION}), instant load in`, loadTime, 'ms');
      // Don't reload - we have enough data with correct schema
      setShowSkeleton(false);
      setIsLoading(false);
      return;
    } else if (existingData && existingData.length >= 5000 && cachedVersion !== TREE_DATA_SCHEMA_VERSION) {
      console.log(`⚠️ Schema version mismatch (cached: v${cachedVersion}, current: v${TREE_DATA_SCHEMA_VERSION}), reloading tree...`);
    } else if (existingData && existingData.length > 0) {
      console.log('⚠️ Partial tree data exists:', existingData.length, 'nodes, loading full tree...');
    }

    setIsLoading(true);
    setNetworkError(null);
    setIsRetrying(false);

    try {
      // First get the root node
      const { data: rootData, error: rootError } =
        await profilesService.getBranchData(null, 1, 1);

      // DEBUG: Detailed logging to identify exact validation failure
      console.log("=== ROOT NODE DEBUG ===");
      console.log("rootError:", rootError);
      console.log("rootData type:", typeof rootData);
      console.log("rootData is array?:", Array.isArray(rootData));
      console.log("rootData length:", rootData?.length);
      console.log("rootData value:", JSON.stringify(rootData, null, 2));
      console.log("Validation checks:");
      console.log("  - rootError?", !!rootError);
      console.log("  - !rootData?", !rootData);
      console.log("  - !Array.isArray?", !Array.isArray(rootData));
      console.log("  - length === 0?", rootData?.length === 0);
      console.log("======================");

      if (
        rootError ||
        !rootData ||
        !Array.isArray(rootData) ||
        rootData.length === 0
      ) {
        console.error("Error loading root node:", rootError);
        console.log("rootError type:", typeof rootError);
        console.log("rootError object:", JSON.stringify(rootError, null, 2));

        // Check if it's a network error - handle both Error objects and plain objects
        const errorString =
          rootError?.toString?.() || JSON.stringify(rootError) || "";
        const errorMsg = (
          rootError?.message ||
          errorString ||
          ""
        ).toLowerCase();

        console.log("Error message check:", errorMsg);
        console.log("Has 'network'?", errorMsg.includes("network"));
        console.log("Has 'fetch'?", errorMsg.includes("fetch"));

        // For TypeError objects, check the name as well
        const isNetworkError =
          errorMsg.includes("fetch") ||
          errorMsg.includes("network") ||
          rootError?.name === "TypeError" ||
          rootError?.code === "PGRST301";

        if (isNetworkError) {
          console.log("Setting network error state");
          setNetworkError("network");
          setTreeData([]);
        } else if (rootData?.length === 0) {
          setNetworkError("empty");
          setTreeData([]);
        } else {
          // Fall back to local data
          console.log("Falling back to local data");
          setTreeData(familyData || []);
        }
        // Don't trigger fade animation on error
        setShowSkeleton(false);
        setIsLoading(false);
        return;
      }

      // Then load the tree starting from the root HID
      const rootHid = rootData[0].hid;
      const { data, error } = await profilesService.getBranchData(
        rootHid,
        15, // Increased depth for future-proofing (supports deeper tree structures)
        5000, // Supports 3K incoming profiles + 67% buffer. Viewport culling handles rendering.
      );
      if (error) {
        console.error("Error loading tree data:", error);
        // Check if it's a network error (case insensitive)
        const errorMsg = error?.message?.toLowerCase() || "";
        if (
          errorMsg.includes("fetch") ||
          errorMsg.includes("network") ||
          error?.code === "PGRST301"
        ) {
          setNetworkError("network");
          setTreeData([]);
        } else {
          // Fall back to local data if backend fails
          setTreeData(familyData || []);
        }
      } else {
        // Monitor tree size and warn when approaching limit
        const profileCount = data?.length || 0;
        console.log(`✅ Tree loaded: ${profileCount} profiles`);

        if (profileCount > 3750) { // 75% of 5000
          console.warn(`⚠️ Approaching limit: ${profileCount}/5000 profiles. Consider increasing limit or progressive loading.`);
        }

        if (profileCount >= 4750) { // 95% of 5000
          console.error(`🚨 CRITICAL: ${profileCount}/5000 profiles. Immediate action required.`);
        }

        // User-facing warning at 90% capacity
        if (profileCount >= 4500) {
          Alert.alert(
            "⚠️ اقتراب الشجرة من الحد الأقصى",
            `الشجرة تحتوي على ${profileCount} ملف شخصي من أصل 5000 حد أقصى.\n\nيُنصح بالتواصل مع المطور قريباً لزيادة السعة.`,
            [{ text: "حسناً", style: "default" }]
          );
        }

        setTreeData(data || []);
        setNetworkError(null); // Clear any previous errors
      }

      // Start fade transition when data is loaded
      RNAnimated.parallel([
        // Fade out skeleton
        RNAnimated.timing(skeletonFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        // Fade in content
        RNAnimated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 400,
          delay: 100, // Slight overlap for smoother transition
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowSkeleton(false); // Remove skeleton from DOM after animation
      });

      const totalLoadTime = Date.now() - startTime;
      console.log('[TreeView] Tree loaded successfully in', totalLoadTime, 'ms');
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load tree:", err);
      // Check if it's a network error (case insensitive)
      const errorMsg = err?.message?.toLowerCase() || "";
      if (
        errorMsg.includes("fetch") ||
        errorMsg.includes("network") ||
        err?.code === "PGRST301"
      ) {
        setNetworkError("network");
        setTreeData([]);
      } else {
        // Fall back to local data
        setTreeData(familyData || []);
      }
      // Don't trigger fade animation on error
      setShowSkeleton(false);
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await loadTreeData();
  };

  // Load tree on mount
  useEffect(() => {
    loadTreeData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync loading state with treeData changes
  useEffect(() => {
    const { treeData } = useTreeStore.getState();
    if (treeData && treeData.length > 0) {
      console.log('[TreeView] Tree data updated, hiding loading state');
      setIsLoading(false);
      setShowSkeleton(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription for profile updates (Debounced for performance)
  useEffect(() => {
    // Debounced handler to batch rapid updates
    const handleProfileChange = debounce((payload) => {
      // Handle different event types
      if (payload.eventType === "UPDATE" && payload.new) {
        // Update just the affected node
        // Get current settings from ref (prevents stale closures)
        const currentSettings = settingsRef.current || { showPhotos: true, highlightMyLine: false };
        const updatedNode = {
          ...payload.new,
          name: payload.new.name || "بدون اسم",
          marriages:
            payload.new.marriages?.map((marriage) => ({
              ...marriage,
              start_date: marriage.start_date
                ? formatDateByPreference(
                    marriage.start_date,
                    currentSettings?.defaultCalendar || 'gregorian',
                  )
                : null,
            })) || [],
        };

        // Update in Zustand store
        useTreeStore.getState().updateNode(updatedNode.id, updatedNode);
      } else if (payload.eventType === "INSERT" && payload.new) {
        // Add new node
        // Get current settings from ref (prevents stale closures)
        const currentSettings = settingsRef.current || { showPhotos: true, highlightMyLine: false };
        const newNode = {
          ...payload.new,
          name: payload.new.name || "بدون اسم",
          marriages:
            payload.new.marriages?.map((marriage) => ({
              ...marriage,
              start_date: marriage.start_date
                ? formatDateByPreference(
                    marriage.start_date,
                    currentSettings?.defaultCalendar || 'gregorian',
                  )
                : null,
            })) || [],
        };

        // Add to Zustand store
        useTreeStore.getState().addNode(newNode);
      } else if (payload.eventType === "DELETE" && payload.old) {
        // Remove node
        const nodeId = payload.old.id;

        // Remove from Zustand store
        useTreeStore.getState().removeNode(nodeId);
      }
    }, 150); // 150ms debounce - batches rapid updates together

    // Subscribe to profile changes via Supabase
    const channel = supabase
      .channel("profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        handleProfileChange
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [setTreeData]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loadTreeData, handleRetry };
}
