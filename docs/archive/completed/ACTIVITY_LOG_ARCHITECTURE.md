# Activity Log Dashboard - Architecture Diagram

Visual representation of the component architecture and data flow.

## Component Hierarchy

```
ActivityLogDashboard
├── SafeAreaView (flex: 1, edges: ['top', 'left', 'right'])
│   └── FlatList (single scroll container)
│       ├── ListHeaderComponent
│       │   ├── Header (80px fixed)
│       │   │   ├── Emblem Icon (48x48)
│       │   │   ├── Title Section
│       │   │   │   ├── Title: "سجل النشاط" (34px bold)
│       │   │   │   └── Subtitle: "تتبع التغييرات..." (15px)
│       │   │   └── Refresh Button (44x44)
│       │   │
│       │   ├── StatsWidget (88px fixed)
│       │   │   ├── StatCard: Total Count
│       │   │   ├── StatCard: Today Count
│       │   │   ├── StatCard: Critical Count
│       │   │   └── StatCard: Pending Count
│       │   │
│       │   ├── SearchBar (48px fixed)
│       │   │   ├── Search Icon (20px)
│       │   │   ├── TextInput
│       │   │   └── Clear Button (conditional, 32x32)
│       │   │
│       │   └── FilterButtons (60px fixed)
│       │       └── FlatList (horizontal)
│       │           ├── FilterButton: الكل
│       │           ├── FilterButton: الشجرة
│       │           ├── FilterButton: الأزواج
│       │           ├── FilterButton: الصور
│       │           ├── FilterButton: الإدارة
│       │           └── FilterButton: حرج
│       │
│       └── Data Items (grouped by date)
│           ├── DateGroupCard: "اليوم"
│           │   ├── DateHeader
│           │   └── DateCard
│           │       ├── ActivityRow 1
│           │       │   ├── Icon (40x40)
│           │       │   ├── Content (flex: 1)
│           │       │   │   ├── Actor Name (17px bold)
│           │       │   │   └── Action (15px regular)
│           │       │   └── Meta
│           │       │       ├── Time (13px)
│           │       │       └── Chevron
│           │       ├── Divider
│           │       ├── ActivityRow 2
│           │       └── ActivityRow 3
│           │
│           ├── DateGroupCard: "أمس"
│           │   └── [same structure]
│           │
│           └── DateGroupCard: "d MMMM"
│               └── [same structure]
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     External Data Source                      │
│                    (Supabase audit_log)                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Initial Load / Refresh
                 ▼
        ┌────────────────────┐
        │   activities []    │
        │  (raw data array)  │
        └────────┬───────────┘
                 │
                 │ useMemo (filter + search)
                 ▼
     ┌───────────────────────────┐
     │  filteredActivities []    │
     │ (after filter + search)   │
     └───────────┬───────────────┘
                 │
                 │ useMemo (group by date)
                 ▼
     ┌───────────────────────────┐
     │  groupedActivities []     │
     │ (DateGroupCard objects)   │
     └───────────┬───────────────┘
                 │
                 │ FlatList render
                 ▼
        ┌────────────────────┐
        │   UI Components    │
        └────────────────────┘
```

## Data Transformation Pipeline

```
Raw Activities (from DB)
    │
    │ [
    │   { id: '1', action_type: 'TREE', actor_name: 'علي', ... },
    │   { id: '2', action_type: 'ADMIN', actor_name: 'محمد', ... },
    │   ...
    │ ]
    │
    ▼
Filter by Type (activeFilter)
    │
    │ activities.filter(a => a.action_type === activeFilter)
    │
    ▼
Filter by Search (searchQuery)
    │
    │ activities.filter(a =>
    │   a.actor_name.includes(query) ||
    │   a.action.includes(query) ||
    │   a.target_name?.includes(query)
    │ )
    │
    ▼
Group by Date
    │
    │ {
    │   '2025-10-07': { dateLabel: 'اليوم', activities: [...] },
    │   '2025-10-06': { dateLabel: 'أمس', activities: [...] },
    │   '2025-10-05': { dateLabel: '5 أكتوبر', activities: [...] }
    │ }
    │
    ▼
Convert to Array & Sort
    │
    │ [
    │   { date: '2025-10-07', dateLabel: 'اليوم', activities: [...] },
    │   { date: '2025-10-06', dateLabel: 'أمس', activities: [...] },
    │   { date: '2025-10-05', dateLabel: '5 أكتوبر', activities: [...] }
    │ ]
    │
    ▼
Render in FlatList
```

## Event Flow

### User Interaction Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       User Actions                            │
└─────────┬───────────────────────────────────────────────────┘
          │
          ├─── Refresh ────────────────────────────────────┐
          │                                                 │
          │    1. onRefresh() called                       │
          │    2. setIsRefreshing(true)                    │
          │    3. Fetch from Supabase                      │
          │    4. setActivities(data)                      │
          │    5. setIsRefreshing(false)                   │
          │                                                 │
          ├─── Change Filter ──────────────────────────────┤
          │                                                 │
          │    1. handleFilterPress(value) called          │
          │    2. setActiveFilter(value)                   │
          │    3. useMemo recalculates filteredActivities  │
          │    4. useMemo recalculates groupedActivities   │
          │    5. FlatList re-renders                      │
          │                                                 │
          ├─── Search ─────────────────────────────────────┤
          │                                                 │
          │    1. onChangeText(text) called                │
          │    2. setSearchQuery(text)                     │
          │    3. useMemo recalculates filteredActivities  │
          │    4. useMemo recalculates groupedActivities   │
          │    5. FlatList re-renders                      │
          │                                                 │
          └─── Expand Activity ────────────────────────────┤
                                                            │
               1. handleToggleExpand(id) called            │
               2. expandedIds Set updated                  │
               3. ActivityRow re-renders                   │
               4. Metadata shown/hidden                    │
                                                            │
                                                            ▼
                                                    ┌───────────────┐
                                                    │   UI Update   │
                                                    └───────────────┘
```

## Memory Layout

### Component Instance Counts

```
ActivityLogDashboard (1 instance)
    │
    ├─ Header (1 memo instance)
    ├─ StatsWidget (1 memo instance)
    ├─ SearchBar (1 memo instance)
    ├─ FilterButtons FlatList (1 instance)
    │   └─ FilterButton × 6 (6 memo instances)
    └─ Activity FlatList (1 instance)
        └─ DateGroupCard × N (N memo instances, where N = unique dates)
            └─ ActivityRow × M (M memo instances per date group)
```

### State Memory

```
┌────────────────────────────────────────────────────────┐
│ Component State (ActivityLogDashboard)                 │
├────────────────────────────────────────────────────────┤
│ activities: ActivityLog[]           ~10-100KB          │
│ isLoading: boolean                  4 bytes            │
│ isRefreshing: boolean               4 bytes            │
│ searchQuery: string                 ~50 bytes          │
│ isSearchFocused: boolean            4 bytes            │
│ activeFilter: string                ~20 bytes          │
│ expandedIds: Set<string>            ~500 bytes         │
├────────────────────────────────────────────────────────┤
│ Memoized Values                                        │
├────────────────────────────────────────────────────────┤
│ filteredActivities: ActivityLog[]   ~10-100KB (ref)    │
│ groupedActivities: GroupedActivity[] ~10-100KB (ref)   │
│ stats: object                       ~100 bytes         │
├────────────────────────────────────────────────────────┤
│ Total Memory (approximate)          ~20-200KB          │
└────────────────────────────────────────────────────────┘
```

## Re-render Optimization

### When Components Re-render

```
State Change → Component Re-renders?
────────────────────────────────────────────────────────
activities        → Header           ❌ (memoized, no dep)
                  → StatsWidget      ✅ (depends on stats)
                  → SearchBar        ❌ (memoized, no dep)
                  → FilterButtons    ❌ (memoized, no dep)
                  → DateGroupCard    ✅ (new data)

searchQuery       → Header           ❌
                  → StatsWidget      ❌
                  → SearchBar        ✅ (prop change)
                  → FilterButtons    ❌
                  → DateGroupCard    ✅ (filtered results)

activeFilter      → Header           ❌
                  → StatsWidget      ❌
                  → SearchBar        ❌
                  → FilterButtons    ✅ (isActive change)
                  → DateGroupCard    ✅ (filtered results)

expandedIds       → Header           ❌
                  → StatsWidget      ❌
                  → SearchBar        ❌
                  → FilterButtons    ❌
                  → DateGroupCard    ✅ (Set passed as prop)
                  → ActivityRow      ✅ (isExpanded change)
```

### Memoization Strategy

```typescript
// Component memoization (prevent re-render if props unchanged)
const Header = memo<HeaderProps>(({ onRefresh, isRefreshing }) => (...));

// Value memoization (recalculate only when dependencies change)
const filteredActivities = useMemo(() => {
  return activities.filter(...);
}, [activities, activeFilter, searchQuery]);

// Callback memoization (prevent function recreation)
const handleRefresh = useCallback(async () => {
  await fetchData();
}, []); // Empty deps = function never recreated
```

## Layout Calculation Flow

### Single-Pass Layout (Why It's Fast)

```
SafeAreaView (flex: 1)
    │ ✅ Height determined by screen size
    │
    └─ FlatList
        │ ✅ Height determined by parent (flex: 1)
        │
        ├─ ListHeaderComponent
        │   │ ✅ All children have FIXED heights
        │   │
        │   ├─ Header (height: 80)
        │   ├─ StatsWidget (height: 88)
        │   ├─ SearchBar (height: 48)
        │   └─ FilterButtons (height: 60)
        │       └─ FlatList horizontal
        │           └─ getItemLayout() provides dimensions
        │               ✅ No measurement needed
        │
        └─ Data Items
            └─ DateGroupCard
                └─ ActivityRow (minHeight: 60)
                    ✅ Content-driven but has minimum
```

### Comparison: Why Other Approaches Fail

```
❌ BAD: Multiple ScrollViews
ScrollView
    └─ Header (auto height - must measure)
        └─ FlatList (needs height - conflict!)
            └─ Items

Problem: Parent needs child height, child needs parent height

✅ GOOD: Single FlatList
FlatList
    ├─ ListHeaderComponent (fixed heights)
    └─ Items

Solution: Single scroll container, header has fixed dimensions
```

## Performance Metrics

### Target Metrics

```
Metric                      Target      Actual (estimated)
──────────────────────────────────────────────────────────
Initial render time         < 100ms     ~80ms
Filter change time          < 50ms      ~30ms
Search (per keystroke)      < 100ms     ~50ms
Expand/collapse             < 16ms      ~10ms (60fps)
Scroll frame rate           60fps       60fps
Memory usage (100 items)    < 5MB       ~2-3MB
```

### Bottleneck Analysis

```
Operation               Cost        Optimization
────────────────────────────────────────────────────────
Array filtering         O(n)        useMemo caching
Date grouping           O(n)        useMemo caching
FlatList render         O(visible)  Virtualization
Component updates       O(changed)  React.memo
Layout calculation      O(1)        Fixed heights
```

## Deployment Checklist

- [x] Component implements single FlatList pattern
- [x] All header elements have fixed heights
- [x] Filter buttons use horizontal FlatList with getItemLayout
- [x] All subcomponents are memoized
- [x] All handlers use useCallback
- [x] All derived state uses useMemo
- [x] Touch targets meet 44px minimum
- [x] Colors follow Najdi Sadu palette
- [x] Typography uses iOS standard sizes
- [x] Spacing follows 8px grid
- [x] RTL layout tested and working
- [x] Loading skeleton matches real layout
- [x] Documentation complete

---

**Architecture Version**: 1.0.0
**Last Updated**: January 2025
**Status**: Production-ready
