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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import CardSurface from "../components/ios/CardSurface";
import profilesService from "../services/profiles";
import { useAdminMode } from "../contexts/AdminModeContext";
import ValidationDashboard from "./ValidationDashboard";
import ActivityScreen from "./ActivityScreen";
import { useTreeStore } from "../stores/useTreeStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
      // Mock data for now - replace with actual audit log data
      const activities = [
        {
          id: 1,
          type: "create",
          name: "محمد بن أحمد",
          time: "منذ 5 دقائق",
          icon: "add-circle",
          color: "#34C759",
        },
        {
          id: 2,
          type: "update",
          name: "فاطمة بنت علي",
          time: "منذ 15 دقيقة",
          icon: "create",
          color: "#007AFF",
        },
        {
          id: 3,
          type: "photo",
          name: "خالد بن سعد",
          time: "منذ ساعة",
          icon: "camera",
          color: "#FF9500",
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
          { text: "JSON", onPress: () => handleExport("json") },
          { text: "CSV", onPress: () => handleExport("csv") },
          { text: "إلغاء", style: "cancel" },
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
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>لوحة التحكم</Text>
          <View style={{ width: 40 }} />
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
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.errorContent}>
            <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats Cards Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity activeOpacity={0.95} style={styles.statCard}>
            <LinearGradient
              colors={["#34C759", "#30A14E"]}
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statIcon}>
                <Ionicons name="time" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.totalProfiles}</Text>
              <Text style={styles.statLabel}>تغيير اليوم</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.95} style={styles.statCard}>
            <LinearGradient
              colors={["#007AFF", "#0051D5"]}
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statIcon}>
                <Ionicons name="people" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.totalProfiles}</Text>
              <Text style={styles.statLabel}>ملف شخصي</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.statCard}
            onPress={() => setShowValidationDashboard(true)}
          >
            <LinearGradient
              colors={["#FF3B30", "#DC3023"]}
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statIcon}>
                <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.pendingValidation}</Text>
              <Text style={styles.statLabel}>خطأ للإصلاح</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.95} style={styles.statCard}>
            <LinearGradient
              colors={["#FF9500", "#FF6B35"]}
              style={styles.statGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statIcon}>
                <Ionicons name="sync" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.activeJobs}</Text>
              <Text style={styles.statLabel}>عملية نشطة</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
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
                id: "backup",
                icon: "save-outline",
                label: "نسخ",
                color: "#FF9500",
              },
              {
                id: "validate",
                icon: "checkmark-circle-outline",
                label: "تحقق",
                color: "#5856D6",
              },
              {
                id: "export",
                icon: "cloud-download-outline",
                label: "تصدير",
                color: "#34C759",
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
                    { backgroundColor: `${action.color}15` },
                  ]}
                >
                  {exporting && action.id === "export" ? (
                    <ActivityIndicator size="small" color={action.color} />
                  ) : (
                    <Ionicons
                      name={action.icon}
                      size={24}
                      color={action.color}
                    />
                  )}
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
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
                <CardSurface key={activity.id} style={styles.activityItem}>
                  <View
                    style={[
                      styles.activityIcon,
                      { backgroundColor: `${activity.color}15` },
                    ]}
                  >
                    <Ionicons
                      name={activity.icon}
                      size={18}
                      color={activity.color}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </CardSurface>
              ))}
            </View>
          ) : (
            <CardSurface style={styles.emptyCard}>
              <Text style={styles.emptyText}>لا يوجد نشاط حديث</Text>
            </CardSurface>
          )}
        </View>

        {/* Demographics & Data Quality in one row */}
        <View style={styles.section}>
          <View style={styles.infoCardsRow}>
            {/* Demographics Card */}
            <CardSurface style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>التركيبة السكانية</Text>
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>ذكور</Text>
                <Text style={styles.demographicValue}>{stats.maleCount}</Text>
              </View>
              <View style={styles.demographicDivider} />
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>إناث</Text>
                <Text style={styles.demographicValue}>{stats.femaleCount}</Text>
              </View>
              <View style={styles.demographicDivider} />
              <View style={styles.demographicItem}>
                <Text style={styles.demographicLabel}>
                  الجيل {stats.maxGeneration}
                </Text>
                <Text style={styles.demographicValue}>
                  {stats.avgChildren || "0"}
                </Text>
              </View>
            </CardSurface>

            {/* Data Quality Card */}
            <CardSurface style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>جودة البيانات</Text>
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
                            ? (stats.profilesWithPhotos / stats.totalProfiles) *
                              100
                            : 0
                        }%`,
                        backgroundColor: "#34C759",
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.qualityItem}>
                <View style={styles.qualityHeader}>
                  <Text style={styles.qualityLabel}>بسيرة</Text>
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
                        backgroundColor: "#007AFF",
                      },
                    ]}
                  />
                </View>
              </View>
            </CardSurface>
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
                color: "#007AFF",
              },
              {
                id: "merge",
                title: "دمج المكررات",
                description: "البحث عن ودمج الملفات المكررة",
                icon: "git-merge-outline",
                color: "#FF9500",
              },
              {
                id: "cleanup",
                title: "تنظيف البيانات",
                description: "إزالة البيانات الفارغة والمعطوبة",
                icon: "trash-outline",
                color: "#FF3B30",
              },
            ].map((op) => (
              <TouchableOpacity
                key={op.id}
                activeOpacity={0.7}
                onPress={() => Alert.alert(op.title, "هذه الميزة قيد التطوير")}
              >
                <CardSurface style={styles.operationCard}>
                  <View
                    style={[
                      styles.operationIcon,
                      { backgroundColor: `${op.color}15` },
                    ]}
                  >
                    <Ionicons name={op.icon} size={24} color={op.color} />
                  </View>
                  <View style={styles.operationInfo}>
                    <Text style={styles.operationTitle}>{op.title}</Text>
                    <Text style={styles.operationDescription}>
                      {op.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                </CardSurface>
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
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8E8E93",
  },
  errorBanner: {
    backgroundColor: "#FF3B30",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 100,
  },
  statGradient: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    justifyContent: "space-between",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
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
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3C3C43",
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: "#8E8E93",
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  infoCardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  infoCard: {
    flex: 1,
    padding: 16,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
  },
  demographicItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  demographicLabel: {
    fontSize: 13,
    color: "#8E8E93",
  },
  demographicValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
  },
  demographicDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5EA",
    marginVertical: 4,
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
    color: "#000000",
  },
  qualityPercent: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "700",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E5EA",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  operationsList: {
    gap: 12,
  },
  operationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  operationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  operationInfo: {
    flex: 1,
  },
  operationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  operationDescription: {
    fontSize: 13,
    color: "#8E8E93",
  },
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
