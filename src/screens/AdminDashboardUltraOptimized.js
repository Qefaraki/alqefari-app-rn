import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ValidationDashboard from "./ValidationDashboard";
import ActivityLogDashboard from "./admin/ActivityLogDashboard"; // Unified Activity Dashboard
import QuickAddOverlay from "../components/admin/QuickAddOverlay";
import ProfileConnectionManagerV2 from "../components/admin/ProfileConnectionManagerV2";
import AdminMessagesManager from "../components/admin/AdminMessagesManager";
import MunasibManager from "../components/admin/MunasibManager";
import pdfExportService from "../services/pdfExport";
import { supabase } from "../services/supabase";
import SkeletonLoader from "../components/ui/SkeletonLoader";

const AdminDashboardUltraOptimized = ({ user }) => {
  // Loading states for each section
  const [statsLoading, setStatsLoading] = useState(true);
  const [enhancedLoading, setEnhancedLoading] = useState(true);
  const [validationLoading, setValidationLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [dataHealth, setDataHealth] = useState(100);
  const [recentActivity, setRecentActivity] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showLinkRequests, setShowLinkRequests] = useState(false);
  const [showMessagesManager, setShowMessagesManager] = useState(false);
  const [showMunasibManager, setShowMunasibManager] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

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
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  // Load data progressively
  useEffect(() => {
    loadDataProgressively();
  }, []);

  const loadDataProgressively = async () => {
    // Load basic stats first (fastest)
    loadBasicStats();
    loadPendingRequestsCount();

    // Load other sections with delays
    setTimeout(() => loadEnhancedStats(), 300);
    setTimeout(() => loadValidationData(), 600);
    setTimeout(() => loadActivityFeed(), 900);
  };

  const loadPendingRequestsCount = async () => {
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
      const { data: realStats } = await supabase.rpc("admin_get_statistics");
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

  const loadValidationData = async () => {
    try {
      const { data } = await supabase.rpc("admin_validation_dashboard");
      if (data) {
        setValidationIssues(data);
        const healthScore = Math.max(0, 100 - data.length * 2);
        setDataHealth(Math.round(healthScore));
      }
    } catch (error) {
      console.error("Validation failed:", error);
    } finally {
      setValidationLoading(false);
    }
  };

  const loadActivityFeed = async () => {
    try {
      const { data } = await supabase
        .from("activity_log_detailed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        setRecentActivity(data);
      }
    } catch (error) {
      console.error("Activity feed failed:", error);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatsLoading(true);
    setEnhancedLoading(true);
    setValidationLoading(true);
    setActivityLoading(true);

    await loadDataProgressively();
    setRefreshing(false);
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return "الآن";
    if (diff < 60) return `منذ ${diff}د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)}س`;
    return `منذ ${Math.floor(diff / 1440)}ي`;
  };

  // Handle other actions
  const handleAutoFix = async () => {
    try {
      const { data } = await supabase.rpc("admin_auto_fix_issues");
      if (data) {
        Alert.alert("نجح", "تم إصلاح المشاكل بنجاح");
        handleRefresh();
      }
    } catch (error) {
      Alert.alert("خطأ", "فشل إصلاح المشاكل");
    }
  };

  const handleExportDatabase = async () => {
    try {
      setExporting(true);

      // Show export options
      Alert.alert(
        "تصدير شجرة العائلة",
        "اختر نوع التصدير",
        [
          {
            text: "إلغاء",
            style: "cancel",
            onPress: () => setExporting(false),
          },
          {
            text: "تقرير المنتسبين",
            onPress: async () => {
              try {
                await pdfExportService.exportMunasibReport();
              } catch (error) {
                console.error("Munasib export error:", error);
              } finally {
                setExporting(false);
              }
            },
          },
          {
            text: "الشجرة الكاملة",
            onPress: async () => {
              try {
                await pdfExportService.exportFamilyTreePDF({
                  includePhotos: true,
                  includeMarriages: true,
                  includeMunasib: true,
                });
              } catch (error) {
                console.error("PDF export error:", error);
              } finally {
                setExporting(false);
              }
            },
          },
        ],
        { cancelable: true, onDismiss: () => setExporting(false) },
      );
    } catch (error) {
      Alert.alert("خطأ", "فشل تصدير شجرة العائلة");
      setExporting(false);
    }
  };

  const handleRecalculateLayouts = () => {
    Alert.alert(
      "إعادة حساب التخطيط",
      "سيتم إعادة حساب جميع مواضع العقد في الشجرة.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "متابعة",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc(
                "queue_all_layouts_recalculation",
              );
              if (error) throw error;
              Alert.alert("نجح", "تم إضافة المهمة إلى قائمة الانتظار");
            } catch (error) {
              Alert.alert("خطأ", "فشلت إعادة الحساب");
            }
          },
        },
      ],
    );
  };

  // Modal renders
  
  if (showActivityLog) {
    return <ActivityLogDashboard onClose={() => setShowActivityLog(false)}  />;
  }
  if (showQuickAdd) {
    return (
      <QuickAddOverlay
        onClose={() => setShowQuickAdd(false)}
        onComplete={() => {
          setShowQuickAdd(false);
          handleRefresh();
        }}
      />
    );
  }
  if (showLinkRequests) {
    return (
      <ProfileConnectionManagerV2
        onBack={() => {
          setShowLinkRequests(false);
          loadPendingRequestsCount(); // Refresh count when returning
        }}
      />
    );
  }
  if (showMessagesManager) {
    return (
      <AdminMessagesManager
        onClose={() => {
          setShowMessagesManager(false);
        }}
      />
    );
  }
  // Render MunasibManager as a modal
  const renderMunasibManager = () => (
    <MunasibManager
      visible={showMunasibManager}
      onClose={() => setShowMunasibManager(false)}
    />
  );
  if (showValidationDashboard) {
    return (
      <ValidationDashboard
        navigation={{ goBack: () => setShowValidationDashboard(false) }}
      />
    );
  }

  // Skeleton components
  const StatsGridSkeleton = () => (
    <View style={styles.statsGrid}>
      {[...Array(6)].map((_, i) => (
        <View key={i} style={styles.statBox}>
          <SkeletonLoader width={50} height={24} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="70%" height={12} />
        </View>
      ))}
    </View>
  );

  const CardSkeleton = () => (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <SkeletonLoader width="40%" height={18} style={{ marginBottom: 16 }} />
      <View style={{ gap: 12 }}>
        <SkeletonLoader width="100%" height={60} borderRadius={12} />
        <View style={{ flexDirection: "row-reverse", gap: 12 }}>
          <SkeletonLoader width="48%" height={40} borderRadius={8} />
          <SkeletonLoader width="48%" height={40} borderRadius={8} />
        </View>
      </View>
    </Animated.View>
  );

  const ActivitySkeleton = () => (
    <View style={styles.card}>
      {[...Array(2)].map((_, i) => (
        <View
          key={i}
          style={[styles.activityItem, i === 0 && styles.activityItemBorder]}
        >
          <View style={{ flex: 1 }}>
            <SkeletonLoader
              width="60%"
              height={16}
              style={{ marginBottom: 6 }}
            />
            <SkeletonLoader width="40%" height={12} />
          </View>
          <SkeletonLoader width={50} height={12} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.title}>الإدارة</Text>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* iOS Widget Style Statistics Card */}
        <Animated.View
          style={[
            styles.statsWidget,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {statsLoading ? (
            <View style={styles.statsWidgetContent}>
              <View style={styles.statsRow}>
                <SkeletonLoader width={80} height={32} />
                <SkeletonLoader width={80} height={32} />
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsRow}>
                <SkeletonLoader width={80} height={32} />
                <SkeletonLoader width={80} height={32} />
              </View>
            </View>
          ) : (
            <View style={styles.statsWidgetContent}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumberLarge, { color: "#A13333" }]}>
                    {stats?.total_profiles || 0}
                  </Text>
                  <Text style={styles.statLabelSmall}>تاريخي</Text>
                </View>
                <View style={styles.statVerticalDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumberLarge, { color: "#242121" }]}>
                    {stats?.alive_count || 0}
                  </Text>
                  <Text style={styles.statLabelSmall}>حالي</Text>
                </View>
              </View>

              <View style={styles.statsDivider} />

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumberLarge, { color: "#242121" }]}>
                    {stats?.male_count || 0}
                  </Text>
                  <Text style={styles.statLabelSmall}>ذكور</Text>
                </View>
                <View style={styles.statVerticalDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumberLarge, { color: "#D58C4A" }]}>
                    {stats?.female_count || 0}
                  </Text>
                  <Text style={styles.statLabelSmall}>إناث</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>



        {/* Recent Activity */}
        {activityLoading ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>النشاط الأخير</Text>
            <ActivitySkeleton />
          </View>
        ) : recentActivity.length > 0 ? (
          <Animated.View
            style={[
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                marginTop: 16,
              },
            ]}
          >
            <Text style={styles.sectionTitle}>النشاط الأخير</Text>
            <View style={styles.card}>
              {recentActivity.slice(0, 2).map((activity, index) => (
                <View
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    index === 0 && styles.activityItemBorder,
                  ]}
                >
                  <View style={styles.activityContent}>
                    <Text style={styles.activityName}>
                      {activity.actor_name || "مجهول"}
                    </Text>
                    <Text style={styles.activityDescription}>
                      {activity.action === "INSERT"
                        ? "إضافة ملف جديد"
                        : activity.action === "UPDATE"
                          ? "تعديل الملف الشخصي"
                          : "حذف ملف"}
                    </Text>
                  </View>
                  <Text style={styles.activityTime}>
                    {formatTimeAgo(activity.created_at)}
                  </Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => setShowActivityLog(true)}
              >
                <Text style={styles.viewAllText}>عرض الكل</Text>
                <Ionicons name="chevron-back" size={16} color="#6366f1" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {/* Quick Actions Grid - Compact 2x3 Layout */}
        <Animated.View
          style={[
            styles.actionsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#A1333310" }]}
              onPress={() => setShowLinkRequests(true)}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="link-outline" size={28} color="#A13333" />
                {pendingRequestsCount > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{pendingRequestsCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionCardText}>ربط الملفات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#D58C4A10" }]}
              onPress={() => setShowMunasibManager(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={28} color="#D58C4A" />
              <Text style={styles.actionCardText}>المنتسبين</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#A1333310" }]}
              onPress={() => setShowQuickAdd(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={28} color="#A13333" />
              <Text style={styles.actionCardText}>إضافة جديد</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#24212110" }]}
              onPress={() => setShowActivityLog(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={28} color="#242121" />
              <Text style={styles.actionCardText}>سجل النشاط</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#D58C4A10" }]}
              onPress={handleAutoFix}
              activeOpacity={0.7}
            >
              <Ionicons name="construct-outline" size={28} color="#D58C4A" />
              <Text style={styles.actionCardText}>إصلاح تلقائي</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#24212110" }]}
              onPress={handleRecalculateLayouts}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={28} color="#242121" />
              <Text style={styles.actionCardText}>إعادة حساب</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Munasib families - Shows after enhanced stats load */}
        {!enhancedLoading &&
          stats?.munasib &&
          stats.munasib.top_families?.length > 0 && (
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                  marginTop: 16,
                  marginBottom: 20,
                },
              ]}
            >
              <View style={styles.munasibHeader}>
                <Text style={styles.cardTitle}>العائلات المنتسبة</Text>
                <View style={styles.munasibBadge}>
                  <Text style={styles.munasibBadgeText}>
                    {stats.munasib.total_munasib} منتسب
                  </Text>
                </View>
              </View>

              <View style={styles.topFamiliesContainer}>
                {stats.munasib.top_families.slice(0, 3).map((family, index) => (
                  <View
                    key={index}
                    style={[
                      styles.topFamilyCard,
                      index === 0 && styles.topFamilyFirst,
                    ]}
                  >
                    <View style={styles.topFamilyRank}>
                      <Text style={styles.topFamilyRankText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.topFamilyName} numberOfLines={1}>
                      {family.family_name}
                    </Text>
                    <View style={styles.topFamilyStats}>
                      <Text style={styles.topFamilyCount}>{family.count}</Text>
                      <Text style={styles.topFamilyPercentage}>
                        {family.percentage}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
      </ScrollView>

      {/* MunasibManager Modal */}
      {renderMunasibManager()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#242121", // Sadu Night
    fontFamily: Platform.select({
      ios: "SF Arabic",
      default: "System",
    }),
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  card: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCard: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    width: "48.5%",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1BBA320", // Camel Hair Beige 20%
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  statCardTopLeft: {
    borderTopRightRadius: 4,
  },
  statCardTopRight: {
    borderTopLeftRadius: 4,
  },
  statCardBottomLeft: {
    borderBottomRightRadius: 4,
  },
  statCardBottomRight: {
    borderBottomLeftRadius: 4,
  },
  statIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    opacity: 0.3,
  },
  actionsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  actionCard: {
    width: "31%",
    aspectRatio: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#00000008",
  },
  actionIconContainer: {
    position: "relative",
  },
  actionBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#A13333",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  actionBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  actionCardText: {
    color: "#242121",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
  },
  statsCard: {
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#242121", // Sadu Night
    fontFamily: "SF Arabic",
    marginBottom: 16,
    textAlign: "right",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#24212199", // Sadu Night 60%
    marginTop: 2,
    textAlign: "center",
    fontWeight: "500",
  },
  completenessGrid: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  completenessItem: {
    width: "48%",
  },
  completenessHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  completenessPercentage: {
    fontSize: 24,
    fontWeight: "700",
    color: "#242121", // Sadu Night
  },
  completenessIcon: {
    fontSize: 20,
  },
  completenessBarContainer: {
    height: 8,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  completenessBar: {
    height: "100%",
    borderRadius: 4,
  },
  completenessLabel: {
    fontSize: 12,
    color: "#24212199", // Sadu Night 60%
  },
  dataHealthHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  healthPercentage: {
    fontSize: 24,
    fontWeight: "700",
    color: "#D58C4A", // Desert Ochre
  },
  progressBar: {
    height: 6,
    backgroundColor: "#D1BBA340", // Camel Hair Beige 40%
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#D58C4A", // Desert Ochre
    borderRadius: 999,
  },
  issuesTags: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  tagSuccess: {
    backgroundColor: "#D58C4A" + "1A", // Desert Ochre 10%
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagSuccessText: {
    color: "#D58C4A", // Desert Ochre
    fontSize: 14,
  },
  tagWarning: {
    backgroundColor: "#A13333" + "1A", // Najdi Crimson 10%
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagWarningText: {
    color: "#A13333", // Najdi Crimson
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#A13333", // Najdi Crimson
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#F9F7F3", // Al-Jass White
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  activityItem: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  activityItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#242121", // Sadu Night
  },
  activityDescription: {
    fontSize: 14,
    color: "#24212199", // Sadu Night 60%
    marginTop: 2,
  },
  activityTime: {
    fontSize: 14,
    color: "#24212166", // Sadu Night 40%
  },
  viewAllButton: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  viewAllText: {
    color: "#A13333", // Najdi Crimson
    fontSize: 16,
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "#A13333",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: "#F9F7F3", // Al-Jass White
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  munasibHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  munasibBadge: {
    backgroundColor: "#D58C4A" + "20", // Desert Ochre 20%
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D58C4A" + "60", // Desert Ochre 60%
  },
  munasibBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#242121", // Sadu Night
  },
  topFamiliesContainer: {
    gap: 12,
  },
  topFamilyCard: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
    position: "relative",
  },
  topFamilyFirst: {
    borderColor: "#D58C4A", // Desert Ochre
    borderWidth: 2,
  },
  topFamilyRank: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F9F7F3", // Al-Jass White
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topFamilyRankText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#242121", // Sadu Night
  },
  topFamilyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121", // Sadu Night
    marginRight: 32,
    textAlign: "right",
  },
  topFamilyStats: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 8,
    marginTop: 8,
  },
  topFamilyCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#242121", // Sadu Night
  },
  topFamilyPercentage: {
    fontSize: 14,
    fontWeight: "500",
    color: "#24212199", // Sadu Night 60%
  },
});

export default AdminDashboardUltraOptimized;
