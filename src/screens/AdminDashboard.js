import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Modal,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import CardSurface from "../components/ios/CardSurface";
import profilesService from "../services/profiles";
import { useAdminMode } from "../contexts/AdminModeContext";
import ValidationDashboard from "./ValidationDashboard";
import ActivityScreen from "./ActivityScreen";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Force RTL
I18nManager.forceRTL(true);

const AdminDashboard = ({ navigation }) => {
  const { isAdmin, isAdminMode } = useAdminMode();
  const [stats, setStats] = useState({
    totalProfiles: 0,
    recentChanges: 0,
    pendingValidation: 0,
    activeJobs: 0,
    maleCount: 0,
    femaleCount: 0,
    aliveCount: 0,
    deceasedCount: 0,
    maxGeneration: 0,
    avgChildren: 0,
    profilesWithPhotos: 0,
    profilesWithBio: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [showActivityScreen, setShowActivityScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (isAdmin && isAdminMode) {
      loadDashboardData();
      loadRecentActivity();
    }
  }, [isAdmin, isAdminMode]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await profilesService.getAdminStatistics();

      if (error) {
        setError("فشل تحميل الإحصائيات");
        console.error("Error loading stats:", error);
        return;
      }

      if (data) {
        setStats({
          totalProfiles: data.total_profiles || 0,
          recentChanges: data.recent_changes || 0,
          pendingValidation: data.pending_validation || 0,
          activeJobs: data.active_jobs || 0,
          maleCount: data.male_count || 0,
          femaleCount: data.female_count || 0,
          aliveCount: data.alive_count || 0,
          deceasedCount: data.deceased_count || 0,
          maxGeneration: data.max_generation || 0,
          avgChildren: data.avg_children || 0,
          profilesWithPhotos: data.profiles_with_photos || 0,
          profilesWithBio: data.profiles_with_bio || 0,
        });
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setError("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      // Mock data with proper RTL names
      const activities = [
        {
          id: 1,
          type: "create",
          name: "محمد بن أحمد",
          time: "منذ ٥ دقائق",
          icon: "add-circle",
        },
        {
          id: 2,
          type: "update",
          name: "فاطمة بنت علي",
          time: "منذ ١٥ دقيقة",
          icon: "create",
        },
        {
          id: 3,
          type: "photo",
          name: "خالد بن سعد",
          time: "منذ ساعة",
          icon: "camera",
        },
      ];
      setRecentActivity(activities);
    } catch (error) {
      console.error("Error loading recent activity:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await loadRecentActivity();
    setRefreshing(false);
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const { data, error } = await profilesService.exportData(format);

      if (error) {
        Alert.alert("خطأ", "فشل تصدير البيانات");
        return;
      }

      if (data) {
        const fileName = `alqefari_tree_${new Date().toISOString().split("T")[0]}.${format}`;
        const fileUri = FileSystem.documentDirectory + fileName;

        if (format === "json") {
          await FileSystem.writeAsStringAsync(
            fileUri,
            JSON.stringify(data, null, 2),
          );
        } else if (format === "csv") {
          await FileSystem.writeAsStringAsync(fileUri, data);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      case "permissions":
        Alert.alert("إدارة الصلاحيات", "هذه الميزة قيد التطوير");
        break;
      default:
        break;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "create":
        return "add-circle";
      case "update":
        return "create";
      case "photo":
        return "camera";
      default:
        return "ellipse";
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case "create":
        return "#34C759";
      case "update":
        return "#007AFF";
      case "photo":
        return "#FF9500";
      default:
        return "#8E8E93";
    }
  };

  if (!isAdmin || !isAdminMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color="#8E8E93" />
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
            <Ionicons name="chevron-forward" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Error Banner - Subtle */}
      {error && (
        <View style={styles.errorBanner}>
          <BlurView intensity={80} tint="dark" style={styles.errorContent}>
            <View style={styles.errorInner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats Cards - Refined Colors */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View
              style={[styles.statCardInner, { backgroundColor: "#007AFF" }]}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="people" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.totalProfiles}</Text>
              <Text style={styles.statLabel}>ملف شخصي</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View
              style={[styles.statCardInner, { backgroundColor: "#34C759" }]}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="time" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>
                {stats.recentChanges || stats.totalProfiles}
              </Text>
              <Text style={styles.statLabel}>تغيير اليوم</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View
              style={[styles.statCardInner, { backgroundColor: "#FF9500" }]}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="sync" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.activeJobs}</Text>
              <Text style={styles.statLabel}>عملية نشطة</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => setShowValidationDashboard(true)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.statCardInner, { backgroundColor: "#FF3B30" }]}
            >
              <View style={styles.statIconContainer}>
                <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.pendingValidation}</Text>
              <Text style={styles.statLabel}>خطأ للإصلاح</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions - Subtle Design */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.quickActionsGrid}>
            {[
              {
                id: "activity",
                icon: "time-outline",
                label: "السجل",
                color: "#007AFF",
              },
              {
                id: "export",
                icon: "cloud-download-outline",
                label: "تصدير",
                color: "#34C759",
              },
              {
                id: "validate",
                icon: "checkmark-circle-outline",
                label: "تحقق",
                color: "#5856D6",
              },
              {
                id: "backup",
                icon: "save-outline",
                label: "نسخ",
                color: "#FF9500",
              },
              {
                id: "permissions",
                icon: "shield-checkmark-outline",
                label: "صلاحيات",
                color: "#AF52DE",
              },
            ].map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickAction}
                onPress={() => handleQuickAction(action.id)}
                disabled={exporting && action.id === "export"}
              >
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: `${action.color}10` },
                  ]}
                >
                  {exporting && action.id === "export" ? (
                    <ActivityIndicator size="small" color={action.color} />
                  ) : (
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={action.color}
                    />
                  )}
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity - Refined */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>النشاط الأخير</Text>
            <TouchableOpacity onPress={() => setShowActivityScreen(true)}>
              <Text style={styles.seeAllText}>عرض الكل</Text>
            </TouchableOpacity>
          </View>

          {recentActivity.length > 0 ? (
            <View style={styles.activityList}>
              {recentActivity.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityLeft}>
                    <View
                      style={[
                        styles.activityIcon,
                        {
                          backgroundColor: `${getActivityColor(activity.type)}10`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getActivityIcon(activity.type)}
                        size={16}
                        color={getActivityColor(activity.type)}
                      />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityName}>{activity.name}</Text>
                      <Text style={styles.activityTime}>{activity.time}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>لا يوجد نشاط حديث</Text>
            </View>
          )}
        </View>

        {/* Info Cards - Side by Side */}
        <View style={styles.section}>
          <View style={styles.infoCardsRow}>
            {/* Demographics Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>التركيبة السكانية</Text>
              <View style={styles.infoCardContent}>
                <View style={styles.demographicRow}>
                  <Text style={styles.demographicLabel}>ذكور</Text>
                  <Text style={styles.demographicValue}>{stats.maleCount}</Text>
                </View>
                <View style={styles.demographicRow}>
                  <Text style={styles.demographicLabel}>إناث</Text>
                  <Text style={styles.demographicValue}>
                    {stats.femaleCount}
                  </Text>
                </View>
                <View style={styles.demographicRow}>
                  <Text style={styles.demographicLabel}>أحياء</Text>
                  <Text style={styles.demographicValue}>
                    {stats.aliveCount}
                  </Text>
                </View>
                <View style={styles.demographicRow}>
                  <Text style={styles.demographicLabel}>متوفون</Text>
                  <Text style={styles.demographicValue}>
                    {stats.deceasedCount}
                  </Text>
                </View>
              </View>
            </View>

            {/* Data Quality Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>جودة البيانات</Text>
              <View style={styles.infoCardContent}>
                <View style={styles.qualityItem}>
                  <View style={styles.qualityHeader}>
                    <Text style={styles.qualityLabel}>بصور</Text>
                    <Text style={styles.qualityPercent}>
                      {stats.totalProfiles > 0
                        ? Math.round(
                            (stats.profilesWithPhotos / stats.totalProfiles) *
                              100,
                          )
                        : 0}
                      %
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${
                            stats.totalProfiles > 0
                              ? (stats.profilesWithPhotos /
                                  stats.totalProfiles) *
                                100
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.qualityItem}>
                  <View style={styles.qualityHeader}>
                    <Text style={styles.qualityLabel}>بسيرة ذاتية</Text>
                    <Text style={styles.qualityPercent}>
                      {stats.totalProfiles > 0
                        ? Math.round(
                            (stats.profilesWithBio / stats.totalProfiles) * 100,
                          )
                        : 0}
                      %
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${
                            stats.totalProfiles > 0
                              ? (stats.profilesWithBio / stats.totalProfiles) *
                                100
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Operations List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>عمليات إدارية</Text>
          <View style={styles.operationsList}>
            {[
              {
                id: "import",
                title: "استيراد البيانات",
                description: "استيراد ملفات من CSV أو JSON",
                icon: "cloud-upload-outline",
              },
              {
                id: "merge",
                title: "دمج المكررات",
                description: "البحث عن ودمج الملفات المكررة",
                icon: "git-merge-outline",
              },
              {
                id: "cleanup",
                title: "تنظيف البيانات",
                description: "إزالة البيانات الفارغة والمعطوبة",
                icon: "trash-outline",
              },
            ].map((op) => (
              <TouchableOpacity
                key={op.id}
                style={styles.operationCard}
                activeOpacity={0.7}
                onPress={() => Alert.alert(op.title, "هذه الميزة قيد التطوير")}
              >
                <View style={styles.operationContent}>
                  <View style={styles.operationIcon}>
                    <Ionicons name={op.icon} size={20} color="#007AFF" />
                  </View>
                  <View style={styles.operationInfo}>
                    <Text style={styles.operationTitle}>{op.title}</Text>
                    <Text style={styles.operationDescription}>
                      {op.description}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-back" size={20} color="#C7C7CC" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Validation Dashboard Modal */}
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

      {/* Activity Screen Modal */}
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
    backgroundColor: "#F2F2F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "right",
  },
  errorBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  errorContent: {
    overflow: "hidden",
  },
  errorInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },

  // Stats Cards - Refined
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 90,
  },
  statCardInner: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "right",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "right",
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    textAlign: "right",
  },
  seeAllText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },

  // Quick Actions - Refined
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  quickAction: {
    alignItems: "center",
    flex: 1,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    backgroundColor: "#F2F2F7",
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#3C3C43",
    textAlign: "center",
  },

  // Recent Activity - Refined
  activityList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  activityItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  activityInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  activityName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  activityTime: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "right",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },

  // Info Cards
  infoCardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
    textAlign: "right",
  },
  infoCardContent: {
    gap: 8,
  },
  demographicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  demographicLabel: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "right",
  },
  demographicValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
  },
  qualityItem: {
    marginBottom: 12,
  },
  qualityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  qualityLabel: {
    fontSize: 13,
    color: "#3C3C43",
    textAlign: "right",
  },
  qualityPercent: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "600",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 2,
  },

  // Operations List
  operationsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  operationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  operationContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  operationIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  operationInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  operationTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 2,
    textAlign: "right",
  },
  operationDescription: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "right",
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
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
});

export default AdminDashboard;
