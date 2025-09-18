import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Dimensions,
} from "react-native";
import TreeView from "./TreeView";
import profilesService from "../services/profiles";
import { useTreeStore } from "../stores/treeStore";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * BranchTreeView - Shows a filtered view of the tree focused on a specific person
 * Displays: ancestors to root, all descendants, siblings, uncles, and direct children
 * Hides but indicates: cousins, nieces/nephews, extended family
 */
const BranchTreeView = ({ focusPersonId, style }) => {
  const [branchData, setBranchData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get the full tree data from store
  const treeData = useTreeStore((s) => s.treeData);
  const nodesMap = useTreeStore((s) => s.nodesMap);

  useEffect(() => {
    if (!focusPersonId) {
      setLoading(false);
      return;
    }

    loadBranchData();
  }, [focusPersonId]);

  const loadBranchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // First try to use existing tree data if available
      if (treeData.length > 0 && nodesMap.has(focusPersonId)) {
        const filteredData = filterTreeForBranch(treeData, focusPersonId);
        setBranchData(filteredData);
        setLoading(false);
        return;
      }

      // Otherwise load fresh data for this branch
      // Load the person and their immediate family context
      const { data: personData, error: personError } =
        await profilesService.getBranchData(focusPersonId, 3, 3);

      if (personError) {
        throw personError;
      }

      // Also load ancestors up to root
      const ancestors = await loadAncestorsToRoot(focusPersonId);

      // Combine and deduplicate
      const combinedData = combineAndDeduplicate([
        ...(personData || []),
        ...(ancestors || []),
      ]);

      const filteredData = filterTreeForBranch(combinedData, focusPersonId);
      setBranchData(filteredData);
    } catch (err) {
      console.error("Error loading branch data:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAncestorsToRoot = async (personId) => {
    const ancestors = [];
    let currentId = personId;
    let depth = 0;
    const maxDepth = 20; // Prevent infinite loops

    while (currentId && depth < maxDepth) {
      const { data, error } = await profilesService.getProfile(currentId);
      if (error || !data) break;

      ancestors.push(data);
      currentId = data.father_id;
      depth++;
    }

    return ancestors;
  };

  const combineAndDeduplicate = (nodes) => {
    const uniqueMap = new Map();
    nodes.forEach((node) => {
      if (node && node.id) {
        uniqueMap.set(node.id, node);
      }
    });
    return Array.from(uniqueMap.values());
  };

  /**
   * Filter tree data to show only relevant nodes for the focused person's branch
   */
  const filterTreeForBranch = (allNodes, focusId) => {
    if (!allNodes || allNodes.length === 0) return [];

    const nodesById = new Map(allNodes.map((n) => [n.id, n]));
    const focusNode = nodesById.get(focusId);
    if (!focusNode) return [];

    const nodesToShow = new Set();
    const nodesWithHiddenChildren = new Map(); // Track which nodes have hidden children

    // 1. Add the focus person
    nodesToShow.add(focusId);

    // 2. Add all direct ancestors up to root
    let currentId = focusNode.father_id;
    while (currentId && nodesById.has(currentId)) {
      nodesToShow.add(currentId);
      const ancestor = nodesById.get(currentId);
      currentId = ancestor.father_id;
    }

    // 3. Add all direct descendants
    const addAllDescendants = (nodeId) => {
      const node = nodesById.get(nodeId);
      if (!node) return;

      // Find all children
      const children = allNodes.filter((n) => n.father_id === nodeId);
      children.forEach((child) => {
        nodesToShow.add(child.id);
        addAllDescendants(child.id); // Recursively add all descendants
      });
    };
    addAllDescendants(focusId);

    // 4. Add siblings of focus person
    if (focusNode.father_id) {
      const siblings = allNodes.filter(
        (n) => n.father_id === focusNode.father_id && n.id !== focusId,
      );
      siblings.forEach((sibling) => {
        nodesToShow.add(sibling.id);
        // Check if sibling has children (to show indicator)
        const siblingChildren = allNodes.filter(
          (n) => n.father_id === sibling.id,
        );
        if (siblingChildren.length > 0) {
          nodesWithHiddenChildren.set(sibling.id, siblingChildren.length);
        }
      });
    }

    // 5. Add uncles/aunts (parent's siblings)
    if (focusNode.father_id) {
      const father = nodesById.get(focusNode.father_id);
      if (father && father.father_id) {
        const uncles = allNodes.filter(
          (n) => n.father_id === father.father_id && n.id !== father.id,
        );
        uncles.forEach((uncle) => {
          nodesToShow.add(uncle.id);
          // Check if uncle has children (cousins - to show indicator)
          const cousinCount = allNodes.filter(
            (n) => n.father_id === uncle.id,
          ).length;
          if (cousinCount > 0) {
            nodesWithHiddenChildren.set(uncle.id, cousinCount);
          }
        });
      }
    }

    // 6. Add direct children of focus person (already handled in descendants)

    // Build the filtered array with indicators for hidden branches
    const filteredNodes = allNodes
      .filter((node) => nodesToShow.has(node.id))
      .map((node) => {
        // Add indicator if this node has hidden children
        if (nodesWithHiddenChildren.has(node.id)) {
          return {
            ...node,
            hasHiddenDescendants: true,
            hiddenDescendantCount: nodesWithHiddenChildren.get(node.id),
          };
        }
        return node;
      });

    return filteredNodes;
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A13333" />
          <Text style={styles.loadingText}>جاري تحميل شجرة العائلة...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>حدث خطأ في تحميل البيانات</Text>
        </View>
      </View>
    );
  }

  if (branchData.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>لا توجد بيانات</Text>
        </View>
      </View>
    );
  }

  // Use TreeView with the filtered data
  // Pass special props to indicate this is a branch view
  return (
    <View style={[styles.container, style]}>
      <TreeView
        customTreeData={branchData}
        initialFocusId={focusPersonId}
        isBranchView={true}
        hideControls={true}
        style={styles.treeView}
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>يوجد أفراد إضافيون (مخفيون)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  treeView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: "#A13333",
    fontFamily: "SF Arabic",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#24212199",
    fontFamily: "SF Arabic",
  },
  legend: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1BBA399",
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
});

export default BranchTreeView;
