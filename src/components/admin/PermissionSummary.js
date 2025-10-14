import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
  separator: "#C6C6C8",
  error: "#A13333",
  success: "#D58C4A",
};

/**
 * PermissionSummary Component
 *
 * Comprehensive panel showing all permission details for a selected user.
 * Displays role, branch assignments, block status, and permission statistics.
 * NOW INCLUDES: Admin action sections (Role, Branch, Block management)
 *
 * Props:
 * - user: object - User data with id, name, role, etc.
 * - onClose: () => void - Called when panel is closed
 * - onRefresh: () => void - Called when data needs refresh
 * - currentUserRole: string - Role of the user viewing this (for permission checks)
 * - onRoleChange: (userId, newRole) => Promise - Callback to change user role
 * - onBranchManage: (user) => void - Callback to manage branch assignments
 * - onBlockToggle: (userId, isBlocked) => Promise - Callback to toggle block status
 */
const PermissionSummary = ({
  user,
  onClose,
  onRefresh,
  currentUserRole,
  onRoleChange,
  onBranchManage,
  onBlockToggle,
}) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id) {
      loadPermissionSummary();
    }
  }, [user?.id]);

  const loadPermissionSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get comprehensive permission summary
      const { data, error: rpcError } = await supabase.rpc(
        "get_user_permissions_summary",
        { p_user_id: user.id }
      );

      if (rpcError) throw rpcError;

      setSummary(data);
    } catch (err) {
      console.error("Error loading permission summary:", err);
      setError(err.message || "فشل تحميل ملخص الصلاحيات");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadPermissionSummary();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ملخص الصلاحيات</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ملخص الصلاحيات</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={20} color={colors.white} />
            <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roleLabels = {
    super_admin: "مشرف عام",
    admin: "مشرف",
    moderator: "مراقب",
    user: "مستخدم",
    null: "مستخدم",
  };

  const roleColors = {
    super_admin: colors.error,
    admin: colors.primary,
    moderator: colors.secondary,
    user: colors.textMuted,
    null: colors.textMuted,
  };

  const userRole = user.role || "user";
  const roleLabel = roleLabels[userRole] || "مستخدم";
  const roleColor = roleColors[userRole] || colors.textMuted;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ملخص الصلاحيات</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <View style={styles.card}>
          <Text style={styles.userChain}>{user.full_name_chain}</Text>

          {/* Role Badge */}
          <View style={styles.badgeContainer}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + "20" }]}>
              <Ionicons name="shield-checkmark" size={14} color={roleColor} />
              <Text style={[styles.roleText, { color: roleColor }]}>
                {roleLabel}
              </Text>
            </View>

            {user.is_blocked && (
              <View style={styles.blockedBadge}>
                <Ionicons name="ban" size={14} color={colors.error} />
                <Text style={styles.blockedText}>محظور من الاقتراحات</Text>
              </View>
            )}
          </View>
        </View>

        {/* Branch Moderator Section */}
        {summary?.moderated_branches?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="git-branch" size={20} color={colors.secondary} />
              <Text style={styles.sectionTitle}>
                الفروع المُدارة ({summary.moderated_branches.length})
              </Text>
            </View>

            {summary.moderated_branches.map((branch, index) => (
              <View key={index} style={styles.branchItem}>
                <View style={styles.branchInfo}>
                  <Text style={styles.branchName}>{branch.branch_name}</Text>
                  <View style={styles.branchMeta}>
                    <View style={styles.hidBadge}>
                      <Text style={styles.hidText}>{branch.branch_hid}</Text>
                    </View>
                    {branch.assigned_at && (
                      <Text style={styles.metaText}>
                        منذ {formatDate(branch.assigned_at)}
                      </Text>
                    )}
                  </View>
                  {branch.notes && (
                    <Text style={styles.notesText} numberOfLines={2}>
                      {branch.notes}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
              </View>
            ))}
          </View>
        )}

        {/* Permission Stats */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>إحصائيات الصلاحيات</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.secondary + "15" }]}>
                <Ionicons name="people" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.statValue}>
                {summary?.total_editable_profiles || 0}
              </Text>
              <Text style={styles.statLabel}>الملفات القابلة للتعديل</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.primary + "15" }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>
                {summary?.pending_suggestions || 0}
              </Text>
              <Text style={styles.statLabel}>الاقتراحات المعلقة</Text>
            </View>
          </View>
        </View>

        {/* Block Status */}
        {user.is_blocked && summary?.block_reason && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={20} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                سبب الحظر
              </Text>
            </View>
            <View style={styles.blockReasonCard}>
              <Text style={styles.blockReasonText}>{summary.block_reason}</Text>
              {summary.blocked_at && (
                <Text style={styles.blockDateText}>
                  تاريخ الحظر: {formatDate(summary.blocked_at)}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Role Management Section - Only for super_admin */}
        {currentUserRole === "super_admin" && userRole !== "super_admin" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>إدارة الصلاحية</Text>
            </View>
            <View style={styles.actionSectionCard}>
              <Text style={styles.actionSectionInfo}>
                الصلاحية الحالية: {roleLabel}
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (onRoleChange) onRoleChange(user.id, user.role);
                }}
              >
                <Text style={styles.primaryButtonText}>تغيير الصلاحية</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Branch Moderation Section - Only for super_admin, not for admin/super_admin users */}
        {currentUserRole === "super_admin" && userRole !== "admin" && userRole !== "super_admin" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="git-branch" size={20} color={colors.secondary} />
              <Text style={styles.sectionTitle}>إدارة الفروع</Text>
            </View>
            <View style={styles.actionSectionCard}>
              {summary?.moderated_branches?.length > 0 ? (
                <>
                  <Text style={styles.actionSectionInfo}>
                    يدير {summary.moderated_branches.length} {summary.moderated_branches.length === 1 ? "فرع" : "فروع"}
                  </Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { flex: 1 }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (onBranchManage) onBranchManage(user);
                      }}
                    >
                      <Ionicons name="eye" size={16} color={colors.primary} />
                      <Text style={styles.secondaryButtonText}>عرض الفروع</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { flex: 1 }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (onBranchManage) onBranchManage(user);
                      }}
                    >
                      <Ionicons name="add" size={16} color={colors.white} />
                      <Text style={styles.primaryButtonText}>إضافة فرع</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.actionSectionInfo}>
                    لم يتم تعيين أي فروع لهذا المستخدم
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (onBranchManage) onBranchManage(user);
                    }}
                  >
                    <Ionicons name="add" size={16} color={colors.white} />
                    <Text style={styles.primaryButtonText}>تعيين كمشرف فرع</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* Block Management Section - Only for super_admin, not for admin/super_admin users (Danger Zone) */}
        {currentUserRole === "super_admin" && userRole !== "admin" && userRole !== "super_admin" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={20} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.error }]}>
                منطقة الخطر
              </Text>
            </View>
            <View style={styles.dangerZoneCard}>
              {user.is_blocked ? (
                <>
                  <Ionicons name="ban" size={32} color={colors.error} style={{ marginBottom: 8 }} />
                  <Text style={styles.dangerZoneTitle}>المستخدم محظور</Text>
                  <Text style={styles.dangerZoneText}>
                    لا يمكن لهذا المستخدم إرسال اقتراحات تعديل
                  </Text>
                  <TouchableOpacity
                    style={styles.unblockButton}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      if (onBlockToggle) onBlockToggle(user.id, true); // true = currently blocked, so unblock
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                    <Text style={styles.unblockButtonText}>إلغاء الحظر</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={32} color={colors.error} style={{ marginBottom: 8 }} />
                  <Text style={styles.dangerZoneTitle}>حظر الاقتراحات</Text>
                  <Text style={styles.dangerZoneText}>
                    منع هذا المستخدم من إرسال اقتراحات تعديل جديدة
                  </Text>
                  <TouchableOpacity
                    style={styles.blockButton}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      if (onBlockToggle) onBlockToggle(user.id, false); // false = not blocked, so block
                    }}
                  >
                    <Ionicons name="ban" size={16} color={colors.white} />
                    <Text style={styles.blockButtonText}>حظر من الاقتراحات</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `${diffDays} أيام`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} أسابيع`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} أشهر`;
  return `${Math.floor(diffDays / 365)} سنة`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator + "40",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
    fontFamily: "SF Arabic",
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // User Info Card
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
    fontFamily: "SF Arabic",
  },
  userChain: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  roleText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  blockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.error + "10",
    gap: 6,
  },
  blockedText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.error,
    fontFamily: "SF Arabic",
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Branch Items
  branchItem: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  branchInfo: {
    flex: 1,
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
    backgroundColor: colors.secondary + "15",
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
  metaText: {
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

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
    fontFamily: "SF Arabic",
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    fontFamily: "SF Arabic",
  },

  // Block Reason
  blockReasonCard: {
    backgroundColor: colors.error + "08",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.error + "20",
  },
  blockReasonText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    fontFamily: "SF Arabic",
  },
  blockDateText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Action Card
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Action Section Cards (Role, Branch, Block)
  actionSectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  actionSectionInfo: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
    fontFamily: "SF Arabic",
  },

  // Button Row
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },

  // Primary Button
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },

  // Secondary Button
  secondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    fontFamily: "SF Arabic",
  },

  // Danger Zone Card
  dangerZoneCard: {
    backgroundColor: colors.error + "08",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.error + "20",
    alignItems: "center",
  },
  dangerZoneTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
    fontFamily: "SF Arabic",
  },
  dangerZoneText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "SF Arabic",
  },

  // Block Button
  blockButton: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  blockButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },

  // Unblock Button
  unblockButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  unblockButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
});

export default PermissionSummary;
