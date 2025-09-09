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
  Platform,
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
import { useTreeStore } from "../stores/useTreeStore";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withSpring,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// System Status Indicator Component
const SystemStatusIndicator = ({ loading = false, error = null, onClose }) => {
  const translateY = useSharedValue(error ? 0 : -100);
  const nodes = useTreeStore((state) => state.nodes);
  const [systemHealth, setSystemHealth] = useState("healthy");

  useEffect(() => {
    translateY.value = withSpring(error ? 0 : -100);
  }, [error]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!error && systemHealth === "healthy") return null;

  return (
    <Animated.View style={[styles.statusIndicator, animatedStyle]}>
      <BlurView intensity={90} tint="dark" style={styles.statusBlur}>
        <View style={styles.statusContent}>
          <View style={styles.statusLeft}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: error ? "#FF3B30" : "#34C759" },
              ]}
            />
            <Text style={styles.statusText}>
              {error || "النظام يعمل بشكل طبيعي"}
            </Text>
          </View>
          {error && (
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </Animated.View>
  );
};

const AdminDashboard = ({ navigation }) => {
  const { isAdmin, isAdminMode } = useAdminMode();
  const [activeTab, setActiveTab] = useState("overview");
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
  const [systemError, setSystemError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  const tabAnimation = useSharedValue(0);

  useEffect(() => {
    if (isAdmin && isAdminMode) {
      loadDashboardData();
      loadRecentActivity();
    }
  }, [isAdmin, isAdminMode]);

  useEffect(() => {
    tabAnimation.value = withSpring(activeTab === "overview" ? 0 : 1, {
      damping: 15,
      stiffness: 150,
    });
  }, [activeTab]);

  const loadDashboardData = async () => {
    try {
      const { data, error } = await profilesService.getAdminStatistics();

      if (error) {
        setSystemError(error.message || "فشل تحميل الإحصائيات");
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
      setSystemError("خطأ في تحميل البيانات");
    }
  };

  const loadRecentActivity = async () => {
    try {
      // Load recent activity from audit log or activity feed
      const activities = [
        { id: 1, type: "create", name: "محمد بن أحمد", time: "منذ 5 دقائق" },
        { id: 2, type: "update", name: "فاطمة بنت علي", time: "منذ 15 دقيقة" },
        { id: 3, type: "photo", name: "خالد بن سعد", time: "منذ ساعة" },
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
        Alert.alert("خطأ", error.message || "فشل تصدير البيانات");
        return;
      }

      if (data) {
        const fileName = `alqefari_tree_${new Date().toISOString()}.${format}`;
        const fileUri = FileSystem.documentDirectory + fileName;

        if (format === "json") {
          await FileSystem.writeAsStringAsync(
            fileUri,
            JSON.stringify(data, null, 2),
          );
        } else if (format === "csv") {
          const csv = convertToCSV(data);
          await FileSystem.writeAsStringAsync(fileUri, csv);
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

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return "";
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(","));
    return [headers, ...rows].join("\n");
  };

  const handleOperation = async (operationId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (operationId) {
      case "export":
        Alert.alert("تصدير البيانات", "اختر صيغة التصدير", [
          { text: "JSON", onPress: () => handleExport("json") },
          { text: "CSV", onPress: () => handleExport("csv") },
          { text: "إلغاء", style: "cancel" },
        ]);
        break;
      case "import":
        Alert.alert("استيراد البيانات", "هذه الميزة قيد التطوير");
        break;
      case "validate":
        setShowValidationDashboard(true);
        break;
      case "merge":
        Alert.alert("دمج المكررات", "هذه الميزة قيد التطوير");
        break;
      case "activity":
        setShowActivityScreen(true);
        break;
      case "backup":
        Alert.alert("النسخ الاحتياطي", "هذه الميزة قيد التطوير");
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

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          tabAnimation.value,
          [0, 1],
          [0, SCREEN_WIDTH / 2],
        ),
      },
    ],
  }));

  const getActivityIcon = (type) => {
    switch (type) {
      case "create":
        return { name: "add-circle", color: "#34C759" };
      case "update":
        return { name: "create", color: "#007AFF" };
      case "photo":
        return { name: "camera", color: "#FF9500" };
      default:
        return { name: "ellipse", color: "#8E8E93" };
    }
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* System Status */}
      {systemError && (
        <SystemStatusIndicator
          error={systemError}
          onClose={() => setSystemError(null)}
        />
      )}

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <TouchableOpacity activeOpacity={0.7} style={styles.statCard}>
          <LinearGradient
            colors={["#007AFF", "#0051D5"]}
            style={styles.statGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="people" size={28} color="#FFFFFF" />
            <Text style={styles.statNumber}>{stats.totalProfiles}</Text>
            <Text style={styles.statLabel}>ملف شخصي</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} style={styles.statCard}>
          <LinearGradient
            colors={["#34C759", "#30A14E"]}
            style={styles.statGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="time" size={28} color="#FFFFFF" />
            <Text style={styles.statNumber}>{stats.recentChanges}</Text>
            <Text style={styles.statLabel}>تغيير اليوم</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} style={styles.statCard}>
          <LinearGradient
            colors={["#FF9500", "#FF6B35"]}
            style={styles.statGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sync" size={28} color="#FFFFFF" />
            <Text style={styles.statNumber}>{stats.activeJobs}</Text>
            <Text style={styles.statLabel}>عملية نشطة</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.statCard}
          onPress={() => setShowValidationDashboard(true)}
        >
          <LinearGradient
            colors={["#FF3B30", "#DC3023"]}
            style={styles.statGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
            <Text style={styles.statNumber}>{stats.pendingValidation}</Text>
            <Text style={styles.statLabel}>خطأ للإصلاح</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActionsScroll}
        >
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("activity")}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#007AFF15" }]}
            >
              <Ionicons name="time-outline" size={28} color="#007AFF" />
            </View>
            <Text style={styles.quickActionText}>السجل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("export")}
            disabled={exporting}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#34C75915" }]}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#34C759" />
              ) : (
                <Ionicons
                  name="cloud-download-outline"
                  size={28}
                  color="#34C759"
                />
              )}
            </View>
            <Text style={styles.quickActionText}>تصدير</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("validate")}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#5856D615" }]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={28}
                color="#5856D6"
              />
            </View>
            <Text style={styles.quickActionText}>تحقق</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("backup")}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#FF950015" }]}
            >
              <Ionicons name="save-outline" size={28} color="#FF9500" />
            </View>
            <Text style={styles.quickActionText}>نسخ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("permissions")}
          >
            <View
              style={[styles.quickActionIcon, { backgroundColor: "#AF52DE15" }]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={28}
                color="#AF52DE"
              />
            </View>
            <Text style={styles.quickActionText}>صلاحيات</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>النشاط الأخير</Text>
          <TouchableOpacity onPress={() => handleOperation("activity")}>
            <Text style={styles.seeAllText}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        {recentActivity.length > 0 ? (
          <View style={styles.activityList}>
            {recentActivity.map((activity) => {
              const icon = getActivityIcon(activity.type);
              return (
                <CardSurface key={activity.id} style={styles.activityItem}>
                  <View
                    style={[
                      styles.activityIcon,
                      { backgroundColor: `${icon.color}15` },
                    ]}
                  >
                    <Ionicons name={icon.name} size={20} color={icon.color} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>{activity.name}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </CardSurface>
              );
            })}
          </View>
        ) : (
          <CardSurface style={styles.emptyActivity}>
            <Text style={styles.emptyText}>لا يوجد نشاط حديث</Text>
          </CardSurface>
        )}
      </View>

      {/* Demographics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التركيبة السكانية</Text>
        <CardSurface style={styles.demographicsCard}>
          <View style={styles.demographicRow}>
            <View style={styles.demographicItem}>
              <Text style={styles.demographicLabel}>ذكور</Text>
              <Text style={styles.demographicValue}>{stats.maleCount}</Text>
            </View>
            <View style={styles.demographicDivider} />
            <View style={styles.demographicItem}>
              <Text style={styles.demographicLabel}>إناث</Text>
              <Text style={styles.demographicValue}>{stats.femaleCount}</Text>
            </View>
          </View>
          <View style={styles.demographicRow}>
            <View style={styles.demographicItem}>
              <Text style={styles.demographicLabel}>أحياء</Text>
              <Text style={styles.demographicValue}>{stats.aliveCount}</Text>
            </View>
            <View style={styles.demographicDivider} />
            <View style={styles.demographicItem}>
              <Text style={styles.demographicLabel}>متوفون</Text>
              <Text style={styles.demographicValue}>{stats.deceasedCount}</Text>
            </View>
          </View>
        </CardSurface>
      </View>

      {/* Data Quality */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>جودة البيانات</Text>
        <CardSurface style={styles.qualityCard}>
          <View style={styles.qualityItem}>
            <View style={styles.qualityHeader}>
              <Text style={styles.qualityLabel}>ملفات بصور</Text>
              <Text style={styles.qualityPercent}>
                {stats.totalProfiles > 0
                  ? Math.round(
                      (stats.profilesWithPhotos / stats.totalProfiles) * 100,
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
                        ? (stats.profilesWithPhotos / stats.totalProfiles) * 100
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
              <Text style={styles.qualityLabel}>ملفات بسيرة ذاتية</Text>
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
                        ? (stats.profilesWithBio / stats.totalProfiles) * 100
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
    </ScrollView>
  );

  const renderOperations = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.operationsContainer}>
        {[
          {
            id: "export",
            title: "تصدير البيانات",
            description: "تصدير الشجرة إلى JSON أو CSV",
            icon: "cloud-download-outline",
            color: "#34C759",
          },
          {
            id: "import",
            title: "استيراد مجمع",
            description: "استيراد ملفات شخصية من ملف",
            icon: "cloud-upload-outline",
            color: "#007AFF",
          },
          {
            id: "validate",
            title: "التحقق من البيانات",
            description: "فحص وإصلاح أخطاء البيانات",
            icon: "checkmark-circle-outline",
            color: "#5856D6",
          },
          {
            id: "merge",
            title: "دمج المكررات",
            description: "البحث عن ودمج الملفات المكررة",
            icon: "git-merge-outline",
            color: "#FF9500",
          },
          {
            id: "backup",
            title: "النسخ الاحتياطي",
            description: "إنشاء نسخة احتياطية من البيانات",
            icon: "save-outline",
            color: "#FF9500",
          },
          {
            id: "permissions",
            title: "إدارة الصلاحيات",
            description: "تعيين أدوار المستخدمين وصلاحياتهم",
            icon: "shield-checkmark-outline",
            color: "#AF52DE",
          },
        ].map((op) => (
          <TouchableOpacity
            key={op.id}
            activeOpacity={0.7}
            onPress={() => handleOperation(op.id)}
            disabled={exporting && op.id === "export"}
          >
            <CardSurface style={styles.operationCard}>
              <View
                style={[
                  styles.operationIcon,
                  { backgroundColor: `${op.color}15` },
                ]}
              >
                {exporting && op.id === "export" ? (
                  <ActivityIndicator size="small" color={op.color} />
                ) : (
                  <Ionicons name={op.icon} size={28} color={op.color} />
                )}
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
    </ScrollView>
  );

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

      {/* Modern Tab Bar */}
      <View style={styles.tabBar}>
        <View style={styles.tabs}>
          {[
            { id: "overview", title: "نظرة عامة", icon: "grid-outline" },
            { id: "operations", title: "العمليات", icon: "layers-outline" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => {
                setActiveTab(tab.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={activeTab === tab.id ? "#007AFF" : "#8E8E93"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.activeTabText,
                ]}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Animated.View style={[styles.tabIndicator, tabIndicatorStyle]} />
      </View>

      {/* Content */}
      {activeTab === "overview" ? renderOverview() : renderOperations()}

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
  tabBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
  },
  activeTabText: {
    color: "#007AFF",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: SCREEN_WIDTH / 2,
    height: 3,
    backgroundColor: "#007AFF",
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
  },
  content: {
    flex: 1,
  },
  statusIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  statusBlur: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 110,
  },
  statGradient: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
  },
  seeAllText: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "600",
  },
  quickActionsScroll: {
    gap: 12,
    paddingRight: 16,
  },
  quickAction: {
    alignItems: "center",
    gap: 8,
  },
  quickActionIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 12,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 13,
    color: "#8E8E93",
  },
  emptyActivity: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#8E8E93",
  },
  demographicsCard: {
    padding: 16,
    gap: 16,
  },
  demographicRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  demographicItem: {
    flex: 1,
    alignItems: "center",
  },
  demographicLabel: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 4,
  },
  demographicValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
  },
  demographicDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E5EA",
  },
  qualityCard: {
    padding: 16,
    gap: 16,
  },
  qualityItem: {
    gap: 8,
  },
  qualityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qualityLabel: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "600",
  },
  qualityPercent: {
    fontSize: 15,
    color: "#007AFF",
    fontWeight: "700",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  operationsContainer: {
    padding: 16,
    gap: 12,
  },
  operationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
  },
  operationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  operationInfo: {
    flex: 1,
  },
  operationTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 2,
  },
  operationDescription: {
    fontSize: 14,
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
