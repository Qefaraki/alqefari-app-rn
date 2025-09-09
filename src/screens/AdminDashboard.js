import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Share,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useAdminMode } from "../contexts/AdminModeContext";
import { supabase } from "../services/supabase";
import profilesService from "../services/profiles";
import useStore from "../hooks/useStore";
import CardSurface from "../components/ios/CardSurface";
import SystemStatusIndicator from "../components/admin/SystemStatusIndicator";
import ValidationDashboard from "./ValidationDashboard";
import ActivityScreen from "./ActivityScreen";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AdminDashboard = ({ navigation, onClose }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const { isAdmin, isAdminMode } = useAdminMode();
  const { nodes } = useStore();
  const [stats, setStats] = useState({
    totalProfiles: 0,
    recentChanges: 0,
    activeJobs: 0,
    pendingValidation: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [showActivityScreen, setShowActivityScreen] = useState(false);
  const tabAnimation = useSharedValue(0);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    // Animate tab indicator
    const tabIndex = [
      "overview",
      "operations",
      "activity",
      "validation",
    ].indexOf(activeTab);
    tabAnimation.value = withSpring(tabIndex);
  }, [activeTab]);

  const loadStats = async () => {
    try {
      // Get total profiles count
      const { count: profileCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get recent changes (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { count: changeCount } = await supabase
        .from("audit_log")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString());

      // Get active jobs
      const { count: jobCount } = await supabase
        .from("background_jobs")
        .select("*", { count: "exact", head: true })
        .in("status", ["queued", "processing"]);

      // Get validation issues count
      const { data: validationData } =
        await profilesService.getValidationDashboard();
      const issueCount =
        validationData?.filter((v) => v.severity === "error").length || 0;

      setStats({
        totalProfiles: profileCount || 0,
        recentChanges: changeCount || 0,
        activeJobs: jobCount || 0,
        pendingValidation: issueCount,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Get all profiles with relationships
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
          `
          *,
          marriages_as_husband:marriages!husband_id(
            wife:profiles!wife_id(id, name, hid)
          ),
          marriages_as_wife:marriages!wife_id(
            husband:profiles!husband_id(id, name, hid)
          )
        `,
        )
        .order("generation", { ascending: true })
        .order("sibling_order", { ascending: true });

      if (error) throw error;

      let content = "";
      let filename = "";

      if (format === "json") {
        // Export as JSON with metadata
        const exportData = {
          metadata: {
            version: "1.0",
            exportDate: new Date().toISOString(),
            totalProfiles: profiles.length,
            appName: "Alqefari Family Tree",
          },
          profiles: profiles,
        };
        content = JSON.stringify(exportData, null, 2);
        filename = `alqefari_tree_${new Date().toISOString().split("T")[0]}.json`;
      } else if (format === "csv") {
        // Export as CSV
        const headers = [
          "ID",
          "Name",
          "Gender",
          "Generation",
          "HID",
          "Father Name",
          "Mother Name",
          "Birth Year",
          "Current Residence",
        ];
        const rows = profiles.map((p) => [
          p.id,
          p.name,
          p.gender === "male" ? "ذكر" : "أنثى",
          p.generation,
          p.hid || "",
          "", // Father name would need another query
          "", // Mother name would need another query
          p.dob_data?.gregorian?.year || "",
          p.current_residence || "",
        ]);

        content = [headers, ...rows].map((row) => row.join(",")).join("\n");
        filename = `alqefari_tree_${new Date().toISOString().split("T")[0]}.csv`;
      }

      // Share the file
      if (Platform.OS === "ios") {
        await Share.share({
          message: content,
          title: filename,
        });
      } else {
        // For Android, we need a different approach
        await Share.share({
          title: filename,
          message: content,
        });
      }

      Alert.alert("نجح", `تم تصدير ${profiles.length} ملف شخصي بنجاح`);
    } catch (error) {
      if (error.message !== "User cancelled") {
        Alert.alert("خطأ", "فشل تصدير البيانات");
        console.error("Export error:", error);
      }
    } finally {
      setExporting(false);
    }
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
          [0, 1, 2, 3],
          [0, SCREEN_WIDTH / 4, (SCREEN_WIDTH / 4) * 2, (SCREEN_WIDTH / 4) * 3],
        ),
      },
    ],
  }));

  const renderOverview = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Status Indicator */}
      <SystemStatusIndicator />

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
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("activity")}
          >
            <CardSurface style={styles.quickActionCard}>
              <Ionicons name="time-outline" size={32} color="#007AFF" />
              <Text style={styles.quickActionText}>السجل</Text>
            </CardSurface>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("export")}
            disabled={exporting}
          >
            <CardSurface style={styles.quickActionCard}>
              {exporting ? (
                <ActivityIndicator size="small" color="#34C759" />
              ) : (
                <Ionicons
                  name="cloud-download-outline"
                  size={32}
                  color="#34C759"
                />
              )}
              <Text style={styles.quickActionText}>تصدير</Text>
            </CardSurface>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => handleOperation("validate")}
          >
            <CardSurface style={styles.quickActionCard}>
              <Ionicons
                name="checkmark-circle-outline"
                size={32}
                color="#5856D6"
              />
              <Text style={styles.quickActionText}>تحقق</Text>
            </CardSurface>
          </TouchableOpacity>
        </View>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
  },
  quickAction: {
    flex: 1,
  },
  quickActionCard: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3C3C43",
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
