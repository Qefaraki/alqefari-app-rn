import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";

// Najdi Sadu palette
const colors = {
  background: "#F9F7F3",
  white: "#FFFFFF",
  text: "#242121",
  textMuted: "#736372",
  primary: "#A13333",
  secondary: "#D58C4A",
  error: "#A13333",
};

/**
 * BranchList Component
 *
 * Displays and manages all branches assigned to a branch moderator.
 * Shows branch name, HID, assignment date, and allows removal.
 *
 * Props:
 * - userId: string (UUID) - The moderator's user ID
 * - onBranchRemoved: () => void - Called after successful removal
 * - style: ViewStyle - Optional container style
 */
const BranchList = ({ userId, onBranchRemoved, style }) => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null); // HID being removed

  useEffect(() => {
    if (userId) {
      loadBranches();
    }
  }, [userId]);

  const loadBranches = async () => {
    try {
      setLoading(true);

      // Get all active branch assignments for this user
      const { data: assignments, error: assignError } = await supabase
        .from("branch_moderators")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("assigned_at", { ascending: false });

      if (assignError) throw assignError;

      if (!assignments || assignments.length === 0) {
        setBranches([]);
        return;
      }

      // Get profile names for each branch HID
      const branchHids = assignments.map((a) => a.branch_hid);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("hid, name")
        .in("hid", branchHids);

      if (profileError) throw profileError;

      // Create a map of HID -> name
      const hidToName = {};
      (profiles || []).forEach((p) => {
        hidToName[p.hid] = p.name;
      });

      // Merge assignment data with profile names
      const enrichedBranches = assignments.map((assignment) => ({
        ...assignment,
        branch_name: hidToName[assignment.branch_hid] || "غير معروف",
      }));

      setBranches(enrichedBranches);
    } catch (error) {
      console.error("Error loading branches:", error);
      Alert.alert("خطأ", "فشل تحميل الفروع المُدارة");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBranch = async (branch) => {
    Alert.alert(
      "إزالة الفرع",
      `هل تريد إزالة إشراف هذا المستخدم على فرع:\n\n${branch.branch_name}\nHID: ${branch.branch_hid}`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "إزالة",
          style: "destructive",
          onPress: async () => {
            try {
              setRemoving(branch.branch_hid);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

              const { error } = await supabase.rpc(
                "super_admin_remove_branch_moderator",
                {
                  p_user_id: userId,
                  p_branch_hid: branch.branch_hid,
                }
              );

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("نجح", "تم إزالة الفرع بنجاح");

              // Refresh list
              await loadBranches();

              // Notify parent
              if (onBranchRemoved) {
                onBranchRemoved();
              }
            } catch (error) {
              console.error("Error removing branch:", error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("خطأ", error.message || "فشل إزالة الفرع");
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  if (branches.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="git-branch-outline" size={32} color={`${colors.textMuted  }60`} />
          <Text style={styles.emptyText}>لا توجد فروع مُدارة</Text>
          <Text style={styles.emptySubtext}>
            لم يتم تعيين أي فروع لهذا المستخدم بعد
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Ionicons name="git-branch" size={20} color={colors.secondary} />
        <Text style={styles.headerText}>الفروع المُدارة ({branches.length})</Text>
      </View>

      {branches.map((branch, index) => (
        <View
          key={branch.id}
          style={[
            styles.branchCard,
            index === branches.length - 1 && styles.branchCardLast,
          ]}
        >
          <View style={styles.branchInfo}>
            <Text style={styles.branchName} numberOfLines={1}>
              {branch.branch_name}
            </Text>

            <View style={styles.branchMeta}>
              <View style={styles.hidBadge}>
                <Text style={styles.hidText}>{branch.branch_hid}</Text>
              </View>
              <Text style={styles.dateText}>
                تم التعيين: {formatDate(branch.assigned_at)}
              </Text>
            </View>

            {branch.notes && (
              <Text style={styles.notesText} numberOfLines={2}>
                ملاحظات: {branch.notes}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.removeButton,
              removing === branch.branch_hid && styles.removeButtonDisabled,
            ]}
            onPress={() => handleRemoveBranch(branch)}
            disabled={removing === branch.branch_hid}
          >
            {removing === branch.branch_hid ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Loading State
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Empty State
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },

  // Branch Cards
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.background,
  },
  branchCardLast: {
    marginBottom: 16,
  },
  branchInfo: {
    flex: 1,
    marginRight: 12,
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
    fontFamily: "SF Arabic",
  },
  branchMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  hidBadge: {
    backgroundColor: `${colors.secondary  }15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hidText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.secondary,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },
  notesText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 4,
    fontFamily: "SF Arabic",
  },

  // Remove Button
  removeButton: {
    width: 44,  // iOS minimum touch target
    height: 44,  // iOS minimum touch target
    borderRadius: 22,
    backgroundColor: `${colors.error  }10`,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
});

export default BranchList;
