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
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
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
import undoService from "../../services/undoService";
import { useUndoStore } from "../../stores/undoStore";
import Toast from "../../components/ui/Toast";

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

// Helper: Check if two name chains represent the same person
// Handles both old format (space-separated) and new format (with "بن")
const isNameChainEquivalent = (historical, current) => {
  const h = historical?.trim();
  const c = current?.trim();

  if (!h || !c) return false;
  if (h === c) return true; // Fast path for exact match

  // Remove " القفاري" suffix if present
  const stripSuffix = (str) => str.replace(/ القفاري$/, '').trim();
  const hClean = stripSuffix(h);
  const cClean = stripSuffix(c);

  // Split into parts - handle both formats:
  // Old format: "محمد علي عبدالله" (spaces only)
  // New format: "محمد بن علي بن عبدالله" (with بن)
  const splitChain = (str) => {
    if (str.includes(' بن ')) {
      // New format: split by "بن"
      return str.split(' بن ').map(p => p.trim());
    }
    // Old format: space-separated names
    return str.split(/\s+/).filter(p => p.length > 0);
  };

  const hParts = splitChain(hClean);
  const cParts = splitChain(cClean);
  const minLength = Math.min(hParts.length, cParts.length);

  // Compare overlapping segments - ALL must match for same person
  for (let i = 0; i < minLength; i++) {
    if (hParts[i] !== cParts[i]) {
      return false; // Different person or name was edited
    }
  }

  return true; // Same person (one chain is just longer)
};

// Smart Name Display Component - Shows historical + current names with navigation
const SmartNameDisplay = React.memo(({
  historicalName,
  currentName,
  profileId,
  onNavigate,
  style,
  historicalStyle,
  currentStyle
}) => {
  // Normalize empty strings to null for consistent comparisons
  const normalizedHistorical = historicalName?.trim() || null;
  const normalizedCurrent = currentName?.trim() || null;

  // Use smart comparison to handle 3-level vs full chain differences
  const namesAreDifferent =
    normalizedHistorical &&
    normalizedCurrent &&
    !isNameChainEquivalent(normalizedHistorical, normalizedCurrent);

  const handlePress = useCallback((e) => {
    if (!onNavigate || !profileId) return;

    try {
      // Stop event propagation to prevent expanding the activity card
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      // Fire haptics FIRST for immediate tactile feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onNavigate(profileId);
    } catch (error) {
      console.error('[SmartNameDisplay] خطأ في التنقل:', error);
    }
  }, [onNavigate, profileId]);

  // Both names are null or empty
  if (!normalizedHistorical && !normalizedCurrent) {
    return <Text style={style}>مستخدم</Text>;
  }

  // Same name or only one available - show simple clickable name
  if (!namesAreDifferent) {
    const displayName = normalizedHistorical || normalizedCurrent;
    return (
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={(e) => e?.stopPropagation && e.stopPropagation()}
        disabled={!onNavigate || !profileId}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        accessibilityLabel={`الانتقال إلى ملف ${displayName}`}
        accessibilityRole="button"
        accessibilityHint="اضغط للانتقال إلى الملف الشخصي في الشجرة"
      >
        <Ionicons name="person-circle-outline" size={14} color="#736372" />
        <Text style={[style, historicalStyle]}>
          {displayName}
        </Text>
        {onNavigate && profileId && (
          <Ionicons name="chevron-back" size={12} color="#736372" />
        )}
      </TouchableOpacity>
    );
  }

  // Names are different - show both with visual distinction
  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={(e) => e?.stopPropagation && e.stopPropagation()}
      disabled={!onNavigate || !profileId}
      activeOpacity={0.7}
      accessibilityLabel={`الاسم تغير من ${normalizedHistorical} إلى ${normalizedCurrent}. اضغط للانتقال إلى الملف`}
      accessibilityRole="button"
      accessibilityHint="اضغط للانتقال إلى الملف الشخصي في الشجرة"
    >
      <View style={{ gap: 4 }}>
        {/* Historical name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="person-circle-outline" size={14} color="#73637280" />
          <Text style={[style, historicalStyle]}>
            {normalizedHistorical}
          </Text>
        </View>
        {/* Current name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 18 }}>
          <View style={{
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: '#D58C4A15'
          }}>
            <Text style={{ fontSize: 10, color: '#73637280', fontWeight: '600' }}>الآن</Text>
          </View>
          <Text style={[style, currentStyle, { color: '#242121' }]}>
            {normalizedCurrent}
          </Text>
          {onNavigate && profileId && (
            <Ionicons name="chevron-back" size={12} color="#736372" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function ActivityLogDashboard({ onClose, onNavigateToProfile }) {
  const { userProfile } = useAuth();

  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Undo functionality
  const { showToast, hideToast, toastVisible, toastMessage, toastType } = useUndoStore();

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter modal state
  const [showUserFilter, setShowUserFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [datePreset, setDatePreset] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState(null);
  const [customDateTo, setCustomDateTo] = useState(null);

  // Memoize customDateRange object to prevent infinite loops
  const customDateRange = useMemo(() => ({
    from: customDateFrom,
    to: customDateTo
  }), [customDateFrom, customDateTo]);

  // Stats state (fetched from server)
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    critical: 0,
    users: 0,
  });

  const subscriptionRef = useRef(null);
  const flatListRef = useRef(null);
  const requestIdRef = useRef(0); // Track latest request to discard stale responses
  const statsRequestIdRef = useRef(0); // Track latest stats request to discard stale responses

  // Refs for filter values (so subscription can access current values without recreating)
  const selectedUserRef = useRef(selectedUser);
  const datePresetRef = useRef(datePreset);
  const customDateRangeRef = useRef(customDateRange);
  const activeFilterRef = useRef(activeFilter);

  // Update refs when filter state changes
  useEffect(() => {
    selectedUserRef.current = selectedUser;
    datePresetRef.current = datePreset;
    customDateRangeRef.current = customDateRange;
    activeFilterRef.current = activeFilter;
  }, [selectedUser, datePreset, customDateRange, activeFilter]);

  // Fade-in animation for smooth transition from loading to loaded
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      // Fade in when loading finishes
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Reset opacity when loading starts
      fadeAnim.setValue(0);
    }
  }, [loading, fadeAnim]);

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
    // Increment request ID to track this request
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

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

      // Check if this request is stale (a newer request was initiated)
      if (currentRequestId !== requestIdRef.current) {
        console.log('Discarding stale request', currentRequestId, 'current:', requestIdRef.current);
        return; // Discard this response
      }

      if (error) throw error;

      if (isLoadMore) {
        setActivities(prev => [...prev, ...(data || [])]);
      } else {
        setActivities(data || []);
      }

      setPage(currentPage + 1);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      // Only show error if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        console.error("Error fetching activities:", error);
        Alert.alert("خطأ", "فشل تحميل السجل");
      }
    } finally {
      // Only update loading states if this is still the latest request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [page, PAGE_SIZE, selectedUser, datePreset, customDateRange]);

  // Fetch stats from server (O(1) memory vs O(n) client-side calculation)
  const fetchStats = useCallback(async () => {
    // Increment request ID to track this request
    statsRequestIdRef.current += 1;
    const currentRequestId = statsRequestIdRef.current;

    try {
      // Build parameters for RPC function
      const dateRange = datePreset === 'custom'
        ? { start: customDateRange.from, end: customDateRange.to }
        : datePreset !== 'all' ? getDateRangeForPreset(datePreset) : { start: null, end: null };

      const { data, error } = await supabase.rpc('get_activity_stats', {
        p_user_filter: selectedUser?.actor_id || null,
        p_date_from: dateRange.start?.toISOString() || null,
        p_date_to: dateRange.end?.toISOString() || null,
        p_action_filter: null, // Not filtering by action type in stats
      });

      // Check if this request is stale (a newer request was initiated)
      if (currentRequestId !== statsRequestIdRef.current) {
        console.log('[fetchStats] Discarding stale stats request', currentRequestId, 'current:', statsRequestIdRef.current);
        return; // Discard this response
      }

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        setStats({
          total: parseInt(result.total_count) || 0,
          today: parseInt(result.today_count) || 0,
          critical: parseInt(result.critical_count) || 0,
          users: parseInt(result.users_count) || 0,
        });
      }
    } catch (error) {
      // Only log error if this is still the latest request
      if (currentRequestId === statsRequestIdRef.current) {
        console.error('Error fetching stats:', error);
        // Keep previous stats on error, don't show alert (non-critical)
      }
    }
  }, [selectedUser, datePreset, customDateRange]);

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
    fetchStats(); // Load stats on initial mount

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
          // Optimistic update: prepend new item with filter checks
          setActivities((prev) => {
            const newActivity = payload.new;

            // Avoid duplicates
            if (prev.some((item) => item.id === newActivity.id)) {
              return prev;
            }

            // Apply user filter (using ref to get current value)
            if (selectedUserRef.current && newActivity.actor_id !== selectedUserRef.current.actor_id) {
              return prev; // Skip - doesn't match user filter
            }

            // Apply date range filter (using refs)
            if (datePresetRef.current !== 'all') {
              const activityDate = new Date(newActivity.created_at);
              const range = datePresetRef.current === 'custom'
                ? { start: customDateRangeRef.current.from, end: customDateRangeRef.current.to }
                : getDateRangeForPreset(datePresetRef.current);

              if (range.start && activityDate < range.start) return prev;
              if (range.end && activityDate > range.end) return prev;
            }

            // Apply category filter (using ref)
            if (activeFilterRef.current !== 'all') {
              switch (activeFilterRef.current) {
                case 'tree':
                  if (!['create_node', 'update_node', 'delete_node', 'merge_nodes'].includes(newActivity.action_type)) {
                    return prev;
                  }
                  break;
                case 'admin':
                  if (!['grant_admin', 'revoke_admin', 'update_settings'].includes(newActivity.action_type) &&
                      !['super_admin', 'admin'].includes(newActivity.actor_role)) {
                    return prev;
                  }
                  break;
                case 'critical':
                  if (!['critical', 'high'].includes(newActivity.severity)) {
                    return prev;
                  }
                  break;
                case 'photos':
                  if (!['upload_photo', 'delete_photo', 'update_photo'].includes(newActivity.action_type)) {
                    return prev;
                  }
                  break;
                case 'marriages':
                  if (!['add_marriage', 'update_marriage', 'delete_marriage'].includes(newActivity.action_type)) {
                    return prev;
                  }
                  break;
              }
            }

            return [newActivity, ...prev];
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
  }, []); // Empty deps - subscription uses refs for filter values

  // Refetch activities and stats when filters change
  useEffect(() => {
    setPage(0);
    fetchActivities(false);
    fetchStats(); // Fetch stats from server
  }, [selectedUser, datePreset, customDateRange]); // Removed function deps - they're stable via useCallback

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

  // Handle undo action
  const handleUndo = useCallback(async (activityId, actionType) => {
    if (!userProfile?.id) {
      showToast('يجب تسجيل الدخول للتراجع', 'error');
      return;
    }

    try {
      // Check permission first
      const permissionCheck = await undoService.checkUndoPermission(
        activityId,
        userProfile.id
      );

      if (!permissionCheck.can_undo) {
        showToast(permissionCheck.reason || 'لا يمكن التراجع عن هذا الإجراء', 'error');
        return;
      }

      // Perform undo based on action type
      const result = await undoService.undoAction(
        activityId,
        actionType,
        'تراجع من لوحة السجل'
      );

      if (result.success) {
        showToast('✓ تم التراجع بنجاح', 'success');
        // Refresh activities to show the undo
        fetchActivities(false);
      } else {
        showToast(result.error || 'فشل التراجع', 'error');
      }
    } catch (error) {
      console.error('Undo error:', error);
      showToast(error.message || 'حدث خطأ أثناء التراجع', 'error');
    }
  }, [userProfile, showToast, fetchActivities]);

  // Handle stat widget taps to apply filters
  const handleStatPress = useCallback((filterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (filterType) {
      case 'all':
        setActiveFilter('all');
        break;
      case 'critical':
        setActiveFilter('critical');
        break;
      case 'today':
        // Set date filter to today
        setDatePreset('today');
        break;
      case 'users':
        // Open user filter modal
        setShowUserFilter(true);
        break;
      default:
        break;
    }
  }, []);

  // Clear all active filters
  const handleClearAllFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveFilter('all');
    setSelectedUser(null);
    setDatePreset('all');
    setCustomDateFrom(null);
    setCustomDateTo(null);
    setSearchText('');
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

  // Memoized Stats Widget Component (now interactive)
  const StatsWidget = useMemo(() => (
    <View style={styles.statsWidget}>
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[
            styles.statItem,
            activeFilter === 'all' && datePreset === 'all' && !selectedUser && styles.statItemActive
          ]}
          onPress={() => handleStatPress('all')}
          activeOpacity={0.7}
          accessibilityLabel="إجمالي الأنشطة"
          accessibilityHint="اضغط لعرض جميع الأنشطة"
          accessibilityRole="button"
        >
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>إجمالي</Text>
          <Ionicons name="chevron-back" size={12} color={tokens.colors.textMuted} style={styles.statChevron} />
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={[
            styles.statItem,
            datePreset === 'today' && styles.statItemActive
          ]}
          onPress={() => handleStatPress('today')}
          activeOpacity={0.7}
          accessibilityLabel="أنشطة اليوم"
          accessibilityHint="اضغط لتصفية أنشطة اليوم فقط"
          accessibilityRole="button"
        >
          <Text style={styles.statValue}>{stats.today}</Text>
          <Text style={styles.statLabel}>اليوم</Text>
          <Ionicons name="chevron-back" size={12} color={tokens.colors.textMuted} style={styles.statChevron} />
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={[
            styles.statItem,
            activeFilter === 'critical' && styles.statItemActive
          ]}
          onPress={() => handleStatPress('critical')}
          activeOpacity={0.7}
          accessibilityLabel="أنشطة حرجة"
          accessibilityHint="اضغط لتصفية الأنشطة الحرجة فقط"
          accessibilityRole="button"
        >
          <Text style={styles.statValue}>{stats.critical}</Text>
          <Text style={styles.statLabel}>حرج</Text>
          <Ionicons name="chevron-back" size={12} color={tokens.colors.textMuted} style={styles.statChevron} />
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={[
            styles.statItem,
            selectedUser && styles.statItemActive
          ]}
          onPress={() => handleStatPress('users')}
          activeOpacity={0.7}
          accessibilityLabel="تصفية حسب المستخدم"
          accessibilityHint="اضغط لفتح تصفية المستخدمين"
          accessibilityRole="button"
        >
          <Text style={styles.statValue}>{stats.users}</Text>
          <Text style={styles.statLabel}>مستخدمون</Text>
          <Ionicons name="chevron-back" size={12} color={tokens.colors.textMuted} style={styles.statChevron} />
        </TouchableOpacity>
      </View>
    </View>
  ), [stats, activeFilter, datePreset, selectedUser, handleStatPress]);

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
      {/* Show loading indicator during debounce */}
      {searchText !== debouncedSearch && searchText.length > 0 && (
        <ActivityIndicator size="small" color={tokens.colors.najdi.crimson} />
      )}
      {searchText.length > 0 && searchText === debouncedSearch && (
        <TouchableOpacity onPress={() => setSearchText("")}>
          <Ionicons name="close-circle" size={20} color="#24212160" />
        </TouchableOpacity>
      )}
    </View>
  ), [searchText, debouncedSearch]);

  // Filter Chips Component
  const FilterChips = useMemo(() => {
    const activeFilterCount = [
      activeFilter !== 'all' ? 1 : 0,
      selectedUser ? 1 : 0,
      datePreset !== 'all' ? 1 : 0,
      searchText.length > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    const hasFilters = activeFilterCount > 0;

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
              setCustomDateFrom(null);
              setCustomDateTo(null);
              setPage(0);
            }}>
              <Ionicons name="close-circle" size={16} color={tokens.colors.najdi.alJass} />
            </TouchableOpacity>
          </View>
        )}
        {activeFilterCount > 1 && (
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={handleClearAllFilters}
            activeOpacity={0.7}
            accessibilityLabel="مسح جميع الفلاتر"
            accessibilityHint="اضغط لإزالة جميع الفلاتر النشطة"
            accessibilityRole="button"
          >
            <Text style={styles.clearAllText}>مسح الكل</Text>
            <Ionicons name="close-circle" size={14} color={tokens.colors.najdi.crimson} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [selectedUser, datePreset, activeFilter, searchText, handleClearAllFilters]);

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

  // Filter Buttons Component (horizontal FlatList with integrated modal buttons)
  const FilterButtons = useMemo(() => (
    <View style={styles.filterSection}>
      <FlatList
        horizontal
        data={FILTER_DATA}
        renderItem={renderFilterButton}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        ListHeaderComponent={
          <View style={styles.filterHeaderButtons}>
            <TouchableOpacity
              style={[styles.filterModalButton, selectedUser && styles.filterModalButtonActive]}
              onPress={() => setShowUserFilter(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person"
                size={14}
                color={selectedUser ? "#F9F7F3" : "#242121"}
                style={{ marginRight: 4 }}
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
                size={14}
                color={datePreset !== 'all' ? "#F9F7F3" : "#242121"}
                style={{ marginRight: 4 }}
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

            {/* Divider before segment buttons */}
            <View style={styles.filterDivider} />
          </View>
        }
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

  // Get first meaningful field (skip metadata fields like version)
  const getDisplayField = useCallback((changedFields) => {
    const metadataFields = ['version', 'updated_at', 'created_at'];
    return changedFields.find(field => !metadataFields.includes(field)) || changedFields[0];
  }, []);

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
                      activity.target_name_historical || activity.target_name_current
                    )}
                  </Text>
                  <SmartNameDisplay
                    historicalName={activity.actor_name_historical}
                    currentName={activity.actor_name_current}
                    profileId={activity.actor_profile_id}
                    onNavigate={onNavigateToProfile}
                    style={styles.activitySubtitle}
                  />
                  {/* Show inline diff ONLY for single-field changes (reduce clutter) */}
                  {!isExpanded && activity.changed_fields && activity.changed_fields.length === 1 && (() => {
                    const displayField = getDisplayField(activity.changed_fields);
                    return (
                      <InlineDiff
                        field={displayField}
                        oldValue={activity.old_data?.[displayField]}
                        newValue={activity.new_data?.[displayField]}
                        showLabels={false}
                      />
                    );
                  })()}
                  {/* Show field count badge for multi-field changes */}
                  {!isExpanded && activity.changed_fields && activity.changed_fields.length > 1 && (
                    <View style={styles.fieldCountBadge}>
                      <Text style={styles.fieldCountText}>
                        {activity.changed_fields.length} حقول
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.activityTime}>
                  {format(parseISO(activity.created_at), "h:mm a", { locale: ar })}
                </Text>
                {/* Undo button for undoable actions */}
                {userProfile?.id && !activity.undone_at && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleUndo(activity.id, activity.action_type);
                    }}
                    onPressIn={(e) => e.stopPropagation()}
                    style={styles.undoButton}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="arrow-undo-outline"
                      size={18}
                      color="#A13333"
                    />
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-back" size={18} color="#24212140" />
              </TouchableOpacity>

              {/* Expanded details */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {/* Actor Information */}
                  {(activity.actor_name_historical || activity.actor_name_current) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>المستخدم المنفذ</Text>
                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>الاسم</Text>
                          <SmartNameDisplay
                            historicalName={activity.actor_name_historical}
                            currentName={activity.actor_name_current}
                            profileId={activity.actor_profile_id}
                            onNavigate={onNavigateToProfile}
                            style={styles.detailValue}
                          />
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
                  {(activity.target_name_historical || activity.target_name_current) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>الملف المتأثر</Text>
                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>الاسم</Text>
                          <SmartNameDisplay
                            historicalName={activity.target_name_historical}
                            currentName={activity.target_name_current}
                            profileId={activity.target_profile_id}
                            onNavigate={onNavigateToProfile}
                            style={styles.detailValue}
                          />
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
                                backgroundColor: SEVERITY_COLORS[activity.severity],
                              },
                            ]}
                          >
                            <Text style={styles.severityBadgeText}>
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
  ), [expandedCards, toggleCardExpansion, formatTimestamp, getDisplayField]);

  // Loading state
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
      </SafeAreaView>
    );
  }

  // Main render with single FlatList
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          ref={flatListRef}
          data={groupedActivities}
          renderItem={renderDateGroup}
        keyExtractor={(item) => item.dateLabel}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
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
            {(selectedUser || datePreset !== 'all' || activeFilter !== 'all' || searchText) ? (
              <>
                <Text style={styles.emptyText}>لا توجد نتائج تطابق الفلاتر</Text>
                <Text style={styles.emptySubtext}>
                  جرب تعديل الفلاتر أو البحث
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={handleClearAllFilters}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emptyActionText}>مسح الفلاتر</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>لا توجد أنشطة</Text>
                <Text style={styles.emptySubtext}>
                  لم يتم تسجيل أي أنشطة بعد
                </Text>
              </>
            )}
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
      </Animated.View>

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
            setCustomDateFrom(range.from);
            setCustomDateTo(range.to);
          }
          setPage(0);
        }}
        activePreset={datePreset}
        customRange={customDateRange}
      />

      {/* Toast notifications */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },

  // Header (SafeAreaView handles top inset automatically)
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
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
    backgroundColor: "#F9F7F3", // Al-Jass White (changed from #FFFFFF)
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
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    minHeight: 44, // Accessibility touch target
  },
  statItemActive: {
    backgroundColor: "#A1333315", // Najdi Crimson 8% opacity
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
  statChevron: {
    marginTop: 4,
    opacity: 0.6,
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
  filterHeaderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 12, // Add spacing before divider (note: RTL, so paddingRight is on the left)
  },
  filterDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: "#D1BBA340",
    marginHorizontal: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    minHeight: 44, // Changed from 36px to meet iOS minimum touch target
    paddingVertical: 10,
    borderRadius: 22,
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
  fieldCountBadge: {
    alignSelf: "flex-start",
    backgroundColor: tokens.colors.najdi.ochre + "20",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.ochre + "40",
  },
  fieldCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: tokens.colors.najdi.ochre,
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
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#FFFFFF", // White text for better contrast on solid backgrounds
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
  emptyActionButton: {
    marginTop: 24,
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.najdi.alJass,
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

  // Filter Modal Buttons (match segment button styling exactly)
  filterModalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D1BBA340",
    minHeight: 44,
    minWidth: 90,
  },
  filterModalButtonActive: {
    backgroundColor: "#A13333",
    borderColor: "#A13333",
  },
  filterModalButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#242121",
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
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.crimson,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: tokens.colors.najdi.crimson,
    fontFamily: Platform.OS === "ios" ? "SF Arabic" : "System",
  },

  // Undo Button
  undoButton: {
    padding: 8,
    borderRadius: 8,
    minHeight: 44,  // Accessibility touch target
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
