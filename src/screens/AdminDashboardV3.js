import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import pdfExportService from "../services/pdfExport";

// Lazy load heavy modals
const ValidationDashboard = React.lazy(() => import("./ValidationDashboard"));
const ActivityScreen = React.lazy(() => import("./ActivityScreen"));
const QuickAddOverlay = React.lazy(() => import("../components/admin/QuickAddOverlay"));
const ProfileConnectionManagerV2 = React.lazy(() => import("../components/admin/ProfileConnectionManagerV2"));
const AdminMessagesManager = React.lazy(() => import("../components/admin/AdminMessagesManager"));
const MunasibManager = React.lazy(() => import("../components/admin/MunasibManager"));
const SuggestionReviewManager = React.lazy(() => import("../components/admin/SuggestionReviewManager"));

// Cache for stats
let statsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const AdminDashboardV3 = ({ onClose, user, onToggleVersion }) => {
  // Core states
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validationIssues, setValidationIssues] = useState([]);
  const [dataHealth, setDataHealth] = useState(100);
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  // Modal states
  const [activeModal, setActiveModal] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadCriticalData();
    // Load secondary data after interaction
    InteractionManager.runAfterInteractions(() => {
      loadSecondaryData();
    });
  }, []);

  // Critical data - load immediately
  const loadCriticalData = async () => {
    const now = Date.now();

    // Check cache first
    if (statsCache && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION) {
      setStats(statsCache);
      setLoading(false);
      return;
    }

    try {
      // Fast count queries
      const [profileCount, marriageCount, pendingCount] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("marriages").select("*", { count: "exact", head: true }),
        supabase
          .from("profile_link_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      const quickStats = {
        total_profiles: profileCount.count || 0,
        total_marriages: marriageCount.count || 0,
        // Estimates for instant display
        alive_count: Math.floor((profileCount.count || 0) * 0.85),
        male_count: Math.floor((profileCount.count || 0) * 0.52),
        female_count: Math.floor((profileCount.count || 0) * 0.48),
      };

      setStats(quickStats);
      setPendingRequestsCount(pendingCount.count || 0);
      setLoading(false);

      // Get real stats in background
      const { data: realStats } = await supabase.rpc("admin_get_enhanced_statistics");
      if (realStats) {
        const fullStats = {
          ...quickStats,
          ...realStats.basic,
          munasib: realStats.munasib,
          data_quality: realStats.data_quality,
        };
        setStats(fullStats);
        statsCache = fullStats;
        cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error("Error loading critical data:", error);
      setLoading(false);
    }
  };

  // Secondary data - load after interaction
  const loadSecondaryData = async () => {
    try {
      // Load validation issues
      const { data: issues } = await supabase.rpc("admin_validation_dashboard");
      if (issues) {
        setValidationIssues(issues);
        const healthScore = Math.max(0, 100 - issues.length * 2);
        setDataHealth(Math.round(healthScore));
      }

      // Load recent activity
      const { data: activity } = await supabase
        .from("activity_log_detailed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

      if (activity) {
        setRecentActivity(activity);
      }
    } catch (error) {
      console.error("Error loading secondary data:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    statsCache = null; // Clear cache
    cacheTimestamp = null;
    await loadCriticalData();
    await loadSecondaryData();
    setRefreshing(false);
  };

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
              const { error } = await supabase.rpc("queue_all_layouts_recalculation");
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

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return "الآن";
    if (diff < 60) return `منذ ${diff}د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)}س`;
    return `منذ ${Math.floor(diff / 1440)}ي`;
  };

  const getHealthColor = () => {
    if (dataHealth >= 90) return "#10B981"; // Green
    if (dataHealth >= 70) return "#D58C4A"; // Desert Ochre
    return "#A13333"; // Najdi Crimson
  };

  const openModal = (modalName) => {
    setActiveModal(modalName);
  };

  const closeModal = () => {
    setActiveModal(null);
    if (activeModal === "linkRequests") {
      loadCriticalData(); // Refresh counts when closing
    }
  };

  // Render modals
  const renderModal = () => {
    if (!activeModal) return null;

    return (
      <React.Suspense fallback={
        <View style={styles.modalLoading}>
          <ActivityIndicator size="large" color="#A13333" />
        </View>
      }>
        {activeModal === "validation" && (
          <ValidationDashboard
            navigation={{ goBack: closeModal }}
          />
        )}
        {activeModal === "activity" && (
          <ActivityScreen onClose={closeModal} />
        )}
        {activeModal === "quickAdd" && (
          <QuickAddOverlay
            onClose={closeModal}
            onComplete={() => {
              closeModal();
              handleRefresh();
            }}
          />
        )}
        {activeModal === "linkRequests" && (
          <ProfileConnectionManagerV2 onBack={closeModal} />
        )}
        {activeModal === "messages" && (
          <AdminMessagesManager onClose={closeModal} />
        )}
        {activeModal === "munasib" && (
          <MunasibManager visible={true} onClose={closeModal} />
        )}
        {activeModal === "suggestions" && (
          <SuggestionReviewManager onClose={closeModal} />
        )}
      </React.Suspense>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A13333" />
      </View>
    );
  }

  // If modal is open, render it instead of dashboard
  if (activeModal) {
    return renderModal();
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Clean Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#242121" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image
            source={require('../../assets/logo/AlqefariEmblem.png')}
            style={styles.emblem}
            resizeMode="contain"
          />
          <Text style={styles.title}>الإدارة</Text>
        </View>
        <TouchableOpacity onPress={onToggleVersion} style={styles.toggleButton}>
          <Ionicons name="git-compare-outline" size={24} color="#A13333" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Compact Metrics Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.metricsContainer}
        >
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: "#A13333" }]}>
              {stats?.total_profiles || 0}
            </Text>
            <Text style={styles.metricLabel}>الأفراد</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: "#D58C4A" }]}>
              {stats?.alive_count || 0}
            </Text>
            <Text style={styles.metricLabel}>أحياء</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: getHealthColor() }]}>
              {dataHealth}%
            </Text>
            <Text style={styles.metricLabel}>صحة البيانات</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: "#242121" }]}>
              {stats?.munasib?.total_munasib || 0}
            </Text>
            <Text style={styles.metricLabel}>منتسبين</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: "#736372" }]}>
              {stats?.male_count || 0}
            </Text>
            <Text style={styles.metricLabel}>ذكور</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: "#736372" }]}>
              {stats?.female_count || 0}
            </Text>
            <Text style={styles.metricLabel}>إناث</Text>
          </View>
        </ScrollView>

        {/* Smart Status Card - Only show if issues */}
        {validationIssues.length > 0 && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="warning" size={20} color="#D58C4A" />
              <Text style={styles.statusText}>
                {validationIssues.length} مشاكل تحتاج مراجعة
              </Text>
            </View>
            <View style={styles.statusActions}>
              <TouchableOpacity
                style={styles.statusButton}
                onPress={handleAutoFix}
              >
                <Text style={styles.statusButtonText}>إصلاح تلقائي</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusButton, styles.statusButtonSecondary]}
                onPress={() => openModal("validation")}
              >
                <Text style={styles.statusButtonTextSecondary}>عرض التفاصيل</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Primary Actions Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => openModal("linkRequests")}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionLabel}>طلبات الربط</Text>
            {pendingRequestsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => openModal("quickAdd")}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={styles.actionLabel}>إضافة فرد</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => openModal("munasib")}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionLabel}>المنتسبين</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={handleExportDatabase}
            activeOpacity={0.8}
            disabled={exporting}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>
              {exporting ? "جاري..." : "التقارير"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Compact Activity Feed */}
        {recentActivity.length > 0 && (
          <View style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Text style={styles.sectionTitle}>آخر النشاطات</Text>
              <TouchableOpacity onPress={() => openModal("activity")}>
                <Text style={styles.viewAll}>عرض الكل ←</Text>
              </TouchableOpacity>
            </View>
            {recentActivity.slice(0, 2).map((activity) => (
              <View key={activity.id} style={styles.activityLine}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityName}>
                    {activity.actor_name || "مجهول"}
                  </Text>
                  {" • "}
                  {activity.action === "INSERT"
                    ? "أضاف ملف جديد"
                    : activity.action === "UPDATE"
                    ? "عدّل ملف"
                    : "حذف ملف"}
                </Text>
                <Text style={styles.activityTime}>
                  {formatTimeAgo(activity.created_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Family Stats Summary */}
        {stats?.munasib?.top_families?.length > 0 && (
          <TouchableOpacity
            style={styles.familyStatsCard}
            onPress={() => openModal("munasib")}
            activeOpacity={0.8}
          >
            <View style={styles.familyStatsContent}>
              <Text style={styles.familyStatsTitle}>أكثر العائلات المنتسبة</Text>
              <Text style={styles.familyStatsSummary}>
                {stats.munasib.top_families.slice(0, 3).map(f =>
                  `${f.family_name} (${f.count})`
                ).join(" • ")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#24212199" />
          </TouchableOpacity>
        )}

        {/* Secondary Actions - Collapsible */}
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setExpandedSection(expandedSection === "tools" ? null : "tools")}
          activeOpacity={0.7}
        >
          <Text style={styles.collapsibleTitle}>أدوات إضافية</Text>
          <Ionicons
            name={expandedSection === "tools" ? "chevron-up" : "chevron-down"}
            size={20}
            color="#24212199"
          />
        </TouchableOpacity>

        {expandedSection === "tools" && (
          <View style={styles.collapsibleContent}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleRecalculateLayouts}
            >
              <Text style={styles.menuIcon}>🔄</Text>
              <Text style={styles.menuLabel}>إعادة حساب التخطيط</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openModal("activity")}
            >
              <Text style={styles.menuIcon}>📋</Text>
              <Text style={styles.menuLabel}>سجل التدقيق</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openModal("messages")}
            >
              <Text style={styles.menuIcon}>💬</Text>
              <Text style={styles.menuLabel}>الرسائل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => openModal("suggestions")}
            >
              <Text style={styles.menuIcon}>💡</Text>
              <Text style={styles.menuLabel}>الاقتراحات</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F7F3",
  },
  modalLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F7F3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9F7F3",
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340",
  },
  closeButton: {
    padding: 8,
  },
  toggleButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  emblem: {
    width: 28,
    height: 28,
    tintColor: "#242121",
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121",
  },
  metricsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 12,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: "#24212199",
    fontFamily: "SF Arabic",
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400E",
    marginLeft: 8,
    fontFamily: "SF Arabic",
  },
  statusActions: {
    flexDirection: "row",
    gap: 12,
  },
  statusButton: {
    flex: 1,
    backgroundColor: "#D58C4A",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  statusButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D58C4A",
  },
  statusButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  statusButtonTextSecondary: {
    color: "#D58C4A",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionTile: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    margin: "1.5%",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#A13333",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  activityCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  viewAll: {
    fontSize: 14,
    color: "#A13333",
    fontFamily: "SF Arabic",
  },
  activityLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  activityName: {
    fontWeight: "600",
  },
  activityTime: {
    fontSize: 12,
    color: "#24212199",
    marginLeft: 8,
  },
  familyStatsCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  familyStatsContent: {
    flex: 1,
  },
  familyStatsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  familyStatsSummary: {
    fontSize: 13,
    color: "#24212199",
    fontFamily: "SF Arabic",
  },
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#F9F7F3",
    marginTop: 8,
  },
  collapsibleTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  collapsibleContent: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 15,
    color: "#242121",
    fontFamily: "SF Arabic",
  },
});

export default AdminDashboardV3;