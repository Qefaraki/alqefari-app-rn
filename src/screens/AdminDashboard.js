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
        // Map snake_case to camelCase
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

      // Load recent activities
      const mockActivities = [
        {
          id: 1,
          type: "create",
          name: "محمد بن أحمد",
          time: "منذ ٥ دقائق",
        },
        {
          id: 2,
          type: "edit",
          name: "فاطمة بنت عبدالله",
          time: "منذ ١٥ دقيقة",
        },
        {
          id: 3,
          type: "delete",
          name: "ملف مكرر",
          time: "منذ ساعة",
        },
      ];
      setRecentActivity(mockActivities);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      Alert.alert("خطأ", "فشل تحميل بيانات لوحة التحكم");
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

      if (result?.error) {
        Alert.alert("خطأ", "فشل تصدير البيانات");
        return;
      }

      if (result?.data) {
        const fileName = `alqefari_tree_${new Date().toISOString().split("T")[0]}.${format}`;
        const fileUri = FileSystem.documentDirectory + fileName;

        if (format === "json") {
          await FileSystem.writeAsStringAsync(
            fileUri,
            JSON.stringify(result.data, null, 2),
          );
        } else if (format === "csv") {
          await FileSystem.writeAsStringAsync(fileUri, result.data);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("نجح", `تم حفظ الملف: ${fileName}`);
        }
      }
    } catch (error) {
      Alert.alert("خطأ", "فشل تصدير البيانات");
    } finally {
      setExporting(false);
    }
  };

  const handleQuickAction = async (action) => {
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
        Alert.alert(
          "النسخ الاحتياطي",
          "سيتم إنشاء نسخة احتياطية من قاعدة البيانات",
          [
            { text: "إلغاء", style: "cancel" },
            {
              text: "نسخ",
              onPress: () => Alert.alert("نجح", "تم إنشاء النسخة الاحتياطية"),
            },
          ],
        );
        break;
      default:
        Alert.alert("قيد التطوير", "هذه الميزة قيد التطوير");
        break;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "create":
        return "add-circle-outline";
      case "edit":
        return "create-outline";
      case "delete":
        return "trash-outline";
      default:
        return "ellipse-outline";
    }
  };

  const getActivityDotColor = (type) => {
    switch (type) {
      case "delete":
        return "#FF3B30";
      default:
        return "#007AFF";
    }
  };

  if (!isAdmin || !isAdminMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color="#C7C7CC" />
          <Text style={styles.errorText}>ليس لديك صلاحية الوصول</Text>
          <Text style={styles.errorSubtext}>
            يجب أن تكون مسؤولاً للوصول إلى هذه الصفحة
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-forward" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Ultra-minimal Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-forward" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#000000"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Primary Stat - Ultra Clean */}
        <View style={styles.primarySection}>
          <Text style={styles.primaryNumber}>{stats.totalProfiles}</Text>
          <Text style={styles.primaryLabel}>إجمالي الملفات</Text>
        </View>

        {/* Secondary Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.maleCount}</Text>
            <Text style={styles.statLabel}>ذكور</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.femaleCount}</Text>
            <Text style={styles.statLabel}>إناث</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.aliveCount}</Text>
            <Text style={styles.statLabel}>أحياء</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.deceasedCount}</Text>
            <Text style={styles.statLabel}>متوفون</Text>
          </View>
        </View>

        {/* Quick Actions - Icons Only */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleQuickAction("activity")}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="time-outline" size={26} color="#000000" />
              </View>
              <Text style={styles.actionText}>السجل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleQuickAction("validate")}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={26}
                  color="#000000"
                />
                {stats.pendingValidation > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {stats.pendingValidation}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionText}>تحقق</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleQuickAction("export")}
              disabled={exporting}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconContainer}>
                {exporting ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons name="download-outline" size={26} color="#000000" />
                )}
              </View>
              <Text style={styles.actionText}>تصدير</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleQuickAction("backup")}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="save-outline" size={26} color="#000000" />
              </View>
              <Text style={styles.actionText}>نسخ</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Quality - Ultra Minimal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>جودة البيانات</Text>
          <View style={styles.qualityContainer}>
            <View style={styles.qualityRow}>
              <Text style={styles.qualityLabel}>ملفات بصور</Text>
              <View style={styles.qualityRight}>
                <Text style={styles.qualityValue}>
                  {stats.profilesWithPhotos}/{stats.totalProfiles}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      stats.totalProfiles > 0
                        ? (stats.profilesWithPhotos / stats.totalProfiles) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>

            <View style={[styles.qualityRow, { marginTop: 20 }]}>
              <Text style={styles.qualityLabel}>ملفات بسيرة ذاتية</Text>
              <View style={styles.qualityRight}>
                <Text style={styles.qualityValue}>
                  {stats.profilesWithBio}/{stats.totalProfiles}
                </Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      stats.totalProfiles > 0
                        ? (stats.profilesWithBio / stats.totalProfiles) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Recent Activity - Ultra Clean */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>النشاط الأخير</Text>
            <TouchableOpacity onPress={() => setShowActivityScreen(true)}>
              <Text style={styles.viewAllText}>عرض الكل</Text>
            </TouchableOpacity>
          </View>

          {recentActivity.length > 0 ? (
            <View style={styles.activityList}>
              {recentActivity.map((activity, index) => (
                <TouchableOpacity
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    index === recentActivity.length - 1 &&
                      styles.lastActivityItem,
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.activityContent}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                  <View
                    style={[
                      styles.activityIndicator,
                      { backgroundColor: getActivityDotColor(activity.type) },
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>لا يوجد نشاط حديث</Text>
            </View>
          )}
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
            navigate: (screen) => console.log("Navigate to:", screen),
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
            navigate: (screen) => console.log("Navigate to:", screen),
          }}
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },

  // Header - Ultra Minimal
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    letterSpacing: -0.4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#8E8E93",
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Primary Stat - Hero Style
  primarySection: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  primaryNumber: {
    fontSize: 72,
    fontWeight: "200",
    color: "#000000",
    letterSpacing: -3,
    marginBottom: 8,
  },
  primaryLabel: {
    fontSize: 15,
    color: "#8E8E93",
    letterSpacing: -0.2,
  },

  // Stats Grid - Ultra Clean
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  statCard: {
    width: "50%",
    alignItems: "center",
    paddingVertical: 20,
  },
  statNumber: {
    fontSize: 34,
    fontWeight: "300",
    color: "#000000",
    letterSpacing: -1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#8E8E93",
    letterSpacing: -0.1,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: -0.5,
  },
  viewAllText: {
    fontSize: 15,
    color: "#007AFF",
  },

  // Quick Actions - Ultra Minimal
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    alignItems: "center",
    flex: 1,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F5F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    position: "relative",
  },
  actionText: {
    fontSize: 11,
    color: "#8E8E93",
    letterSpacing: -0.1,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Data Quality - Ultra Clean
  qualityContainer: {
    marginTop: 8,
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  qualityLabel: {
    fontSize: 15,
    color: "#000000",
  },
  qualityRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  qualityValue: {
    fontSize: 15,
    color: "#8E8E93",
  },
  progressBar: {
    height: 2,
    backgroundColor: "#F0F0F0",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#000000",
  },

  // Activity List - Ultra Minimal
  activityList: {
    marginTop: 8,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  lastActivityItem: {
    borderBottomWidth: 0,
  },
  activityContent: {
    flex: 1,
    alignItems: "flex-end",
  },
  activityName: {
    fontSize: 15,
    color: "#000000",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 13,
    color: "#8E8E93",
  },
  activityIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 12,
  },

  // Empty State
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#C7C7CC",
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
});

export default AdminDashboard;
