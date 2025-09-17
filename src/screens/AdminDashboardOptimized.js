import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ValidationDashboard from "./ValidationDashboard";
import ActivityScreen from "./ActivityScreen";
import AuditLogViewer from "./AuditLogViewer";
import QuickAddOverlay from "../components/admin/QuickAddOverlay";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "../services/supabase";
import SkeletonLoader, {
  SkeletonStatBox,
} from "../components/ui/SkeletonLoader";

const AdminDashboardOptimized = ({ onClose, user }) => {
  // Core state
  const [stats, setStats] = useState(null);
  const [basicStatsLoaded, setBasicStatsLoaded] = useState(false);
  const [fullStatsLoaded, setFullStatsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [validationIssues, setValidationIssues] = useState([]);
  const [dataHealth, setDataHealth] = useState(100);
  const [recentActivity, setRecentActivity] = useState([]);

  // Modal states
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [showActivityScreen, setShowActivityScreen] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Progressive loading stages
  const loadBasicStats = useCallback(async () => {
    try {
      // Use count queries for ultra-fast loading
      const [profileCount, marriageCount] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("marriages").select("*", { count: "exact", head: true }),
      ]);

      // Set initial counts immediately
      if (profileCount.count !== null) {
        setStats({
          total_profiles: profileCount.count,
          total_marriages: marriageCount.count || 0,
          male_count: 0,
          female_count: 0,
          alive_count: 0,
          deceased_count: 0,
          profiles_with_photos: 0,
          profiles_with_dates: 0,
        });
        setBasicStatsLoaded(true);
        startAnimations();
      }

      // Then load detailed stats in background
      const { data: profileStats } = await supabase.rpc("admin_get_statistics");
      if (profileStats) {
        setStats((prev) => ({
          ...prev,
          ...profileStats,
        }));
      }
    } catch (error) {
      console.error("Error loading basic stats:", error);
      setBasicStatsLoaded(true);
    }
  }, []);

  // Load enhanced stats separately
  const loadEnhancedStats = useCallback(async () => {
    try {
      const { data: enhancedStats } = await supabase.rpc(
        "admin_get_enhanced_statistics",
      );

      if (enhancedStats) {
        setStats((prevStats) => ({
          ...prevStats,
          ...enhancedStats,
          basic: enhancedStats.basic || prevStats,
          munasib: enhancedStats.munasib,
          family: enhancedStats.family,
          data_quality: enhancedStats.data_quality,
          activity: enhancedStats.activity,
        }));
      }
      setFullStatsLoaded(true);
    } catch (error) {
      console.error("Error loading enhanced stats:", error);
      setFullStatsLoaded(true);
    }
  }, []);

  // Load validation issues separately
  const loadValidationData = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("admin_validation_dashboard");
      if (data) {
        setValidationIssues(data);
        const issueCount = data.length;
        const totalProfiles = stats?.total_profiles || 1;
        const healthScore = Math.max(
          0,
          100 - (issueCount / totalProfiles) * 100,
        );
        setDataHealth(Math.round(healthScore));
      }
    } catch (error) {
      console.error("Validation check failed");
    }
  }, [stats]);

  // Load activity feed separately
  const loadActivityFeed = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        setRecentActivity(data);
      }
    } catch (error) {
      console.error("Activity feed failed");
    }
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(countAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1000,
        delay: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Progressive loading effect
  useEffect(() => {
    // Start animations immediately for skeleton appearance
    startAnimations();

    // Stage 1: Load basic stats after minimal delay
    const basicTimer = setTimeout(() => {
      loadBasicStats();
    }, 50);

    // Stage 2: Load enhanced stats after 200ms
    const enhancedTimer = setTimeout(() => {
      loadEnhancedStats();
    }, 200);

    // Stage 3: Load validation after 400ms
    const validationTimer = setTimeout(() => {
      loadValidationData();
    }, 400);

    // Stage 4: Load activity feed after 600ms
    const activityTimer = setTimeout(() => {
      loadActivityFeed();
    }, 600);

    return () => {
      clearTimeout(basicTimer);
      clearTimeout(enhancedTimer);
      clearTimeout(validationTimer);
      clearTimeout(activityTimer);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setBasicStatsLoaded(false);
    setFullStatsLoaded(false);

    await Promise.all([
      loadBasicStats(),
      loadEnhancedStats(),
      loadValidationData(),
      loadActivityFeed(),
    ]);

    setRefreshing(false);
  }, [loadBasicStats, loadEnhancedStats, loadValidationData, loadActivityFeed]);

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

  const handleMakeAdmin = () => {
    Alert.alert("إضافة مشرف", "أدخل معرف المستخدم", [
      { text: "إلغاء", style: "cancel" },
      { text: "إضافة", onPress: () => Alert.alert("نجح", "تم إضافة المشرف") },
    ]);
  };

  const handleExportDatabase = async () => {
    try {
      setExporting(true);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const jsonData = JSON.stringify(profiles, null, 2);
      const fileUri = FileSystem.documentDirectory + "alqefari_backup.json";
      await FileSystem.writeAsStringAsync(fileUri, jsonData);
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      Alert.alert("خطأ", "فشل تصدير قاعدة البيانات");
    } finally {
      setExporting(false);
    }
  };

  const handleRecalculateLayouts = () => {
    Alert.alert(
      "إعادة حساب التخطيط",
      "سيتم إعادة حساب جميع مواضع العقد في الشجرة. قد يستغرق هذا بعض الوقت.",
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

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return "الآن";
    if (diff < 60) return `منذ ${diff}د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)}س`;
    return `منذ ${Math.floor(diff / 1440)}ي`;
  };

  // Modals
  if (showActivityScreen) {
    return <ActivityScreen onClose={() => setShowActivityScreen(false)} />;
  }
  if (showAuditLog) {
    return <AuditLogViewer onClose={() => setShowAuditLog(false)} />;
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
  if (showValidationDashboard) {
    return (
      <ValidationDashboard
        navigation={{ goBack: () => setShowValidationDashboard(false) }}
      />
    );
  }

  // Skeleton loader for stats grid
  const StatsGridSkeleton = () => (
    <View style={styles.statsGrid}>
      {[...Array(6)].map((_, i) => (
        <SkeletonStatBox key={i} />
      ))}
    </View>
  );

  // Skeleton loader for cards
  const CardSkeleton = () => (
    <View style={styles.card}>
      <SkeletonLoader width="40%" height={20} style={{ marginBottom: 16 }} />
      <SkeletonLoader width="100%" height={100} borderRadius={12} />
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
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>لوحة التحكم</Text>
          <Text style={styles.subtitle}>Admin Dashboard</Text>
          {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Main Statistics Section */}
        <Animated.View
          style={[
            styles.card,
            styles.statsCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.cardTitle}>إحصائيات العائلة</Text>

          {!basicStatsLoaded ? (
            <StatsGridSkeleton />
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Animated.Text
                  style={[
                    styles.statNumber,
                    { opacity: countAnim, color: "#6366f1" },
                  ]}
                >
                  {stats?.total_profiles || 0}
                </Animated.Text>
                <Text style={styles.statLabel}>إجمالي الأفراد</Text>
              </View>
              <View style={styles.statBox}>
                <Animated.Text
                  style={[
                    styles.statNumber,
                    { opacity: countAnim, color: "#10b981" },
                  ]}
                >
                  {stats?.alive_count || 0}
                </Animated.Text>
                <Text style={styles.statLabel}>على قيد الحياة</Text>
              </View>
              <View style={styles.statBox}>
                <Animated.Text
                  style={[
                    styles.statNumber,
                    { opacity: countAnim, color: "#3b82f6" },
                  ]}
                >
                  {stats?.male_count || 0}
                </Animated.Text>
                <Text style={styles.statLabel}>ذكور</Text>
              </View>
              <View style={styles.statBox}>
                <Animated.Text
                  style={[
                    styles.statNumber,
                    { opacity: countAnim, color: "#ec4899" },
                  ]}
                >
                  {stats?.female_count || 0}
                </Animated.Text>
                <Text style={styles.statLabel}>إناث</Text>
              </View>
              <View style={styles.statBox}>
                <Animated.Text
                  style={[
                    styles.statNumber,
                    { opacity: countAnim, color: "#8b5cf6" },
                  ]}
                >
                  {stats?.munasib?.total_munasib || 0}
                </Animated.Text>
                <Text style={styles.statLabel}>منتسبين</Text>
              </View>
              <View style={styles.statBox}>
                <Animated.Text
                  style={[
                    styles.statNumber,
                    { opacity: countAnim, color: "#f59e0b" },
                  ]}
                >
                  {stats?.total_marriages || 0}
                </Animated.Text>
                <Text style={styles.statLabel}>عقود زواج</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Profile Completeness - Shows with basic stats */}
        {basicStatsLoaded && (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.cardTitle}>اكتمال البيانات</Text>

            <View style={styles.completenessGrid}>
              <View style={styles.completenessItem}>
                <View style={styles.completenessHeader}>
                  <Text style={styles.completenessPercentage}>
                    {stats?.profiles_with_photos > 0
                      ? (
                          (stats.profiles_with_photos /
                            (stats?.total_profiles || 1)) *
                          100
                        ).toFixed(1)
                      : "0"}
                    %
                  </Text>
                  <Text style={styles.completenessIcon}>📷</Text>
                </View>
                <View style={styles.completenessBarContainer}>
                  <Animated.View
                    style={[
                      styles.completenessBar,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            "0%",
                            `${Math.max(3, ((stats?.profiles_with_photos || 0) / (stats?.total_profiles || 1)) * 100)}%`,
                          ],
                        }),
                        backgroundColor: "#10b981",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.completenessLabel}>
                  لديهم صور ({stats?.profiles_with_photos || 0})
                </Text>
              </View>

              <View style={styles.completenessItem}>
                <View style={styles.completenessHeader}>
                  <Text style={styles.completenessPercentage}>
                    {Math.round(
                      ((stats?.profiles_with_dates || 0) /
                        (stats?.total_profiles || 1)) *
                        100,
                    )}
                    %
                  </Text>
                  <Text style={styles.completenessIcon}>📅</Text>
                </View>
                <View style={styles.completenessBarContainer}>
                  <Animated.View
                    style={[
                      styles.completenessBar,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            "0%",
                            `${((stats?.profiles_with_dates || 0) / (stats?.total_profiles || 1)) * 100}%`,
                          ],
                        }),
                        backgroundColor: "#3b82f6",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.completenessLabel}>
                  تواريخ كاملة ({stats?.profiles_with_dates || 0})
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Data Health Section - Loads after validation data */}
        {validationIssues !== null ? (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.dataHealthHeader}>
              <Text style={styles.cardTitle}>صحة البيانات</Text>
              <Text style={styles.healthPercentage}>{dataHealth}%</Text>
            </View>

            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", `${dataHealth}%`],
                    }),
                  },
                ]}
              />
            </View>

            <View style={styles.issuesTags}>
              {validationIssues.length === 0 ? (
                <>
                  <View style={styles.tagSuccess}>
                    <Text style={styles.tagSuccessText}>✓ معرفات فريدة</Text>
                  </View>
                  <View style={styles.tagSuccess}>
                    <Text style={styles.tagSuccessText}>✓ التواريخ</Text>
                  </View>
                </>
              ) : (
                <>
                  {validationIssues.slice(0, 2).map((issue, index) => (
                    <View key={index} style={styles.tagWarning}>
                      <Text style={styles.tagWarningText}>
                        ⚠ {issue.issue_type}
                      </Text>
                    </View>
                  ))}
                  {validationIssues.length > 2 && (
                    <View style={styles.tagWarning}>
                      <Text style={styles.tagWarningText}>
                        +{validationIssues.length - 2}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowValidationDashboard(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>فحص البيانات الآن</Text>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <CardSkeleton />
        )}

        {/* Recent Activity - Loads last */}
        {recentActivity.length > 0 ? (
          <Animated.View
            style={[
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>النشاط الأخير</Text>
            <View style={styles.card}>
              {recentActivity.slice(0, 2).map((activity, index) => (
                <Animated.View
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    index !== 1 && styles.activityItemBorder,
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateX: slideAnim.interpolate({
                            inputRange: [0, 50],
                            outputRange: [0, 30],
                          }),
                        },
                      ],
                    },
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
                </Animated.View>
              ))}

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => setShowActivityScreen(true)}
              >
                <Text style={styles.viewAllText}>عرض الكل</Text>
                <Ionicons name="chevron-back" size={16} color="#6366f1" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          !fullStatsLoaded && <CardSkeleton />
        )}

        {/* Quick Actions - Always visible */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setShowQuickAdd(true)}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionIcon}>➕</Text>
                <Text style={styles.actionText}>إضافة ملف جديد</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleRecalculateLayouts}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionIcon}>🔄</Text>
                <Text style={styles.actionText}>إعادة حساب التخطيط</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleExportDatabase}
              activeOpacity={0.7}
              disabled={exporting}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionIcon}>💾</Text>
                <Text style={styles.actionText}>
                  {exporting ? "جاري التصدير..." : "تصدير قاعدة البيانات"}
                </Text>
              </View>
              {exporting ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Ionicons name="chevron-back" size={20} color="#9ca3af" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setShowAuditLog(true)}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionText}>سجل التدقيق</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleAutoFix}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionIcon}>🔧</Text>
                <Text style={styles.actionText}>إصلاح تلقائي</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Top Families (Munasib) - Shows after enhanced stats load */}
        {fullStatsLoaded && stats?.munasib && (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                marginTop: 16,
                marginBottom: 16,
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

            {stats.munasib.top_families &&
            stats.munasib.top_families.length > 0 ? (
              <View style={styles.topFamiliesContainer}>
                {stats.munasib.top_families.slice(0, 3).map((family, index) => (
                  <View
                    key={index}
                    style={[
                      styles.topFamilyCard,
                      index === 0 && styles.topFamilyFirst,
                      index === 1 && styles.topFamilySecond,
                      index === 2 && styles.topFamilyThird,
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
                    <View style={styles.topFamilyBar}>
                      <Animated.View
                        style={[
                          styles.topFamilyProgress,
                          {
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", `${family.percentage}%`],
                            }),
                            backgroundColor:
                              index === 0
                                ? "#fbbf24"
                                : index === 1
                                  ? "#94a3b8"
                                  : "#f97316",
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  لا توجد عائلات منتسبة حالياً
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Admin Section */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginBottom: 20,
            },
          ]}
        >
          <Text style={styles.sectionTitle}>المشرفون</Text>
          <View style={styles.card}>
            <View style={styles.adminsList}>
              <View style={styles.adminItem}>
                <Text style={styles.adminName}>حصة</Text>
                <Text style={styles.adminRole}>مشرف</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleMakeAdmin}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>إضافة مشرف</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    direction: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerContent: {
    flex: 1,
    alignItems: "flex-start",
    marginRight: 12,
    marginLeft: 0,
    writingDirection: "rtl",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  userEmail: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 4,
    fontStyle: "italic",
    textAlign: "right",
    writingDirection: "rtl",
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#8c82b4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statsCard: {
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  statsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
  },
  statBox: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    width: "48%",
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6366f1",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
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
    color: "#111827",
  },
  completenessIcon: {
    fontSize: 20,
  },
  completenessBarContainer: {
    height: 8,
    backgroundColor: "#f3f4f6",
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
    color: "#6b7280",
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
    color: "#10b981",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366f1",
    borderRadius: 999,
  },
  issuesTags: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  tagSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagSuccessText: {
    color: "#10b981",
    fontSize: 14,
  },
  tagWarning: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagWarningText: {
    color: "#ef4444",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginHorizontal: 16,
    marginBottom: 12,
    textAlign: "right",
    writingDirection: "rtl",
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
    color: "#111827",
  },
  activityDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  activityTime: {
    fontSize: 14,
    color: "#9ca3af",
  },
  viewAllButton: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  viewAllText: {
    color: "#6366f1",
    fontSize: 16,
    fontWeight: "500",
  },
  actionItem: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  actionContent: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  adminsList: {
    marginBottom: 16,
  },
  adminItem: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  adminName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  adminRole: {
    fontSize: 14,
    color: "#6b7280",
  },
  munasibHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  munasibBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  munasibBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },
  topFamiliesContainer: {
    marginTop: 20,
    gap: 12,
  },
  topFamilyCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    position: "relative",
    overflow: "hidden",
  },
  topFamilyFirst: {
    borderColor: "#fbbf24",
    borderWidth: 2,
  },
  topFamilySecond: {
    borderColor: "#94a3b8",
    borderWidth: 1.5,
  },
  topFamilyThird: {
    borderColor: "#f97316",
    borderWidth: 1.5,
  },
  topFamilyRank: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  topFamilyRankText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  topFamilyName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    marginRight: 40,
    textAlign: "right",
    writingDirection: "rtl",
  },
  topFamilyStats: {
    flexDirection: "row-reverse",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 12,
  },
  topFamilyCount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  topFamilyPercentage: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
  },
  topFamilyBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  topFamilyProgress: {
    height: "100%",
    borderRadius: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
});

export default AdminDashboardOptimized;
