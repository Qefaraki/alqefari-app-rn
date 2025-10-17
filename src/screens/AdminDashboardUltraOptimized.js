import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ActivityLogDashboard from "./admin/ActivityLogDashboard"; // Unified Activity Dashboard
import ProfileConnectionManagerV2 from "../components/admin/ProfileConnectionManagerV2";
import { featureFlags } from "../config/featureFlags";
import AdminMessagesManager from "../components/admin/AdminMessagesManager";
import MunasibManager from "../components/admin/MunasibManager";
import PermissionManager from "../components/admin/PermissionManager";
import SuggestionReviewManager from "../components/admin/SuggestionReviewManager";
import AdminBroadcastManager from "../components/admin/AdminBroadcastManager";
import MessageTemplateManager from "../components/admin/MessageTemplateManager";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { supabase } from "../services/supabase";
import suggestionService from "../services/suggestionService";
import SkeletonLoader from "../components/ui/SkeletonLoader";
import NotificationCenter from "../components/NotificationCenter";
import NotificationBadge from "../components/NotificationBadge";
import { useTreeStore } from "../stores/useTreeStore";
import * as Haptics from 'expo-haptics';
import tokens from "../components/ui/tokens";
import LargeTitleHeader from "../components/ios/LargeTitleHeader";
import WidgetCard from "../components/ios/WidgetCard";
import { ListSection, ListItem } from "../components/ios/GroupedList";
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { ADMIN_FEATURES } from '../config/adminFeatures';

const formatCount = (value) => {
  const numeric = Number.isFinite(value) ? value : 0;
  try {
    return numeric.toLocaleString("ar-SA");
  } catch (error) {
    return `${numeric}`;
  }
};

const AdminDashboardUltraOptimized = ({ user, profile, openLinkRequests = false }) => {
  // Single source of truth for feature access
  const { canAccess } = useFeatureAccess(profile.role);

  // Loading states for each section
  const [statsLoading, setStatsLoading] = useState(true);
  const [enhancedLoading, setEnhancedLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showLinkRequests, setShowLinkRequests] = useState(false);
  const [showMessagesManager, setShowMessagesManager] = useState(false);
  const [showMunasibManager, setShowMunasibManager] = useState(false);
  const [showPermissionManager, setShowPermissionManager] = useState(false);
  const [showSuggestionReview, setShowSuggestionReview] = useState(false);
  const [showBroadcastManager, setShowBroadcastManager] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [munasibCounts, setMunasibCounts] = useState({ families: 0, members: 0 });
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // Get safe area insets for dynamic bottom padding
  const insets = useSafeAreaInsets();

  // Router for navigation
  const router = useRouter();

  // Tree data for profile existence checks
  const treeData = useTreeStore(state => state.treeData);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Start animations immediately on mount
  useEffect(() => {
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
    ]).start();

    // Open link requests modal if requested via navigation
    if (openLinkRequests) {
      setTimeout(() => {
        setShowLinkRequests(true);
      }, 500); // Small delay to let the dashboard load first
    }
  }, []);

  // Load data progressively
  useEffect(() => {
    const timer1 = setTimeout(() => loadEnhancedStats(), 300);

    loadBasicStats();
    loadPendingRequestsCount();
    loadPendingSuggestionsCount();
    loadMunasibStats();

    // Cleanup timers on unmount
    return () => {
      clearTimeout(timer1);
    };
  }, []);

  const loadDataProgressively = async () => {
    // Load basic stats first (fastest)
    loadBasicStats();
    loadPendingRequestsCount();
    loadPendingSuggestionsCount();
    loadMunasibStats();

    // Load other sections with delays (NO CLEANUP - only used in refresh)
    setTimeout(() => loadEnhancedStats(), 300);
  };

  const loadPendingRequestsCount = async () => {
    if (!featureFlags.profileLinkRequests) {
      setPendingRequestsCount(0);
      return;
    }
    try {
      const { count } = await supabase
        .from("profile_link_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.log("Error loading pending requests:", error);
    }
  };

  const loadPendingSuggestionsCount = async () => {
    try {
      const count = await suggestionService.getPendingSuggestionsCount();
      setPendingSuggestionsCount(count || 0);
    } catch (error) {
      console.log("Error loading pending suggestions:", error);
    }
  };

  const loadMunasibStats = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, family_origin")
        .is("hid", null)
        .not("family_origin", "is", null);

      if (error) throw error;

      const families = new Set();
      (data || []).forEach((profile) => {
        if (profile.family_origin) {
          families.add(profile.family_origin);
        }
      });

      setMunasibCounts({
        families: families.size,
        members: data?.length || 0,
      });
    } catch (error) {
      console.error("Error loading munasib stats:", error);
      setMunasibCounts({ families: 0, members: 0 });
    }
  };

  const loadBasicStats = async () => {
    try {
      // Super fast count query
      const { count: profileCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: marriageCount } = await supabase
        .from("marriages")
        .select("*", { count: "exact", head: true });

      // Set basic counts immediately
      setStats({
        total_profiles: profileCount || 0,
        total_marriages: marriageCount || 0,
        male_count: Math.floor((profileCount || 0) * 0.52), // Estimate initially
        female_count: Math.floor((profileCount || 0) * 0.48),
        alive_count: Math.floor((profileCount || 0) * 0.85),
        deceased_count: Math.floor((profileCount || 0) * 0.15),
        profiles_with_photos: 0,
        profiles_with_dates: 0,
      });

      setStatsLoading(false);

      // Then get real stats in background
      const { data: realStats } = await supabase.rpc("admin_get_enhanced_statistics");
      if (realStats) {
        setStats((prev) => ({ ...prev, ...realStats }));
      }
    } catch (error) {
      console.error("Error loading stats:", error);
      setStatsLoading(false);
    }
  };

  const loadEnhancedStats = async () => {
    try {
      const { data } = await supabase.rpc("admin_get_enhanced_statistics");
      if (data) {
        setStats((prev) => ({
          ...prev,
          ...data,
          munasib: data.munasib,
          family: data.family,
          data_quality: data.data_quality,
        }));
      }
    } catch (error) {
      console.error("Error loading enhanced stats:", error);
    } finally {
      setEnhancedLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatsLoading(true);
    setEnhancedLoading(true);
    await loadDataProgressively();
    setRefreshing(false);
  };

  // Create refs at component level for modals
  const modalTranslateX = useRef(new Animated.Value(0)).current;
  const modalGestureHandler = useRef(null);

  // Modal renders - components handle their own headers
  const renderIOSModal = (visible, onClose, Component, props = {}) => {
    if (!visible) return null;

    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationX: modalTranslateX } }],
      { useNativeDriver: true }
    );

    const onHandlerStateChange = (event) => {
      if (event.nativeEvent.state === State.END) {
        const { translationX, velocityX } = event.nativeEvent;

        // Swipe right to dismiss (for RTL)
        if (translationX > 120 || velocityX > 800) {
          Animated.timing(modalTranslateX, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            modalTranslateX.setValue(0);
            onClose();
          });
        } else {
          // Snap back
          Animated.spring(modalTranslateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }).start();
        }
      }
    };

    return (
      <Modal
        animationType="slide"
        presentationStyle="fullScreen"
        visible={visible}
        onRequestClose={onClose}
      >
        <PanGestureHandler
          ref={modalGestureHandler}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetX={10}
          failOffsetY={[-5, 5]}
        >
          <Animated.View
            style={[
              { flex: 1, backgroundColor: '#F9F7F3' },
              { transform: [{ translateX: modalTranslateX }] }
            ]}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F9F7F3' }}>
              <Component
                {...props}
                onClose={onClose}
                onBack={onClose}
                navigation={{ goBack: onClose }}
              />
            </SafeAreaView>
          </Animated.View>
        </PanGestureHandler>
      </Modal>
    );
  };

  // Skeleton components
  const StatsGridSkeleton = () => (
    <View style={styles.metricGrid}>
      {[...Array(4)].map((_, i) => (
        <View key={i} style={[styles.metricCard, styles.metricCardSkeleton]}>
          <SkeletonLoader width="60%" height={28} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="50%" height={12} />
        </View>
      ))}
    </View>
  );

  const metrics = [
    {
      key: "total_profiles",
      label: "إجمالي الملفات",
      value: stats?.total_profiles,
      tone: "crimson",
    },
    {
      key: "alive_count",
      label: "الأحياء",
      value: stats?.alive_count,
      tone: "neutral",
    },
    {
      key: "male_count",
      label: "الذكور",
      value: stats?.male_count,
      tone: "neutral",
    },
    {
      key: "female_count",
      label: "الإناث",
      value: stats?.female_count,
      tone: "ochre",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        pointerEvents="none"
        colors={["#FFFFFF", "rgba(249, 247, 243, 0.96)", tokens.colors.najdi.background]}
        locations={[0, 0.45, 1]}
        style={styles.backgroundGlow}
      />

      <LargeTitleHeader
        title="الإدارة"
        emblemSource={require("../../assets/logo/AlqefariEmblem.png")}
        actions={
          <NotificationBadge
            onPress={() => {
              requestAnimationFrame(() => {
                setShowNotificationCenter(true);
              });
            }}
          />
        }
      />

      {showNotificationCenter && (
        <NotificationCenter
          visible={showNotificationCenter}
          onClose={() => setShowNotificationCenter(false)}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Animated.View
          style={[
            styles.sectionWrapper,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <WidgetCard>
            {statsLoading ? (
              <StatsGridSkeleton />
            ) : (
              <>
                <View style={styles.widgetHeader}>
                  <Text style={styles.widgetTitle}>مؤشرات العائلة</Text>
                </View>
                <View style={styles.metricGrid}>
                  {metrics.map((metric) => (
                    <View
                      key={metric.key}
                      style={[
                        styles.metricCard,
                        metric.tone === "crimson" && styles.metricCardCrimson,
                        metric.tone === "ochre" && styles.metricCardOchre,
                      ]}
                    >
                      <Text style={styles.metricValue}>
                        {formatCount(metric.value)}
                      </Text>
                      <Text style={styles.metricLabel}>{metric.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </WidgetCard>
        </Animated.View>

        <Animated.View
          style={[
            styles.sectionWrapper,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ListSection title="الإدارة الأساسية">
            {canAccess(ADMIN_FEATURES.LINK_REQUESTS.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="link-outline"
                    size={22}
                    color={tokens.colors.najdi.primary}
                  />
                }
                title="ربط الملفات"
                trailing={
                  <View style={styles.trailingCluster}>
                    {pendingRequestsCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {formatCount(pendingRequestsCount)}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={tokens.colors.najdi.textMuted}
                    />
                  </View>
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowLinkRequests(true);
                }}
              />
            )}

            {canAccess(ADMIN_FEATURES.MUNASIB_MANAGER.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="people-outline"
                    size={22}
                    color={tokens.colors.najdi.secondary}
                  />
                }
                title="الأنساب"
                subtitle={`${munasibCounts.families} عائلة • ${munasibCounts.members} أفراد`}
                trailing={
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={tokens.colors.najdi.textMuted}
                  />
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowMunasibManager(true);
                }}
              />
            )}

            {canAccess(ADMIN_FEATURES.SUGGESTION_REVIEW.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="document-text-outline"
                    size={22}
                    color={tokens.colors.najdi.text}
                  />
                }
                title="مراجعة الاقتراحات"
                trailing={
                  <View style={styles.trailingCluster}>
                    {pendingSuggestionsCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {formatCount(pendingSuggestionsCount)}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={tokens.colors.najdi.textMuted}
                    />
                  </View>
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSuggestionReview(true);
                }}
                showDivider={canAccess(ADMIN_FEATURES.PERMISSION_MANAGER.id)}
              />
            )}

            {canAccess(ADMIN_FEATURES.PERMISSION_MANAGER.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="star-outline"
                    size={22}
                    color={tokens.colors.najdi.primary}
                  />
                }
                title="إدارة الصلاحيات"
                trailing={
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={tokens.colors.najdi.textMuted}
                  />
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPermissionManager(true);
                }}
                showDivider={false}
              />
            )}
          </ListSection>

          <ListSection title="أدوات النظام">
            {canAccess(ADMIN_FEATURES.ACTIVITY_LOG.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="time-outline"
                    size={21}
                    color={tokens.colors.najdi.text}
                  />
                }
                title="سجل النشاط"
                trailing={
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={tokens.colors.najdi.textMuted}
                  />
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowActivityLog(true);
                }}
              />
            )}

            {canAccess(ADMIN_FEATURES.MESSAGE_TEMPLATES.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="logo-whatsapp"
                    size={21}
                    color="#25D366"
                  />
                }
                title="التواصل"
                trailing={
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={tokens.colors.najdi.textMuted}
                  />
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowTemplateManager(true);
                }}
                showDivider={canAccess(ADMIN_FEATURES.BROADCAST_MANAGER.id)}
              />
            )}

            {canAccess(ADMIN_FEATURES.BROADCAST_MANAGER.id) && (
              <ListItem
                leading={
                  <Ionicons
                    name="mail-outline"
                    size={21}
                    color={tokens.colors.najdi.primary}
                  />
                }
                title="إشعارات جماعية"
                trailing={
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={tokens.colors.najdi.textMuted}
                  />
                }
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowBroadcastManager(true);
                }}
                showDivider={false}
              />
            )}
          </ListSection>
        </Animated.View>

        {!enhancedLoading &&
          stats?.munasib &&
          stats.munasib.top_families?.length > 0 && (
            <Animated.View
              style={[
                styles.sectionWrapper,
                styles.munasibWrapper,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <WidgetCard>
                <View style={styles.munasibHeader}>
                  <Text style={styles.cardTitle}>العائلات المنتسبة</Text>
                  <View style={styles.munasibBadge}>
                    <Ionicons
                      name="people-outline"
                      size={16}
                      color={tokens.colors.najdi.primary}
                    />
                    <Text style={styles.munasibBadgeText}>
                      {formatCount(stats.munasib.total_munasib)} منتسب
                    </Text>
                  </View>
                </View>

                <View style={styles.topFamiliesContainer}>
                  {stats.munasib.top_families.slice(0, 3).map((family, index) => (
                    <View key={family.family_name || index} style={styles.topFamilyCard}>
                      <View style={styles.topFamilyRank}>
                        <Text style={styles.topFamilyRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.topFamilyName} numberOfLines={1}>
                        {family.family_name}
                      </Text>
                      <View style={styles.topFamilyStats}>
                        <Text style={styles.topFamilyCount}>
                          {formatCount(family.count)}
                        </Text>
                        <Text style={styles.topFamilyPercentage}>
                          {family.percentage}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </WidgetCard>
            </Animated.View>
          )}
      </ScrollView>

      {/* Full-Screen Modals - each component handles its own header */}
      {renderIOSModal(
        showActivityLog,
        () => setShowActivityLog(false),
        ActivityLogDashboard,
        {
          profile: profile,  // Pass profile from AdminDashboard
          onNavigateToProfile: async (profileId) => {
            try {
              // Check if profile exists in currently loaded tree
              const nodeExists = treeData.length > 0 && treeData.some(n => n.id === profileId);

              if (!nodeExists) {
                Alert.alert(
                  "الملف غير محمل",
                  "هذا الملف غير موجود في الفرع المحمل حالياً. سيتم إعادة تحميل الشجرة.",
                  [
                    { text: "إلغاء", style: "cancel" },
                    {
                      text: "تحميل",
                      onPress: () => {
                        setShowActivityLog(false);
                        setTimeout(() => {
                          router.push(`/?reloadBranch=${profileId}&highlightProfileId=${profileId}&focusOnProfile=true`);
                        }, 300);
                      }
                    }
                  ]
                );
                return;
              }

              // Profile exists in tree, navigate to it
              setShowActivityLog(false);

              // Wait for modal close animation, then verify tree state before navigation
              setTimeout(() => {
                // Double-check tree state after modal closes (prevents race conditions)
                const currentTreeData = useTreeStore.getState().treeData || [];
                if (currentTreeData.some(n => n.id === profileId)) {
                  router.push(`/?highlightProfileId=${profileId}&focusOnProfile=true`);
                } else {
                  Alert.alert('خطأ', 'تم تغيير حالة الشجرة. يرجى المحاولة مرة أخرى.');
                }
              }, 300);
            } catch (error) {
              console.error('[ActivityLog] خطأ في التنقل:', error);
              Alert.alert('خطأ', 'فشل التنقل إلى الملف');
            }
          }
        }
      )}

      {renderIOSModal(
        showLinkRequests,
        () => {
          setShowLinkRequests(false);
          loadPendingRequestsCount();
        },
        ProfileConnectionManagerV2
      )}

      {renderIOSModal(
        showMessagesManager,
        () => setShowMessagesManager(false),
        AdminMessagesManager
      )}

      {renderIOSModal(
        showMunasibManager,
        () => setShowMunasibManager(false),
        MunasibManager,
        {
          onNavigateToProfile: async (munasibId, alqefariId) => {
            // Close MunasibManager first
            setShowMunasibManager(false);

            // Wait for modal close animation
            setTimeout(() => {
              router.push({
                pathname: "/",
                params: {
                  highlightProfileId: alqefariId,  // Center tree on Al-Qefari spouse
                  openProfileId: munasibId,        // Open Munasib's profile sheet
                  focusOnProfile: 'true'           // Trigger tree centering
                }
              });
            }, 300);
          }
        }
      )}

      {renderIOSModal(
        showPermissionManager,
        () => setShowPermissionManager(false),
        PermissionManager,
        { user, profile }
      )}

      {renderIOSModal(
        showSuggestionReview,
        () => {
          setShowSuggestionReview(false);
          loadPendingSuggestionsCount();
        },
        SuggestionReviewManager
      )}

      {/* Unified Broadcast Manager */}
      {renderIOSModal(
        showBroadcastManager,
        () => setShowBroadcastManager(false),
        AdminBroadcastManager
      )}
      {renderIOSModal(
        showTemplateManager,
        () => setShowTemplateManager(false),
        MessageTemplateManager
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  backgroundGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  sectionWrapper: {
    marginBottom: tokens.spacing.xl,
  },
  widgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.md,
  },
  widgetTitle: {
    fontSize: tokens.typography.title3.fontSize,
    fontWeight: tokens.typography.title3.fontWeight,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(209, 187, 163, 0.25)",
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
  metricCardCrimson: {
    backgroundColor: "rgba(161, 51, 51, 0.12)",
    borderColor: "rgba(161, 51, 51, 0.24)",
  },
  metricCardOchre: {
    backgroundColor: "rgba(213, 140, 74, 0.14)",
    borderColor: "rgba(213, 140, 74, 0.24)",
  },
  metricCardSkeleton: {
    backgroundColor: "rgba(209, 187, 163, 0.18)",
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "700",
    color: tokens.colors.najdi.text,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  metricLabel: {
    marginTop: 4,
    fontSize: tokens.typography.footnote.fontSize,
    color: tokens.colors.najdi.textMuted,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  cardTitle: {
    fontSize: tokens.typography.title3.fontSize,
    fontWeight: tokens.typography.title3.fontWeight,
    color: tokens.colors.najdi.text,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  trailingCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: tokens.colors.najdi.background,
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  munasibWrapper: {
    marginBottom: tokens.spacing.xl,
  },
  munasibHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.md,
  },
  munasibBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(161, 51, 51, 0.12)",
    borderRadius: 999,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
  },
  munasibBadgeText: {
    color: tokens.colors.najdi.primary,
    fontSize: tokens.typography.footnote.fontSize,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  topFamiliesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: tokens.spacing.sm,
  },
  topFamilyCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(209, 187, 163, 0.35)",
    padding: tokens.spacing.md,
    alignItems: "flex-start",
  },
  topFamilyRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.najdi.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.spacing.sm,
  },
  topFamilyRankText: {
    color: tokens.colors.najdi.background,
    fontWeight: "700",
  },
  topFamilyName: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  topFamilyStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  topFamilyCount: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: tokens.colors.najdi.text,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  topFamilyPercentage: {
    fontSize: tokens.typography.caption1.fontSize,
    color: tokens.colors.najdi.textMuted,
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
});

export default AdminDashboardUltraOptimized;
