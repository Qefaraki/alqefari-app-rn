import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

  const renderSuggestion = (suggestion) => (
    <View key={suggestion.id} style={styles.suggestionCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {suggestion.profile?.name || "غير معروف"}
          </Text>
          <Text style={styles.profileHID}>#{suggestion.profile?.hid}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(suggestion.status) + "20" },
          ]}
        >
          <Text
            style={[styles.statusText, { color: getStatusColor(suggestion.status) }]}
          >
            {getStatusLabel(suggestion.status)}
          </Text>
        </View>
      </View>

      {/* Field Change */}
      <View style={styles.changeSection}>
        <Text style={styles.fieldLabel}>{getFieldLabel(suggestion.field_name)}</Text>
        <View style={styles.changeValues}>
          <View style={styles.oldValue}>
            <Text style={styles.valueLabel}>من:</Text>
            <Text style={styles.valueText}>
              {suggestion.old_value ?? "فارغ"}
            </Text>
          </View>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={COLORS.textLight}
            style={styles.arrow}
          />
          <View style={styles.newValue}>
            <Text style={styles.valueLabel}>إلى:</Text>
            <Text style={[styles.valueText, styles.newValueText]}>
              {suggestion.new_value ?? ""}
            </Text>
          </View>
        </View>
      </View>

      {/* Reason if provided */}
      {suggestion.reason && (
        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>السبب:</Text>
          <Text style={styles.reasonText}>{suggestion.reason}</Text>
        </View>
      )}

      {/* Auto-approval timer for family circle suggestions */}
      {suggestion.status === "pending" &&
        suggestion.permission_level === "family" && (
          <View style={styles.autoApprovalBanner}>
            <Ionicons
              name="timer-outline"
              size={16}
              color={COLORS.secondary}
            />
            <Text style={styles.autoApprovalText}>
              موافقة تلقائية خلال:{" "}
              {suggestionService.getAutoApprovalTimeRemaining(
                suggestion.created_at
              )}
            </Text>
          </View>
        )}

      {/* Suggester Info */}
      <View style={styles.suggesterSection}>
        <Text style={styles.suggesterText}>
          اقترح بواسطة: {suggestion.suggester?.name || "غير معروف"}
        </Text>
        <Text style={styles.dateText}>
          {new Date(suggestion.created_at).toLocaleDateString("ar-SA")}
        </Text>
      </View>

      {/* Actions for pending suggestions */}
      {suggestion.status === "pending" && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => confirmReject(suggestion)}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.error} />
            <Text style={[styles.actionText, { color: COLORS.error }]}>رفض</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => confirmApprove(suggestion)}
          >
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={[styles.actionText, { color: COLORS.success }]}>قبول</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result for processed suggestions */}
      {suggestion.status !== "pending" && (
        <View style={styles.resultSection}>
          {suggestion.status === "approved" && suggestion.reviewed_by && (
            <Text style={styles.resultText}>
              تم القبول بواسطة المشرف • {new Date(suggestion.reviewed_at).toLocaleDateString("ar-SA")}
            </Text>
          )}
          {suggestion.status === "rejected" && suggestion.rejection_reason && (
            <Text style={styles.rejectionReason}>
              سبب الرفض: {suggestion.rejection_reason}
            </Text>
          )}
        </View>
      )}
    </View>
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
      <ScrollView
        style={styles.scrollView}
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
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyText}>لا توجد اقتراحات</Text>
          </View>
        ) : (
          suggestions.map(renderSuggestion)
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  suggestionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.container + "40",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  profileHID: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  changeSection: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMedium,
    marginBottom: 8,
  },
  changeValues: {
    flexDirection: "row",
    alignItems: "center",
  },
  oldValue: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.container + "10",
    borderRadius: 8,
  },
  arrow: {
    marginHorizontal: 12,
  },
  newValue: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.success + "10",
    borderRadius: 8,
  },
  valueLabel: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 14,
    color: COLORS.text,
  },
  newValueText: {
    fontWeight: "600",
  },
  reasonSection: {
    backgroundColor: COLORS.container + "10",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textMedium,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.text,
  },
  autoApprovalBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.secondary + "15",
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  autoApprovalText: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: "500",
  },
  suggesterSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.container + "40",
  },
  suggesterText: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.container + "40",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
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
  resultSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.container + "40",
  },
  resultText: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontStyle: "italic",
  },
  rejectionReason: {
    fontSize: 12,
    color: COLORS.error,
    fontStyle: "italic",
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
