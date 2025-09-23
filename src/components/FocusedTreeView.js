import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import profilesService from "../services/profiles";

/**
 * FocusedTreeView - Shows a filtered tree view focused on a specific person
 * This is a simplified version specifically for the profile verification modal
 */
const FocusedTreeView = ({ focusPersonId }) => {
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState([]);
  const [focusPerson, setFocusPerson] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!focusPersonId) return;
    loadFocusedData();
  }, [focusPersonId]);

  const loadFocusedData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load the person and their branch (3 levels up and down)
      const { data: branchData, error: branchError } =
        await profilesService.getBranchData(focusPersonId, 5, 300);

      if (branchError) {
        console.error("Error loading branch:", branchError);
        // Fallback: Try to load manually
        await loadManualBranch();
        return;
      }

      if (!branchData || branchData.length === 0) {
        await loadManualBranch();
        return;
      }

      // Find the focus person in the data
      const person = branchData.find((p) => p.id === focusPersonId);
      if (person) {
        setFocusPerson(person);
      }

      setTreeData(branchData);
    } catch (err) {
      console.error("Error in loadFocusedData:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadManualBranch = async () => {
    try {
      // Load person
      const { data: person } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", focusPersonId)
        .single();

      if (!person) {
        throw new Error("Person not found");
      }

      setFocusPerson(person);
      const allNodes = [person];

      // Load ancestors up to root
      let currentId = person.father_id;
      let depth = 0;
      while (currentId && depth < 10) {
        const { data: ancestor } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentId)
          .single();

        if (ancestor) {
          allNodes.push(ancestor);
          currentId = ancestor.father_id;
        } else {
          break;
        }
        depth++;
      }

      // Load all descendants recursively
      const loadDescendants = async (parentId, currentDepth = 0) => {
        if (currentDepth > 5) return; // Limit depth

        const { data: children } = await supabase
          .from("profiles")
          .select("*")
          .eq("father_id", parentId)
          .order("sibling_order");

        if (children && children.length > 0) {
          allNodes.push(...children);
          // Load grandchildren for each child
          for (const child of children) {
            await loadDescendants(child.id, currentDepth + 1);
          }
        }
      };

      await loadDescendants(focusPersonId);

      // Load siblings
      if (person.father_id) {
        const { data: siblings } = await supabase
          .from("profiles")
          .select("*")
          .eq("father_id", person.father_id)
          .neq("id", focusPersonId)
          .order("sibling_order");

        if (siblings) {
          allNodes.push(...siblings);
        }
      }

      // Load uncles/aunts (parent's siblings)
      if (person.father_id) {
        const { data: father } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", person.father_id)
          .single();

        if (father && father.father_id) {
          const { data: uncles } = await supabase
            .from("profiles")
            .select("*")
            .eq("father_id", father.father_id)
            .neq("id", person.father_id)
            .order("sibling_order");

          if (uncles) {
            allNodes.push(...uncles);
          }
        }
      }

      // Remove duplicates
      const uniqueNodes = Array.from(
        new Map(allNodes.map((node) => [node.id, node])).values(),
      );

      setTreeData(uniqueNodes);
    } catch (err) {
      console.error("Error loading manual branch:", err);
      setError(err);
    }
  };

  // Create a simple tree structure display
  const renderTreeStructure = () => {
    if (!focusPerson || treeData.length === 0) {
      return <Text style={styles.emptyText}>لا توجد بيانات</Text>;
    }

    // Group nodes by relationship
    const ancestors = [];
    const siblings = [];
    const children = [];
    const uncles = [];
    const descendants = [];

    // Find ancestors
    let currentId = focusPerson.father_id;
    const ancestorIds = new Set();
    while (currentId) {
      ancestorIds.add(currentId);
      const ancestor = treeData.find((p) => p.id === currentId);
      if (ancestor) {
        ancestors.push(ancestor);
        currentId = ancestor.father_id;
      } else {
        break;
      }
    }

    // Categorize other nodes
    treeData.forEach((node) => {
      if (node.id === focusPersonId) return; // Skip focus person

      if (ancestorIds.has(node.id)) {
        // Already in ancestors
        return;
      } else if (
        node.father_id === focusPerson.father_id &&
        focusPerson.father_id
      ) {
        siblings.push(node);
      } else if (node.father_id === focusPersonId) {
        children.push(node);
      } else if (focusPerson.father_id) {
        // Check if uncle (parent's sibling)
        const parent = treeData.find((p) => p.id === focusPerson.father_id);
        if (parent && parent.father_id === node.father_id && node.father_id) {
          uncles.push(node);
        } else {
          // Check if descendant (grandchild, etc)
          let ancestorId = node.father_id;
          while (ancestorId) {
            if (ancestorId === focusPersonId) {
              descendants.push(node);
              break;
            }
            const ancestor = treeData.find((p) => p.id === ancestorId);
            ancestorId = ancestor?.father_id;
          }
        }
      }
    });

    return (
      <ScrollView style={styles.scrollView}>
        {/* Ancestors */}
        {ancestors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأجداد</Text>
            {ancestors.reverse().map((ancestor, index) => (
              <View key={ancestor.id} style={styles.ancestorChain}>
                <View style={styles.nodeCard}>
                  <Text style={styles.nodeName}>{ancestor.name}</Text>
                  {ancestor.birth_year_hijri && (
                    <Text style={styles.nodeInfo}>
                      {ancestor.birth_year_hijri} هـ
                    </Text>
                  )}
                </View>
                {index < ancestors.length - 1 && (
                  <Ionicons name="arrow-down" size={16} color="#D1BBA3" />
                )}
              </View>
            ))}
            <Ionicons name="arrow-down" size={16} color="#D1BBA3" />
          </View>
        )}

        {/* Focus Person */}
        <View style={styles.focusSection}>
          <View style={styles.focusCard}>
            <Ionicons name="person" size={20} color="#F9F7F3" />
            <Text style={styles.focusName}>{focusPerson.name}</Text>
            {focusPerson.birth_year_hijri && (
              <Text style={styles.focusInfo}>
                ولد عام {focusPerson.birth_year_hijri} هـ
              </Text>
            )}
            {focusPerson.generation && (
              <Text style={styles.focusInfo}>
                الجيل {focusPerson.generation}
              </Text>
            )}
          </View>
        </View>

        {/* Family Members */}
        <View style={styles.familyGrid}>
          {/* Siblings */}
          {siblings.length > 0 && (
            <View style={styles.relationGroup}>
              <Text style={styles.relationTitle}>
                الإخوة ({siblings.length})
              </Text>
              <View style={styles.nodeGrid}>
                {siblings.slice(0, 6).map((sibling) => (
                  <View key={sibling.id} style={styles.smallNode}>
                    <Text style={styles.smallNodeName} numberOfLines={1}>
                      {sibling.name}
                    </Text>
                  </View>
                ))}
                {siblings.length > 6 && (
                  <View style={styles.moreNode}>
                    <Text style={styles.moreText}>+{siblings.length - 6}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Children */}
          {children.length > 0 && (
            <View style={styles.relationGroup}>
              <Text style={styles.relationTitle}>
                الأبناء ({children.length})
              </Text>
              <View style={styles.nodeGrid}>
                {children.slice(0, 6).map((child) => (
                  <View key={child.id} style={styles.smallNode}>
                    <Text style={styles.smallNodeName} numberOfLines={1}>
                      {child.name}
                    </Text>
                  </View>
                ))}
                {children.length > 6 && (
                  <View style={styles.moreNode}>
                    <Text style={styles.moreText}>+{children.length - 6}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Uncles */}
          {uncles.length > 0 && (
            <View style={styles.relationGroup}>
              <Text style={styles.relationTitle}>
                الأعمام ({uncles.length})
              </Text>
              <View style={styles.nodeGrid}>
                {uncles.slice(0, 4).map((uncle) => (
                  <View key={uncle.id} style={styles.smallNode}>
                    <Text style={styles.smallNodeName} numberOfLines={1}>
                      {uncle.name}
                    </Text>
                  </View>
                ))}
                {uncles.length > 4 && (
                  <View style={styles.moreNode}>
                    <Text style={styles.moreText}>+{uncles.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Grandchildren if any */}
          {descendants.length > 0 && (
            <View style={styles.relationGroup}>
              <Text style={styles.relationTitle}>
                الأحفاد ({descendants.length})
              </Text>
              <View style={styles.nodeGrid}>
                {descendants.slice(0, 4).map((desc) => (
                  <View key={desc.id} style={styles.smallNode}>
                    <Text style={styles.smallNodeName} numberOfLines={1}>
                      {desc.name}
                    </Text>
                  </View>
                ))}
                {descendants.length > 4 && (
                  <View style={styles.moreNode}>
                    <Text style={styles.moreText}>
                      +{descendants.length - 4}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A13333" />
          <Text style={styles.loadingText}>جاري تحميل شجرة العائلة...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>حدث خطأ في تحميل البيانات</Text>
        </View>
      </View>
    );
  }

  return <View style={styles.container}>{renderTreeStructure()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  scrollView: {
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
  emptyText: {
    fontSize: 14,
    color: "#24212199",
    fontFamily: "SF Arabic",
    textAlign: "center",
    marginTop: 40,
  },
  section: {
    padding: 16,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginBottom: 12,
  },
  ancestorChain: {
    alignItems: "center",
    marginBottom: 8,
  },
  nodeCard: {
    backgroundColor: "#D1BBA320",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    alignItems: "center",
  },
  nodeName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  nodeInfo: {
    fontSize: 11,
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  focusSection: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  focusCard: {
    backgroundColor: "#A13333",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 200,
  },
  focusName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9F7F3",
    fontFamily: "SF Arabic",
    marginTop: 8,
  },
  focusInfo: {
    fontSize: 12,
    color: "#F9F7F3CC",
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
  familyGrid: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  relationGroup: {
    marginBottom: 20,
  },
  relationTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  nodeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallNode: {
    backgroundColor: "#F9F7F3",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  smallNodeName: {
    fontSize: 12,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  moreNode: {
    backgroundColor: "#D1BBA320",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  moreText: {
    fontSize: 12,
    color: "#24212199",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
});

export default FocusedTreeView;
