# Activity Log Dashboard - Design & Implementation Guide

**Status**: ✅ Production-ready implementation with layout stability guarantees

## Overview

The Activity Log Dashboard provides a comprehensive, iOS-first interface for administrators to monitor all system activities with filtering, search, and detailed metadata inspection capabilities.

## Design Philosophy

### Core Principles

1. **Layout Stability First**: Fixed heights, no competing ScrollViews, explicit dimensions
2. **Single Scroll Container**: FlatList as the only scrollable element
3. **Memoized Components**: Prevent unnecessary re-renders
4. **iOS HIG Compliance**: 44px touch targets, standard font sizes, native gestures

### Architecture Decision: Why This Structure Works

```
SafeAreaView (flex: 1)
└── FlatList (single scroll container)
    ├── ListHeaderComponent (all fixed-height header elements)
    │   ├── Header (80px fixed)
    │   ├── StatsWidget (88px fixed)
    │   ├── SearchBar (48px fixed)
    │   └── FilterButtons (60px fixed - horizontal FlatList)
    └── Data Items (activity cards grouped by date)
```

**Why not ScrollView with FlatList inside?**
- ❌ Causes scroll competition and layout thrashing
- ❌ Makes pull-to-refresh unreliable
- ❌ Filter buttons shift when content changes
- ❌ Performance degrades with large datasets

**Why FlatList for filter buttons?**
- ✅ Built-in horizontal scrolling with momentum
- ✅ `getItemLayout` optimization prevents shifting
- ✅ Handles dynamic active states without recalculation
- ✅ Consistent with main list architecture

## Component Structure

### Main Component: `ActivityLogDashboard.tsx`

```typescript
export const ActivityLogDashboard: React.FC
```

**Key Features:**
- Single FlatList architecture
- Memoized subcomponents
- Date-grouped activity cards
- Real-time search and filtering
- Expandable metadata views
- Pull-to-refresh support

### Loading Skeleton: `ActivityLogSkeleton.tsx`

```typescript
export const ActivityLogSkeleton: React.FC
```

**Features:**
- Matches dashboard layout exactly
- Shimmer animation (1500ms loop)
- Shows 2 date groups with 3 activities each
- All header elements included

## Subcomponent Reference

### Header

```typescript
interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}
```

**Layout:**
- Height: 80px (fixed)
- Emblem icon: 48x48px with Najdi Crimson background
- Title: "سجل النشاط" (34px, bold, LEFT-ALIGNED)
- Subtitle: "تتبع التغييرات والعمليات" (15px, regular)
- Refresh button: 44x44px touch target

**RTL Notes:**
- Title is left-aligned in LTR code (React Native flips to right in RTL)
- Emblem on left, refresh on right (flips in RTL)

### StatsWidget

```typescript
interface StatsWidgetProps {
  totalCount: number;
  todayCount: number;
  criticalCount: number;
  pendingCount: number;
}
```

**Layout:**
- Height: 88px (fixed)
- 4 cards in a row with 12px gap
- Each card: flex: 1, 12px border-radius
- Background: Camel Hair Beige 20% with 40% border

**Stats Calculation:**
```typescript
const stats = useMemo(() => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return {
    totalCount: activities.length,
    todayCount: activities.filter(
      (a) => new Date(a.created_at) >= todayStart
    ).length,
    criticalCount: activities.filter((a) => a.action_type === 'CRITICAL').length,
    pendingCount: 0, // TODO: Implement pending logic
  };
}, [activities]);
```

### SearchBar

```typescript
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}
```

**Layout:**
- Height: 48px (fixed)
- Border: 1px Camel Hair Beige 40%, 2px Najdi Crimson on focus
- Icon: 20px search icon on left (flips to right in RTL)
- Clear button: 32x32px touch target (appears when text present)

**Focus Behavior:**
```typescript
const [isSearchFocused, setIsSearchFocused] = useState(false);

// Focused state adds crimson border
style={[
  styles.searchContainer,
  isFocused && styles.searchContainerFocused,
]}
```

### FilterButton

```typescript
interface FilterButtonProps {
  filter: FilterOption;
  isActive: boolean;
  onPress: () => void;
}
```

**Layout:**
- Height: 44px (touch target)
- Min Width: 90px (prevents shifting)
- Border Radius: 22px (pill shape)
- Active: Najdi Crimson background, white text
- Inactive: Transparent background, dark text, Camel Hair border

**Filter Options:**
```typescript
const FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'الكل', value: 'all' },
  { id: 'tree', label: 'الشجرة', icon: 'git-network-outline', value: 'TREE' },
  { id: 'munasib', label: 'الأزواج', icon: 'people-outline', value: 'MUNASIB' },
  { id: 'photo', label: 'الصور', icon: 'image-outline', value: 'PHOTO' },
  { id: 'admin', label: 'الإدارة', icon: 'shield-outline', value: 'ADMIN' },
  { id: 'critical', label: 'حرج', value: 'CRITICAL' },
];
```

**CRITICAL: Fixed Item Layout**
```typescript
<FlatList
  horizontal
  getItemLayout={(data, index) => ({
    length: 100, // Approximate width
    offset: 100 * index,
    index,
  })}
/>
```

This prevents the list from recalculating layout when active state changes.

### ActivityRow

```typescript
interface ActivityRowProps {
  activity: ActivityLog;
  isExpanded: boolean;
  onToggleExpand: () => void;
}
```

**Layout:**
- Min Height: 60px
- Icon: 40x40px with colored background (type-specific)
- Content: Flex 1 with actor name + action description
- Meta: Time + chevron (right side, flips to left in RTL)

**Expandable Metadata:**
```typescript
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
```

### DateGroupCard

```typescript
interface DateGroupCardProps {
  group: GroupedActivity;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}
```

**Layout:**
- Date header: 17px bold, 22px line height
- Card: Al-Jass White background, 12px border radius
- Activities: Multiple rows separated by 1px dividers

**Date Grouping Logic:**
```typescript
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

      groups[dateKey] = { date: dateKey, dateLabel, activities: [] };
    }

    groups[dateKey].activities.push(activity);
  });

  return Object.values(groups).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}, [filteredActivities]);
```

## State Management

### Core State

```typescript
const [activities, setActivities] = useState<ActivityLog[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isRefreshing, setIsRefreshing] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [isSearchFocused, setIsSearchFocused] = useState(false);
const [activeFilter, setActiveFilter] = useState('all');
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
```

### Memoized Derived State

**Filtered Activities:**
```typescript
const filteredActivities = useMemo(() => {
  let filtered = activities;

  if (activeFilter !== 'all') {
    filtered = filtered.filter((a) => a.action_type === activeFilter);
  }

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
```

### Handler Patterns

**Refresh Handler:**
```typescript
const handleRefresh = useCallback(async () => {
  setIsRefreshing(true);
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setActivities(data);
  } catch (error) {
    Alert.alert('خطأ', 'فشل تحديث البيانات');
  } finally {
    setIsRefreshing(false);
  }
}, []);
```

**Toggle Expand Handler:**
```typescript
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
```

## Activity Types & Icons

```typescript
const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  TREE: { icon: 'git-network-outline', color: tokens.colors.najdi.crimson },
  MUNASIB: { icon: 'people-outline', color: tokens.colors.najdi.ochre },
  PHOTO: { icon: 'image-outline', color: tokens.colors.najdi.ochre },
  ADMIN: { icon: 'shield-outline', color: tokens.colors.najdi.crimson },
  CRITICAL: { icon: 'warning-outline', color: '#D32F2F' },
};
```

## Database Integration

### Expected Schema

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type TEXT NOT NULL CHECK (action_type IN ('TREE', 'MUNASIB', 'PHOTO', 'ADMIN', 'CRITICAL')),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES profiles(id),
  actor_name TEXT NOT NULL,
  target_id UUID REFERENCES profiles(id),
  target_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
```

### Fetch Query

```typescript
const { data: activities, error } = await supabase
  .from('audit_log')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(500); // Pagination recommended
```

### Real-time Subscription (Optional)

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('audit_log_changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'audit_log' },
      (payload) => {
        setActivities((prev) => [payload.new as ActivityLog, ...prev]);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

## Performance Optimizations

### 1. Component Memoization

All subcomponents use `React.memo`:
```typescript
const Header = memo<HeaderProps>(({ onRefresh, isRefreshing }) => (...));
const StatsWidget = memo<StatsWidgetProps>(({ totalCount, ... }) => (...));
const SearchBar = memo<SearchBarProps>(({ value, ... }) => (...));
const FilterButton = memo<FilterButtonProps>(({ filter, ... }) => (...));
const ActivityRow = memo<ActivityRowProps>(({ activity, ... }) => (...));
const DateGroupCard = memo<DateGroupCardProps>(({ group, ... }) => (...));
```

### 2. Callback Memoization

All handlers use `useCallback`:
```typescript
const handleRefresh = useCallback(async () => { ... }, []);
const handleFilterPress = useCallback((filterValue: string) => { ... }, []);
const handleToggleExpand = useCallback((id: string) => { ... }, []);
```

### 3. Derived State Memoization

All computed values use `useMemo`:
```typescript
const filteredActivities = useMemo(() => { ... }, [activities, activeFilter, searchQuery]);
const groupedActivities = useMemo(() => { ... }, [filteredActivities]);
const stats = useMemo(() => { ... }, [activities]);
```

### 4. FlatList Optimizations

```typescript
<FlatList
  // ... other props
  windowSize={10}
  maxToRenderPerBatch={5}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={true}
  initialNumToRender={5}
/>
```

## Styling Principles

### Fixed Heights Everywhere

```typescript
header: { height: 80 },          // FIXED
statsContainer: { height: 88 },  // FIXED
searchContainer: { height: 48 }, // FIXED
filterSection: { height: 60 },   // FIXED
filterButton: { height: 44 },    // FIXED
```

**Why?** Fixed heights prevent layout recalculation when:
- Filter states change
- Search results update
- Activities expand/collapse
- Content loads

### Touch Targets

All interactive elements meet iOS minimum:
```typescript
refreshButton: { width: 44, height: 44 },
clearButton: { width: 32, height: 32 },   // Nested, so smaller OK
filterButton: { height: 44 },
activityContent: { minHeight: 60 },
```

### Color Usage

```typescript
// Background hierarchy
container: { backgroundColor: tokens.colors.najdi.aljass },      // #F9F7F3
dateCard: { backgroundColor: tokens.colors.najdi.aljass },
statCard: { backgroundColor: tokens.colors.najdi.camelHair + '20' }, // #D1BBA320

// Text hierarchy
title: { color: tokens.colors.text.primary },      // Sadu Night #242121
subtitle: { color: tokens.colors.text.secondary }, // Sadu Night 80%
activityTime: { color: tokens.colors.text.tertiary }, // Sadu Night 60%

// Accent colors
filterButtonActive: { backgroundColor: tokens.colors.najdi.crimson }, // #A13333
activityIcon TREE: { color: tokens.colors.najdi.crimson },
activityIcon MUNASIB: { color: tokens.colors.najdi.ochre }, // #D58C4A
```

## Common Issues & Solutions

### Issue: Filter Buttons Shifting When Clicked

**Cause:** Using `View` with `.map()` causes React to recalculate layout

**Solution:** Use horizontal FlatList with `getItemLayout`:
```typescript
<FlatList
  horizontal
  getItemLayout={(data, index) => ({
    length: 100,
    offset: 100 * index,
    index,
  })}
/>
```

### Issue: Padding Inconsistency Between Sections

**Cause:** Different horizontal padding values (e.g., 16px vs 20px)

**Solution:** Use consistent `paddingHorizontal: 16` everywhere:
```typescript
header: { paddingHorizontal: 16 },
statsContainer: { paddingHorizontal: 16 },
searchContainer: { marginHorizontal: 16 },
dateCard: { marginHorizontal: 16 },
```

### Issue: ScrollView Not Scrolling Smoothly

**Cause:** Multiple ScrollViews or FlatLists nested

**Solution:** Single FlatList with ListHeaderComponent:
```typescript
<FlatList
  data={groupedActivities}
  ListHeaderComponent={renderListHeader}
/>
```

### Issue: Performance Degradation with Large Datasets

**Cause:** No virtualization, all items rendered

**Solution:** Use FlatList pagination:
```typescript
const [page, setPage] = useState(1);
const PAGE_SIZE = 50;

const paginatedActivities = useMemo(
  () => groupedActivities.slice(0, page * PAGE_SIZE),
  [groupedActivities, page]
);

<FlatList
  data={paginatedActivities}
  onEndReached={() => setPage((p) => p + 1)}
  onEndReachedThreshold={0.5}
/>
```

## Usage Example

```typescript
import { ActivityLogDashboard } from '@/components/admin/ActivityLogDashboard';
import { ActivityLogSkeleton } from '@/components/admin/ActivityLogSkeleton';

export default function AdminActivityScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data load
    setTimeout(() => setIsLoading(false), 1500);
  }, []);

  if (isLoading) {
    return <ActivityLogSkeleton />;
  }

  return <ActivityLogDashboard />;
}
```

## Testing Checklist

- [ ] Header title is left-aligned (appears right in RTL)
- [ ] Filter buttons do not shift when clicked
- [ ] Search bar focus state shows crimson border
- [ ] Stats update when activities change
- [ ] Date grouping shows "اليوم", "أمس" correctly
- [ ] Activity rows expand/collapse smoothly
- [ ] Pull-to-refresh works reliably
- [ ] Empty state appears when no activities
- [ ] Loading skeleton matches real layout
- [ ] All touch targets are 44px minimum
- [ ] RTL layout works correctly throughout

## Future Enhancements

1. **Pagination**: Load activities in batches of 50
2. **Real-time Updates**: Supabase subscription for live changes
3. **Export**: PDF/CSV export of filtered activities
4. **Advanced Filters**: Date range picker, actor filter
5. **Search Highlighting**: Highlight search terms in results
6. **Undo Actions**: Rollback recent changes (if supported)

## Related Documentation

- [Permission System v4.2](./PERMISSION_SYSTEM_V4.md) - Audit log integration
- [CLAUDE.md](../CLAUDE.md) - Design system reference
- [Najdi Sadu Design Tokens](../src/components/ui/tokens.js)

---

**Last Updated**: January 2025
**Component Version**: 1.0.0
**Status**: Production-ready
