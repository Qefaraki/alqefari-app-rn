import React, { useState, useEffect, useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#242121CC", // Sadu Night 80%
  textMuted: "#24212199", // Sadu Night 60%
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  accent: "#957EB5", // Lavender Haze
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  whatsapp: "#25D366",
  inputBg: "rgba(209, 187, 163, 0.1)", // Container 10%
  inputBorder: "rgba(209, 187, 163, 0.4)", // Container 40%
};

// Status badge colors
const statusColors = {
  pending: colors.warning,
  reviewing: colors.accent,
  approved: colors.success,
  rejected: colors.error,
};

// Status labels in Arabic
const statusLabels = {
  pending: "قيد الانتظار",
  reviewing: "قيد المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
};

// Request card component - memoized for performance
const RequestCard = memo(
  ({ request, onApprove, onReject, onReview, onWhatsApp }) => {
    const statusColor = statusColors[request.status] || colors.textMuted;

    const formattedDate = new Date(request.created_at).toLocaleDateString(
      "ar-SA",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    return (
      <View style={styles.card}>
        {/* Header with status badge */}
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "20" },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabels[request.status]}
            </Text>
          </View>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        {/* Request details */}
        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.textMuted}
            />
            <Text style={styles.detailLabel}>الاسم:</Text>
            <Text style={styles.detailValue}>{request.name_chain}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} />
            <Text style={styles.detailLabel}>الهاتف:</Text>
            <Text style={styles.detailValue}>{request.phone_number}</Text>
          </View>

          {request.additional_info && (
            <View style={[styles.detailRow, styles.infoRow]}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.textMuted}
              />
              <Text style={styles.detailLabel}>معلومات إضافية:</Text>
            </View>
          )}
          {request.additional_info && (
            <Text style={styles.additionalInfo}>{request.additional_info}</Text>
          )}

          {request.admin_notes && (
            <>
              <View style={[styles.detailRow, styles.infoRow]}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.detailLabel, { color: colors.primary }]}>
                  ملاحظات المشرف:
                </Text>
              </View>
              <Text style={[styles.additionalInfo, styles.adminNotes]}>
                {request.admin_notes}
              </Text>
            </>
          )}
        </View>

        {/* Action buttons */}
        {request.status === "pending" && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.whatsappButton]}
              onPress={() => onWhatsApp(request)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>واتساب</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.reviewButton]}
              onPress={() => onReview(request)}
            >
              <Ionicons name="eye-outline" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>مراجعة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => onApprove(request)}
            >
              <Ionicons name="checkmark" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>موافقة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => onReject(request)}
            >
              <Ionicons name="close" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>رفض</Text>
            </TouchableOpacity>
          </View>
        )}

        {request.status === "reviewing" && (
          <View style={styles.reviewingBanner}>
            <Ionicons name="time-outline" size={16} color={colors.accent} />
            <Text style={styles.reviewingText}>
              يتم مراجعة هذا الطلب حالياً
              {request.reviewed_by && " بواسطة مشرف آخر"}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

export default function ProfileCreationRequests({ onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("pending"); // pending, all, approved, rejected

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from("profile_creation_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      Alert.alert("خطأ", "فشل في تحميل الطلبات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [filter]);

  const handleWhatsApp = (request) => {
    const message = encodeURIComponent(
      `السلام عليكم\n\nبخصوص طلبك لإضافة ملفك الشخصي:\nالاسم: ${request.name_chain}\n\nنود التحقق من بعض المعلومات...`,
    );
    const url = `whatsapp://send?phone=${request.phone_number}&text=${message}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert("خطأ", "WhatsApp غير مثبت على هذا الجهاز");
        }
      })
      .catch((err) => console.error("Error opening WhatsApp:", err));
  };

  const handleReview = async (request) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("profile_creation_requests")
        .update({
          status: "reviewing",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("تم", "تم وضع الطلب قيد المراجعة");
      fetchRequests();
    } catch (error) {
      console.error("Error updating request:", error);
      Alert.alert("خطأ", "فشل في تحديث حالة الطلب");
    }
  };

  const handleApprove = (request) => {
    Alert.alert(
      "موافقة على الطلب",
      `هل تريد الموافقة على طلب ${request.name_chain}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "موافقة",
          style: "default",
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              // Update request status
              const { error } = await supabase
                .from("profile_creation_requests")
                .update({
                  status: "approved",
                  reviewed_by: user.id,
                  reviewed_at: new Date().toISOString(),
                  admin_notes: "تمت الموافقة وإنشاء الملف الشخصي",
                })
                .eq("id", request.id);

              if (error) throw error;

              // TODO: Create the actual profile in the profiles table

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("تم", "تمت الموافقة على الطلب");
              fetchRequests();
            } catch (error) {
              console.error("Error approving request:", error);
              Alert.alert("خطأ", "فشل في الموافقة على الطلب");
            }
          },
        },
      ],
    );
  };

  const handleReject = (request) => {
    // Since Alert.prompt is iOS only, use a simple confirmation
    Alert.alert("رفض الطلب", `هل تريد رفض طلب ${request.name_chain}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "رفض",
        style: "destructive",
        onPress: async () => {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
              Alert.alert("خطأ", "يجب تسجيل الدخول كمشرف");
              return;
            }

            // Verify admin status
            const { data: adminData } = await supabase
              .from("admins")
              .select("id")
              .eq("user_id", user.id)
              .single();

            if (!adminData) {
              Alert.alert("خطأ", "ليس لديك صلاحيات المشرف");
              return;
            }

            const { error } = await supabase
              .from("profile_creation_requests")
              .update({
                status: "rejected",
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
                admin_notes: "تم الرفض من قبل المشرف",
              })
              .eq("id", request.id);

            if (error) throw error;

            Haptics.notificationAsync(Haptics.notificationFeedbackType.Warning);
            Alert.alert("تم", "تم رفض الطلب");
            fetchRequests();
          } catch (error) {
            console.error("Error rejecting request:", error);
            Alert.alert("خطأ", "فشل في رفض الطلب");
          }
        },
      },
    ]);
  };

  const renderRequest = ({ item }) => (
    <RequestCard
      request={item}
      onApprove={handleApprove}
      onReject={handleReject}
      onReview={handleReview}
      onWhatsApp={handleWhatsApp}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open-outline" size={64} color={colors.textMuted} />
      <Text style={styles.emptyStateText}>
        لا توجد طلبات {filter !== "all" ? statusLabels[filter] : ""}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>طلبات إنشاء الملفات</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "pending" && styles.filterTabActive,
          ]}
          onPress={() => setFilter("pending")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "pending" && styles.filterTabTextActive,
            ]}
          >
            قيد الانتظار
          </Text>
          {requests.filter((r) => r.status === "pending").length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {requests.filter((r) => r.status === "pending").length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "reviewing" && styles.filterTabActive,
          ]}
          onPress={() => setFilter("reviewing")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "reviewing" && styles.filterTabTextActive,
            ]}
          >
            قيد المراجعة
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === "all" && styles.filterTabActive]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === "all" && styles.filterTabTextActive,
            ]}
          >
            الكل
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },

  // Filter tabs
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  filterTabTextActive: {
    color: "#FFF",
  },
  badge: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },

  // Request card
  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBg,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  dateText: {
    fontSize: 11,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
  },

  cardBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  infoRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  additionalInfo: {
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
    paddingLeft: 26,
  },
  adminNotes: {
    backgroundColor: colors.inputBg,
    padding: 8,
    borderRadius: 6,
    marginLeft: 0,
  },

  // Action buttons
  cardActions: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.inputBg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#FFF",
  },
  whatsappButton: {
    backgroundColor: colors.whatsapp,
  },
  reviewButton: {
    backgroundColor: colors.accent,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },

  // Reviewing banner
  reviewingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: colors.accent + "10",
    borderTopWidth: 1,
    borderTopColor: colors.accent + "30",
  },
  reviewingText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "SF Arabic",
    color: colors.accent,
  },

  // Loading & empty states
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: "SF Arabic",
    color: colors.textMuted,
    marginTop: 16,
  },
});
