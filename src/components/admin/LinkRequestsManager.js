import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";
import * as Haptics from "expo-haptics";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3",
  container: "#D1BBA3",
  text: "#242121",
  primary: "#A13333",
  secondary: "#D58C4A",
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FFC107",
  white: "#FFFFFF",
};

const LinkRequestsManager = ({ onClose }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [treeContexts, setTreeContexts] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPendingRequests();
    subscribeToRequests();

    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    return () => {
      // Cleanup subscription
    };
  }, []);

  const loadPendingRequests = async () => {
    try {
      // Get all pending requests with profile and user info
      const { data, error } = await supabase
        .from("profile_link_requests")
        .select(
          `
          *,
          profiles!profile_link_requests_profile_id_fkey (
            id,
            name,
            hid,
            generation,
            father_id,
            gender,
            status
          )
        `,
        )
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by status
      const grouped = {
        pending: [],
        approved: [],
        rejected: [],
      };

      data?.forEach((request) => {
        grouped[request.status].push(request);
      });

      setRequests(grouped);
    } catch (error) {
      console.error("Error loading requests:", error);
      Alert.alert("خطأ", "فشل تحميل الطلبات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToRequests = () => {
    const subscription = supabase
      .channel("admin-link-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile_link_requests",
        },
        () => {
          // Reload when any request changes
          loadPendingRequests();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadTreeContext = async (profileId) => {
    if (treeContexts[profileId]) return;

    try {
      const result = await phoneAuthService.getProfileTreeContext(profileId);
      if (result.success) {
        setTreeContexts((prev) => ({
          ...prev,
          [profileId]: result.context,
        }));
      }
    } catch (error) {
      console.error("Error loading tree context:", error);
    }
  };

  const handleApprove = async (request) => {
    Alert.alert(
      "تأكيد الموافقة",
      `هل تريد الموافقة على ربط "${request.profiles.name}" بهذا الحساب؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "موافقة",
          style: "default",
          onPress: async () => {
            try {
              // Update profile to link with user
              const { error: profileError } = await supabase
                .from("profiles")
                .update({
                  user_id: request.user_id,
                  phone: request.phone,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", request.profile_id);

              if (profileError) throw profileError;

              // Update request status
              const { error: requestError } = await supabase
                .from("profile_link_requests")
                .update({
                  status: "approved",
                  reviewed_at: new Date().toISOString(),
                })
                .eq("id", request.id);

              if (requestError) throw requestError;

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("نجح", "تمت الموافقة على الطلب");
              loadPendingRequests();
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
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert("خطأ", "يرجى كتابة سبب الرفض");
      return;
    }

    try {
      const { error } = await supabase
        .from("profile_link_requests")
        .update({
          status: "rejected",
          review_notes: rejectReason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تم", "تم رفض الطلب");
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedRequest(null);
      loadPendingRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      Alert.alert("خطأ", "فشل في رفض الطلب");
    }
  };

  const openWhatsApp = (phone) => {
    const message = encodeURIComponent(
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة...",
    );
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح WhatsApp");
    });
  };

  const toggleExpanded = (requestId) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);

    // Load tree context when expanding
    const request = [
      ...requests.pending,
      ...requests.approved,
      ...requests.rejected,
    ].find((r) => r.id === requestId);

    if (request && !treeContexts[request.profile_id]) {
      loadTreeContext(request.profile_id);
    }
  };

  const renderTreeContext = (context) => {
    if (!context) return null;

    return (
      <View style={styles.contextContainer}>
        <Text style={styles.contextTitle}>السياق العائلي</Text>

        {context.lineage && context.lineage.length > 0 && (
          <View style={styles.contextSection}>
            <Text style={styles.contextLabel}>السلسلة النسبية:</Text>
            {context.lineage.map((ancestor, index) => (
              <Text key={ancestor.id} style={styles.contextValue}>
                {Array(index + 1)
                  .fill("  ")
                  .join("")}
                ← {ancestor.name} (الجيل {ancestor.generation})
              </Text>
            ))}
          </View>
        )}

        {context.siblings && context.siblings.length > 0 && (
          <View style={styles.contextSection}>
            <Text style={styles.contextLabel}>
              الإخوة ({context.siblings.length}):
            </Text>
            <Text style={styles.contextValue}>
              {context.siblings.map((s) => s.name).join("، ")}
            </Text>
          </View>
        )}

        {context.children_count > 0 && (
          <View style={styles.contextSection}>
            <Text style={styles.contextLabel}>عدد الأبناء:</Text>
            <Text style={styles.contextValue}>{context.children_count}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderRequest = (request, status) => {
    const isExpanded = expandedRequest === request.id;
    const context = treeContexts[request.profile_id];

    return (
      <Animated.View
        key={request.id}
        style={[
          styles.requestCard,
          status === "approved" && styles.approvedCard,
          status === "rejected" && styles.rejectedCard,
          { opacity: fadeAnim },
        ]}
      >
        <TouchableOpacity
          style={styles.requestHeader}
          onPress={() => toggleExpanded(request.id)}
        >
          <View style={styles.requestInfo}>
            <View style={styles.profileBadge}>
              <Ionicons name="person" size={20} color={colors.white} />
            </View>
            <View style={styles.requestText}>
              <Text style={styles.profileName}>
                {request.profiles?.name || "غير معروف"}
              </Text>
              <Text style={styles.requestMeta}>
                الجيل {request.profiles?.generation} • {request.profiles?.hid}
              </Text>
              <Text style={styles.nameChain}>
                الاسم المدخل: {request.name_chain}
              </Text>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.requestDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="call" size={16} color={colors.text} />
              <Text style={styles.detailText}>
                {request.phone || "غير متوفر"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color={colors.text} />
              <Text style={styles.detailText}>
                {new Date(request.created_at).toLocaleDateString("ar-SA")}
              </Text>
            </View>

            {status === "rejected" && request.review_notes && (
              <View style={styles.rejectionReason}>
                <Text style={styles.rejectionLabel}>سبب الرفض:</Text>
                <Text style={styles.rejectionText}>{request.review_notes}</Text>
              </View>
            )}

            {context && renderTreeContext(context)}

            {status === "pending" && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleApprove(request)}
                >
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                  <Text style={styles.actionText}>موافقة</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReject(request)}
                >
                  <Ionicons name="close" size={18} color={colors.white} />
                  <Text style={styles.actionText}>رفض</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.whatsappButton]}
                  onPress={() => openWhatsApp(request.phone)}
                >
                  <Ionicons
                    name="logo-whatsapp"
                    size={18}
                    color={colors.white}
                  />
                  <Text style={styles.actionText}>واتساب</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  const renderSection = (title, data, status, icon, color) => {
    if (!data || data.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={20} color={color} />
          <Text style={styles.sectionTitle}>
            {title} ({data.length})
          </Text>
        </View>
        {data.map((request) => renderRequest(request, status))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>طلبات ربط الملفات</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جارٍ التحميل...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>طلبات ربط الملفات</Text>
        <TouchableOpacity onPress={loadPendingRequests}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPendingRequests();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {renderSection(
          "في انتظار المراجعة",
          requests.pending,
          "pending",
          "time-outline",
          colors.warning,
        )}

        {renderSection(
          "طلبات موافق عليها",
          requests.approved,
          "approved",
          "checkmark-circle-outline",
          colors.success,
        )}

        {renderSection(
          "طلبات مرفوضة",
          requests.rejected,
          "rejected",
          "close-circle-outline",
          colors.error,
        )}

        {!requests.pending?.length &&
          !requests.approved?.length &&
          !requests.rejected?.length && (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={64}
                color={colors.text + "40"}
              />
              <Text style={styles.emptyText}>لا توجد طلبات</Text>
            </View>
          )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>سبب الرفض</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="اكتب سبب رفض الطلب..."
              placeholderTextColor={colors.text + "60"}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmReject}
              >
                <Text style={styles.confirmText}>تأكيد الرفض</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "40",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.container + "20",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginLeft: 8,
  },
  requestCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.container + "40",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  approvedCard: {
    borderColor: colors.success + "40",
    backgroundColor: colors.success + "05",
  },
  rejectedCard: {
    borderColor: colors.error + "40",
    backgroundColor: colors.error + "05",
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  requestInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  requestText: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  requestMeta: {
    fontSize: 13,
    color: colors.text + "99",
    fontFamily: "SF Arabic",
  },
  nameChain: {
    fontSize: 12,
    color: colors.secondary,
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  requestDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  detailText: {
    fontSize: 14,
    color: colors.text + "CC",
    fontFamily: "SF Arabic",
    marginLeft: 8,
  },
  rejectionReason: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.error + "10",
    borderRadius: 8,
  },
  rejectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.error,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  contextContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 12,
  },
  contextSection: {
    marginBottom: 12,
  },
  contextLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text + "CC",
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 13,
    color: colors.text + "99",
    fontFamily: "SF Arabic",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: "center",
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  whatsappButton: {
    backgroundColor: "#25D366",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.text + "99",
    fontFamily: "SF Arabic",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text + "60",
    fontFamily: "SF Arabic",
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.container + "60",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
    minHeight: 100,
    textAlign: "right",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: colors.container + "40",
  },
  confirmButton: {
    backgroundColor: colors.error,
  },
  cancelText: {
    fontSize: 16,
    color: colors.text,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  confirmText: {
    fontSize: 16,
    color: colors.white,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
});

export default LinkRequestsManager;
