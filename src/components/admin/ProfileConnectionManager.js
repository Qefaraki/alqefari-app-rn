import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Image,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";

// Design system colors
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  textSecondary: "#24212199", // Sadu Night 60%
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
};

// Desert palette for avatars (from ProfileMatchingScreen)
const DESERT_PALETTE = [
  "#A13333", // Najdi Crimson
  "#D58C4A", // Desert Ochre
  "#957EB5", // Lavender Haze
  "#736372", // Muted Plum
];

// Arabic generation names
const generationNames = [
  "الجيل الأول",
  "الجيل الثاني",
  "الجيل الثالث",
  "الجيل الرابع",
  "الجيل الخامس",
  "الجيل السادس",
  "الجيل السابع",
  "الجيل الثامن",
  "الجيل التاسع",
  "الجيل العاشر",
];

const getGenerationName = (generation) => {
  if (!generation || generation < 1) return "غير محدد";
  return generationNames[generation - 1] || `الجيل ${generation}`;
};

const getInitials = (name) => {
  if (!name) return "؟";
  return name.charAt(0);
};

// Compact request card component
const RequestCard = ({ request, status, onApprove, onReject, onExpand, isExpanded, index }) => {
  const avatarColor = DESERT_PALETTE[index % DESERT_PALETTE.length];
  const profile = request.profiles;

  return (
    <Pressable
      onPress={() => onExpand(request)}
      style={({ pressed }) => [
        styles.requestCard,
        pressed && styles.requestCardPressed,
        status === "pending" && styles.requestCardPending,
      ]}
    >
      <View style={styles.cardContent}>
        {/* Compact Avatar */}
        <View style={styles.avatarContainer}>
          {profile?.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>
                {getInitials(profile?.name)}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Info - Simplified */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {request.name_chain || profile?.name || "غير معروف"}
          </Text>
          <View style={styles.metaContainer}>
            <Text style={[styles.generationBadge, { color: avatarColor }]}>
              {getGenerationName(profile?.generation)}
            </Text>
            {status === "pending" && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.pendingText}>جديد</Text>
              </>
            )}
          </View>
        </View>

        {/* Status Icon */}
        {status === "approved" && (
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        )}
        {status === "rejected" && (
          <Ionicons name="close-circle" size={20} color={colors.error} />
        )}
        {status === "pending" && (
          <View style={styles.chevron}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </View>
        )}
      </View>

      {/* Expanded Actions for Pending */}
      {isExpanded && status === "pending" && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.expandedActions}
        >
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onApprove(request);
            }}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={styles.actionButtonText}>موافقة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReject(request);
            }}
          >
            <Ionicons name="close" size={18} color="#FFF" />
            <Text style={styles.actionButtonText}>رفض</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Pressable>
  );
};

// Tab Button Component
const TabButton = ({ tab, label, count, icon, activeTab, onPress }) => {
  const isActive = activeTab === tab;

  return (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(tab);
      }}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isActive ? colors.primary : colors.textSecondary}
      />
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.badge, isActive && styles.badgeActive]}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function ProfileConnectionManager({ onBack }) {
  const [requests, setRequests] = useState({
    pending: [],
    approved: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [expandedRequest, setExpandedRequest] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadPendingRequests();
    const subscription = subscribeToRequests();
    return () => subscription?.unsubscribe();
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
            generation,
            photo_url,
            gender
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
    return supabase
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
  };

  const handleApprove = async (request) => {
    Alert.alert(
      "تأكيد الموافقة",
      `موافقة على ربط "${request.name_chain || request.profiles?.name}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "موافقة",
          style: "default",
          onPress: async () => {
            try {
              const { error } = await phoneAuthService.approveProfileLink(
                request.id
              );
              if (error) throw error;

              Alert.alert("نجح", "تمت الموافقة على الطلب");
              loadPendingRequests();
            } catch (error) {
              Alert.alert("خطأ", "فشلت الموافقة على الطلب");
            }
          },
        },
      ]
    );
  };

  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedRequest) return;

    try {
      const { error } = await phoneAuthService.rejectProfileLink(
        selectedRequest.id,
        rejectReason
      );
      if (error) throw error;

      Alert.alert("تم", "تم رفض الطلب");
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedRequest(null);
      loadPendingRequests();
    } catch (error) {
      Alert.alert("خطأ", "فشل رفض الطلب");
    }
  };

  const currentRequests = requests[activeTab] || [];

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* iOS-style Header */}
      <View style={styles.header}>
        <Text style={styles.title}>طلبات ربط الملفات</Text>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
          >
            <Ionicons name="chevron-back" size={28} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Compact Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.statNumber}>{requests.pending?.length || 0}</Text>
          <Text style={styles.statLabel}>في الانتظار</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: colors.success }]} />
          <Text style={styles.statNumber}>{requests.approved?.length || 0}</Text>
          <Text style={styles.statLabel}>موافق عليها</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: colors.error }]} />
          <Text style={styles.statNumber}>{requests.rejected?.length || 0}</Text>
          <Text style={styles.statLabel}>مرفوضة</Text>
        </View>
      </View>

      {/* Native Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton
          tab="pending"
          label="في الانتظار"
          count={requests.pending?.length || 0}
          icon="time-outline"
          activeTab={activeTab}
          onPress={setActiveTab}
        />
        <TabButton
          tab="approved"
          label="موافق عليها"
          count={requests.approved?.length || 0}
          icon="checkmark-circle-outline"
          activeTab={activeTab}
          onPress={setActiveTab}
        />
        <TabButton
          tab="rejected"
          label="مرفوضة"
          count={requests.rejected?.length || 0}
          icon="close-circle-outline"
          activeTab={activeTab}
          onPress={setActiveTab}
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
          currentRequests.map((request, index) => (
            <RequestCard
              key={request.id}
              request={request}
              status={activeTab}
              onApprove={handleApprove}
              onReject={handleReject}
              onExpand={(req) => {
                setExpandedRequest(expandedRequest === req.id ? null : req.id);
              }}
              isExpanded={expandedRequest === request.id}
              index={index}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name={
                activeTab === "pending"
                  ? "time-outline"
                  : activeTab === "approved"
                  ? "checkmark-circle-outline"
                  : "close-circle-outline"
              }
              size={48}
              color={colors.textSecondary}
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
            <Text style={styles.modalTitle}>سبب الرفض</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="اكتب سبب رفض الطلب..."
              placeholderTextColor={colors.textSecondary}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              textAlign="right"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmReject}
              >
                <Text style={styles.modalConfirmText}>رفض</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // iOS-style header (matching SettingsPage)
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  backButton: {
    position: "absolute",
    right: 16,
    top: 8,
    padding: 8,
  },

  // Compact stats row
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: "space-around",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Native tab bar
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "20",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 6,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    marginBottom: -1,
  },
  tabLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: colors.textSecondary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
  },
  badgeActive: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 11,
    color: "#FFF",
    fontWeight: "600",
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },

  // Compact request cards (matching ProfileMatchingScreen)
  requestCard: {
    backgroundColor: "#D1BBA310",
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  requestCardPressed: {
    backgroundColor: "#D1BBA320",
    transform: [{ scale: 0.98 }],
  },
  requestCardPending: {
    backgroundColor: "#A1333308",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 64,
  },

  // Compact avatar (40x40 like ProfileMatchingScreen)
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.container + "20",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFF",
  },

  // Profile info - simplified
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    lineHeight: 20,
    marginBottom: 2,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  generationBadge: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },
  metaDot: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.warning,
    fontFamily: "SF Arabic",
  },
  chevron: {
    marginLeft: 8,
  },

  // Expanded actions
  expandedActions: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
    fontFamily: "SF Arabic",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    marginTop: 12,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 20,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    backgroundColor: colors.container + "10",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: "SF Arabic",
    color: colors.text,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.container + "20",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.error,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
    fontFamily: "SF Arabic",
  },
});