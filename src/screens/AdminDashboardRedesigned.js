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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import * as Haptics from "expo-haptics";

const AdminDashboardRedesigned = ({ user, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProfiles: 0,
    activeProfiles: 0,
    totalMunasib: 0,
    dataHealth: 100,
    pendingSuggestions: 0,
    recentActivity: 0,
  });
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load family statistics
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, hid, name", { count: "exact" });

      if (!profilesError && profiles) {
        const totalProfiles = profiles.length;
        // Since is_active doesn't exist, count profiles with names as active
        const activeProfiles = profiles.filter(p => p.name).length;
        const totalMunasib = profiles.filter(p => !p.hid).length;

        // Calculate data health percentage
        const completeProfiles = profiles.filter(p => p.hid && p.name).length;
        const dataHealth = totalProfiles > 0 ? Math.round((completeProfiles / totalProfiles) * 100) : 0;

        setStats({
          totalProfiles,
          activeProfiles,
          totalMunasib,
          dataHealth,
          pendingSuggestions: 0, // TODO: Connect to suggestions table
          recentActivity: 0, // TODO: Connect to activity logs
        });

        // Check for critical alerts after stats are set
        const currentAlerts = [];
        if (dataHealth < 80) {
          currentAlerts.push({
            type: "warning",
            message: "البيانات تحتاج إلى مراجعة",
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

    // TODO: Navigate to appropriate screens
    switch (action) {
      case "profiles":
        Alert.alert("إدارة الملفات", "سيتم فتح إدارة الملفات الشخصية");
        break;
      case "munasib":
        Alert.alert("إدارة المناسيب", "سيتم فتح إدارة المناسيب");
        break;
      case "suggestions":
        Alert.alert("المقترحات", "سيتم فتح صفحة المقترحات");
        break;
      case "connections":
        Alert.alert("الروابط", "سيتم فتح إدارة الروابط العائلية");
        break;
      default:
        Alert.alert("قريباً", "هذه الميزة قيد التطوير");
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

      {/* Alerts Bar */}
      {alerts.length > 0 && (
        <View style={styles.alertBar}>
          <Ionicons name="warning-outline" size={20} color="#D58C4A" />
          <Text style={styles.alertText}>{alerts[0].message}</Text>
        </View>
      )}

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

            {/* Data Health Card */}
            <View style={styles.overviewCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="pulse-outline" size={24} color="#D58C4A" />
                <Text style={styles.cardTitle}>صحة البيانات</Text>
              </View>
              <View style={styles.healthContainer}>
                <View style={styles.healthBar}>
                  <View
                    style={[
                      styles.healthBarFill,
                      {
                        width: `${stats.dataHealth}%`,
                        backgroundColor: stats.dataHealth > 80 ? "#4CAF50" :
                                       stats.dataHealth > 60 ? "#D58C4A" : "#A13333"
                      }
                    ]}
                  />
                </View>
                <Text style={styles.healthPercentage}>{stats.dataHealth}%</Text>
              </View>
              <Text style={styles.healthLabel}>
                {stats.dataHealth > 80 ? "البيانات في حالة ممتازة" :
                 stats.dataHealth > 60 ? "تحتاج إلى بعض التحسينات" :
                 "تحتاج إلى مراجعة عاجلة"}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Center */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الأدوات الرئيسية</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => handleActionPress("profiles")}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="person-circle-outline" size={32} color="#A13333" />
              </View>
              <Text style={styles.actionTitle}>إدارة الملفات</Text>
              <Text style={styles.actionDescription}>تعديل وإضافة الملفات الشخصية</Text>
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
                <Ionicons name="git-network-outline" size={32} color="#A13333" />
              </View>
              <Text style={styles.actionTitle}>الروابط العائلية</Text>
              <Text style={styles.actionDescription}>إدارة العلاقات والروابط</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Management Hub */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أدوات الإدارة</Text>
          <View style={styles.managementList}>
            <TouchableOpacity style={styles.managementItem} activeOpacity={0.7}>
              <View style={styles.managementIcon}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#242121" />
              </View>
              <View style={styles.managementContent}>
                <Text style={styles.managementTitle}>الصلاحيات</Text>
                <Text style={styles.managementDescription}>إدارة صلاحيات المشرفين</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#24212199" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementItem} activeOpacity={0.7}>
              <View style={styles.managementIcon}>
                <Ionicons name="document-text-outline" size={24} color="#242121" />
              </View>
              <View style={styles.managementContent}>
                <Text style={styles.managementTitle}>التقارير</Text>
                <Text style={styles.managementDescription}>إنشاء وتصدير التقارير</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#24212199" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.managementItem} activeOpacity={0.7}>
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

        {/* System Tools */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>أدوات النظام</Text>
          <View style={styles.systemGrid}>
            <TouchableOpacity style={styles.systemCard} activeOpacity={0.7}>
              <Ionicons name="sync-outline" size={24} color="#5F6368" />
              <Text style={styles.systemLabel}>مزامنة البيانات</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.systemCard} activeOpacity={0.7}>
              <Ionicons name="bug-outline" size={24} color="#5F6368" />
              <Text style={styles.systemLabel}>إصلاح الأخطاء</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.systemCard} activeOpacity={0.7}>
              <Ionicons name="download-outline" size={24} color="#5F6368" />
              <Text style={styles.systemLabel}>النسخ الاحتياطي</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.systemCard} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={24} color="#5F6368" />
              <Text style={styles.systemLabel}>الإعدادات</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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

  // Alert Bar
  alertBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D58C4A20",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  alertText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#D58C4A",
    fontFamily: "SF Arabic",
    fontWeight: "500",
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
  lastSection: {
    marginBottom: 24,
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

  // Health Bar
  healthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  healthBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#D1BBA320",
    borderRadius: 4,
    overflow: "hidden",
    marginRight: 12,
  },
  healthBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  healthPercentage: {
    fontSize: 20,
    fontWeight: "700",
    color: "#242121",
    fontFamily: "SF Arabic",
    minWidth: 50,
    textAlign: "right",
  },
  healthLabel: {
    fontSize: 13,
    color: "#24212199",
    fontFamily: "SF Arabic",
    marginTop: 4,
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

  // System Tools
  systemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
  },
  systemCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    flexDirection: "row",
    alignItems: "center",
  },
  systemLabel: {
    fontSize: 14,
    color: "#242121",
    fontFamily: "SF Arabic",
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
  },
});

export default AdminDashboardRedesigned;