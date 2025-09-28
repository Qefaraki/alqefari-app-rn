import React, { useState, useEffect } from "react";
import {
  View,
  Alert,
  RefreshControl,
  ScrollView,
  Dimensions,
  StyleSheet,
  Linking,
  TouchableOpacity,
  Text,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Host, Picker } from "@expo/ui/swift-ui";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { supabase } from "../../services/supabase";
import { phoneAuthService } from "../../services/phoneAuth";
import { buildNameChain } from "../../utils/nameChainBuilder";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Exact colors from app research
const colors = {
  // Najdi Sadu palette
  background: "#F9F7F3",      // Al-Jass White
  container: "#D1BBA3",        // Camel Hair Beige
  text: "#242121",            // Sadu Night
  textMuted: "#736372",       // Muted plum
  primary: "#A13333",         // Najdi Crimson
  secondary: "#D58C4A",       // Desert Ochre

  // Status colors (keeping brand palette)
  success: "#D58C4A",         // Desert Ochre for approve
  warning: "#D58C4A",         // Desert Ochre for pending
  error: "#A13333",           // Najdi Crimson for reject

  // System colors
  white: "#FFFFFF",
  separator: "#C6C6C8",
  whatsapp: "#A13333",  // Changed to Najdi Crimson as requested
};

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
  // Get first two characters for Arabic names
  const cleanName = name.trim();
  if (cleanName.length >= 2) {
    return cleanName.substring(0, 2);
  }
  return cleanName.charAt(0);
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

// Animated button component
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ProfileConnectionManagerV2({ onBack }) {
  console.log("🚀 ProfileConnectionManagerV2 MOUNTED");
  const router = useRouter();
  const [requests, setRequests] = useState({
    pending: [],
    approved: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0); // 0: pending, 1: approved, 2: rejected
  const [allProfiles, setAllProfiles] = useState([]);

  const tabOptions = ["في الانتظار", "موافق عليها", "مرفوضة"];
  const tabKeys = ["pending", "approved", "rejected"];

  useEffect(() => {
    console.log("🚀 ProfileConnectionManagerV2 useEffect running");
    loadPendingRequests();
    const subscription = subscribeToRequests();
    return () => subscription?.unsubscribe();
  }, []);

  const loadPendingRequests = async () => {
    console.log("🔍 DEBUG: Starting loadPendingRequests...");
    try {
      // Load all profiles for name chain building
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, father_id");

      if (profiles) {
        console.log(`🔍 DEBUG: Loaded ${profiles.length} profiles for name chains`);
        setAllProfiles(profiles);
      }

      console.log("🔍 DEBUG: Fetching profile_link_requests...");
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

      console.log("🔍 DEBUG: Query response:", { data, error });

      if (error) {
        console.error("❌ Error loading profile link requests:", error);
        console.error("❌ Error details:", JSON.stringify(error, null, 2));
        throw error;
      }

      console.log(`🔍 DEBUG: Received ${data?.length || 0} requests`);
      if (data && data.length > 0) {
        console.log("🔍 DEBUG: First request:", JSON.stringify(data[0], null, 2));
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

      console.log("🔍 DEBUG: Grouped requests:", {
        pending: grouped.pending.length,
        approved: grouped.approved.length,
        rejected: grouped.rejected.length
      });

      setRequests(grouped);
    } catch (error) {
      console.error("❌ Error in loadPendingRequests:", error);
      console.error("❌ Stack trace:", error.stack);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

  const handleReject = async (request) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Alert.alert(
      "سبب الرفض",
      "يرجى إدخال سبب رفض الطلب",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "رفض",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await phoneAuthService.rejectProfileLink(
                request.id,
                "رفض من قبل المسؤول"
              );
              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert("تم", "تم رفض الطلب");
              loadPendingRequests();
            } catch (error) {
              Alert.alert("خطأ", "فشل رفض الطلب");
            }
          },
        },
      ]
    );
  };

  const handleWhatsApp = (phone) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent(
      "مرحباً، بخصوص طلب ربط ملفك الشخصي في شجرة العائلة..."
    );
    const url = `whatsapp://send?phone=${phone}&text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح WhatsApp");
    });
  };

  const handleNavigateToProfile = (profileId) => {
    if (!profileId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Close the current screen if needed
    if (onBack) {
      onBack();
    }

    // Navigate to tree view with profile highlighted
    router.push({
      pathname: "/",
      params: {
        highlightProfileId: profileId,
        focusOnProfile: 'true'
      }
    });
  };

  const currentRequests = requests[tabKeys[selectedTab]] || [];
  const totalRequests = requests.pending.length + requests.approved.length + requests.rejected.length;

  // Status color helper
  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return colors.warning;
      case "approved": return colors.success;
      case "rejected": return colors.error;
      default: return colors.textMuted;
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIndicator}>
            <Ionicons name="hourglass-outline" size={48} color={colors.container} />
          </View>
          <Text style={styles.loadingText}>جارٍ التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header with emblem - matching SettingsPage pattern */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image
            source={require('../../../assets/logo/AlqefariEmblem.png')}
            style={styles.emblem}
            resizeMode="contain"
          />
          <View style={styles.titleContent}>
            <Text style={styles.title}>الربط</Text>
          </View>
          {onBack && (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onBack();
              }}
              style={styles.backButton}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <Host style={{ width: "100%", height: 36 }}>
          <Picker
            label=""
            options={tabOptions}
            variant="segmented"
            selectedIndex={selectedTab}
            onOptionSelected={({ nativeEvent: { index } }) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTab(index);
            }}
          />
        </Host>
      </View>

      {/* Mini Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={[styles.statIndicator, { backgroundColor: colors.warning + "20" }]}>
            <Text style={[styles.statNumber, { color: colors.warning }]}>
              {requests.pending?.length || 0}
            </Text>
          </View>
          <Text style={styles.statLabel}>في الانتظار</Text>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIndicator, { backgroundColor: colors.success + "20" }]}>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {requests.approved?.length || 0}
            </Text>
          </View>
          <Text style={styles.statLabel}>موافق عليها</Text>
        </View>

        <View style={styles.statItem}>
          <View style={[styles.statIndicator, { backgroundColor: colors.error + "20" }]}>
            <Text style={[styles.statNumber, { color: colors.error }]}>
              {requests.rejected?.length || 0}
            </Text>
          </View>
          <Text style={styles.statLabel}>مرفوضة</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
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
            progressBackgroundColor={colors.background}
            title="اسحب للتحديث"
            titleColor={colors.textMuted}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentRequests.length > 0 ? (
          <View style={styles.listContainer}>
            {currentRequests.map((request, index) => {
              const profile = request.profiles;
              const displayName = profile ? getFullNameChain(profile, allProfiles) : request.name_chain || "غير معروف";
              const statusColor = getStatusColor(tabKeys[selectedTab]);

              return (
                <TouchableOpacity
                  key={request.id}
                  onPress={() => profile?.id && handleNavigateToProfile(profile.id)}
                  activeOpacity={0.7}
                >
                <Animated.View
                  entering={FadeInDown.delay(index * 30).springify().damping(15)}
                  layout={Layout.springify()}
                  style={[styles.requestCard, { transform: [{ scale: 1 }] }]}
                >
                  {/* Status indicator line */}
                  <View style={[styles.statusIndicatorLine, { backgroundColor: statusColor }]} />

                  <View style={styles.cardContent}>
                    {/* Profile photo with border */}
                    <View style={styles.photoContainer}>
                      {profile?.photo_url ? (
                        <Image
                          source={{ uri: profile.photo_url }}
                          style={styles.profilePhoto}
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                          <Text style={styles.avatarText}>
                            {getInitials(profile?.name || request.name_chain || "غير معروف")}
                          </Text>
                        </View>
                      )}
                      <View style={styles.photoBorder} />
                    </View>

                    {/* Name and details */}
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>{displayName}</Text>
                      <Text style={styles.profileMeta}>
                        {getGenerationName(profile?.generation)}
                      </Text>
                      <Text style={[styles.profileMeta, { fontSize: 13, color: colors.textMuted + "99" }]}>
                        {request.phone || "لا يوجد رقم"}
                      </Text>
                    </View>

                    {/* Actions for pending */}
                    {tabKeys[selectedTab] === "pending" && (
                      <View style={styles.actionButtons}>
                        <AnimatedActionButton
                          onPress={() => handleApprove(request)}
                          style={[styles.actionButton, styles.approveButton]}
                          icon="checkmark"
                          color="#FFFFFF"
                        />

                        <AnimatedActionButton
                          onPress={() => handleReject(request)}
                          style={[styles.actionButton, styles.rejectButton]}
                          icon="close"
                          color="#FFFFFF"
                        />

                        {request.phone && (
                          <AnimatedActionButton
                            onPress={() => handleWhatsApp(request.phone)}
                            style={[styles.actionButton, styles.whatsappButton]}
                            icon="logo-whatsapp"
                            color={colors.text}
                            size={18}
                          />
                        )}
                      </View>
                    )}

                    {/* Status indicators and WhatsApp for approved/rejected */}
                    {tabKeys[selectedTab] === "approved" && (
                      <View style={styles.actionButtons}>
                        <View style={styles.statusIcon}>
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={colors.success}
                          />
                        </View>
                        {request.phone && (
                          <AnimatedActionButton
                            onPress={() => handleWhatsApp(request.phone)}
                            style={[styles.actionButton, styles.whatsappButton]}
                            icon="logo-whatsapp"
                            color={colors.text}
                            size={18}
                          />
                        )}
                      </View>
                    )}

                    {tabKeys[selectedTab] === "rejected" && (
                      <View style={styles.actionButtons}>
                        <View style={styles.rejectedInfo}>
                          <Ionicons
                            name="close-circle"
                            size={22}
                            color={colors.error}
                          />
                          {request.review_notes && (
                            <Text style={styles.rejectionNote} numberOfLines={1}>
                              {request.review_notes}
                            </Text>
                          )}
                        </View>
                        {request.phone && (
                          <AnimatedActionButton
                            onPress={() => handleWhatsApp(request.phone)}
                            style={[styles.actionButton, styles.whatsappButton]}
                            icon="logo-whatsapp"
                            color={colors.text}
                            size={18}
                          />
                        )}
                      </View>
                    )}
                  </View>
                </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Image
              source={require('../../../assets/sadu_patterns/png/42.png')}
              style={styles.emptyPattern}
              resizeMode="contain"
            />
            <Ionicons
              name="document-text-outline"
              size={48}
              color={colors.container}
            />
            <Text style={styles.emptyText}>
              {selectedTab === 0
                ? "لا توجد طلبات في الانتظار"
                : selectedTab === 1
                ? "لا توجد طلبات موافق عليها"
                : "لا توجد طلبات مرفوضة"}
            </Text>
            <Text style={styles.refreshHint}>
              اسحب للأسفل للتحديث
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Animated action button component
const AnimatedActionButton = ({ onPress, style, icon, color, size = 20 }) => {
  const scaleAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scaleAnim.value, { damping: 15, stiffness: 300 }) }],
  }));

  return (
    <AnimatedTouchable
      style={[style, animatedStyle]}
      onPressIn={() => {
        scaleAnim.value = 0.88;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scaleAnim.value = 1;
      }}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Ionicons name={icon} size={size} color={color} />
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Header - matching SettingsPage pattern
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
    marginRight: -8,
  },
  emblem: {
    width: 52,
    height: 52,
    tintColor: colors.text,
    marginRight: 3,
    marginTop: -5,
    marginLeft: -5,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },

  // Segmented Control
  segmentedControlContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },

  // Stats
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  statItem: {
    alignItems: "center",
  },
  statIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // List
  listContainer: {
    paddingTop: 16,
  },

  // Card - Modern floating style
  requestCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    minHeight: 92,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statusIndicatorLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingLeft: 20,
  },

  // Photo
  photoContainer: {
    position: "relative",
  },
  profilePhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    fontFamily: "SF Arabic",
  },
  photoBorder: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.container + "30",
    top: -1,
    left: -1,
  },

  // Info
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  metaRow: {
    marginBottom: 2,
  },
  profileMeta: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    fontWeight: "500",
    marginBottom: 2,
  },
  metaSeparator: {
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: 6,
  },

  // Actions
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  whatsappButton: {
    backgroundColor: colors.primary,  // Using Najdi Crimson instead of WhatsApp green
  },
  statusIcon: {
    padding: 4,
  },
  rejectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rejectionNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    marginTop: 2,
    maxWidth: 100,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyPattern: {
    position: "absolute",
    width: 200,
    height: 200,
    opacity: 0.05,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: "SF Arabic",
    marginTop: 16,
    marginBottom: 8,
  },
  refreshHint: {
    fontSize: 13,
    color: colors.textMuted + "80",
    fontFamily: "SF Arabic",
  },
});