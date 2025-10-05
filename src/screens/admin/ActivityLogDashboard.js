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

  // Render activity item
  const renderActivityItem = ({ item }) => {
    const config = ACTION_CONFIGS[item.action_type] || ACTION_CONFIGS.default;
    const isExpanded = expandedCards.has(item.id);

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => toggleCardExpansion(item.id)}
        activeOpacity={0.95}
      >
        <View style={styles.activityHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: config.color + "15" },
            ]}
          >
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>

          <View style={styles.activityInfo}>
            <View style={styles.activityTitleRow}>
              <Text style={styles.activityTitle}>{config.label}</Text>
              <Text style={styles.activityTime}>
                {formatRelativeTime(item.created_at)}
              </Text>
            </View>

            <View style={styles.activityActorRow}>
              <Ionicons name="person" size={14} color={colors.textLight} />
              <Text style={styles.activityActor}>
                {item.actor_name || "مستخدم غير معروف"}
                {item.actor_phone && ` (${item.actor_phone})`}
              </Text>
              {item.actor_role && (
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor:
                        item.actor_role === "super_admin"
                          ? colors.primary
                          : item.actor_role === "admin"
                            ? colors.secondary
                            : colors.container,
                    },
                  ]}
                >
                  <Text style={styles.roleBadgeText}>{item.actor_role}</Text>
                </View>
              )}
            </View>

            {item.target_name && (
              <View style={styles.activityTargetRow}>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={colors.textLight}
                />
                <Text style={styles.activityTarget}>
                  {item.target_name}
                  {item.target_phone && ` (${item.target_phone})`}
                </Text>
              </View>
            )}

            {item.description && (
              <Text
                style={styles.activityDescription}
                numberOfLines={isExpanded ? undefined : 2}
              >
                {item.description}
              </Text>
            )}
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Metadata */}
            <View style={styles.metadataRow}>
              <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>الوقت الكامل</Text>
                <Text style={styles.metadataValue}>
                  {formatTimestamp(item.created_at)}
                </Text>
              </View>

              {item.severity && (
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>الأهمية</Text>
                  <View
                    style={[
                      styles.severityBadge,
                      {
                        backgroundColor: SEVERITY_COLORS[item.severity] + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityBadgeText,
                        { color: SEVERITY_COLORS[item.severity] },
                      ]}
                    >
                      {item.severity}
                    </Text>
                  </View>
                </View>
              )}

              {item.ip_address && (
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>IP</Text>
                  <Text style={styles.metadataValue}>{item.ip_address}</Text>
                </View>
              )}
            </View>

            {/* Before/After diff if available */}
            {(item.old_data || item.new_data) && (
              <View style={styles.diffContainer}>
                {item.old_data && (
                  <View style={styles.diffSection}>
                    <Text style={styles.diffLabel}>قبل التغيير</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <Text style={styles.diffContent}>
                        {JSON.stringify(item.old_data, null, 2)}
                      </Text>
                    </ScrollView>
                  </View>
                )}

                {item.new_data && (
                  <View style={styles.diffSection}>
                    <Text style={styles.diffLabel}>بعد التغيير</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <Text style={styles.diffContent}>
                        {JSON.stringify(item.new_data, null, 2)}
                      </Text>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              {/* TODO: Implement revert functionality before enabling */}
              {false && item.can_revert && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.revertButton]}
                  onPress={() => handleRevert(item)}
                >
                  <Ionicons name="arrow-undo" size={16} color={colors.error} />
                  <Text style={styles.revertButtonText}>تراجع</Text>
                </TouchableOpacity>
              )}

              {/* TODO: Implement navigation to profile/entity before enabling */}
              {false && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.detailsButton]}
                  onPress={() => {
                    // Navigate to specific entity (node, marriage, etc.)
                    Alert.alert("التفاصيل", `ID: ${item.target_id || item.id}`);
                  }}
                >
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={colors.info}
                  />
                  <Text style={styles.detailsButtonText}>عرض التفاصيل</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Expansion indicator */}
        <View style={styles.expansionIndicator}>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textLight}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // Render stats card
  const renderStatsCard = (icon, label, value, color) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
  );

  // Render filter button
  const renderFilterButton = (key, label, icon) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        activeFilter === key && styles.filterButtonActive,
      ]}
      onPress={() => setActiveFilter(key)}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={16}
          color={activeFilter === key ? colors.background : colors.text}
          style={styles.filterIcon}
        />
      )}
      <Text
        style={[
          styles.filterButtonText,
          activeFilter === key && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>سجل النشاط المفصل</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل سجل النشاط...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل النشاط المفصل</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            fetchActivities();
          }}
        >
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsContainer}
        contentContainerStyle={styles.statsContent}
      >
        {renderStatsCard("analytics", "إجمالي", stats.total, colors.info)}
        {renderStatsCard("today", "اليوم", stats.today, colors.success)}
        {renderStatsCard("warning", "حرج", stats.critical, colors.error)}
        {renderStatsCard("time", "معلق", stats.pending, colors.warning)}
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color={colors.textLight}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث بالاسم، الهاتف، أو النشاط..."
          placeholderTextColor={colors.textLight}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {renderFilterButton("all", "الكل", null)}
        {renderFilterButton("tree", "الشجرة", "git-branch")}
        {renderFilterButton("marriages", "الزواجات", "heart")}
        {renderFilterButton("photos", "الصور", "image")}
        {renderFilterButton("admin", "الإدارة", "shield")}
        {renderFilterButton("critical", "حرج", "warning")}
      </ScrollView>

      {/* Activities List */}
      <FlatList
        ref={flatListRef}
        data={filteredActivities}
        renderItem={renderActivityItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchActivities();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>لا توجد أنشطة</Text>
            <Text style={styles.emptySubtext}>
              {searchText
                ? "جرب تغيير كلمات البحث"
                : "لم يتم تسجيل أي أنشطة بعد"}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.container + "20",
  },
  closeButton: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  refreshButton: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: tokens.spacing.xxl,
  },
  loadingText: {
    fontSize: tokens.typography.body.fontSize,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    color: colors.text,
    marginTop: tokens.spacing.md,
  },
  statsContainer: {
    maxHeight: 100,
    marginVertical: tokens.spacing.md,
  },
  statsContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    minWidth: 100,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.container + "20",
    marginRight: tokens.spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statsValue: {
    fontSize: tokens.typography.title2.fontSize,
    fontWeight: tokens.typography.title2.fontWeight,
    color: colors.text,
    marginTop: tokens.spacing.xs,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  statsLabel: {
    fontSize: tokens.typography.footnote.fontSize,
    color: colors.textMuted,
    marginTop: tokens.spacing.xxs,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.container + "10",
    borderRadius: tokens.radii.sm,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
    height: tokens.touchTarget.minimum,
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  searchIcon: {
    marginRight: tokens.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  clearButton: {
    padding: tokens.spacing.xxs,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  filterContainer: {
    maxHeight: 44,
    marginBottom: tokens.spacing.md,
  },
  filterContent: {
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    minHeight: 32,
    borderRadius: 20,
    backgroundColor: colors.container + "20",
    borderWidth: 1,
    borderColor: colors.container + "30",
    marginRight: tokens.spacing.xs,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterIcon: {
    marginRight: 6,
  },
  filterButtonText: {
    fontSize: tokens.typography.footnote.fontSize,
    fontWeight: "600",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: 100,
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: tokens.spacing.md,
    marginVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: colors.container + "20",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: tokens.spacing.sm,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.xxs,
  },
  activityTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityTime: {
    fontSize: tokens.typography.footnote.fontSize,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityActorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.spacing.xxs,
  },
  activityActor: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: colors.text,
    marginLeft: 6,
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: tokens.spacing.xxs,
    marginLeft: tokens.spacing.lg,
  },
  activityTarget: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: colors.textMuted,
    marginLeft: 6,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  activityDescription: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: colors.textMuted,
    marginTop: tokens.spacing.xxs,
    lineHeight: tokens.typography.subheadline.lineHeight,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  roleBadge: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: tokens.spacing.xs,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  expandedContent: {
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.container + "20",
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.sm,
  },
  metadataItem: {
    flex: 1,
  },
  metadataLabel: {
    fontSize: tokens.typography.caption1.fontSize,
    color: colors.textMuted,
    marginBottom: tokens.spacing.xxs,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  metadataValue: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: colors.text,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  severityBadge: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xxs,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  severityBadgeText: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "600",
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  diffContainer: {
    marginTop: tokens.spacing.sm,
  },
  diffSection: {
    marginBottom: tokens.spacing.sm,
  },
  diffLabel: {
    fontSize: tokens.typography.caption1.fontSize,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  diffContent: {
    fontSize: tokens.typography.caption1.fontSize,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: colors.text,
    backgroundColor: colors.container + "10",
    padding: tokens.spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.container + "20",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 44,
  },
  revertButton: {
    borderColor: colors.error + "40",
    backgroundColor: colors.error + "10",
  },
  revertButtonText: {
    fontSize: tokens.typography.caption1.fontSize,
    color: colors.error,
    marginLeft: 4,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  detailsButton: {
    borderColor: colors.info + "40",
    backgroundColor: colors.info + "10",
  },
  detailsButtonText: {
    fontSize: tokens.typography.caption1.fontSize,
    color: colors.info,
    marginLeft: 4,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  expansionIndicator: {
    position: "absolute",
    bottom: tokens.spacing.xs,
    right: tokens.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "600",
    color: colors.text,
    marginTop: tokens.spacing.md,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  emptySubtext: {
    fontSize: tokens.typography.subheadline.fontSize,
    color: colors.textMuted,
    marginTop: tokens.spacing.xs,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
});
