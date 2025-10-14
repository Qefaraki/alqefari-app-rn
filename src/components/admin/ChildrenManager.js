import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import CardSurface from "../ios/CardSurface";
import { supabase } from "../../services/supabase";
import profilesService from "../../services/profiles";
import QuickAddOverlay from "./QuickAddOverlay";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";

const ChildrenManager = ({ profile, onUpdate, isAdmin }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);

  // Load children when component mounts or profile changes
  useEffect(() => {
    if (profile?.id) {
      loadChildren();
    }
  }, [profile?.id]);

  const loadChildren = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          hid,
          name,
          gender,
          status,
          generation,
          sibling_order,
          photo_url,
          mother_id,
          mother:profiles!mother_id(id, name)
        `,
        )
        .or(`father_id.eq.${profile.id},mother_id.eq.${profile.id}`)
        .is("deleted_at", null)
        .order("sibling_order", { ascending: true });

      if (error) {
        console.error("Error loading children:", error);
        setChildren([]);
      } else {
        // Group children by mother if this is a father
        const processedChildren =
          profile.gender === "male"
            ? groupChildrenByMother(data || [])
            : data || [];
        setChildren(processedChildren);
      }
    } catch (error) {
      console.error("Error in loadChildren:", error);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  };

  const groupChildrenByMother = (childrenData) => {
    // Group children by mother_id
    const grouped = {};
    childrenData.forEach((child) => {
      const motherId = child.mother_id || "unknown";
      if (!grouped[motherId]) {
        grouped[motherId] = {
          mother: child.mother,
          children: [],
        };
      }
      grouped[motherId].children.push(child);
    });
    return grouped;
  };

  const handleDeleteChild = async (child) => {
    setDeleteTarget(child);
    setLoadingImpact(true);
    setShowDeleteDialog(true);

    try {
      // Get delete impact preview using service
      const { data, error } = await profilesService.previewDeleteImpact(
        child.id,
      );

      if (error) {
        console.error("Error getting delete impact:", error);
        setDeleteImpact({
          total_affected: 1,
          direct_children: 0,
          total_descendants: 0,
        });
      } else {
        setDeleteImpact(data);
      }
    } catch (error) {
      console.error("Error in handleDeleteChild:", error);
      setDeleteImpact({
        total_affected: 1,
        direct_children: 0,
        total_descendants: 0,
      });
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmDelete = async (cascade = false) => {
    if (!deleteTarget) return;

    try {
      const { data, error } = await profilesService.deleteProfile(
        deleteTarget.id,
        cascade,
        deleteTarget.version || 1,
      );

      if (error) {
        Alert.alert("خطأ", "فشل حذف الملف الشخصي");
        console.error("Delete error:", error);
      } else {
        Alert.alert("نجح", `تم حذف ${data.deleted_count} ملف شخصي`);
        loadChildren(); // Reload children
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      Alert.alert("خطأ", "حدث خطأ أثناء الحذف");
      console.error("Error in confirmDelete:", error);
    } finally {
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      setDeleteImpact(null);
    }
  };

  const handleReorderChild = async (childId, newOrder) => {
    try {
      // Update sibling order
      const { error } = await supabase
        .from("profiles")
        .update({ sibling_order: newOrder })
        .eq("id", childId);

      if (error) {
        console.error("Error reordering child:", error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        loadChildren(); // Reload to show new order
      }
    } catch (error) {
      console.error("Error in handleReorderChild:", error);
    }
  };

  const renderChild = (child, index, totalChildren) => {
    const canMoveUp = index > 0;
    const canMoveDown = index < totalChildren - 1;

    return (
      <View key={child.id} style={styles.childRow}>
        <View style={styles.childInfo}>
          <View style={styles.childHeader}>
            <Text style={styles.childName}>{child.name}</Text>
            <View style={styles.childBadges}>
              {child.gender === "male" ? (
                <View style={[styles.genderBadge, styles.maleBadge]}>
                  <Ionicons name="male" size={12} color="#007AFF" />
                </View>
              ) : (
                <View style={[styles.genderBadge, styles.femaleBadge]}>
                  <Ionicons name="female" size={12} color="#E91E63" />
                </View>
              )}
              {child.status === "deceased" && (
                <View style={styles.deceasedBadge}>
                  <Text style={styles.deceasedText}>متوفى</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.childMeta}>
            HID: {child.hid} • الجيل: {child.generation}
          </Text>
        </View>

        {isAdmin && (
          <View style={styles.childActions}>
            <TouchableOpacity
              onPress={() => handleReorderChild(child.id, index - 1)}
              disabled={!canMoveUp}
              style={[
                styles.actionButton,
                !canMoveUp && styles.actionButtonDisabled,
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={canMoveUp ? "#007AFF" : "#C7C7CC"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleReorderChild(child.id, index + 1)}
              disabled={!canMoveDown}
              style={[
                styles.actionButton,
                !canMoveDown && styles.actionButtonDisabled,
              ]}
            >
              <Ionicons
                name="arrow-down"
                size={18}
                color={canMoveDown ? "#007AFF" : "#C7C7CC"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDeleteChild(child)}
              style={[styles.actionButton, styles.deleteButton]}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderGroupedChildren = () => {
    if (typeof children === "object" && !Array.isArray(children)) {
      // Grouped by mother
      return Object.entries(children).map(([motherId, group]) => (
        <View key={motherId} style={styles.motherGroup}>
          <View style={styles.motherHeader}>
            <Text style={styles.motherName}>
              {group.mother ? `أم: ${group.mother.name}` : "أم: غير معروف"}
            </Text>
            <Text style={styles.motherChildCount}>
              {group.children.length} أطفال
            </Text>
          </View>
          {group.children.map((child, index) =>
            renderChild(child, index, group.children.length),
          )}
        </View>
      ));
    } else {
      // Simple list
      return children.map((child, index) =>
        renderChild(child, index, children.length),
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>الأبناء</Text>
        <CardSurface>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>جارِ التحميل...</Text>
          </View>
        </CardSurface>
      </View>
    );
  }

  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Object.keys(children).length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>الأبناء</Text>
        {isAdmin && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowQuickAdd(true)}
          >
            <Ionicons name="add-circle" size={24} color="#007AFF" />
            <Text style={styles.addButtonText}>إضافة</Text>
          </TouchableOpacity>
        )}
      </View>

      <CardSurface>
        <View style={styles.content}>
          {hasChildren ? (
            <ScrollView style={styles.childrenList}>
              {renderGroupedChildren()}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#8A8A8E" />
              <Text style={styles.emptyText}>لا يوجد أبناء</Text>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.emptyAddButton}
                  onPress={() => setShowQuickAdd(true)}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#007AFF"
                  />
                  <Text style={styles.emptyAddText}>إضافة أبناء</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </CardSurface>

      {/* Quick Add Overlay */}
      <QuickAddOverlay
        visible={showQuickAdd}
        onClose={() => {
          setShowQuickAdd(false);
          loadChildren(); // Reload after adding
        }}
        parentNode={profile}
        siblings={
          Array.isArray(children)
            ? children
            : Object.values(children).flatMap((g) => g.children)
        }
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        visible={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setDeleteTarget(null);
          setDeleteImpact(null);
        }}
        target={deleteTarget}
        impact={deleteImpact}
        loading={loadingImpact}
        onConfirm={confirmDelete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontFamily: "SF Arabic Regular",
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  childrenList: {
    maxHeight: 400,
  },
  motherGroup: {
    marginBottom: 20,
  },
  motherHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  motherName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  motherChildCount: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  childInfo: {
    flex: 1,
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  childName: {
    fontSize: 17,
    color: "#000000",
    fontFamily: "SF Arabic Regular",
  },
  childBadges: {
    flexDirection: "row",
    gap: 6,
  },
  genderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  maleBadge: {
    backgroundColor: "#E3F2FD",
  },
  femaleBadge: {
    backgroundColor: "#FCE4EC",
  },
  deceasedBadge: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deceasedText: {
    fontSize: 11,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  childMeta: {
    fontSize: 14,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  childActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F7F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    backgroundColor: "#FFF5F5",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    color: "#8A8A8E",
    fontFamily: "SF Arabic Regular",
  },
  emptyAddButton: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F0F9FF",
    borderRadius: 20,
  },
  emptyAddText: {
    fontSize: 15,
    color: "#007AFF",
    fontFamily: "SF Arabic Regular",
  },
});

export default ChildrenManager;
