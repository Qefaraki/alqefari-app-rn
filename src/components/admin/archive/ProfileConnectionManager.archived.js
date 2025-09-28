import React, { useState, useEffect } from "react";
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
  Linking,
  Dimensions,
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
import { buildNameChain } from "../../utils/nameChainBuilder";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Najdi Sadu Design System Colors - Matching ProfileLinkStatusIndicator
const colors = {
  background: "#F9F7F3",    // Al-Jass White
  container: "#D1BBA3",      // Camel Hair Beige
  text: "#242121",          // Sadu Night
  textSecondary: "#24212199", // Sadu Night 60%
  primary: "#A13333",       // Najdi Crimson
  secondary: "#D58C4A",     // Desert Ochre
  muted: "#24212199",       // Sadu Night 60%
  success: "#22C55E",       // Matching ProfileLinkStatusIndicator
  warning: "#D58C4A",       // Desert Ochre for pending
  error: "#EF4444",         // Matching ProfileLinkStatusIndicator
  white: "#FFFFFF",
  surface: "#FFFFFF",
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

// Helper function to get full name chain
const getFullNameChain = (profile, allProfiles = []) => {
  if (!profile) return "غير محدد";

  // Use buildNameChain utility to get the full chain
  const chain = buildNameChain(profile, allProfiles);

  // If we got a chain, ensure it has القفاري
  if (chain && chain !== profile.name) {
    return chain.includes("القفاري") ? chain : `${chain} القفاري`;
  }

  // Fallback to name with surname
  const name = profile.name || "غير محدد";
  return name.includes("القفاري") ? name : `${name} القفاري`;
};

// Compact request card component
const RequestCard = ({ request, status, onApprove, onReject, onWhatsApp, onExpand, isExpanded, index, allProfiles }) => {
  const avatarColor = DESERT_PALETTE[index % DESERT_PALETTE.length];
  const profile = request.profiles;

  const statusConfig = {
    pending: { color: colors.warning, icon: "time", label: "قيد المراجعة" },
    approved: { color: colors.success, icon: "checkmark-circle", label: "موافق عليه" },
    rejected: { color: colors.error, icon: "close-circle", label: "مرفوض" },
  };

  const config = statusConfig[status];

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onExpand(request);
      }}
      style={({ pressed }) => [
        styles.requestCard,
        pressed && styles.requestCardPressed,
      ]}
    >
      {/* Status indicator bar */}
      <View style={[styles.statusBar, { backgroundColor: config.color }]} />

      <View style={styles.cardContent}>
        {/* Compact Avatar */}
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[avatarColor, avatarColor + "DD"]}
            style={styles.avatarGradient}
          >
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarText}>
                {getInitials(profile?.name)}
              </Text>
            )}
          </LinearGradient>
        </View>

        {/* Profile Info - Simplified */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile ? getFullNameChain(profile, allProfiles) : request.name_chain || "غير معروف"}
          </Text>
          <View style={styles.metaContainer}>
            <View style={styles.statusBadge}>
              <Ionicons name={config.icon} size={12} color={config.color} />
              <Text style={[styles.statusText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <Text style={[styles.generationBadge, { color: avatarColor }]}>
              {getGenerationName(profile?.generation)}
            </Text>
          </View>
          {request.phone && (
            <Text style={styles.phoneText}>
              <Ionicons name="call" size={11} color={colors.textSecondary} />
              {" " + request.phone}
            </Text>
          )}
        </View>

        {/* Chevron */}
        <View style={styles.chevron}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </View>

      {/* Expanded Actions for Pending */}
      {isExpanded && status === "pending" && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.expandedActions}
        >
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onApprove(request);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color={colors.success} />
            <Text style={styles.approveButtonText}>موافقة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReject(request);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={16} color={colors.error} />
            <Text style={styles.rejectButtonText}>رفض</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onWhatsApp(request.phone);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={18} color={colors.white} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Rejection reason for rejected */}
      {isExpanded && status === "rejected" && request.review_notes && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.rejectionReason}
        >
          <Ionicons name="information-circle" size={14} color={colors.error} />
          <Text style={styles.rejectionText}>{request.review_notes}</Text>
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
  const [allProfiles, setAllProfiles] = useState([]);

  // Animation values using Reanimated
  const tabIndicatorPosition = useSharedValue(0);

  // Create animated style at top level to maintain hooks order
  const tabIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorPosition.value }],
  }));

  useEffect(() => {
    loadPendingRequests();
    const subscription = subscribeToRequests();
    return () => subscription?.unsubscribe();
  }, []);

  // Update tab indicator position when activeTab changes
  useEffect(() => {
    const tabIndex = activeTab === "pending" ? 0 : activeTab === "approved" ? 1 : 2;
    tabIndicatorPosition.value = withSpring(tabIndex * (SCREEN_WIDTH / 3), {
      damping: 15,
      stiffness: 150,
    });
  }, [activeTab]);

  const loadPendingRequests = async () => {
    try {
      // Load all profiles for name chain building
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, father_id");

      if (profiles) {
        setAllProfiles(profiles);
      }

      const { data, error } = await supabase
        .from("profile_link_requests")
        .select(
          `
          *,
          profiles:profile_id (
            id,
            name,
            father_id,
            generation,
            photo_url,
            gender,
            hid
          )
        `
        )
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading profile link requests:", error);
        throw error;
      }

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
      `موافقة على ربط "${request.profiles ? getFullNameChain(request.profiles, allProfiles) : request.name_chain}"؟`,
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

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    if (!rejectReason.trim()) {
      Alert.alert("خطأ", "يرجى كتابة سبب الرفض");
      return;
    }

    try {
      const { error } = await phoneAuthService.rejectProfileLink(
        selectedRequest.id,
        rejectReason
      );
      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("تم", "تم رفض الطلب");
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedRequest(null);
      loadPendingRequests();
    } catch (error) {
      Alert.alert("خطأ", "فشل رفض الطلب");
    }
  };

  const handleWhatsApp = (phone) => {
    const message = encodeURIComponent(
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة..."
    );
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح WhatsApp");
    });
  };

  const currentRequests = requests[activeTab] || [];

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جارٍ التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View
        entering={FadeIn.duration(400)}
        layout={Layout.springify()}
      >
        {/* Header with gradient */}
        <LinearGradient
          colors={[colors.white, colors.background]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Text style={styles.title}>طلبات ربط الملفات</Text>
            <View style={styles.headerButtons}>
              {onBack && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBack();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
              )}
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
          </View>
        </LinearGradient>

        {/* Enhanced Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.warning + "15" }]}>
              <Ionicons name="time" size={16} color={colors.warning} />
            </View>
            <Text style={styles.statNumber}>{requests.pending?.length || 0}</Text>
            <Text style={styles.statLabel}>في الانتظار</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.success + "15" }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            </View>
            <Text style={styles.statNumber}>{requests.approved?.length || 0}</Text>
            <Text style={styles.statLabel}>موافق عليها</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.error + "15" }]}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
            </View>
            <Text style={styles.statNumber}>{requests.rejected?.length || 0}</Text>
            <Text style={styles.statLabel}>مرفوضة</Text>
          </View>
        </View>

        {/* Native Tab Bar with indicator */}
        <View style={styles.tabBarContainer}>
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
          <Animated.View
            style={[
              styles.tabIndicator,
              tabIndicatorAnimatedStyle,
            ]}
          />
        </View>
      </Animated.View>

      {/* Requests List */}
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
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentRequests.length > 0 ? (
          currentRequests.map((request, index) => (
            <RequestCard
              key={request.id}
              request={request}
              status={activeTab}
              onApprove={handleApprove}
              onReject={handleReject}
              onWhatsApp={handleWhatsApp}
              onExpand={(r) => setExpandedRequest(
                expandedRequest?.id === r.id ? null : r
              )}
              isExpanded={expandedRequest?.id === request.id}
              index={index}
              allProfiles={allProfiles}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyText}>
              {activeTab === "pending"
                ? "لا توجد طلبات في الانتظار"
                : activeTab === "approved"
                ? "لا توجد طلبات موافق عليها"
                : "لا توجد طلبات مرفوضة"}
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

      {/* Rejection Modal */}
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
          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
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
                rejectReason && styles.modalInputActive,
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
                style={styles.modalCancel}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  !rejectReason.trim() && styles.modalConfirmDisabled,
                ]}
                onPress={confirmReject}
                activeOpacity={0.8}
                disabled={!rejectReason.trim()}
              >
                <Text style={styles.modalConfirmText}>تأكيد الرفض</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header styles
  headerGradient: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    flex: 1,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    marginTop: 2,
  },

  // Tab bar styles
  tabBarContainer: {
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: colors.container + "30",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: SCREEN_WIDTH / 3,
    height: 3,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: colors.container + "30",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeActive: {
    backgroundColor: colors.primary + "15",
  },
  badgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },

  // Scroll view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingBottom: 24,
  },

  // Request cards
  requestCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  requestCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  statusBar: {
    height: 4,
    width: "100%",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 72,
  },

  // Avatar styles
  avatarContainer: {
    marginRight: 12,
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
  },

  // Profile info
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    lineHeight: 20,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  generationBadge: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SF Arabic",
  },
  metaDot: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  phoneText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    marginTop: 2,
  },
  chevron: {
    marginLeft: 8,
  },

  // Expanded actions
  expandedActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.container + "20",
    paddingTop: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.success + "12",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.success + "25",
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
    backgroundColor: colors.error + "12",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.error + "25",
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

  // Rejection reason
  rejectionReason: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    alignItems: "flex-start",
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: colors.error,
    fontFamily: "SF Arabic",
    lineHeight: 18,
  },

  // Empty state
  emptyState: {
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
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: "SF Arabic",
    marginBottom: 24,
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginTop: 12,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(36, 33, 33, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 360,
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
    fontFamily: "SF Arabic",
    color: colors.text,
    minHeight: 100,
    textAlignVertical: "top",
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
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.container + "20",
    borderWidth: 1,
    borderColor: colors.container + "40",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: "center",
  },
  modalConfirmDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
});