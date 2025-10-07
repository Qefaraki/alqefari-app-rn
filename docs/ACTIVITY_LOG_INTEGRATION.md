# Activity Log Dashboard - Integration Guide

Quick reference for integrating the Activity Log Dashboard into your admin panel.

## Basic Usage

### 1. Import Components

```typescript
import { ActivityLogDashboard } from '@/components/admin/ActivityLogDashboard';
import { ActivityLogSkeleton } from '@/components/admin/ActivityLogSkeleton';
```

### 2. Create Admin Screen

```typescript
// app/(tabs)/admin/activity.tsx
import React, { useState, useEffect } from 'react';
import { ActivityLogDashboard } from '@/components/admin/ActivityLogDashboard';
import { ActivityLogSkeleton } from '@/components/admin/ActivityLogSkeleton';

export default function AdminActivityLogScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial data load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <ActivityLogSkeleton />;
  }

  return <ActivityLogDashboard />;
}
```

### 3. Add to Admin Dashboard Navigation

```typescript
// In your admin dashboard component
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@/components/ui/tokens';

const AdminDashboardCard = () => (
  <TouchableOpacity
    style={styles.actionCard}
    onPress={() => navigation.navigate('activity')}
  >
    <View style={styles.cardIcon}>
      <Ionicons
        name="document-text-outline"
        size={24}
        color={tokens.colors.najdi.crimson}
      />
    </View>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>سجل النشاط</Text>
      <Text style={styles.cardSubtitle}>تتبع التغييرات والعمليات</Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={20}
      color={tokens.colors.text.tertiary}
    />
  </TouchableOpacity>
);
```

## Data Integration with Supabase

### Option A: Fetch Data Inside Component (Recommended)

Modify `ActivityLogDashboard.tsx` to fetch data on mount:

```typescript
// Inside ActivityLogDashboard component
useEffect(() => {
  loadActivities();
}, []);

const loadActivities = async () => {
  setIsLoading(true);
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    setActivities(data || []);
  } catch (error) {
    console.error('Failed to load activities:', error);
    Alert.alert('خطأ', 'فشل تحميل سجل النشاط');
  } finally {
    setIsLoading(false);
  }
};
```

### Option B: Pass Data as Props

If you prefer to manage data at screen level:

```typescript
// Update component interface
interface ActivityLogDashboardProps {
  activities?: ActivityLog[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
}

export const ActivityLogDashboard: React.FC<ActivityLogDashboardProps> = ({
  activities: initialActivities = [],
  isLoading: externalLoading = false,
  onRefresh: externalRefresh,
}) => {
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities);
  // ... rest of component
};
```

```typescript
// Screen usage
export default function AdminActivityLogScreen() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  if (isLoading) {
    return <ActivityLogSkeleton />;
  }

  return (
    <ActivityLogDashboard
      activities={activities}
      onRefresh={loadActivities}
    />
  );
}
```

## Real-time Updates (Optional)

Add live activity updates using Supabase subscriptions:

```typescript
useEffect(() => {
  // Initial load
  loadActivities();

  // Real-time subscription
  const subscription = supabase
    .channel('audit_log_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'audit_log',
      },
      (payload) => {
        console.log('New activity:', payload.new);
        setActivities((prev) => [payload.new as ActivityLog, ...prev]);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

## Expo Router Integration

### File Structure

```
app/
├── (tabs)/
│   ├── admin/
│   │   ├── _layout.tsx
│   │   ├── index.tsx          # Admin dashboard
│   │   └── activity.tsx       # Activity log screen
```

### Layout Configuration

```typescript
// app/(tabs)/admin/_layout.tsx
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'لوحة الإدارة',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="activity"
        options={{
          title: 'سجل النشاط',
          headerShown: false, // Dashboard has its own header
        }}
      />
    </Stack>
  );
}
```

### Navigation from Dashboard

```typescript
// app/(tabs)/admin/index.tsx
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <View style={styles.dashboard}>
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => router.push('/admin/activity')}
      >
        <Text style={styles.cardTitle}>سجل النشاط</Text>
      </TouchableOpacity>
    </View>
  );
}
```

## Permission Checks

Ensure only admins can access:

```typescript
// app/(tabs)/admin/activity.tsx
import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';

export default function AdminActivityLogScreen() {
  const { userProfile } = useAuth();

  // Check admin permission
  if (userProfile?.role !== 'admin' && userProfile?.role !== 'super_admin') {
    return <Redirect href="/home" />;
  }

  return <ActivityLogDashboard />;
}
```

## Customization Options

### Custom Activity Types

Add your own activity types:

```typescript
// In ActivityLogDashboard.tsx
const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  ...defaultIcons,
  CUSTOM_TYPE: { icon: 'star-outline', color: '#FFD700' },
  AUDIT: { icon: 'eye-outline', color: tokens.colors.najdi.ochre },
};
```

### Custom Filters

Add domain-specific filters:

```typescript
const FILTER_OPTIONS: FilterOption[] = [
  ...defaultFilters,
  { id: 'failed', label: 'فاشل', icon: 'alert-circle-outline', value: 'FAILED' },
  { id: 'system', label: 'النظام', icon: 'cog-outline', value: 'SYSTEM' },
];
```

### Custom Stats

Modify stats calculation:

```typescript
const stats = useMemo(() => {
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  return {
    totalCount: activities.length,
    todayCount: activities.filter(
      (a) => new Date(a.created_at) >= todayStart
    ).length,
    weekCount: activities.filter(
      (a) => new Date(a.created_at) >= last7Days
    ).length,
    criticalCount: activities.filter((a) => a.action_type === 'CRITICAL').length,
  };
}, [activities]);
```

## Performance Optimization

### Pagination

For large datasets, implement pagination:

```typescript
const [page, setPage] = useState(1);
const PAGE_SIZE = 50;

const loadMoreActivities = async () => {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (!error && data) {
    setActivities((prev) => [...prev, ...data]);
    setPage((p) => p + 1);
  }
};

<FlatList
  onEndReached={loadMoreActivities}
  onEndReachedThreshold={0.5}
/>
```

### Debounced Search

Prevent excessive filtering:

```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const debouncedSearch = useDebouncedValue(searchQuery, 300);

const filteredActivities = useMemo(() => {
  // Use debouncedSearch instead of searchQuery
  if (debouncedSearch.trim()) {
    // ... filtering logic
  }
}, [activities, activeFilter, debouncedSearch]);
```

## Troubleshooting

### Issue: Activities not loading

**Check:**
1. Supabase connection is working
2. `audit_log` table exists and has data
3. User has read permissions on `audit_log`
4. No console errors during fetch

### Issue: Filter buttons shifting

**Verify:**
- Using horizontal FlatList (not View with map)
- `getItemLayout` prop is present
- `minWidth` is set on filter buttons

### Issue: Poor performance with many activities

**Solutions:**
- Implement pagination
- Limit initial load to 100-200 items
- Use `windowSize` and `maxToRenderPerBatch` FlatList props
- Consider virtual scrolling for 1000+ items

### Issue: RTL layout issues

**Remember:**
- App uses native RTL mode (`I18nManager.forceRTL(true)`)
- Write layouts as LTR, React Native flips automatically
- Use `chevron-back` for back buttons (not forward)
- Test on physical device if simulator shows issues

## Testing Checklist

- [ ] Dashboard loads without errors
- [ ] Skeleton appears during loading
- [ ] Activities display grouped by date
- [ ] Search filters activities correctly
- [ ] Filter buttons don't shift on click
- [ ] Refresh works and shows spinner
- [ ] Expand/collapse metadata works
- [ ] Stats update when filtering
- [ ] Empty state appears when no results
- [ ] RTL layout is correct
- [ ] All touch targets are 44px
- [ ] Performance is smooth with 100+ items

## Related Files

- `/src/components/admin/ActivityLogDashboard.tsx` - Main component
- `/src/components/admin/ActivityLogSkeleton.tsx` - Loading skeleton
- `/docs/ACTIVITY_LOG_DASHBOARD.md` - Technical documentation
- `/src/components/ui/tokens.js` - Design tokens

---

**Need help?** See full technical docs in `ACTIVITY_LOG_DASHBOARD.md`
