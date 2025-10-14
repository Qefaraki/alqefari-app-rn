import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import suggestionService from "../../services/suggestionService";
import * as Haptics from "expo-haptics";

// Najdi Sadu Design System Colors
const COLORS = {
  background: "#F9F7F3",
  container: "#D1BBA3",
  text: "#242121",
  primary: "#A13333",
  secondary: "#D58C4A",
  textLight: "#24212199",
  textMedium: "#242121CC",
  success: "#22C55E",
  error: "#EF4444",
  warning: "#F59E0B",
};

const SuggestionReviewManager = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    loadSuggestions();
    loadStats();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from("profile_edit_suggestions")
        .select("status", { count: "exact" });

      if (!error && data) {
        const counts = {
          pending: 0,
          approved: 0,
          rejected: 0,
        };

        data.forEach((item) => {
          if (counts[item.status] !== undefined) {
            counts[item.status]++;
          }
        });

        setStats(counts);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const query = supabase
        .from("profile_edit_suggestions")
        .select(
          `
          *,
          profile:profile_id(id, name, hid),
          suggester:submitter_id(id, name)
        `
        )
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query.eq("status", activeTab);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setSuggestions(data || []);
    } catch (error) {
      console.error("Error loading suggestions:", error);
      Alert.alert("خطأ", "فشل في تحميل الاقتراحات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (suggestion) => {
    try {
      await suggestionService.approveSuggestion(suggestion.id);

      Alert.alert("نجاح", "تم قبول الاقتراح وتطبيقه");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadSuggestions();
      loadStats();
    } catch (error) {
      console.error("Error approving suggestion:", error);
      Alert.alert("خطأ", "فشل في قبول الاقتراح");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleReject = async (suggestion, reason) => {
    try {
      await suggestionService.rejectSuggestion(
        suggestion.id,
        reason || "لا يتوافق مع البيانات المؤكدة"
      );

      Alert.alert("تم", "تم رفض الاقتراح");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadSuggestions();
      loadStats();
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
      Alert.alert("خطأ", "فشل في رفض الاقتراح");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const confirmApprove = (suggestion) => {
    Alert.alert(
      "تأكيد القبول",
      `هل تريد قبول تغيير "${getFieldLabel(suggestion.field_name)}" من "${
        suggestion.old_value ?? "فارغ"
      }" إلى "${suggestion.new_value ?? ""}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "قبول",
          style: "default",
          onPress: () => handleApprove(suggestion),
        },
      ]
    );
  };

  const confirmReject = (suggestion) => {
    Alert.alert(
      "تأكيد الرفض",
      "هل تريد رفض هذا الاقتراح؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "رفض",
          style: "destructive",
          onPress: () => handleReject(suggestion),
        },
      ]
    );
  };

  const getFieldLabel = (field) => {
    const labels = {
      name: "الاسم",
      bio: "السيرة الذاتية",
      phone: "رقم الهاتف",
      email: "البريد الإلكتروني",
      current_residence: "مكان الإقامة",
      occupation: "المهنة",
      education: "التعليم",
    };
    return labels[field] || field;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return COLORS.success;
      case "rejected":
        return COLORS.error;
      case "pending":
        return COLORS.warning;
      default:
        return COLORS.textMedium;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "approved":
        return "مقبول";
      case "rejected":
        return "مرفوض";
      case "pending":
        return "قيد المراجعة";
      default:
        return status;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return "checkmark-circle";
      case "rejected":
        return "close-circle";
      case "pending":
        return "time-outline";
      default:
        return "help-circle-outline";
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "approved":
        return styles.statusBadgeApproved;
      case "rejected":
        return styles.statusBadgeRejected;
      case "pending":
        return styles.statusBadgePending;
      default:
        return {};
    }
  };

  const getStatusTextStyle = (status) => {
    switch (status) {
      case "approved":
        return styles.statusTextApproved;
      case "rejected":
        return styles.statusTextRejected;
      case "pending":
        return styles.statusTextPending;
      default:
        return {};
    }
  };

  const renderSuggestion = ({ item: suggestion }) => (
    <Pressable style={styles.card}>
      {/* Inline header */}
      <View style={styles.headerRow}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {suggestion.profile?.name || "غير معروف"}{" "}
            {suggestion.profile?.hid && (
              <Text style={styles.profileHID}>#{suggestion.profile.hid}</Text>
            )}
          </Text>
        </View>
        <View style={[styles.statusBadge, getStatusBadgeStyle(suggestion.status)]}>
          <Ionicons
            name={getStatusIcon(suggestion.status)}
            size={14}
            color={getStatusColor(suggestion.status)}
          />
          <Text style={[styles.statusText, getStatusTextStyle(suggestion.status)]}>
            {getStatusLabel(suggestion.status)}
          </Text>
        </View>
      </View>

      {/* Inline diff */}
      <View style={styles.diffRow}>
        <Text style={styles.fieldLabel}>{getFieldLabel(suggestion.field_name)}:</Text>
        <View style={styles.diffValues}>
          <Text style={styles.valueOld} numberOfLines={1}>
            {suggestion.old_value ?? "فارغ"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.textLight} style={styles.arrowIcon} />
          <Text style={styles.valueNew} numberOfLines={1}>
            {suggestion.new_value}
          </Text>
        </View>
      </View>

      {/* Collapsible reason */}
      {suggestion.reason && (
        <Text style={styles.reasonText} numberOfLines={2}>
          السبب: {suggestion.reason}
        </Text>
      )}

      {/* Auto-approval timer */}
      {suggestion.status === "pending" && suggestion.permission_level === "family" && (
        <View style={styles.timerRow}>
          <Ionicons name="timer-outline" size={14} color={COLORS.secondary} />
          <Text style={styles.timerText}>
            موافقة تلقائية خلال: {suggestionService.getAutoApprovalTimeRemaining(suggestion.created_at)}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footerRow}>
        <Text style={styles.timestampText}>
          اقترح بواسطة: {suggestion.suggester?.name || "غير معروف"}
        </Text>
        <Text style={styles.dateText}>
          {new Date(suggestion.created_at).toLocaleDateString("ar-SA")}
        </Text>
      </View>

      {/* Action buttons (only for pending) */}
      {suggestion.status === "pending" && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => confirmReject(suggestion)}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.error} />
            <Text style={[styles.actionText, { color: COLORS.error }]}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => confirmApprove(suggestion)}
          >
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={[styles.actionText, { color: COLORS.success }]}>قبول</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rejection reason for rejected suggestions */}
      {suggestion.status === "rejected" && suggestion.rejection_reason && (
        <View style={styles.rejectionSection}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.error} />
          <Text style={styles.rejectionReason}>
            سبب الرفض: {suggestion.rejection_reason}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "pending" && styles.activeTab]}
          onPress={() => setActiveTab("pending")}
        >
          <Text
            style={[styles.tabText, activeTab === "pending" && styles.activeTabText]}
          >
            قيد المراجعة ({stats.pending})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "approved" && styles.activeTab]}
          onPress={() => setActiveTab("approved")}
        >
          <Text
            style={[styles.tabText, activeTab === "approved" && styles.activeTabText]}
          >
            مقبول ({stats.approved})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "rejected" && styles.activeTab]}
          onPress={() => setActiveTab("rejected")}
        >
          <Text
            style={[styles.tabText, activeTab === "rejected" && styles.activeTabText]}
          >
            مرفوض ({stats.rejected})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          renderItem={renderSuggestion}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadSuggestions();
              }}
              tintColor={COLORS.primary}
            />
          }
          getItemLayout={(data, index) => ({
            length: 140,
            offset: 140 * index + 12 * index,
            index,
          })}
          windowSize={5}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyText}>لا توجد اقتراحات</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.container + "40",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textMedium,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  profileInfo: {
    flex: 1,
    marginRight: 8,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  profileHID: {
    fontSize: 13,
    color: COLORS.textMedium,
    fontWeight: "400",
  },

  // Status Badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusBadgeApproved: {
    backgroundColor: COLORS.success + "15",
  },
  statusBadgeRejected: {
    backgroundColor: COLORS.error + "15",
  },
  statusBadgePending: {
    backgroundColor: COLORS.warning + "15",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextApproved: {
    color: COLORS.success,
  },
  statusTextRejected: {
    color: COLORS.error,
  },
  statusTextPending: {
    color: COLORS.warning,
  },

  // Diff Row
  diffRow: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMedium,
    marginBottom: 4,
  },
  diffValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  valueOld: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text + '99',
  },
  arrowIcon: {
    marginHorizontal: 4,
  },
  valueNew: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },

  // Reason
  reasonText: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginBottom: 8,
    lineHeight: 18,
  },

  // Timer Row
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.secondary + "15",
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: "500",
    flex: 1,
  },

  // Footer
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.container + "40",
    marginBottom: 8,
  },
  timestampText: {
    fontSize: 11,
    color: COLORS.textMedium,
  },
  dateText: {
    fontSize: 11,
    color: COLORS.textLight,
  },

  // Actions
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 44,
  },
  rejectButton: {
    backgroundColor: COLORS.error + "10",
  },
  approveButton: {
    backgroundColor: COLORS.success + "10",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Rejection Section
  rejectionSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: COLORS.error + "10",
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  rejectionReason: {
    fontSize: 12,
    color: COLORS.error,
    flex: 1,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMedium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textMedium,
  },
});

export default SuggestionReviewManager;
