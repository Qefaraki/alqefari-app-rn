import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { ar } from 'date-fns/locale';

// Import design tokens
import { tokens } from '../ui/tokens';
// Import undo functionality
import undoService from '../../services/undoService';
import { useUndoStore } from '../../stores/undoStore';
import Toast from '../ui/Toast';
import { supabase } from '../../services/supabase';

// Database Schema Type
interface ActivityLogDetailedRow {
  id: string;
  created_at: string;
  actor_name_current: string | null;
  actor_name_historical: string | null;
  target_name_current: string | null;
  target_name_historical: string | null;
  action_type: string;
  action_category: string | null;
  description: string | null;
  severity: string | null;
  is_undoable: boolean | null;
  undone_at: string | null;
  metadata: Record<string, any> | null;
}

// UI Interface Type
interface ActivityLog {
  id: string;
  action_type: 'TREE' | 'MUNASIB' | 'PHOTO' | 'ADMIN' | 'CRITICAL';
  action: string;
  actor_name: string;
  target_name?: string;
  metadata?: Record<string, any>;
  created_at: string;
  severity?: string;
  is_undoable?: boolean;
}

interface FilterOption {
  id: string;
  label: string;
  icon?: string;
  value: string;
}

interface GroupedActivity {
  date: string;
  dateLabel: string;
  activities: ActivityLog[];
}

// Filter options configuration
const FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'الكل', value: 'all' },
  { id: 'tree', label: 'الشجرة', icon: 'git-network-outline', value: 'TREE' },
  { id: 'munasib', label: 'الأزواج', icon: 'people-outline', value: 'MUNASIB' },
  { id: 'photo', label: 'الصور', icon: 'image-outline', value: 'PHOTO' },
  { id: 'admin', label: 'الإدارة', icon: 'shield-outline', value: 'ADMIN' },
  { id: 'critical', label: 'حرج', value: 'CRITICAL' },
];

// Activity type icons and colors
const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  TREE: { icon: 'git-network-outline', color: tokens.colors.najdi.crimson },
  MUNASIB: { icon: 'people-outline', color: tokens.colors.najdi.ochre },
  PHOTO: { icon: 'image-outline', color: tokens.colors.najdi.ochre },
  ADMIN: { icon: 'shield-outline', color: tokens.colors.najdi.crimson },
  CRITICAL: { icon: 'warning-outline', color: '#D32F2F' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database action_category to UI action_type
 * CRITICAL: Database schema != UI interface
 * - Database has: action_category ('tree'/'marriage'/'photo'/'admin'/'notification')
 * - UI expects: action_type ('TREE'/'MUNASIB'/'PHOTO'/'ADMIN'/'CRITICAL')
 */
const mapToUIType = (log: ActivityLogDetailedRow): 'TREE' | 'MUNASIB' | 'PHOTO' | 'ADMIN' | 'CRITICAL' => {
  // Critical severity always takes precedence for UI display
  if (log.severity === 'critical') return 'CRITICAL';

  // Map database category to UI type
  const categoryMap: Record<string, 'TREE' | 'MUNASIB' | 'PHOTO' | 'ADMIN'> = {
    'tree': 'TREE',
    'marriage': 'MUNASIB',
    'photo': 'PHOTO',
    'admin': 'ADMIN',
    'notification': 'ADMIN', // Notifications are admin actions
  };

  return categoryMap[log.action_category || ''] || 'TREE';
};

// ============================================================================
// MEMOIZED SUBCOMPONENTS (prevent unnecessary re-renders)
// ============================================================================

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

const Header = memo<HeaderProps>(({ onRefresh, isRefreshing }) => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      {/* Emblem Icon */}
      <View style={styles.emblemContainer}>
        <Ionicons
          name="shield-checkmark"
          size={32}
          color={tokens.colors.najdi.crimson}
        />
      </View>

      {/* Title Section - LEFT-ALIGNED */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>السجل</Text>
        <Text style={styles.subtitle}>تتبع التغييرات والعمليات</Text>
      </View>
    </View>

    {/* Refresh Button */}
    <TouchableOpacity
      onPress={onRefresh}
      disabled={isRefreshing}
      style={styles.refreshButton}
      activeOpacity={0.7}
    >
      {isRefreshing ? (
        <ActivityIndicator size="small" color={tokens.colors.najdi.crimson} />
      ) : (
        <Ionicons
          name="refresh-outline"
          size={24}
          color={tokens.colors.najdi.crimson}
        />
      )}
    </TouchableOpacity>
  </View>
));

interface StatsWidgetProps {
  totalCount: number;
  todayCount: number;
  criticalCount: number;
  pendingCount: number;
}

const StatsWidget = memo<StatsWidgetProps>(
  ({ totalCount, todayCount, criticalCount, pendingCount }) => (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{totalCount}</Text>
        <Text style={styles.statLabel}>إجمالي</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{todayCount}</Text>
        <Text style={styles.statLabel}>اليوم</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, { color: '#D32F2F' }]}>
          {criticalCount}
        </Text>
        <Text style={styles.statLabel}>حرج</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{pendingCount}</Text>
        <Text style={styles.statLabel}>معلق</Text>
      </View>
    </View>
  )
);

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}

const SearchBar = memo<SearchBarProps>(
  ({ value, onChangeText, isFocused, onFocus, onBlur }) => (
    <View
      style={[
        styles.searchContainer,
        isFocused && styles.searchContainerFocused,
      ]}
    >
      <Ionicons
        name="search-outline"
        size={20}
        color={tokens.colors.text.secondary}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.searchInput}
        placeholder="ابحث عن نشاط..."
        placeholderTextColor={tokens.colors.text.tertiary}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        textAlign="right"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.clearButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name="close-circle"
            size={20}
            color={tokens.colors.text.tertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  )
);

interface FilterButtonProps {
  filter: FilterOption;
  isActive: boolean;
  onPress: () => void;
}

const FilterButton = memo<FilterButtonProps>(
  ({ filter, isActive, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterButton,
        isActive && styles.filterButtonActive,
      ]}
      activeOpacity={0.7}
    >
      {filter.icon && (
        <Ionicons
          name={filter.icon as any}
          size={16}
          color={
            isActive
              ? tokens.colors.najdi.aljass
              : tokens.colors.text.primary
          }
          style={styles.filterIcon}
        />
      )}
      <Text
        style={[
          styles.filterButtonText,
          isActive && styles.filterButtonTextActive,
        ]}
      >
        {filter.label}
      </Text>
    </TouchableOpacity>
  )
);

interface ActivityRowProps {
  activity: ActivityLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUndo?: (activityId: string) => void;
  canUndo?: boolean;
}

const ActivityRow = memo<ActivityRowProps>(
  ({ activity, isExpanded, onToggleExpand, onUndo, canUndo = false }) => {
    const activityStyle = ACTIVITY_ICONS[activity.action_type] || {
      icon: 'ellipse-outline',
      color: tokens.colors.text.secondary,
    };

    const timeString = format(new Date(activity.created_at), 'hh:mm a', {
      locale: ar,
    });

    const handleUndo = useCallback((e: any) => {
      // Prevent event from bubbling up to parent TouchableOpacity
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }
      if (onUndo) {
        onUndo(activity.id);
      }
    }, [activity.id, onUndo]);

    return (
      <View style={styles.activityRow}>
        <TouchableOpacity
          onPress={onToggleExpand}
          style={styles.activityContent}
          activeOpacity={0.7}
        >
          {/* Icon */}
          <View
            style={[
              styles.activityIconContainer,
              { backgroundColor: activityStyle.color + '15' },
            ]}
          >
            <Ionicons
              name={activityStyle.icon as any}
              size={20}
              color={activityStyle.color}
            />
          </View>

          {/* Content */}
          <View style={styles.activityTextContainer}>
            <Text style={styles.activityActor} numberOfLines={1}>
              {activity.actor_name}
            </Text>
            <Text style={styles.activityAction} numberOfLines={2}>
              {activity.action}
              {activity.target_name && ` - ${activity.target_name}`}
            </Text>
          </View>

          {/* Time, Undo Button & Chevron */}
          <View style={styles.activityMeta}>
            <Text style={styles.activityTime}>{timeString}</Text>
            {canUndo && onUndo && activity.is_undoable && (
              <TouchableOpacity
                onPress={handleUndo}
                onPressIn={(e) => e.stopPropagation()}
                style={styles.undoButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="arrow-undo-outline"
                  size={18}
                  color={tokens.colors.najdi.crimson}
                />
              </TouchableOpacity>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={tokens.colors.text.tertiary}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Metadata */}
        {isExpanded && activity.metadata && (
          <View style={styles.metadataContainer}>
            {Object.entries(activity.metadata).map(([key, value]) => (
              <View key={key} style={styles.metadataRow}>
                <Text style={styles.metadataKey}>{key}:</Text>
                <Text style={styles.metadataValue}>
                  {typeof value === 'object' ? JSON.stringify(value) : value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
);

interface DateGroupCardProps {
  group: GroupedActivity;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onUndo?: (activityId: string) => void;
  canUndo?: boolean;
}

const DateGroupCard = memo<DateGroupCardProps>(
  ({ group, expandedIds, onToggleExpand, onUndo, canUndo }) => (
    <View style={styles.dateGroup}>
      <Text style={styles.dateHeader}>{group.dateLabel}</Text>
      <View style={styles.dateCard}>
        {group.activities.map((activity, index) => (
          <React.Fragment key={activity.id}>
            <ActivityRow
              activity={activity}
              isExpanded={expandedIds.has(activity.id)}
              onToggleExpand={() => onToggleExpand(activity.id)}
              onUndo={onUndo}
              canUndo={canUndo}
            />
            {index < group.activities.length - 1 && (
              <View style={styles.activityDivider} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  )
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ActivityLogDashboard: React.FC = () => {
  // State
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [userProfileId, setUserProfileId] = useState<string | null>(null);

  // Undo store
  const { showToast, hideToast, toastVisible, toastMessage, toastType } = useUndoStore();

  // Get current user's profile ID
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (profile) {
            setUserProfileId(profile.id);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserProfile();
  }, []);

  // Load initial data on component mount
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  // Memoized filtered activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Apply filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'CRITICAL') {
        // Show all critical items regardless of category
        filtered = filtered.filter((a) => a.severity === 'critical');
      } else {
        // Show items matching this category
        filtered = filtered.filter((a) => a.action_type === activeFilter);
      }
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.actor_name.toLowerCase().includes(query) ||
          a.action.toLowerCase().includes(query) ||
          a.target_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activities, activeFilter, searchQuery]);

  // Memoized grouped activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, GroupedActivity> = {};

    filteredActivities.forEach((activity) => {
      const date = new Date(activity.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!groups[dateKey]) {
        let dateLabel: string;
        if (isToday(date)) {
          dateLabel = 'اليوم';
        } else if (isYesterday(date)) {
          dateLabel = 'أمس';
        } else {
          dateLabel = format(date, 'd MMMM', { locale: ar });
        }

        groups[dateKey] = {
          date: dateKey,
          dateLabel,
          activities: [],
        };
      }

      groups[dateKey].activities.push(activity);
    });

    // Sort by date descending
    return Object.values(groups).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredActivities]);

  // Memoized stats
  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return {
      totalCount: activities.length,
      todayCount: activities.filter(
        (a) => new Date(a.created_at) >= todayStart
      ).length,
      criticalCount: activities.filter((a) => a.severity === 'critical').length,
      pendingCount: 0, // TODO: Implement pending logic
    };
  }, [activities]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('activity_log_detailed')
        .select('*')
        .is('undone_at', null) // Exclude undone actions
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Transform database schema to UI interface
      const transformedActivities: ActivityLog[] = (data || []).map((log: ActivityLogDetailedRow) => ({
        id: log.id,
        action_type: mapToUIType(log),
        action: log.description || 'إجراء غير محدد',
        actor_name: log.actor_name_current || 'مستخدم غير معروف',
        target_name: log.target_name_current || undefined,
        metadata: log.metadata || {},
        created_at: log.created_at,
        severity: log.severity || undefined,
        is_undoable: log.is_undoable && !log.undone_at,
      }));

      setActivities(transformedActivities);
    } catch (error: any) {
      console.error('Activity log fetch error:', error);
      const message = error?.message || 'فشل تحميل السجلات';
      Alert.alert('خطأ في تحميل السجلات', message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleFilterPress = useCallback((filterValue: string) => {
    setActiveFilter(filterValue);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleUndo = useCallback(async (activityId: string) => {
    if (!userProfileId) {
      showToast('يجب تسجيل الدخول للتراجع', 'error');
      return;
    }

    try {
      // Get the activity details
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) {
        showToast('لم يتم العثور على النشاط', 'error');
        return;
      }

      // Check permission first
      const permissionCheck = await undoService.checkUndoPermission(
        activityId,
        userProfileId
      );

      if (!permissionCheck.can_undo) {
        showToast(permissionCheck.reason || 'لا يمكن التراجع عن هذا الإجراء', 'error');
        return;
      }

      // Perform undo based on action type
      const result = await undoService.undoAction(
        activityId,
        userProfileId,
        activity.action_type,
        'تراجع من لوحة السجل'
      );

      if (result.success) {
        showToast('✓ تم التراجع بنجاح', 'success');
        // Refresh activities
        handleRefresh();
      } else {
        showToast(result.error || 'فشل التراجع', 'error');
      }
    } catch (error: any) {
      console.error('Undo error:', error);
      showToast(error.message || 'حدث خطأ أثناء التراجع', 'error');
    }
  }, [userProfileId, activities, showToast, handleRefresh]);

  // List header component (all non-scrolling header elements)
  const renderListHeader = useCallback(
    () => (
      <View>
        <Header onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        <StatsWidget
          totalCount={stats.totalCount}
          todayCount={stats.todayCount}
          criticalCount={stats.criticalCount}
          pendingCount={stats.pendingCount}
        />
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          isFocused={isSearchFocused}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />

        {/* Filter Buttons - Horizontal FlatList for stability */}
        <View style={styles.filterSection}>
          <FlatList
            data={FILTER_OPTIONS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <FilterButton
                filter={item}
                isActive={activeFilter === item.value}
                onPress={() => handleFilterPress(item.value)}
              />
            )}
            contentContainerStyle={styles.filterListContent}
            // CRITICAL: Fixed item layout prevents shifting
            getItemLayout={(data, index) => ({
              length: 100, // Approximate width
              offset: 100 * index,
              index,
            })}
          />
        </View>
      </View>
    ),
    [
      handleRefresh,
      isRefreshing,
      stats,
      searchQuery,
      isSearchFocused,
      activeFilter,
      handleFilterPress,
    ]
  );

  // List empty component
  const renderListEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="document-text-outline"
          size={64}
          color={tokens.colors.text.tertiary}
        />
        <Text style={styles.emptyText}>لا توجد أنشطة</Text>
      </View>
    ),
    []
  );

  // List footer (spacing)
  const renderListFooter = useCallback(
    () => <View style={{ height: 24 }} />,
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={groupedActivities}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <DateGroupCard
            group={item}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            onUndo={handleUndo}
            canUndo={!!userProfileId} // ActivityRow will check item.is_undoable
          />
        )}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={hideToast}
      />
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES - ALL FIXED HEIGHTS FOR STABILITY
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.aljass,
  },

  listContent: {
    flexGrow: 1,
  },

  // ========== HEADER ==========
  header: {
    height: 80, // FIXED HEIGHT
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: tokens.colors.najdi.aljass,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  emblemContainer: {
    width: 48, // FIXED WIDTH
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.crimson + '10',
    borderRadius: 12,
    marginRight: 12,
  },

  titleSection: {
    flex: 1,
    alignItems: 'flex-start', // LEFT-ALIGNED
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
  },

  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.secondary,
    marginTop: 2,
  },

  refreshButton: {
    width: 44, // FIXED TOUCH TARGET
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ========== STATS WIDGET ==========
  statsContainer: {
    height: 88, // FIXED HEIGHT
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.camelHair + '20',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
  },

  statValue: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.secondary,
    marginTop: 2,
  },

  // ========== SEARCH BAR ==========
  searchContainer: {
    height: 48, // FIXED HEIGHT
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.najdi.camelHair + '20',
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
  },

  searchContainerFocused: {
    borderColor: tokens.colors.najdi.crimson,
    borderWidth: 2,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
  },

  clearButton: {
    width: 32, // FIXED TOUCH TARGET
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ========== FILTER BUTTONS ==========
  filterSection: {
    height: 60, // FIXED HEIGHT (includes padding)
    marginBottom: 8,
  },

  filterListContent: {
    paddingHorizontal: 16,
    gap: 8,
  },

  filterButton: {
    // FIXED WIDTH prevents shifting
    minWidth: 90,
    height: 44, // TOUCH TARGET
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.camelHair,
    borderRadius: 22, // Pill shape
    paddingHorizontal: 16,
    gap: 6,
  },

  filterButtonActive: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderColor: tokens.colors.najdi.crimson,
  },

  filterIcon: {
    // Icon already sized
  },

  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
  },

  filterButtonTextActive: {
    color: tokens.colors.najdi.aljass,
  },

  // ========== ACTIVITY LIST ==========
  dateGroup: {
    marginBottom: 20,
  },

  dateHeader: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
    marginLeft: 16,
    marginBottom: 8,
  },

  dateCard: {
    backgroundColor: tokens.colors.najdi.aljass,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
  },

  activityRow: {
    // No fixed height - content-driven
  },

  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60, // Minimum touch target
  },

  activityIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },

  activityTextContainer: {
    flex: 1,
    gap: 4,
  },

  activityActor: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
  },

  activityAction: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.secondary,
  },

  activityMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },

  activityTime: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.tertiary,
  },

  undoButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.crimson + '10',
    borderRadius: 8,
  },

  activityDivider: {
    height: 1,
    backgroundColor: tokens.colors.najdi.camelHair + '30',
    marginVertical: 12,
  },

  metadataContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.najdi.camelHair + '30',
    gap: 8,
  },

  metadataRow: {
    flexDirection: 'row',
    gap: 8,
  },

  metadataKey: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.secondary,
    minWidth: 100,
  },

  metadataValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.primary,
  },

  // ========== EMPTY STATE ==========
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },

  emptyText: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily: 'SF Arabic',
    color: tokens.colors.text.tertiary,
  },
});

export default ActivityLogDashboard;
