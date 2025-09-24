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
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";
import {
  notifyUserOfApproval,
  notifyUserOfRejection,
} from "../../services/notifications";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

// Al-Qefari Design System Colors
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  success: "#D58C4A", // Using Desert Ochre for success
  error: "#A13333", // Using Najdi Crimson for errors
  warning: "#D58C4A", // Desert Ochre for warnings
};

const ProfileConnectionManager = ({ onBack }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [treeContexts, setTreeContexts] = useState({});
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    loadPendingRequests();
    subscribeToRequests();

    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      // Cleanup subscription
    };
  }, []);

  const loadPendingRequests = async () => {
    try {
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
            status,
            photo_url
          )
        `
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
          loadPendingRequests();
        }
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
              // Animate card out
              const cardAnim = new Animated.Value(1);
              Animated.timing(cardAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start();

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

              await notifyUserOfApproval(request.user_id, request.profiles);

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );

              loadPendingRequests();
            } catch (error) {
              console.error("Error approving request:", error);
              Alert.alert("خطأ", "فشل في الموافقة على الطلب");
            }
          },
        },
      ]
    );
  };

  const handleReject = (request) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

      await notifyUserOfRejection(selectedRequest.user_id, rejectReason);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

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
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة..."
    );
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح WhatsApp");
    });
  };

  const renderRequestCard = (request, status) => {
    const isExpanded = expandedRequest === request.id;
    const context = treeContexts[request.profile_id];

    return (
      <Animated.View
        key={request.id}
        style={[
          styles.requestCard,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim }
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => {
            setExpandedRequest(isExpanded ? null : request.id);
            if (!isExpanded && !context) {
              loadTreeContext(request.profile_id);
            }
          }}
          activeOpacity={0.7}
        >
          {/* Profile Image or Avatar */}
          <View style={styles.avatarContainer}>
            {request.profiles?.photo_url ? (
              <Image
                source={{ uri: request.profiles.photo_url }}
                style={styles.avatar}
              />
            ) : (
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {request.profiles?.name?.charAt(0) || "؟"}
                </Text>
              </LinearGradient>
            )}
            {status === "pending" && (
              <View style={styles.statusBadge}>
                <View style={styles.pendingDot} />
              </View>
            )}
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {request.profiles?.name || "غير معروف"}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="git-branch" size={12} color={colors.secondary} />
                <Text style={styles.metaText}>الجيل {request.profiles?.generation}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="barcode" size={12} color={colors.secondary} />
                <Text style={styles.metaText}>{request.profiles?.hid}</Text>
              </View>
            </View>
            {request.name_chain && (
              <Text style={styles.nameChain} numberOfLines={1}>
                {request.name_chain}
              </Text>
            )}
          </View>

          {/* Status Indicator */}
          <View style={styles.statusIndicator}>
            {status === "pending" && (
              <Ionicons name="time" size={20} color={colors.warning} />
            )}
            {status === "approved" && (
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            )}
            {status === "rejected" && (
              <Ionicons name="close-circle" size={20} color={colors.error} />
            )}
          </View>
        </TouchableOpacity>

        {/* Expanded Details */}
        {isExpanded && (
          <Animated.View style={styles.expandedContent}>
            {/* Contact Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Ionicons name="call" size={16} color={colors.secondary} />
                <Text style={styles.infoText}>{request.phone || "غير متوفر"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={16} color={colors.secondary} />
                <Text style={styles.infoText}>
                  {new Date(request.created_at).toLocaleDateString("ar-SA")}
                </Text>
              </View>
            </View>

            {/* Tree Context */}
            {context && (
              <View style={styles.contextSection}>
                <Text style={styles.contextTitle}>السياق العائلي</Text>

                {context.lineage && context.lineage.length > 0 && (
                  <View style={styles.lineageContainer}>
                    {context.lineage.map((ancestor, index) => (
                      <View key={ancestor.id} style={styles.lineageItem}>
                        <View style={styles.lineageIndicator} />
                        <Text style={styles.lineageText}>
                          {ancestor.name} • الجيل {ancestor.generation}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.contextStats}>
                  {context.siblings && context.siblings.length > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{context.siblings.length}</Text>
                      <Text style={styles.statLabel}>إخوة</Text>
                    </View>
                  )}
                  {context.children_count > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{context.children_count}</Text>
                      <Text style={styles.statLabel}>أبناء</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Rejection Reason */}
            {status === "rejected" && request.review_notes && (
              <View style={styles.rejectionSection}>
                <Text style={styles.rejectionLabel}>سبب الرفض</Text>
                <Text style={styles.rejectionText}>{request.review_notes}</Text>
              </View>
            )}

            {/* Action Buttons */}
            {status === "pending" && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleApprove(request)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={20} color={colors.background} />
                  <Text style={styles.approveText}>موافقة</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReject(request)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={20} color={colors.background} />
                  <Text style={styles.rejectText}>رفض</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.contactButton]}
                  onPress={() => openWhatsApp(request.phone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  const TabButton = ({ tab, label, count, icon }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={20}
        color={activeTab === tab ? colors.primary : colors.text + "66"}
      />
      <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabBadge, activeTab === tab && styles.activeTabBadge]}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>طلبات ربط الملفات</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جارٍ تحميل الطلبات...</Text>
        </View>
      </View>
    );
  }

  const currentRequests = requests[activeTab] || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, !onBack && { flex: 1 }]}>طلبات ربط الملفات</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            loadPendingRequests();
          }}
        >
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsContainer}
      >
        <View style={[styles.statCard, styles.pendingCard]}>
          <Ionicons name="time" size={24} color={colors.warning} />
          <Text style={styles.statNumber}>{requests.pending?.length || 0}</Text>
          <Text style={styles.statLabel}>في الانتظار</Text>
        </View>
        <View style={[styles.statCard, styles.approvedCard]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.statNumber}>{requests.approved?.length || 0}</Text>
          <Text style={styles.statLabel}>موافق عليها</Text>
        </View>
        <View style={[styles.statCard, styles.rejectedCard]}>
          <Ionicons name="close-circle" size={24} color={colors.error} />
          <Text style={styles.statNumber}>{requests.rejected?.length || 0}</Text>
          <Text style={styles.statLabel}>مرفوضة</Text>
        </View>
      </ScrollView>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton
          tab="pending"
          label="في الانتظار"
          count={requests.pending?.length || 0}
          icon="time"
        />
        <TabButton
          tab="approved"
          label="موافق عليها"
          count={requests.approved?.length || 0}
          icon="checkmark-circle"
        />
        <TabButton
          tab="rejected"
          label="مرفوضة"
          count={requests.rejected?.length || 0}
          icon="close-circle"
        />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
        {currentRequests.length > 0 ? (
          currentRequests.map((request) =>
            renderRequestCard(request, activeTab)
          )
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={
                activeTab === "pending"
                  ? "time"
                  : activeTab === "approved"
                  ? "checkmark-circle"
                  : "close-circle"
              }
              size={64}
              color={colors.text + "20"}
            />
            <Text style={styles.emptyText}>
              {activeTab === "pending"
                ? "لا توجد طلبات في الانتظار"
                : activeTab === "approved"
                ? "لا توجد طلبات موافق عليها"
                : "لا توجد طلبات مرفوضة"}
            </Text>
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
        <BlurView intensity={95} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>سبب الرفض</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

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
                <LinearGradient
                  colors={[colors.primary, colors.primary + "DD"]}
                  style={styles.gradientButton}
                >
                  <Text style={styles.confirmText}>تأكيد الرفض</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
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
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "20",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.container + "20",
    marginRight: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.container + "20",
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 6,
    alignItems: "center",
    minWidth: 110,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: colors.warning + "40",
    backgroundColor: colors.warning + "08",
  },
  approvedCard: {
    borderWidth: 1,
    borderColor: colors.success + "40",
    backgroundColor: colors.success + "08",
  },
  rejectedCard: {
    borderWidth: 1,
    borderColor: colors.error + "40",
    backgroundColor: colors.error + "08",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text + "99",
    marginTop: 4,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.container + "10",
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "20",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.background,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text + "66",
    marginLeft: 6,
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: colors.text + "20",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  activeTabBadge: {
    backgroundColor: colors.primary + "20",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  requestCard: {
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.container + "30",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.background,
  },
  statusBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.warning,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 10,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metaText: {
    fontSize: 12,
    color: colors.text + "99",
    marginLeft: 4,
  },
  nameChain: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 4,
  },
  statusIndicator: {
    padding: 8,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  infoSection: {
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.text + "CC",
    marginLeft: 8,
  },
  contextSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.container + "10",
    borderRadius: 8,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 12,
  },
  lineageContainer: {
    marginBottom: 12,
  },
  lineageItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  lineageIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
    marginRight: 8,
  },
  lineageText: {
    fontSize: 13,
    color: colors.text + "CC",
  },
  contextStats: {
    flexDirection: "row",
    marginTop: 8,
  },
  statItem: {
    alignItems: "center",
    marginRight: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text + "99",
    marginTop: 2,
  },
  rejectionSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.error + "08",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + "20",
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.error,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  contactButton: {
    backgroundColor: "#25D366",
    flex: 0.3,
  },
  approveText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.background,
    marginLeft: 6,
  },
  rejectText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.background,
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
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text + "60",
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: "90%",
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.container + "60",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlign: "right",
    backgroundColor: colors.container + "10",
  },
  modalActions: {
    flexDirection: "row",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: colors.container + "30",
  },
  confirmButton: {
    overflow: "hidden",
  },
  gradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
  },
  confirmText: {
    fontSize: 16,
    color: colors.background,
    fontWeight: "600",
  },
});

export default ProfileConnectionManager;