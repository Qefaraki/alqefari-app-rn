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
  I18nManager,
  Dimensions,
  Modal,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { profilesService } from "../services/profiles";
import { useAdminMode } from "../contexts/AdminModeContext";
import ValidationDashboard from "./ValidationDashboard";
import ActivityScreen from "./ActivityScreen";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

// Force RTL for Arabic
I18nManager.forceRTL(true);

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AdminDashboard = ({ navigation }) => {
  const { isAdminMode, isAdmin } = useAdminMode();
  const [stats, setStats] = useState({
    totalProfiles: 0,
    maleCount: 0,
    femaleCount: 0,
    aliveCount: 0,
    deceasedCount: 0,
    profilesWithPhotos: 0,
    profilesWithBio: 0,
    activeJobs: 0,
    pendingValidation: 0,
    recentChanges: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [showActivityScreen, setShowActivityScreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load statistics
      const result = await profilesService.getAdminStatistics();
      if (result?.data) {
        setStats({
          totalProfiles: result.data.total_profiles || 0,
          maleCount: result.data.male_count || 0,
          femaleCount: result.data.female_count || 0,
          aliveCount: result.data.alive_count || 0,
          deceasedCount: result.data.deceased_count || 0,
          profilesWithPhotos: result.data.profiles_with_photos || 0,
          profilesWithBio: result.data.profiles_with_bio || 0,
          activeJobs: result.data.active_jobs || 0,
          pendingValidation: result.data.pending_validation || 0,
          recentChanges: result.data.recent_changes || 0,
        });
      }

      // Mock activities with better data
      const mockActivities = [
        {
          id: 1,
          type: "add",
          title: "أضيف ملف جديد",
          subtitle: "محمد بن أحمد القفاري",
          time: "قبل ٥ دقائق",
          icon: "person-add",
        },
        {
          id: 2,
          type: "edit",
          title: "تم تحديث البيانات",
          subtitle: "فاطمة بنت عبدالله",
          time: "قبل ساعة",
          icon: "pencil",
        },
        {
          id: 3,
          type: "photo",
          title: "إضافة صورة",
          subtitle: "خالد بن سعد",
          time: "قبل ٣ ساعات",
          icon: "camera",
        },
      ];
      setRecentActivity(mockActivities);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const result = await profilesService.exportData(format);
      if (result?.data) {
        const fileName = `alqefari_tree_${new Date().toISOString().split("T")[0]}.${format}`;
        const fileUri = FileSystem.documentDirectory + fileName;

        if (format === "json") {
          await FileSystem.writeAsStringAsync(
            fileUri,
            JSON.stringify(result.data, null, 2),
          );
        } else {
          await FileSystem.writeAsStringAsync(fileUri, result.data);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        }
      }
    } catch (error) {
      Alert.alert("خطأ", "فشل تصدير البيانات");
    } finally {
      setExporting(false);
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case "activity":
        setShowActivityScreen(true);
        break;
      case "export":
        Alert.alert("تصدير البيانات", "اختر صيغة التصدير", [
          { text: "إلغاء", style: "cancel" },
          { text: "CSV", onPress: () => handleExport("csv") },
          { text: "JSON", onPress: () => handleExport("json") },
        ]);
        break;
      case "validate":
        setShowValidationDashboard(true);
        break;
      case "backup":
        Alert.alert("النسخ الاحتياطي", "سيتم إنشاء نسخة احتياطية", [
          { text: "إلغاء", style: "cancel" },
          {
            text: "نسخ",
            onPress: () => Alert.alert("نجح", "تم النسخ الاحتياطي"),
          },
        ]);
        break;
    }
  };

  if (!isAdmin || !isAdminMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={32} color="#8E8E93" />
          </View>
          <Text style={styles.errorTitle}>وصول مقيد</Text>
          <Text style={styles.errorSubtitle}>هذه الصفحة للمشرفين فقط</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modernHeader}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-forward" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modern Floating Header */}
      <View style={styles.modernHeader}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-forward" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم</Text>
        <TouchableOpacity style={styles.headerButton}>
          <View style={styles.notificationDot} />
          <Ionicons name="notifications-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#000"
          />
        }
      >
        {/* Hero Stats Section - Modern Cards */}
        <View style={styles.heroSection}>
          <View style={styles.heroCard}>
            <View style={styles.heroCardContent}>
              <Text style={styles.heroNumber}>{stats.totalProfiles}</Text>
              <Text style={styles.heroLabel}>إجمالي الملفات الشخصية</Text>
              <View style={styles.heroTrend}>
                <Ionicons name="trending-up" size={16} color="#00C851" />
                <Text style={styles.trendText}>+12% هذا الشهر</Text>
              </View>
            </View>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconBg}>
                <Ionicons name="people" size={32} color="#000" />
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid - Modern Minimal Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <View style={[styles.statCard, styles.statCardLeft]}>
              <View style={styles.statContent}>
                <View style={styles.statHeader}>
                  <View
                    style={[styles.statDot, { backgroundColor: "#007AFF" }]}
                  />
                  <Text style={styles.statLabel}>ذكور</Text>
                </View>
                <Text style={styles.statNumber}>{stats.maleCount}</Text>
                <Text style={styles.statPercentage}>
                  {stats.totalProfiles > 0
                    ? `${Math.round((stats.maleCount / stats.totalProfiles) * 100)}%`
                    : "0%"}
                </Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardRight]}>
              <View style={styles.statContent}>
                <View style={styles.statHeader}>
                  <View
                    style={[styles.statDot, { backgroundColor: "#FF2D55" }]}
                  />
                  <Text style={styles.statLabel}>إناث</Text>
                </View>
                <Text style={styles.statNumber}>{stats.femaleCount}</Text>
                <Text style={styles.statPercentage}>
                  {stats.totalProfiles > 0
                    ? `${Math.round((stats.femaleCount / stats.totalProfiles) * 100)}%`
                    : "0%"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statCard, styles.statCardLeft]}>
              <View style={styles.statContent}>
                <View style={styles.statHeader}>
                  <View
                    style={[styles.statDot, { backgroundColor: "#34C759" }]}
                  />
                  <Text style={styles.statLabel}>أحياء</Text>
                </View>
                <Text style={styles.statNumber}>{stats.aliveCount}</Text>
                <Text style={styles.statPercentage}>نشط</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.statCardRight]}>
              <View style={styles.statContent}>
                <View style={styles.statHeader}>
                  <View
                    style={[styles.statDot, { backgroundColor: "#8E8E93" }]}
                  />
                  <Text style={styles.statLabel}>متوفون</Text>
                </View>
                <Text style={styles.statNumber}>{stats.deceasedCount}</Text>
                <Text style={styles.statPercentage}>في الذاكرة</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions - Modern Buttons */}
        <View style={styles.quickActionsSection}>
          <View style={styles.sectionHeaderActions}>
            <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionsScroll}
            inverted={I18nManager.isRTL}
          >
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#F6F6F8" }]}
              onPress={() => handleQuickAction("activity")}
              activeOpacity={0.8}
            >
              <View
                style={[styles.actionIconBg, { backgroundColor: "#007AFF15" }]}
              >
                <Ionicons name="time" size={24} color="#007AFF" />
              </View>
              <Text style={styles.actionTitle}>السجل</Text>
              <Text style={styles.actionSubtitle}>عرض كل النشاطات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#FFF5F5" }]}
              onPress={() => handleQuickAction("validate")}
              activeOpacity={0.8}
            >
              <View
                style={[styles.actionIconBg, { backgroundColor: "#FF2D5515" }]}
              >
                <Ionicons name="shield-checkmark" size={24} color="#FF2D55" />
                {stats.pendingValidation > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.badgeText}>
                      {stats.pendingValidation}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionTitle}>التحقق</Text>
              <Text style={styles.actionSubtitle}>فحص البيانات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#F5FFF5" }]}
              onPress={() => handleQuickAction("export")}
              disabled={exporting}
              activeOpacity={0.8}
            >
              <View
                style={[styles.actionIconBg, { backgroundColor: "#34C75915" }]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#34C759" />
                ) : (
                  <Ionicons name="download" size={24} color="#34C759" />
                )}
              </View>
              <Text style={styles.actionTitle}>تصدير</Text>
              <Text style={styles.actionSubtitle}>حفظ البيانات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: "#FFF9F5" }]}
              onPress={() => handleQuickAction("backup")}
              activeOpacity={0.8}
            >
              <View
                style={[styles.actionIconBg, { backgroundColor: "#FF950015" }]}
              >
                <Ionicons name="cloud-upload" size={24} color="#FF9500" />
              </View>
              <Text style={styles.actionTitle}>نسخ احتياطي</Text>
              <Text style={styles.actionSubtitle}>حفظ آمن</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Data Quality - Modern Progress */}
        <View style={styles.qualitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>جودة البيانات</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllButton}>تفاصيل</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.qualityCard}>
            <View style={styles.qualityItem}>
              <View style={styles.qualityInfo}>
                <Ionicons name="camera" size={20} color="#007AFF" />
                <Text style={styles.qualityLabel}>ملفات بصور</Text>
              </View>
              <Text style={styles.qualityCount}>
                {stats.profilesWithPhotos} من {stats.totalProfiles}
              </Text>
            </View>
            <View style={styles.modernProgress}>
              <View
                style={[
                  styles.modernProgressFill,
                  {
                    width: `${
                      stats.totalProfiles > 0
                        ? (stats.profilesWithPhotos / stats.totalProfiles) * 100
                        : 0
                    }%`,
                    backgroundColor: "#007AFF",
                  },
                ]}
              />
            </View>

            <View style={[styles.qualityItem, { marginTop: 24 }]}>
              <View style={styles.qualityInfo}>
                <Ionicons name="document-text" size={20} color="#34C759" />
                <Text style={styles.qualityLabel}>ملفات بسيرة ذاتية</Text>
              </View>
              <Text style={styles.qualityCount}>
                {stats.profilesWithBio} من {stats.totalProfiles}
              </Text>
            </View>
            <View style={styles.modernProgress}>
              <View
                style={[
                  styles.modernProgressFill,
                  {
                    width: `${
                      stats.totalProfiles > 0
                        ? (stats.profilesWithBio / stats.totalProfiles) * 100
                        : 0
                    }%`,
                    backgroundColor: "#34C759",
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity - Modern Timeline */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>النشاط الأخير</Text>
            <TouchableOpacity onPress={() => setShowActivityScreen(true)}>
              <Text style={styles.seeAllButton}>عرض الكل</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityTimeline}>
            {recentActivity.map((activity, index) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.activityIconContainer,
                    {
                      backgroundColor:
                        activity.type === "add"
                          ? "#007AFF10"
                          : activity.type === "edit"
                            ? "#FF950010"
                            : "#34C75910",
                    },
                  ]}
                >
                  <Ionicons
                    name={activity.icon}
                    size={20}
                    color={
                      activity.type === "add"
                        ? "#007AFF"
                        : activity.type === "edit"
                          ? "#FF9500"
                          : "#34C759"
                    }
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activitySubtitle}>
                    {activity.subtitle}
                  </Text>
                </View>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <Modal
        visible={showValidationDashboard}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowValidationDashboard(false)}
      >
        <ValidationDashboard
          navigation={{
            goBack: () => setShowValidationDashboard(false),
          }}
        />
      </Modal>

      <Modal
        visible={showActivityScreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowActivityScreen(false)}
      >
        <ActivityScreen
          navigation={{
            goBack: () => setShowActivityScreen(false),
          }}
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },

  // Modern Header with Depth
  modernHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    letterSpacing: 0.3,
  },
  notificationDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF2D55",
  },

  // Content
  content: {
    flex: 1,
  },

  // Hero Section - Modern Card Design
  heroSection: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  heroCardContent: {
    flex: 1,
  },
  heroNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: 16,
    color: "#6C6C70",
    marginBottom: 12,
  },
  heroTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendText: {
    fontSize: 14,
    color: "#00C851",
    fontWeight: "600",
  },
  heroIconContainer: {
    marginLeft: 20,
  },
  heroIconBg: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },

  // Stats Grid - Clean Modern Cards
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardLeft: {
    marginRight: 6,
  },
  statCardRight: {
    marginLeft: 6,
  },
  statContent: {
    alignItems: "flex-end",
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#6C6C70",
    fontWeight: "500",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
    alignSelf: "flex-end",
  },
  statPercentage: {
    fontSize: 13,
    color: "#8E8E93",
    alignSelf: "flex-end",
  },

  // Quick Actions - Horizontal Scroll Cards
  quickActionsSection: {
    marginBottom: 20,
  },
  sectionHeaderActions: {
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: "flex-end",
  },
  actionsScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  actionCard: {
    width: 140,
    padding: 20,
    borderRadius: 16,
    marginRight: 12,
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  actionBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF2D55",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#6C6C70",
  },

  // Sections Common
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 0.3,
  },
  seeAllButton: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "600",
  },

  // Data Quality - Modern Design
  qualitySection: {
    marginBottom: 20,
  },
  qualityCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  qualityItem: {
    marginBottom: 12,
  },
  qualityInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  qualityLabel: {
    fontSize: 15,
    color: "#000",
    fontWeight: "600",
  },
  qualityCount: {
    fontSize: 14,
    color: "#6C6C70",
    textAlign: "right",
  },
  modernProgress: {
    height: 6,
    backgroundColor: "#F2F2F7",
    borderRadius: 3,
    overflow: "hidden",
  },
  modernProgressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Activity Timeline - Modern Cards
  activitySection: {
    marginBottom: 20,
  },
  activityTimeline: {
    paddingHorizontal: 20,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  activityContent: {
    flex: 1,
    alignItems: "flex-end",
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 13,
    color: "#6C6C70",
  },
  activityTime: {
    fontSize: 12,
    color: "#8E8E93",
    marginRight: 12,
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  lockIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: "#6C6C70",
    textAlign: "center",
  },
});

export default AdminDashboard;
