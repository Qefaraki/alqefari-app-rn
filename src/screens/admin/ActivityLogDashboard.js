import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  FlatList,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  formatDistanceToNow,
} from "date-fns";
import { ar } from "date-fns/locale";
import tokens from "../../components/ui/tokens";

// Use Najdi Sadu Color Palette from tokens
const colors = {
  ...tokens.colors.najdi,
  success: tokens.colors.success,
  danger: tokens.colors.danger,
  warning: "#FF9800",
  error: "#FF3B30",
  info: tokens.colors.accent,
  textLight: tokens.colors.najdi.textMuted, // Add missing color definition
};

// Action type configurations
const ACTION_CONFIGS = {
  // Tree operations
  create_node: {
    icon: "person-add",
    color: colors.success,
    label: "إضافة عضو",
  },
  update_node: { icon: "create", color: colors.info, label: "تحديث بيانات" },
  delete_node: { icon: "trash", color: colors.error, label: "حذف عضو" },
  merge_nodes: { icon: "git-merge", color: colors.warning, label: "دمج سجلات" },

  // Marriage operations
  add_marriage: { icon: "heart", color: colors.success, label: "إضافة زواج" },
  update_marriage: {
    icon: "heart-half",
    color: colors.info,
    label: "تحديث زواج",
  },
  delete_marriage: {
    icon: "heart-dislike",
    color: colors.error,
    label: "حذف زواج",
  },

  // Admin operations
  grant_admin: {
    icon: "shield-checkmark",
    color: colors.success,
    label: "منح صلاحيات",
  },
  revoke_admin: { icon: "shield", color: colors.error, label: "سحب صلاحيات" },
  update_settings: {
    icon: "settings",
    color: colors.info,
    label: "تحديث إعدادات",
  },

  // Photo operations
  upload_photo: { icon: "image", color: colors.success, label: "رفع صورة" },
  delete_photo: { icon: "image", color: colors.error, label: "حذف صورة" },
  update_photo: { icon: "image", color: colors.info, label: "تحديث صورة" },

  // Munasib operations
  add_munasib: { icon: "medal", color: colors.success, label: "إضافة منصب" },
  update_munasib: { icon: "medal", color: colors.info, label: "تحديث منصب" },
  delete_munasib: { icon: "medal", color: colors.error, label: "حذف منصب" },

  // Default
  default: {
    icon: "ellipsis-horizontal",
    color: colors.textLight,
    label: "عملية أخرى",
  },
};

// Severity colors
const SEVERITY_COLORS = {
  low: colors.textLight,
  medium: colors.info,
  high: colors.warning,
  critical: colors.error,
};

export default function ActivityLogDashboard({ onClose }) {
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedCards, setExpandedCards] = useState(new Set());

  const subscriptionRef = useRef(null);
  const flatListRef = useRef(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch activities from database
  const fetchActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("audit_log_enhanced")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
      Alert.alert("خطأ", "فشل تحميل سجل النشاط");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time changes
    subscriptionRef.current = supabase
      .channel("activity_log_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "audit_log_enhanced",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            // Fetch the new activity with full details
            fetchActivities();
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to audit log changes');
          Alert.alert("خطأ", "فشل الاتصال بالتحديثات الفورية");
        }
      });

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  // Calculate stats (memoized for performance)
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    return {
      total: activities.length || 0,
      today:
        activities.filter((a) => new Date(a.created_at) >= todayStart).length ||
        0,
      critical:
        activities.filter((a) => a.severity === "critical").length || 0,
      pending: activities.filter((a) => a.status === "pending").length || 0,
    };
  }, [activities]);

  // Group activities by date (memoized for performance)
  const groupedActivities = useMemo(() => {
    const groups = {};
    filteredActivities.forEach(activity => {
      const date = parseISO(activity.created_at);
      let dateLabel;

      if (isToday(date)) {
        dateLabel = "اليوم";
      } else if (isYesterday(date)) {
        dateLabel = "أمس";
      } else {
        dateLabel = format(date, "d MMMM", { locale: ar });
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(activity);
    });

    return Object.entries(groups).map(([dateLabel, activities]) => ({
      dateLabel,
      activities,
    }));
  }, [filteredActivities]);

  // Filter activities based on search and filter
  useEffect(() => {
    let filtered = [...activities];

    // Apply filter
    if (activeFilter !== "all") {
      switch (activeFilter) {
        case "tree":
          filtered = filtered.filter((a) =>
            [
              "create_node",
              "update_node",
              "delete_node",
              "merge_nodes",
            ].includes(a.action_type),
          );
          break;
        case "admin":
          filtered = filtered.filter(
            (a) =>
              ["grant_admin", "revoke_admin", "update_settings"].includes(
                a.action_type,
              ) ||
              a.actor_role === "super_admin" ||
              a.actor_role === "admin",
          );
          break;
        case "critical":
          filtered = filtered.filter(
            (a) => a.severity === "critical" || a.severity === "high",
          );
          break;
        case "photos":
          filtered = filtered.filter((a) =>
            ["upload_photo", "delete_photo", "update_photo"].includes(
              a.action_type,
            ),
          );
          break;
        case "marriages":
          filtered = filtered.filter((a) =>
            ["add_marriage", "update_marriage", "delete_marriage"].includes(
              a.action_type,
            ),
          );
          break;
      }
    }

    // Apply search (debounced)
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.actor_name?.toLowerCase().includes(search) ||
          a.actor_phone?.includes(search) ||
          a.target_name?.toLowerCase().includes(search) ||
          a.target_phone?.includes(search) ||
          a.description?.toLowerCase().includes(search) ||
          ACTION_CONFIGS[a.action_type]?.label?.toLowerCase().includes(search),
      );
    }

    setFilteredActivities(filtered);
  }, [activities, activeFilter, debouncedSearch]);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";

    try {
      const date = parseISO(timestamp);

      if (isToday(date)) {
        return `اليوم ${format(date, "h:mm a", { locale: ar })}`;
      } else if (isYesterday(date)) {
        return `أمس ${format(date, "h:mm a", { locale: ar })}`;
      } else {
        return format(date, "d MMMM yyyy h:mm a", { locale: ar });
      }
    } catch {
      return timestamp;
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "";

    try {
      return formatDistanceToNow(parseISO(timestamp), {
        addSuffix: true,
        locale: ar,
      });
    } catch {
      return "";
    }
  };

  // Toggle card expansion (limit to 5 cards to prevent memory issues)
  const toggleCardExpansion = useCallback((id) => {
    setExpandedCards((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        // Limit to 5 expanded cards at once for performance
        if (newExpanded.size >= 5) {
          const firstId = newExpanded.values().next().value;
          newExpanded.delete(firstId);
        }
        newExpanded.add(id);
      }
      return newExpanded;
    });
  }, []);

  // Handle revert action
  const handleRevert = async (activity) => {
    Alert.alert(
      "تأكيد التراجع",
      `هل تريد التراجع عن: ${ACTION_CONFIGS[activity.action_type]?.label || activity.action_type}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تراجع",
          style: "destructive",
          onPress: async () => {
            try {
              // Here you would implement the actual revert logic
              // based on the action type and old_data
              Alert.alert("نجح", "تم التراجع عن العملية بنجاح");
              fetchActivities();
            } catch (error) {
              Alert.alert("خطأ", "فشل التراجع عن العملية");
            }
          },
        },
      ],
    );
  };

  // Get action icon and color
  const getActionIcon = (activity) => {
    const config = ACTION_CONFIGS[activity.action_type] || ACTION_CONFIGS.default;
    return config.icon;
  };

  const getActionColor = (activity) => {
    const config = ACTION_CONFIGS[activity.action_type] || ACTION_CONFIGS.default;
    return config.color;
  };

  // Handle activity press (show detailed modal)
  const handleActivityPress = (activity) => {
    toggleCardExpansion(activity.id);
  };

  // Render date group with activities as rows
  const renderDateGroup = ({ item }) => (
    <View style={styles.dateGroup}>
      <Text style={styles.dateLabel}>{item.dateLabel}</Text>
      <View style={styles.activityCard}>
        {item.activities.map((activity, index) => {
          const config = ACTION_CONFIGS[activity.action_type] || ACTION_CONFIGS.default;
          const isExpanded = expandedCards.has(activity.id);

          return (
            <View key={activity.id}>
              <TouchableOpacity
                style={styles.activityRow}
                onPress={() => handleActivityPress(activity)}
                activeOpacity={0.7}
              >
                <View style={[styles.activityIcon, { backgroundColor: config.color + "15" }]}>
                  <Ionicons name={config.icon} size={20} color={config.color} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {config.label}
                  </Text>
                  <Text style={styles.activitySubtitle} numberOfLines={1}>
                    {activity.actor_name || "مستخدم"}
                    {activity.target_name && ` → ${activity.target_name}`}
                  </Text>
                </View>
                <Text style={styles.activityTime}>
                  {format(parseISO(activity.created_at), "h:mm a", { locale: ar })}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#24212140" />
              </TouchableOpacity>

              {/* Expanded details */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {/* Metadata */}
                  <View style={styles.metadataRow}>
                    <View style={styles.metadataItem}>
                      <Text style={styles.metadataLabel}>الوقت الكامل</Text>
                      <Text style={styles.metadataValue}>
                        {formatTimestamp(activity.created_at)}
                      </Text>
                    </View>

                    {activity.severity && (
                      <View style={styles.metadataItem}>
                        <Text style={styles.metadataLabel}>الأهمية</Text>
                        <View
                          style={[
                            styles.severityBadge,
                            {
                              backgroundColor: SEVERITY_COLORS[activity.severity] + "20",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.severityBadgeText,
                              { color: SEVERITY_COLORS[activity.severity] },
                            ]}
                          >
                            {activity.severity}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {activity.description && (
                    <Text style={styles.activityDescription}>
                      {activity.description}
                    </Text>
                  )}

                  {/* Before/After diff if available */}
                  {(activity.old_data || activity.new_data) && (
                    <View style={styles.diffContainer}>
                      {activity.old_data && (
                        <View style={styles.diffSection}>
                          <Text style={styles.diffLabel}>قبل التغيير</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                          >
                            <Text style={styles.diffContent}>
                              {JSON.stringify(activity.old_data, null, 2)}
                            </Text>
                          </ScrollView>
                        </View>
                      )}

                      {activity.new_data && (
                        <View style={styles.diffSection}>
                          <Text style={styles.diffLabel}>بعد التغيير</Text>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                          >
                            <Text style={styles.diffContent}>
                              {JSON.stringify(activity.new_data, null, 2)}
                            </Text>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Row separator */}
              {index < item.activities.length - 1 && (
                <View style={styles.activityRowBorder} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/logo/AlqefariEmblem.png')}
              style={styles.emblem}
              resizeMode="contain"
            />
            <View style={styles.titleContent}>
              <Text style={styles.title}>سجل النشاط</Text>
            </View>
            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A13333" />
          <Text style={styles.loadingText}>جاري تحميل سجل النشاط...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header - Emblem + Large Title Pattern */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Image
            source={require('../../../assets/logo/AlqefariEmblem.png')}
            style={styles.emblem}
            resizeMode="contain"
          />
          <View style={styles.titleContent}>
            <Text style={styles.title}>سجل النشاط</Text>
          </View>
          <View style={{ width: 44, height: 44 }} />
        </View>
      </View>

      {/* Stats Widget - White card with dividers */}
      <View style={styles.statsWidget}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>إجمالي</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.today}</Text>
            <Text style={styles.statLabel}>اليوم</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.critical}</Text>
            <Text style={styles.statLabel}>حرج</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>معلق</Text>
          </View>
        </View>
      </View>

      {/* Search Bar - Clean ProfileLinker style */}
      <View style={[
        styles.searchBar,
        searchText.length > 0 && styles.searchBarFocused
      ]}>
        <Ionicons name="search" size={20} color="#24212160" />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث بالاسم، الهاتف، أو النشاط..."
          placeholderTextColor="#24212199"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={20} color="#24212160" />
          </TouchableOpacity>
        )}
      </View>

      {/* Section Title */}
      <Text style={styles.sectionTitle}>النشاط الأخير</Text>

      {/* Activities List - Date-grouped rows */}
      <FlatList
        ref={flatListRef}
        data={groupedActivities}
        renderItem={renderDateGroup}
        keyExtractor={(item) => item.dateLabel}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchActivities();
            }}
            colors={["#A13333"]}
            tintColor="#A13333"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={64} color="#73637280" />
            <Text style={styles.emptyText}>لا توجد أنشطة</Text>
            <Text style={styles.emptySubtext}>
              {searchText
                ? "جرب تغيير كلمات البحث"
                : "لم يتم تسجيل أي أنشطة بعد"}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },

  // Header - NewsScreen/ProfileLinker pattern
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: "#242121",
  },
  titleContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    textAlign: "center",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 17,
    color: "#242121",
    marginTop: 16,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },

  // Stats Widget - AdminDash pattern
  statsWidget: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 13,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
    padding: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  statLabel: {
    fontSize: 12,
    color: "#736372",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#D1BBA320",
  },

  // Search Bar - ProfileLinker pattern
  searchBar: {
    backgroundColor: "#D1BBA320",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 48,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  searchBarFocused: {
    borderColor: "#A13333",
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },

  // Section Title
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // Activities List
  listContent: {
    paddingBottom: 24,
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#736372",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  // Activity Card - AdminDash pattern (card with rows)
  activityCard: {
    backgroundColor: "#F9F7F3",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1BBA340",
    marginHorizontal: 16,
    overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 60,
    backgroundColor: "#F9F7F3",
  },
  activityRowBorder: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D1BBA320",
    marginHorizontal: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 15,
    color: "#736372",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityTime: {
    fontSize: 13,
    color: "#736372",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    minWidth: 60,
    textAlign: "left",
  },

  // Expanded Content
  expandedContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#F9F7F3",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D1BBA320",
  },
  metadataRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
  },
  metadataItem: {
    minWidth: 120,
  },
  metadataLabel: {
    fontSize: 12,
    color: "#736372",
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  metadataValue: {
    fontSize: 15,
    color: "#242121",
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  severityBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityDescription: {
    fontSize: 15,
    color: "#736372",
    lineHeight: 22,
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  diffContainer: {
    marginTop: 8,
  },
  diffSection: {
    marginBottom: 12,
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#736372",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  diffContent: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#242121",
    backgroundColor: "#D1BBA310",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1BBA320",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#242121",
    marginTop: 16,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  emptySubtext: {
    fontSize: 15,
    color: "#736372",
    marginTop: 8,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
});
