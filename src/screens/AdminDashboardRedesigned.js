import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import * as Haptics from "expo-haptics";

// Import actual admin screens
import ValidationDashboard from "./ValidationDashboard";
import MunasibManager from "../components/admin/MunasibManager";
import SuggestionReviewManager from "../components/admin/SuggestionReviewManager";
import ProfileConnectionManager from "../components/admin/ProfileConnectionManager";
import PermissionManager from "../components/admin/PermissionManager";
import ActivityLogView from "../components/admin/ActivityLogView";
import QuickAddOverlay from "../components/admin/QuickAddOverlay";
import AdminMessagesManager from "../components/admin/AdminMessagesManager";

const AdminDashboardRedesigned = ({ user, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProfiles: 0,
    activeProfiles: 0,
    totalMunasib: 0,
    dataIssues: 0,
    missingHID: 0,
    orphanedProfiles: 0,
  });
  const [alerts, setAlerts] = useState([]);

  // Modal states for actual screens
  const [showValidation, setShowValidation] = useState(false);
  const [showMunasib, setShowMunasib] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load real statistics from database
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, hid, name, father_id, mother_id", { count: "exact" });

      if (!profilesError && profiles) {
        const totalProfiles = profiles.length;
        const activeProfiles = profiles.filter(p => p.name).length;
        const totalMunasib = profiles.filter(p => !p.hid).length;

        // Calculate real data issues
        const missingHID = profiles.filter(p => !p.hid).length;
        const missingNames = profiles.filter(p => !p.name).length;

        // Check for orphaned profiles (invalid parent references)
        const profileIds = new Set(profiles.map(p => p.id));
        const orphanedProfiles = profiles.filter(p =>
          (p.father_id && !profileIds.has(p.father_id)) ||
          (p.mother_id && !profileIds.has(p.mother_id))
        ).length;

        const totalIssues = missingNames + orphanedProfiles;

        setStats({
          totalProfiles,
          activeProfiles,
          totalMunasib,
          dataIssues: totalIssues,
          missingHID,
          orphanedProfiles,
        });

        // Set alerts based on real issues
        const currentAlerts = [];
        if (orphanedProfiles > 0) {
          currentAlerts.push({
            type: "error",
            message: `${orphanedProfiles} ملفات بمراجع والدين غير صحيحة`,
          });
        }
        if (missingNames > 0) {
          currentAlerts.push({
            type: "warning",
            message: `${missingNames} ملفات بدون أسماء`,
          });
        }
        setAlerts(currentAlerts);
      }

    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, []);

  const handleActionPress = (action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Open actual screens
    switch (action) {
      case "validation":
        setShowValidation(true);
        break;
      case "munasib":
        setShowMunasib(true);
        break;
      case "suggestions":
        setShowSuggestions(true);
        break;
      case "connections":
        setShowConnections(true);
        break;
      case "permissions":
        setShowPermissions(true);
        break;
      case "activity":
        setShowActivityLog(true);
        break;
      case "quickAdd":
        setShowQuickAdd(true);
        break;
      case "messages":
        setShowMessages(true);
        break;
      default:
        Alert.alert("قيد التطوير", "هذه الميزة قيد التطوير حالياً");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A13333" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#242121" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة التحكم</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Quick Actions Bar */}
      <View style={styles.quickActionsSection}>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => handleActionPress("quickAdd")}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={28} color="#FFFFFF" />
            <Text style={styles.quickActionText}>إضافة شخص سريع</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButtonSecondary}
            onPress={() => handleActionPress("messages")}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={24} color="#A13333" />
            <Text style={styles.quickActionTextSecondary}>الرسائل والطلبات</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Overview Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>نظرة عامة</Text>
          <View style={styles.overviewGrid}>
            {/* Family Statistics Card */}
            <View style={styles.overviewCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="people-outline" size={24} color="#A13333" />
                <Text style={styles.cardTitle}>إحصائيات العائلة</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.totalProfiles}</Text>
                  <Text style={styles.statLabel}>إجمالي الملفات</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.activeProfiles}</Text>
                  <Text style={styles.statLabel}>ملفات نشطة</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{stats.totalMunasib}</Text>
                  <Text style={styles.statLabel}>مناسيب</Text>
                </View>
              </View>
            </View>

          </View>
        </View>

        {/* Action Center */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأدوات الرئيسية</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleActionPress("validation")}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#A13333" />
              </View>
              <Text style={styles.actionTitle}>فحص البيانات</Text>
              <Text style={styles.actionDescription}>التحقق من سلامة البيانات</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleActionPress("munasib")}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="heart-outline" size={32} color="#A13333" />
              </View>
              <Text style={styles.actionTitle}>إدارة المناسيب</Text>
              <Text style={styles.actionDescription}>إدارة ملفات الأزواج</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleActionPress("suggestions")}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="bulb-outline" size={32} color="#A13333" />
              </View>
              <Text style={styles.actionTitle}>المقترحات</Text>
              <Text style={styles.actionDescription}>مراجعة المقترحات الجديدة</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleActionPress("connections")}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="link-outline" size={32} color="#A13333" />
              </View>
              <Text style={styles.actionTitle}>ربط الملفات</Text>
              <Text style={styles.actionDescription}>إدارة روابط الحسابات</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Management Hub */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أدوات الإدارة</Text>
          <View style={styles.managementList}>
            <TouchableOpacity
              style={styles.managementItem}
              activeOpacity={0.7}
              onPress={() => handleActionPress("permissions")}
            >
              <View style={styles.managementIcon}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#242121" />
              </View>
              <View style={styles.managementContent}>
                <Text style={styles.managementTitle}>الصلاحيات</Text>
                <Text style={styles.managementDescription}>إدارة صلاحيات المشرفين</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#24212199" />
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.managementItem}
              activeOpacity={0.7}
              onPress={() => handleActionPress("activity")}
            >
              <View style={styles.managementIcon}>
                <Ionicons name="time-outline" size={24} color="#242121" />
              </View>
              <View style={styles.managementContent}>
                <Text style={styles.managementTitle}>سجل النشاطات</Text>
                <Text style={styles.managementDescription}>مراجعة النشاطات الأخيرة</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#24212199" />
            </TouchableOpacity>
          </View>
        </View>

        {/* System Status Bar - Minimal at bottom */}
        <TouchableOpacity
          style={styles.systemStatusBar}
          onPress={() => stats.dataIssues > 0 && handleActionPress('validation')}
          activeOpacity={stats.dataIssues > 0 ? 0.7 : 1}
          disabled={stats.dataIssues === 0}
        >
          <View style={styles.statusContent}>
            <Ionicons
              name={stats.dataIssues > 0 ? "warning" : "checkmark-circle"}
              size={20}
              color={stats.dataIssues > 0 ? "#A13333" : "#4CAF50"}
            />
            <Text style={[styles.statusText, stats.dataIssues > 0 && styles.statusTextError]}>
              {stats.dataIssues > 0
                ? `النظام: ${stats.dataIssues} مشاكل تحتاج إصلاح`
                : "النظام: ✓ جميع البيانات سليمة"}
            </Text>
          </View>
          {stats.dataIssues > 0 && (
            <Ionicons name="chevron-forward" size={16} color="#A13333" />
          )}
        </TouchableOpacity>

      </ScrollView>

      {/* Modals for actual screens */}
      {showValidation && (
        <Modal
          animationType="slide"
          presentationStyle="fullScreen"
          visible={showValidation}
          onRequestClose={() => setShowValidation(false)}
        >
          <ValidationDashboard
            navigation={{ goBack: () => setShowValidation(false) }}
          />
        </Modal>
      )}

      {showMunasib && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={showMunasib}
          onRequestClose={() => setShowMunasib(false)}
        >
          <MunasibManager onClose={() => setShowMunasib(false)} />
        </Modal>
      )}

      {showSuggestions && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={showSuggestions}
          onRequestClose={() => setShowSuggestions(false)}
        >
          <SuggestionReviewManager onClose={() => setShowSuggestions(false)} />
        </Modal>
      )}

      {showConnections && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={showConnections}
          onRequestClose={() => setShowConnections(false)}
        >
          <ProfileConnectionManager onClose={() => setShowConnections(false)} />
        </Modal>
      )}

      {showPermissions && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={showPermissions}
          onRequestClose={() => setShowPermissions(false)}
        >
          <PermissionManager onClose={() => setShowPermissions(false)} />
        </Modal>
      )}

      {showActivityLog && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={showActivityLog}
          onRequestClose={() => setShowActivityLog(false)}
        >
          <ActivityLogView onClose={() => setShowActivityLog(false)} />
        </Modal>
      )}

      {/* Quick Add Overlay */}
      {showQuickAdd && (
        <QuickAddOverlay
          visible={showQuickAdd}
          onClose={() => {
            setShowQuickAdd(false);
            loadDashboardData(); // Refresh stats
          }}
          parentNode={null}
        />
      )}

      {/* Messages Manager */}
      {showMessages && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          visible={showMessages}
          onRequestClose={() => setShowMessages(false)}
        >
          <AdminMessagesManager onClose={() => setShowMessages(false)} />
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#242121",
    fontFamily: "SF Arabic",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  headerSpacer: {
    width: 40,
  },

  // Quick Actions
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#A13333",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  quickActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "SF Arabic",
  },
  quickActionButtonSecondary: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickActionTextSecondary: {
    fontSize: 15,
    fontWeight: "600",
    color: "#A13333",
    fontFamily: "SF Arabic",
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 24,
  },

  // Sections
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 16,
    marginHorizontal: 16,
  },

  // Overview Cards
  overviewGrid: {
    gap: 16,
    paddingHorizontal: 16,
  },
  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginLeft: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#242121",
    fontFamily: "SF Arabic",
  },
  statLabel: {
    fontSize: 12,
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#D1BBA340",
  },

  // System Status Bar
  systemStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4CAF50",
    fontFamily: "SF Arabic",
  },
  statusTextError: {
    color: "#A13333",
  },

  // Action Cards
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
  },
  actionCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    alignItems: "center",
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#A1333310",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 4,
    textAlign: "center",
  },
  actionDescription: {
    fontSize: 12,
    color: "#24212199",
    fontFamily: "SF Arabic",
    textAlign: "center",
  },

  // Management List
  managementList: {
    paddingHorizontal: 16,
  },
  managementItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  managementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9F7F3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  managementContent: {
    flex: 1,
  },
  managementTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#242121",
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  managementDescription: {
    fontSize: 13,
    color: "#24212199",
    fontFamily: "SF Arabic",
  },

});

export default AdminDashboardRedesigned;