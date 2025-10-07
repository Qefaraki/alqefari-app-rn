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
  FlatList,
  TextInput,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  formatDistanceToNow,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ar } from "date-fns/locale";
import tokens from "../../components/ui/tokens";
import SkeletonLoader from "../../components/ui/SkeletonLoader";
import InlineDiff from "../../components/ui/InlineDiff";
import {
  getFieldLabel,
  generateActionDescription,
  groupFieldsByCategory,
} from "../../services/activityLogTranslations";
import { formatRelativeTime } from "../../utils/formatTimestamp";
import {
  groupConsecutiveActivities,
  isActivityGroup,
  getGroupDisplayText,
} from "../../utils/activityGrouping";
import UserFilterModal from "../../components/admin/UserFilterModal";
import DateRangePickerModal from "../../components/admin/DateRangePickerModal";
import { useAuth } from "../../contexts/AuthContext";

// Use Najdi Sadu Color Palette from tokens
const colors = {
  ...tokens.colors.najdi,
  success: tokens.colors.success,
  danger: tokens.colors.danger,
  warning: "#FF9800",
  error: "#FF3B30",
  info: tokens.colors.accent,
  textLight: tokens.colors.najdi.textMuted,
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

// Filter data
const FILTER_DATA = [
  { key: "all", label: "الكل", icon: null },
  { key: "tree", label: "الشجرة", icon: "git-branch" },
  { key: "marriages", label: "الأزواج", icon: "heart" },
  { key: "photos", label: "الصور", icon: "image" },
  { key: "admin", label: "الإدارة", icon: "shield" },
  { key: "critical", label: "حرج", icon: "warning" },
];

// Shimmer Skeleton Components (for loading state)
const ActivityRowSkeleton = () => (
  <View style={styles.activityRow}>
    <SkeletonLoader width={36} height={36} borderRadius={18} />
    <View style={{ flex: 1, gap: 4 }}>
      <SkeletonLoader width="60%" height={17} borderRadius={4} />
      <SkeletonLoader width="80%" height={15} borderRadius={4} />
    </View>
    <SkeletonLoader width={60} height={13} borderRadius={4} />
    <View style={{ width: 18 }} />
  </View>
);

const ActivityCardSkeleton = () => (
  <View style={styles.activityCard}>
    <ActivityRowSkeleton />
    <View style={styles.activityRowBorder} />
    <ActivityRowSkeleton />
    <View style={styles.activityRowBorder} />
    <ActivityRowSkeleton />
  </View>
);

const DateGroupSkeleton = () => (
  <View style={styles.dateGroup}>
    <SkeletonLoader
      width={80}
      height={13}
      borderRadius={4}
      style={{ marginHorizontal: 16, marginBottom: 8 }}
    />
    <ActivityCardSkeleton />
  </View>
);

// Helper function to format field values for display
const formatValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && value.length > 50) {
    return value.substring(0, 50) + "...";
  }
  return String(value);
};

export default function ActivityLogDashboard({ onClose }) {
  const { userProfile } = useAuth();

  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter modal state
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [datePreset, setDatePreset] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ from: null, to: null });

  const subscriptionRef = useRef(null);
  const flatListRef = useRef(null);

  const PAGE_SIZE = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch activities from database with pagination
  const fetchActivities = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const currentPage = isLoadMore ? page : 0;
      const start = currentPage * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      // Build query with filters
      let query = supabase
        .from("activity_log_detailed")
        .select("*", { count: 'exact' });

      // Apply user filter
      if (selectedUser) {
        query = query.eq('actor_id', selectedUser.actor_id);
      }

      // Apply date range filter
      if (datePreset !== 'all') {
        const range = datePreset === 'custom'
          ? { start: customDateRange.from, end: customDateRange.to }
          : getDateRangeForPreset(datePreset);

        if (range.start) {
          query = query.gte('created_at', range.start.toISOString());
        }
        if (range.end) {
          query = query.lte('created_at', range.end.toISOString());
        }
      }

      query = query
        .order("created_at", { ascending: false })
        .range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;

      if (isLoadMore) {
        setActivities(prev => [...prev, ...(data || [])]);
      } else {
        setActivities(data || []);
      }

      setPage(currentPage + 1);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error("Error fetching activities:", error);
      Alert.alert("خطأ", "فشل تحميل السجل");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, PAGE_SIZE, selectedUser, datePreset, customDateRange]);

  // Helper function to get date range from preset
  const getDateRangeForPreset = (preset) => {
    const now = new Date();

    switch (preset) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: null, end: null };
    }
  };

  // Set up real-time subscription (fixed race condition)
  useEffect(() => {
    fetchActivities(false);

    // Subscribe to real-time changes with optimistic update
    const channel = supabase
      .channel("activity_log_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log_enhanced",
        },
        (payload) => {
          // Optimistic update: prepend new item
          setActivities((prev) => {
            // Avoid duplicates
            if (prev.some((item) => item.id === payload.new.id)) {
              return prev;
            }
            return [payload.new, ...prev];
          });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to audit log changes');
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []); // Empty deps - run once on mount

  // Refetch when filters change
  useEffect(() => {
    setPage(0);
    fetchActivities(false);
  }, [selectedUser, datePreset, customDateRange]);

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
        groups[dateLabel] = {
          activities: [],
          timestamp: date.getTime(),
        };
      }
      groups[dateLabel].activities.push(activity);
    });

    // Sort groups by date descending (newest first)
    return Object.entries(groups)
      .map(([dateLabel, { activities, timestamp }]) => ({
        dateLabel,
        activities: activities.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        timestamp,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
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

  // Toggle card expansion
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

  // Memoized Header Component
  const Header = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Image
          source={require('../../../assets/logo/AlqefariEmblem.png')}
          style={styles.emblem}
          resizeMode="contain"
        />
        <View style={styles.titleContent}>
          <Text style={styles.title}>السجل</Text>
        </View>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#242121" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [onClose]);

  // Memoized Stats Widget Component
  const StatsWidget = useMemo(() => (
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
  ), [stats]);

  // Memoized Search Bar Component
  const SearchBar = useMemo(() => (
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
  ), [searchText]);

  // Filter Chips Component
  const FilterChips = useMemo(() => {
    const hasFilters = selectedUser || datePreset !== 'all';

    if (!hasFilters) return null;

    return (
      <View style={styles.filterChipsContainer}>
        {selectedUser && (
          <View style={styles.filterChip}>
            <Ionicons name="person" size={14} color={tokens.colors.najdi.alJass} />
            <Text style={styles.filterChipText} numberOfLines={1}>
              {selectedUser.actor_name}
            </Text>
            <TouchableOpacity onPress={() => {
              setSelectedUser(null);
              setPage(0);
            }}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.najdi.alJass} />
            </TouchableOpacity>
          </View>
        )}
        {datePreset !== 'all' && (
          <View style={styles.filterChip}>
            <Ionicons name="calendar" size={14} color={tokens.colors.najdi.alJass} />
            <Text style={styles.filterChipText} numberOfLines={1}>
              {datePreset === 'today' ? 'اليوم' :
               datePreset === 'week' ? 'هذا الأسبوع' :
               datePreset === 'month' ? 'هذا الشهر' :
               datePreset === 'custom' ? 'نطاق مخصص' : 'الكل'}
            </Text>
            <TouchableOpacity onPress={() => {
              setDatePreset('all');
              setCustomDateRange({ from: null, to: null });
              setPage(0);
            }}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.najdi.alJass} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [selectedUser, datePreset]);

  // Render filter button (for horizontal FlatList)
  const renderFilterButton = useCallback(({ item }) => {
    const isActive = activeFilter === item.key;
    return (
      <TouchableOpacity
        style={[styles.filterButton, isActive && styles.filterButtonActive]}
        onPress={() => setActiveFilter(item.key)}
        activeOpacity={0.7}
      >
        {item.icon && (
          <Ionicons
            name={item.icon}
            size={14}
            color={isActive ? "#F9F7F3" : "#242121"}
            style={{ marginRight: 4 }}
          />
        )}
        <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [activeFilter]);

  // Filter Buttons Component (horizontal FlatList)
  const FilterButtons = useMemo(() => (
    <View>
      <View style={styles.filterButtonsRow}>
        <TouchableOpacity
          style={[styles.filterModalButton, selectedUser && styles.filterModalButtonActive]}
          onPress={() => setShowUserFilter(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="person"
            size={16}
            color={selectedUser ? tokens.colors.najdi.alJass : tokens.colors.najdi.crimson}
          />
          <Text
            style={[
              styles.filterModalButtonText,
              selectedUser && styles.filterModalButtonTextActive,
            ]}
          >
            المستخدم
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterModalButton,
            datePreset !== 'all' && styles.filterModalButtonActive,
          ]}
          onPress={() => setShowDateFilter(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={datePreset !== 'all' ? tokens.colors.najdi.alJass : tokens.colors.najdi.crimson}
          />
          <Text
            style={[
              styles.filterModalButtonText,
              datePreset !== 'all' && styles.filterModalButtonTextActive,
            ]}
          >
            التاريخ
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={FILTER_DATA}
        renderItem={renderFilterButton}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterSection}
        getItemLayout={(data, index) => ({
          length: 90,
          offset: 90 * index,
          index,
        })}
      />
    </View>
  ), [renderFilterButton, selectedUser, datePreset]);

  // ListHeaderComponent: Contains all header elements
  const ListHeader = useMemo(() => (
    <View>
      {Header}
      {StatsWidget}
      {SearchBar}
      {FilterChips}
      {FilterButtons}
    </View>
  ), [Header, StatsWidget, SearchBar, FilterChips, FilterButtons]);

  // Render date group with activities
  const renderDateGroup = useCallback(({ item }) => (
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
                onPress={() => toggleCardExpansion(activity.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.activityIcon, { backgroundColor: config.color + "15" }]}>
                  <Ionicons name={config.icon} size={20} color={config.color} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {generateActionDescription(
                      activity.action_type,
                      activity.changed_fields,
                      activity.target_name
                    )}
                  </Text>
                  <Text style={styles.activitySubtitle} numberOfLines={1}>
                    {activity.actor_name || "مستخدم"}
                  </Text>
                  {/* Show inline diff when collapsed */}
                  {!isExpanded && activity.changed_fields && activity.changed_fields.length > 0 && (
                    <InlineDiff
                      field={activity.changed_fields[0]}
                      oldValue={activity.old_data?.[activity.changed_fields[0]]}
                      newValue={activity.new_data?.[activity.changed_fields[0]]}
                      showLabels={false}
                    />
                  )}
                </View>
                <Text style={styles.activityTime}>
                  {format(parseISO(activity.created_at), "h:mm a", { locale: ar })}
                </Text>
                <Ionicons name="chevron-back" size={18} color="#24212140" />
              </TouchableOpacity>

              {/* Expanded details */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {/* Actor Information */}
                  {activity.actor_name && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>المستخدم المنفذ</Text>
                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>الاسم</Text>
                          <Text style={styles.detailValue}>{activity.actor_name}</Text>
                        </View>
                        {activity.actor_phone && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>الجوال</Text>
                            <Text style={styles.detailValue}>
                              {'\u202A' + activity.actor_phone + '\u202C'}
                            </Text>
                          </View>
                        )}
                        {activity.actor_role && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>الدور</Text>
                            <Text style={styles.detailValue}>
                              {activity.actor_role === 'super_admin' ? 'مشرف عام' :
                               activity.actor_role === 'admin' ? 'مشرف' : 'مستخدم'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Target Information */}
                  {activity.target_name && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>الملف المتأثر</Text>
                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>الاسم</Text>
                          <Text style={styles.detailValue}>{activity.target_name}</Text>
                        </View>
                        {activity.target_phone && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>الجوال</Text>
                            <Text style={styles.detailValue}>
                              {'\u202A' + activity.target_phone + '\u202C'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* System Metadata */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>معلومات النظام</Text>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>الوقت الكامل</Text>
                        <Text style={styles.detailValue}>
                          {formatTimestamp(activity.created_at)}
                        </Text>
                      </View>
                      {activity.severity && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>الأهمية</Text>
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
                      {activity.description && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>الوصف</Text>
                          <Text style={styles.detailValue}>{activity.description}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Field-by-field diff with proper labels */}
                  {activity.changed_fields && activity.changed_fields.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>
                        الحقول المتغيرة ({activity.changed_fields.length})
                      </Text>
                      {activity.changed_fields.map((field, idx) => (
                        <View key={idx} style={styles.fieldChangeRow}>
                          <Text style={styles.fieldChangeName}>{getFieldLabel(field)}</Text>
                          <InlineDiff
                            field={field}
                            oldValue={activity.old_data?.[field]}
                            newValue={activity.new_data?.[field]}
                            showLabels={true}
                          />
                        </View>
                      ))}
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
  ), [expandedCards, toggleCardExpansion, formatTimestamp]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../../assets/logo/AlqefariEmblem.png')}
              style={styles.emblem}
              resizeMode="contain"
            />
            <View style={styles.titleContent}>
              <Text style={styles.title}>السجل</Text>
            </View>
            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>

        {/* Stats Widget Skeleton */}
        <View style={styles.statsWidget}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <SkeletonLoader width={60} height={28} borderRadius={4} style={{ marginBottom: 4 }} />
              <SkeletonLoader width="80%" height={12} borderRadius={4} />
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <SkeletonLoader width={60} height={28} borderRadius={4} style={{ marginBottom: 4 }} />
              <SkeletonLoader width="80%" height={12} borderRadius={4} />
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <SkeletonLoader width={60} height={28} borderRadius={4} style={{ marginBottom: 4 }} />
              <SkeletonLoader width="80%" height={12} borderRadius={4} />
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <SkeletonLoader width={60} height={28} borderRadius={4} style={{ marginBottom: 4 }} />
              <SkeletonLoader width="80%" height={12} borderRadius={4} />
            </View>
          </View>
        </View>

        {/* Search Bar Skeleton */}
        <SkeletonLoader
          width="auto"
          height={48}
          borderRadius={12}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        />

        {/* Activity Cards Skeletons */}
        <DateGroupSkeleton />
        <DateGroupSkeleton />
        <DateGroupSkeleton />
      </View>
    );
  }

  // Main render with single FlatList
  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={groupedActivities}
        renderItem={renderDateGroup}
        keyExtractor={(item) => item.dateLabel}
        ListHeaderComponent={ListHeader}
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
        onEndReached={() => {
          if (hasMore && !loading && !loadingMore) {
            fetchActivities(true);
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <Text style={styles.footerText}>جارٍ التحميل...</Text>
            </View>
          ) : null
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />

      {/* User Filter Modal */}
      <UserFilterModal
        visible={showUserFilter}
        onClose={() => setShowUserFilter(false)}
        onSelectUser={(user) => {
          setSelectedUser(user);
          setPage(0);
          setShowUserFilter(false);
        }}
        selectedUser={selectedUser}
        currentUserId={userProfile?.id}
      />

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        visible={showDateFilter}
        onClose={() => setShowDateFilter(false)}
        onApplyFilter={(preset, range) => {
          setDatePreset(preset);
          if (preset === 'custom') {
            setCustomDateRange(range);
          }
          setPage(0);
        }}
        activePreset={datePreset}
        customRange={customDateRange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 20, // Extra padding for iOS Dynamic Island
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: "#242121",
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  backButton: {
    padding: 8,
    marginLeft: 8,
    marginRight: -8,
  },

  // Stats Widget
  statsWidget: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
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

  // Search Bar
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

  // Filter Buttons
  filterSection: {
    marginBottom: 16,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D1BBA340",
    minWidth: 90,
  },
  filterButtonActive: {
    backgroundColor: "#A13333",
    borderColor: "#A13333",
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filterButtonTextActive: {
    color: "#F9F7F3",
  },

  // Activities List
  listContent: {
    paddingBottom: 16,
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

  // Activity Card
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
    fontSize: 20, // Increased from 17 for better hierarchy
    fontWeight: "700", // Increased from 600 for more prominence
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    marginBottom: 4, // Increased spacing
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
  // Detail sections
  detailSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA320",
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A13333",
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  detailGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#736372",
    minWidth: 80,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  detailValue: {
    flex: 1,
    fontSize: 15,
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },

  // Field-by-field diff
  fieldChangeRow: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#D1BBA315",
  },
  fieldChangeName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D58C4A",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  fieldChangeValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fieldChangeOld: {
    flex: 1,
    padding: 12,
    backgroundColor: "#FF3B3010",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF3B3020",
  },
  fieldChangeNew: {
    flex: 1,
    padding: 12,
    backgroundColor: "#34C75910",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#34C75920",
  },
  fieldChangeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#736372",
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    textTransform: "uppercase",
  },
  fieldChangeValue: {
    fontSize: 13,
    color: "#242121",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },

  // Full JSON diff
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

  // Footer Loader
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#736372",
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },

  // Filter Modal Buttons
  filterButtonsRow: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
    paddingHorizontal: 16,
    marginBottom: tokens.spacing.sm,
  },
  filterModalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: tokens.colors.najdi.crimson + "15",
    borderWidth: 1,
    borderColor: tokens.colors.najdi.crimson + "40",
    minHeight: 36,
  },
  filterModalButtonActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },
  filterModalButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.crimson,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },
  filterModalButtonTextActive: {
    color: tokens.colors.najdi.alJass,
  },

  // Filter Chips
  filterChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
    paddingHorizontal: 16,
    marginBottom: tokens.spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: "48%",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
    flexShrink: 1,
  },
});
