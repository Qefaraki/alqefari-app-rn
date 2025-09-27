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
  Dimensions,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";
import {
  notifyUserOfApproval,
  notifyUserOfRejection,
} from "../../services/notifications";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Najdi Sadu Color Palette - Matching design system
const colors = {
  background: "#F9F7F3",    // Al-Jass White
  container: "#D1BBA3",      // Camel Hair Beige
  text: "#242121",          // Sadu Night
  primary: "#A13333",       // Najdi Crimson
  secondary: "#D58C4A",     // Desert Ochre
  muted: "#24212199",       // Sadu Night 60%
  success: "#22C55E",
  error: "#EF4444",
  warning: "#D58C4A",       // Using Desert Ochre for pending
  white: "#FFFFFF",
  surface: "#FFFFFF",
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
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    loadPendingRequests();
    subscribeToRequests();

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

              // Send push notification to user
              await notifyUserOfApproval(request.user_id, request.profiles);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

      // Send push notification to user about rejection
      await notifyUserOfRejection(selectedRequest.user_id, rejectReason);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent(
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة...",
    );
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح WhatsApp");
    });
  };

  const toggleExpanded = (requestId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

  const getFullNameWithSurname = (name) => {
    if (!name) return "غير محدد";
    if (name.includes("القفاري")) return name;
    return `${name} القفاري`;
  };

  const renderRequest = (request, status) => {
    const isExpanded = expandedRequest === request.id;
    const context = treeContexts[request.profile_id];

    const statusConfig = {
      pending: { color: colors.warning, icon: "time", label: "قيد المراجعة" },
      approved: { color: colors.success, icon: "checkmark-circle", label: "موافق عليه" },
      rejected: { color: colors.error, icon: "close-circle", label: "مرفوض" },
    };

    const config = statusConfig[status];

    return (
      <Animated.View
        key={request.id}
        style={[
          styles.requestCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Status indicator bar */}
        <View style={[styles.statusBar, { backgroundColor: config.color }]} />

        <TouchableOpacity
          style={styles.requestHeader}
          onPress={() => toggleExpanded(request.id)}
          activeOpacity={0.7}
        >
          <View style={styles.requestInfo}>
            <LinearGradient
              colors={[config.color, config.color + "DD"]}
              style={styles.profileBadge}
            >
              <Ionicons name="person" size={20} color={colors.white} />
            </LinearGradient>

            <View style={styles.requestText}>
              <Text style={styles.profileName}>
                {getFullNameWithSurname(request.profiles?.name || "غير معروف")}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.statusBadge}>
                  <Ionicons name={config.icon} size={12} color={config.color} />
                  <Text style={[styles.statusText, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>
                <Text style={styles.requestMeta}>
                  الجيل {request.profiles?.generation}
                </Text>
              </View>
              {request.name_chain && (
                <Text style={styles.nameChain}>
                  الاسم المدخل: {request.name_chain}
                </Text>
              )}
            </View>
          </View>

          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.muted}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.requestDetails}>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="call" size={14} color={colors.primary} />
                </View>
                <Text style={styles.detailLabel}>الهاتف</Text>
                <Text style={styles.detailValue}>
                  {request.phone || "غير متوفر"}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="time" size={14} color={colors.secondary} />
                </View>
                <Text style={styles.detailLabel}>التاريخ</Text>
                <Text style={styles.detailValue}>
                  {new Date(request.created_at).toLocaleDateString("ar-SA")}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="git-branch" size={14} color={colors.primary} />
                </View>
                <Text style={styles.detailLabel}>الرقم المميز</Text>
                <Text style={styles.detailValue}>
                  {request.profiles?.hid || "غير متوفر"}
                </Text>
              </View>
            </View>

            {status === "rejected" && request.review_notes && (
              <View style={styles.rejectionReason}>
                <Ionicons
                  name="information-circle"
                  size={16}
                  color={colors.error}
                  style={styles.rejectionIcon}
                />
                <View style={styles.rejectionContent}>
                  <Text style={styles.rejectionLabel}>سبب الرفض:</Text>
                  <Text style={styles.rejectionText}>{request.review_notes}</Text>
                </View>
              </View>
            )}

            {context && renderTreeContext(context)}

            {status === "pending" && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApprove(request)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={16} color={colors.success} />
                  <Text style={styles.approveButtonText}>موافقة</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleReject(request)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color={colors.error} />
                  <Text style={styles.rejectButtonText}>رفض</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={() => openWhatsApp(request.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="logo-whatsapp"
                    size={18}
                    color={colors.white}
                  />
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
          <View style={[styles.sectionAccent, { backgroundColor: color }]} />
          <View style={[styles.sectionIconContainer, { backgroundColor: color + "15" }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <Text style={styles.sectionTitle}>
            {title}
          </Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionCount}>{data.length}</Text>
          </View>
        </View>
        <View style={styles.sectionContent}>
          {data.map((request) => renderRequest(request, status))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>طلبات ربط الملفات</Text>
          <View style={{ width: 40 }} />
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>طلبات ربط الملفات</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRefreshing(true);
            loadPendingRequests();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPendingRequests();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
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
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyText}>لا توجد طلبات</Text>
              <Text style={styles.emptySubtext}>
                سيتم عرض طلبات ربط الملفات الجديدة هنا
              </Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setRefreshing(true);
                  loadPendingRequests();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={18} color={colors.white} />
                <Text style={styles.refreshButtonText}>تحديث</Text>
              </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowRejectModal(false);
            setRejectReason("");
          }}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>سبب الرفض</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.modalInput,
                rejectReason && styles.modalInputActive
              ]}
              placeholder="اكتب سبب رفض الطلب..."
              placeholderTextColor={colors.muted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !rejectReason.trim() && styles.confirmButtonDisabled
                ]}
                onPress={confirmReject}
                activeOpacity={0.8}
                disabled={!rejectReason.trim()}
              >
                <Text style={styles.confirmText}>تأكيد الرفض</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "30",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    position: "relative",
  },
  sectionAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: colors.container + "30",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  sectionContent: {
    paddingHorizontal: 16,
  },
  requestCard: {
    backgroundColor: colors.white,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  statusBar: {
    height: 3,
    width: "100%",
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  requestMeta: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },
  nameChain: {
    fontSize: 13,
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
  detailsGrid: {
    flexDirection: "row",
    marginTop: 16,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
    alignItems: "center",
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
    fontFamily: "SF Arabic",
    fontWeight: "500",
  },
  rejectionReason: {
    flexDirection: "row",
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.error + "08",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error + "20",
  },
  rejectionIcon: {
    marginRight: 8,
  },
  rejectionContent: {
    flex: 1,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
    lineHeight: 20,
  },
  contextContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 12,
  },
  contextSection: {
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text + "CC",
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: "SF Arabic",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.success + "15",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success + "30",
    gap: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.success,
    fontFamily: "SF Arabic",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.error + "15",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error + "30",
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.error,
    fontFamily: "SF Arabic",
  },
  whatsappButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginBottom: 24,
    textAlign: "center",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 20,
    gap: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 33, 33, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.container + "40",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    fontFamily: "SF Arabic",
    minHeight: 100,
    textAlign: "right",
    backgroundColor: colors.background,
  },
  modalInputActive: {
    borderColor: colors.primary + "60",
    backgroundColor: colors.white,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.container + "20",
    borderWidth: 1,
    borderColor: colors.container + "40",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.error,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  cancelText: {
    fontSize: 15,
    color: colors.text,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  confirmText: {
    fontSize: 15,
    color: colors.white,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
});

export default LinkRequestsManager;