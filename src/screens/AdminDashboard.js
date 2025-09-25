import React, { useState, useEffect, useRef } from "react";
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
  Animated,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { profilesService } from "../services/profiles";
import { useAdminMode } from "../contexts/AdminModeContext";
import ValidationDashboard from "./ValidationDashboard";
import ActivityScreen from "./ActivityScreen";
import AuditLogViewer from "./AuditLogViewer";
import QuickAddOverlay from "../components/admin/QuickAddOverlay";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "../services/supabase";

// RTL is forced at app level in index.js

// Since I18nManager.isRTL might be false until app restart,
// we'll use a constant for RTL layout
const IS_RTL = true; // Always true for Arabic app

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AdminDashboard = ({ onClose, user }) => {
  const { isAdmin } = useAdminMode();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validationIssues, setValidationIssues] = useState([]);
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [showActivityScreen, setShowActivityScreen] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dataHealth, setDataHealth] = useState(100);
  const [recentActivity, setRecentActivity] = useState([]);
  const [admins, setAdmins] = useState([]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDashboardData();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(countAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1500,
        delay: 500,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Try to load enhanced statistics first
      try {
        const { data: enhancedStats } = await supabase.rpc(
          "admin_get_enhanced_statistics",
        );

        // Check if we got the old structure (no 'basic' property)
        if (enhancedStats && !enhancedStats.basic) {
          // Fetch marriages and check for orphaned references
          const { data: marriages } = await supabase
            .from("marriages")
            .select("husband_id, wife_id, munasib");

          // Count total marriages (even with missing profiles)
          const totalMarriages = marriages?.length || 0;

          // Get all spouse IDs
          const spouseIds = [];
          marriages?.forEach((m) => {
            if (m.husband_id) spouseIds.push(m.husband_id);
            if (m.wife_id) spouseIds.push(m.wife_id);
          });

          // Check which spouse profiles actually exist
          const { data: existingSpouses } = await supabase
            .from("profiles")
            .select("id, name, gender, hid")
            .in("id", spouseIds);

          // Find spouses without HID (true Munasib)
          const munasibData = existingSpouses?.filter((p) => !p.hid) || [];

          // Count Munasib stats
          const munasibStats = {
            total_munasib: munasibData?.length || 0,
            male_munasib:
              munasibData?.filter((p) => p.gender === "male").length || 0,
            female_munasib:
              munasibData?.filter((p) => p.gender === "female").length || 0,
          };

          // Group by family name and count
          const familyCounts = {};
          munasibData?.forEach((person) => {
            const familyName = person.name?.split(" ").pop() || "غير محدد";
            familyCounts[familyName] = (familyCounts[familyName] || 0) + 1;
          });

          // Convert to array and sort
          const topFamilies = Object.entries(familyCounts)
            .map(([name, count]) => ({
              family_name: name,
              count,
              percentage:
                munasibStats.total_munasib > 0
                  ? Math.round(
                      (count / munasibStats.total_munasib) * 100 * 10,
                    ) / 10
                  : 0,
            }))
            .sort((a, b) => b.count - a.count);

          // Convert old structure to new enhanced format
          setStats({
            basic: {
              total_profiles: enhancedStats.total_profiles || 0,
              male_count: enhancedStats.male_count || 0,
              female_count: enhancedStats.female_count || 0,
              deceased_count: enhancedStats.deceased_count || 0,
              living_count: enhancedStats.alive_count || 0,
            },
            data_quality: {
              with_birth_date: enhancedStats.profiles_with_dates || 0,
              birth_date_percentage: enhancedStats.profiles_with_dates
                ? Math.round(
                    (enhancedStats.profiles_with_dates /
                      enhancedStats.total_profiles) *
                      100 *
                      10,
                  ) / 10
                : 0,
              with_photos: enhancedStats.profiles_with_photos || 0,
              photo_percentage: enhancedStats.profiles_with_photos
                ? Math.round(
                    (enhancedStats.profiles_with_photos /
                      enhancedStats.total_profiles) *
                      100 *
                      10,
                  ) / 10
                : 0,
            },
            family: {
              unique_fathers: 0,
              unique_mothers: 0,
              total_marriages: totalMarriages,
              divorced_count: 0,
              orphaned_marriages:
                totalMarriages - (existingSpouses?.length || 0) / 2,
            },
            munasib: {
              total_munasib: munasibStats.total_munasib,
              male_munasib: munasibStats.male_munasib,
              female_munasib: munasibStats.female_munasib,
              top_families: topFamilies,
            },
            activity: {
              added_last_week: 0,
              added_last_month: enhancedStats.new_this_month || 0,
              updated_last_week: 0,
              recent_profiles: enhancedStats.newest_members || [],
            },
            // Keep old properties for compatibility
            ...enhancedStats,
          });
        } else if (enhancedStats) {
          // We have the new enhanced structure
          setStats(enhancedStats);
        } else {
          // Fallback to basic statistics
          const statsResult = await profilesService.getAdminStatistics();
          if (statsResult?.data) {
            setStats({
              ...statsResult.data,
              family_branches: 0,
              new_this_month: 0,
              births_this_year: 0,
              largest_branch_size: 0,
              avg_children: 0,
              generation_counts: {},
              duplicate_names: 0,
              newest_members: [],
              profiles_with_photos: statsResult.data.profiles_with_photos || 0,
              profiles_with_dates: statsResult.data.total_profiles || 0,
              orphaned_profiles: 0,
              missing_dates: 0,
            });
          }
        }
      } catch (e) {
        console.log("Enhanced stats failed, using basic stats");
        // Use basic stats as ultimate fallback
        const { data: profiles } = await supabase.from("profiles").select("*");
        const { data: marriages } = await supabase
          .from("marriages")
          .select("*");

        if (profiles) {
          setStats({
            total_profiles: profiles.length,
            male_count: profiles.filter((p) => p.gender === "male").length,
            female_count: profiles.filter((p) => p.gender === "female").length,
            alive_count: profiles.filter((p) => p.status === "alive").length,
            deceased_count: profiles.filter((p) => p.status === "deceased")
              .length,
            total_marriages: marriages?.length || 0,
            total_photos: profiles.filter((p) => p.photo_url).length,
            profiles_with_photos: profiles.filter((p) => p.photo_url).length,
            profiles_with_dates: profiles.filter((p) => p.dob_data).length,
            family_branches: 0,
            new_this_month: 0,
            births_this_year: 0,
            largest_branch_size: 0,
            avg_children: 0,
            generation_counts: {},
            duplicate_names: 0,
            orphaned_profiles: profiles.filter(
              (p) => !p.father_id && !p.mother_id && p.hid !== "1",
            ).length,
            missing_dates: profiles.filter((p) => !p.dob_data).length,
            newest_members: profiles.slice(0, 5).map((p) => ({
              name: p.name,
              added_date: new Date(p.created_at).toLocaleDateString("ar-SA"),
            })),
          });
        }
      }

      // Load validation issues
      try {
        const validationResult = await profilesService.getValidationIssues();
        if (validationResult?.data) {
          setValidationIssues(validationResult.data);
          const issueCount = validationResult.data.length;
          const totalProfiles = stats?.total_profiles || 1;
          const healthScore = Math.max(
            0,
            100 - (issueCount / totalProfiles) * 100,
          );
          setDataHealth(Math.round(healthScore));
        }
      } catch (e) {
        console.log("Validation check failed");
        setValidationIssues([]);
      }

      // Load recent activity
      try {
        const activityResult = await profilesService.getActivityFeed(5, 0);
        if (activityResult?.data) {
          setRecentActivity(activityResult.data);
        }
      } catch (e) {
        console.log("Activity feed failed");
        setRecentActivity([]);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      // Set default values on error
      setStats({
        total_profiles: 0,
        total_marriages: 0,
        total_photos: 0,
        male_count: 0,
        female_count: 0,
        alive_count: 0,
        profiles_with_photos: 0,
        profiles_with_dates: 0,
      });
      setValidationIssues([]);
      setRecentActivity([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleCheckData = async () => {
    setShowValidationDashboard(true);
  };

  const handleAutoFix = async () => {
    try {
      const result = await profilesService.autoFixIssues();
      if (result?.data) {
        Alert.alert("نجح", "تم إصلاح المشاكل بنجاح");
        handleRefresh();
      } else {
        Alert.alert("خطأ", "فشل إصلاح المشاكل");
      }
    } catch (error) {
      Alert.alert("خطأ", "فشل إصلاح المشاكل");
    }
  };

  const handleMakeAdmin = async () => {
    Alert.alert("إضافة مشرف", "أدخل معرف المستخدم", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "إضافة",
        onPress: () => Alert.alert("نجح", "تم إضافة المشرف"),
      },
    ]);
  };

  const handleExportDatabase = () => {
    Alert.alert("اختر صيغة التصدير", "كيف تريد تصدير التقرير؟", [
      {
        text: "PDF",
        onPress: async () => {
          try {
            setExporting(true);
            const pdfExportService =
              require("../services/pdfExportService").default;
            const { data: profiles } = await supabase
              .from("profiles")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(20);

            await pdfExportService.exportAdminStatsPDF(stats, profiles || []);
          } catch (error) {
            console.error("PDF export error:", error);
            Alert.alert("خطأ", "فشل تصدير PDF: " + error.message);
          } finally {
            setExporting(false);
          }
        },
      },
      {
        text: "نص",
        onPress: async () => {
          try {
            setExporting(true);
            const { data: profiles } = await supabase
              .from("profiles")
              .select(
                `
                  *,
                  marriages:marriages!husband_id(
                    *,
                    wife:wife_id(name),
                    husband:husband_id(name)
                  )
                `,
              )
              .order("generation", { ascending: true })
              .order("sibling_order", { ascending: true });

            if (!profiles || profiles.length === 0) {
              Alert.alert("تنبيه", "لا توجد بيانات للتصدير");
              setExporting(false);
              return;
            }

            const simpleExportService =
              require("../services/simpleExportService").default;
            const result = await simpleExportService.exportAsFormattedText(
              profiles,
              {
                stats,
                title: "تقرير شجرة العائلة",
                timestamp: new Date().toISOString(),
              },
            );

            if (!result.success) {
              throw new Error(result.error || "فشل التصدير");
            }
          } catch (error) {
            console.error("Text export error:", error);
            Alert.alert("خطأ", "فشل تصدير النص: " + error.message);
          } finally {
            setExporting(false);
          }
        },
      },
      {
        text: "إلغاء",
        style: "cancel",
      },
    ]);
  };

  const handleRecalculateLayouts = async () => {
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
    const diff = Math.floor((now - date) / 60000); // minutes

    if (diff < 1) return "الآن";
    if (diff < 60) return `منذ ${diff}د`;
    if (diff < 1440) return `منذ ${Math.floor(diff / 60)}س`;
    return `منذ ${Math.floor(diff / 1440)}ي`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A13333" />
      </View>
    );
  }

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
        navigation={{
          goBack: () => setShowValidationDashboard(false),
        }}
      />
    );
  }

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
          <Ionicons name="close" size={28} color="#242121" />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            alignItems: "flex-start",
            marginRight: 12,
            marginLeft: 0,
            writingDirection: "rtl",
          }}
        >
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
              transform: [
                {
                  translateY: slideAnim,
                },
              ],
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              { position: "absolute", top: 20, right: 20 },
            ]}
          >
            إحصائيات العائلة
          </Text>
          <View style={{ height: 50 }} />

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Animated.Text
                style={[
                  styles.statNumber,
                  { opacity: countAnim, color: "#A13333" },
                ]}
              >
                {stats?.basic?.total_profiles || stats?.total_profiles || 0}
              </Animated.Text>
              <Text style={styles.statLabel}>إجمالي الأفراد</Text>
            </View>
            <View style={styles.statBox}>
              <Animated.Text
                style={[
                  styles.statNumber,
                  { opacity: countAnim, color: "#A13333" },
                ]}
              >
                {stats?.basic?.living_count || stats?.alive_count || 0}
              </Animated.Text>
              <Text style={styles.statLabel}>على قيد الحياة</Text>
            </View>
            <View style={styles.statBox}>
              <Animated.Text
                style={[
                  styles.statNumber,
                  { opacity: countAnim, color: "#D58C4A" },
                ]}
              >
                {stats?.basic?.male_count || stats?.male_count || 0}
              </Animated.Text>
              <Text style={styles.statLabel}>ذكور</Text>
            </View>
            <View style={styles.statBox}>
              <Animated.Text
                style={[
                  styles.statNumber,
                  { opacity: countAnim, color: "#D58C4A" },
                ]}
              >
                {stats?.basic?.female_count || stats?.female_count || 0}
              </Animated.Text>
              <Text style={styles.statLabel}>إناث</Text>
            </View>
            <View style={styles.statBox}>
              <Animated.Text
                style={[
                  styles.statNumber,
                  { opacity: countAnim, color: "#A13333" },
                ]}
              >
                {stats?.munasib?.total_munasib || stats?.married_in_count || 0}
              </Animated.Text>
              <Text style={styles.statLabel}>منتسبين</Text>
            </View>
            <View style={styles.statBox}>
              <Animated.Text
                style={[
                  styles.statNumber,
                  { opacity: countAnim, color: "#D58C4A" },
                ]}
              >
                {stats?.family?.total_marriages || stats?.total_marriages || 0}
              </Animated.Text>
              <Text style={styles.statLabel}>عقود زواج</Text>
            </View>
          </View>
        </Animated.View>

        {/* Generation Stats */}
        {stats?.generation_counts &&
          Object.keys(stats.generation_counts).length > 0 && (
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View
                style={{
                  width: "100%",
                  flexDirection: "row",
                  justifyContent: "flex-end",
                }}
              >
                <Text style={styles.cardTitle}>توزيع الأجيال</Text>
              </View>

              <View style={[styles.demographicsContainer, { paddingTop: 20 }]}>
                <View style={styles.generationStats}>
                  {Object.entries(stats.generation_counts)
                    .slice(0, 5)
                    .map(([gen, count]) => (
                      <View key={gen} style={styles.generationRow}>
                        <Text style={styles.generationLabel}>الجيل {gen}</Text>
                        <View style={styles.generationBarContainer}>
                          <Animated.View
                            style={[
                              styles.generationBar,
                              {
                                width: progressAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [
                                    "0%",
                                    `${(count / stats.total_profiles) * 100}%`,
                                  ],
                                }),
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.generationCount}>{count}</Text>
                      </View>
                    ))}
                </View>
              </View>
              {stats?.newest_members && stats.newest_members.length > 0 && (
                <View style={styles.newestMembers}>
                  <Text style={styles.subTitle}>أحدث الإضافات</Text>
                  {stats.newest_members.slice(0, 3).map((member, index) => (
                    <View key={index} style={styles.newestMemberItem}>
                      <Text style={styles.newestMemberName}>{member.name}</Text>
                      <Text style={styles.newestMemberDate}>
                        {member.added_date}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          )}

        {/* Profile Completeness */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={{
              width: "100%",
              flexDirection: "row",
              justifyContent: "flex-end",
            }}
          >
            <Text style={styles.cardTitle}>اكتمال البيانات</Text>
          </View>

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
                      backgroundColor: "#A13333",
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
                      backgroundColor: "#D58C4A",
                    },
                  ]}
                />
              </View>
              <Text style={styles.completenessLabel}>
                تواريخ كاملة ({stats?.profiles_with_dates || 0})
              </Text>
            </View>
          </View>

          <View style={styles.issuesGrid}>
            <View style={styles.issueItem}>
              <Text style={styles.issueCount}>
                {stats?.orphaned_profiles || 0}
              </Text>
              <Text style={styles.issueLabel}>بدون والدين</Text>
            </View>
            <View style={styles.issueItem}>
              <Text style={styles.issueCount}>{stats?.missing_dates || 0}</Text>
              <Text style={styles.issueLabel}>تواريخ ناقصة</Text>
            </View>
            <View style={styles.issueItem}>
              <Text style={styles.issueCount}>
                {stats?.duplicate_names || 0}
              </Text>
              <Text style={styles.issueLabel}>أسماء مكررة</Text>
            </View>
          </View>
        </Animated.View>

        {/* Data Health Section */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: slideAnim,
                },
              ],
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
            onPress={handleCheckData}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>فحص البيانات الآن</Text>
            <Ionicons name="chevron-back" size={20} color="#F9F7F3" />
          </TouchableOpacity>
        </Animated.View>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
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
                    index !== recentActivity.length - 1 &&
                      styles.activityItemBorder,
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
                <Ionicons name="chevron-back" size={16} color="#A13333" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Quick Actions */}
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
              <Ionicons
                name="chevron-back"
                size={20}
                color="#24212199"
                style={styles.actionArrow}
              />
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
              <Ionicons
                name="chevron-back"
                size={20}
                color="#24212199"
                style={styles.actionArrow}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleExportDatabase}
              activeOpacity={0.7}
              disabled={exporting}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionIcon}>📄</Text>
                <Text style={styles.actionText}>
                  {exporting ? "جاري التصدير..." : "تصدير التقرير"}
                </Text>
              </View>
              {exporting ? (
                <ActivityIndicator size="small" color="#A13333" />
              ) : (
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color="#24212199"
                  style={styles.actionArrow}
                />
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
              <Ionicons
                name="chevron-back"
                size={20}
                color="#24212199"
                style={styles.actionArrow}
              />
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
              <Ionicons
                name="chevron-back"
                size={20}
                color="#24212199"
                style={styles.actionArrow}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Admin Users Section */}
        {/* Top Families Married Into (Munasib) */}
        {stats?.munasib && (
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
            <Text style={styles.subTitle}>
              أكثر العائلات ارتباطاً بعائلة القفاري
            </Text>

            {/* Top 3 Families with Special UI */}
            <View style={styles.topFamiliesContainer}>
              {stats.munasib.top_families &&
              stats.munasib.top_families.length > 0 ? (
                stats.munasib.top_families.slice(0, 3).map((family, index) => (
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
                                ? "#D58C4A" // Desert Ochre
                                : index === 1
                                  ? "#D1BBA3" // Camel Hair Beige
                                  : "#A13333", // Najdi Crimson
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    لا توجد عائلات منتسبة حالياً
                  </Text>
                  <Text style={styles.emptyStateSubText}>
                    سيتم عرض العائلات بعد إضافة عقود الزواج
                  </Text>
                </View>
              )}
            </View>

            {/* Show More Button */}
            {stats.munasib.top_families.length > 3 && (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => {
                  Alert.alert(
                    "جميع العائلات المنتسبة",
                    stats.munasib.top_families
                      .map(
                        (f, i) =>
                          `${i + 1}. ${f.family_name}: ${f.count} فرد (${f.percentage}%)`,
                      )
                      .join("\n"),
                    [{ text: "حسناً", style: "default" }],
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.showMoreText}>
                  عرض جميع العائلات ({stats.munasib.top_families.length})
                </Text>
              </TouchableOpacity>
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
    backgroundColor: "#F9F7F3", // Al-Jass White
    direction: "rtl",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F7F3", // Al-Jass White
  },
  header: {
    flexDirection: "row-reverse", // Always use RTL layout
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#F9F7F3", // Al-Jass White
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
    letterSpacing: -0.5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: "#242121CC", // Sadu Night 80%
    lineHeight: 22,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  userEmail: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#A13333", // Najdi Crimson
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  closeButton: {
    padding: 8,
    borderRadius: 10,
  },
  card: {
    backgroundColor: "#F9F7F3", // Al-Jass White
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  statsCard: {
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
    marginBottom: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  munasibList: {
    marginTop: 12,
  },
  munasibItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  munasibRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#A13333", // Najdi Crimson
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginRight: 0,
  },
  munasibRankText: {
    color: "#F9F7F3", // Al-Jass White
    fontSize: 12,
    fontWeight: "600",
  },
  munasibName: {
    flex: 1,
    fontSize: 16,
    color: "#242121", // Sadu Night
    fontWeight: "500",
  },
  munasibCount: {
    alignItems: "center",
  },
  munasibCountText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#A13333", // Najdi Crimson
  },
  munasibLabel: {
    fontSize: 11,
    color: "#24212166", // Sadu Night 40%
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
  },
  statBox: {
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    width: "48%",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#A13333", // Najdi Crimson
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginTop: 4,
    textAlign: "center",
  },
  demographicsContainer: {
    gap: 20,
  },
  genderStats: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "#D1BBA310", // Camel Hair Beige 10%
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1BBA320",
  },
  genderBox: {
    alignItems: "center",
    flex: 1,
  },
  genderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  genderNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  genderLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  genderDivider: {
    width: 1,
    height: 60,
    backgroundColor: "#e5e7eb",
  },
  generationStats: {
    marginTop: 16,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginBottom: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  generationRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 10,
  },
  generationLabel: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    width: 60,
  },
  generationBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 10,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  generationBar: {
    height: "100%",
    backgroundColor: "#A13333", // Najdi Crimson
    borderRadius: 10,
  },
  generationCount: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
    width: 30,
    textAlign: "right",
  },
  trendsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  trendItem: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  trendHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  trendIcon: {
    fontSize: 24,
  },
  trendValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  trendLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  newestMembers: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  newestMemberItem: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  newestMemberName: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  newestMemberDate: {
    fontSize: 12,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
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
    color: "#242121", // Sadu Night
  },
  completenessIcon: {
    fontSize: 20,
  },
  completenessBarContainer: {
    height: 8,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  completenessBar: {
    height: "100%",
    borderRadius: 4,
  },
  completenessLabel: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },
  issuesGrid: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  issueItem: {
    alignItems: "center",
  },
  issueCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#D58C4A", // Desert Ochre
  },
  issueLabel: {
    fontSize: 11,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginTop: 4,
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
    color: "#A13333", // Najdi Crimson
  },
  progressBar: {
    height: 6,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#A13333", // Najdi Crimson
    borderRadius: 999,
  },
  issuesTags: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  tagSuccess: {
    backgroundColor: "#A1333310", // Najdi Crimson 10%
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagSuccessText: {
    color: "#A13333", // Najdi Crimson
    fontSize: 14,
    fontFamily: "SF Arabic",
  },
  tagWarning: {
    backgroundColor: "#D58C4A20", // Desert Ochre 20%
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagWarningText: {
    color: "#D58C4A", // Desert Ochre
    fontSize: 14,
    fontFamily: "SF Arabic",
  },
  primaryButton: {
    backgroundColor: "#A13333", // Najdi Crimson
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 48,
    gap: 8,
  },
  primaryButtonText: {
    color: "#F9F7F3", // Al-Jass White
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
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
    borderBottomColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  activityDescription: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginTop: 2,
  },
  activityTime: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },
  viewAllButton: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  viewAllText: {
    color: "#A13333", // Najdi Crimson
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  actionItem: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA340", // Camel Hair Beige 40%
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
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  actionArrow: {
    opacity: 0,
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
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  adminName: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
  },
  adminRole: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },

  // Munasib (Top Families) Styles
  munasibHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  munasibBadge: {
    backgroundColor: "#D58C4A20", // Desert Ochre 20%
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D58C4A40", // Desert Ochre 40%
  },
  munasibBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#D58C4A", // Desert Ochre
  },
  topFamiliesContainer: {
    marginTop: 20,
    gap: 12,
  },
  topFamilyCard: {
    backgroundColor: "#D1BBA310", // Camel Hair Beige 10%
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D1BBA340", // Camel Hair Beige 40%
    position: "relative",
    overflow: "hidden",
  },
  topFamilyFirst: {
    borderColor: "#D58C4A", // Desert Ochre
    borderWidth: 2,
  },
  topFamilySecond: {
    borderColor: "#D1BBA3", // Camel Hair Beige
    borderWidth: 1.5,
  },
  topFamilyThird: {
    borderColor: "#A13333", // Najdi Crimson
    borderWidth: 1.5,
  },
  topFamilyRank: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F9F7F3", // Al-Jass White
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  topFamilyRankText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#242121", // Sadu Night
  },
  topFamilyName: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#242121", // Sadu Night
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
    color: "#242121", // Sadu Night
  },
  topFamilyPercentage: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
  },
  topFamilyBar: {
    height: 8,
    backgroundColor: "#D1BBA320", // Camel Hair Beige 20%
    borderRadius: 4,
    overflow: "hidden",
  },
  topFamilyProgress: {
    height: "100%",
    borderRadius: 4,
  },
  showMoreButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#D1BBA340", // Camel Hair Beige 40%
  },
  showMoreText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#A13333", // Najdi Crimson
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    marginBottom: 8,
  },
  emptyStateSubText: {
    fontSize: 14,
    fontFamily: "SF Arabic",
    color: "#24212199", // Sadu Night 60%
    textAlign: "center",
  },
});

export default AdminDashboard;
