# Admin Components

Production-ready admin panel components for the Alqefari Family Tree app.

## Components

### ActivityLogDashboard
**File**: `ActivityLogDashboard.tsx`
**Status**: ✅ Production-ready

Comprehensive activity monitoring dashboard with filtering, search, and expandable metadata.

**Features**:
- Single FlatList architecture (no layout shifting)
- Date-grouped activities
- 6 filter types (All, Tree, Munasib, Photos, Admin, Critical)
- Real-time search
- Expandable metadata views
- Pull-to-refresh
- Stats widget (total, today, critical, pending)

**Key Specifications**:
- Fixed header heights prevent layout recalculation
- Horizontal FlatList for stable filter buttons
- Memoized components for performance
- iOS HIG compliant (44px touch targets, 8px grid)
- Native RTL support

**Usage**:
```typescript
import { ActivityLogDashboard } from '@/components/admin/ActivityLogDashboard';

<ActivityLogDashboard />
```

### ActivityLogSkeleton
**File**: `ActivityLogSkeleton.tsx`
**Status**: ✅ Production-ready

Loading skeleton that matches ActivityLogDashboard layout exactly.

**Features**:
- Shimmer animation (1500ms loop)
- Shows 2 date groups with 3 activities each
- Matches all header elements

**Usage**:
```typescript
import { ActivityLogSkeleton } from '@/components/admin/ActivityLogSkeleton';

{isLoading ? <ActivityLogSkeleton /> : <ActivityLogDashboard />}
```

### MunasibManager
**File**: `MunasibManager.js`
**Status**: ✅ Production-ready (existing)

Dashboard for managing Munasib (spouse) profiles with search, statistics, and PDF export.

### PermissionManager
**File**: `PermissionManager.js`
**Status**: ✅ Production-ready (existing)

Super admin interface for role management and branch moderator assignment.

### SuggestionReviewManager
**File**: `SuggestionReviewManager.js`
**Status**: ✅ Production-ready (existing)

Admin interface for reviewing edit suggestions with tabbed view and bulk actions.

## Design System Compliance

All components follow the Najdi Sadu design system:

### Colors
- **Background**: Al-Jass White (#F9F7F3)
- **Containers**: Camel Hair Beige (#D1BBA3)
- **Text**: Sadu Night (#242121)
- **Actions**: Najdi Crimson (#A13333)
- **Accents**: Desert Ochre (#D58C4A)

### Typography
- **Large Title**: 34px bold (headers)
- **Title 2**: 22px bold (section headers)
- **Body**: 17px regular (main content)
- **Subheadline**: 15px regular (secondary text)
- **Footnote**: 13px regular (timestamps)

### Spacing
All components use 8px grid: 4, 8, 12, 16, 20, 24, 32px

### Touch Targets
Minimum 44px for all interactive elements

## Architecture Patterns

### Layout Stability
All admin components use fixed heights and single scroll containers to prevent layout shifting:

```typescript
// ✅ GOOD: Single FlatList
<FlatList
  data={items}
  ListHeaderComponent={<FixedHeightHeader />}
/>

// ❌ BAD: Nested ScrollViews
<ScrollView>
  <FlatList data={items} />
</ScrollView>
```

### State Management
- Use `useMemo` for derived state
- Use `useCallback` for handlers
- Memoize subcomponents with `React.memo`

### Permission Checks
All admin components should verify user role:

```typescript
import { useAuth } from '@/contexts/AuthContext';

const { userProfile } = useAuth();

if (userProfile?.role !== 'admin' && userProfile?.role !== 'super_admin') {
  return <Redirect href="/home" />;
}
```

## Common Patterns

### Card Component
```typescript
<View style={styles.card}>
  {/* Content */}
</View>

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.najdi.aljass,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
  },
});
```

### Primary Button
```typescript
<TouchableOpacity
  style={styles.primaryButton}
  onPress={handleAction}
  activeOpacity={0.8}
>
  <Text style={styles.primaryButtonText}>نص الزر</Text>
</TouchableOpacity>

const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: tokens.colors.najdi.crimson,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: tokens.colors.najdi.aljass,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
});
```

### Input Field
```typescript
<View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
  <TextInput
    style={styles.input}
    placeholder="نص المدخل..."
    onFocus={() => setIsFocused(true)}
    onBlur={() => setIsFocused(false)}
  />
</View>

const styles = StyleSheet.create({
  inputContainer: {
    backgroundColor: tokens.colors.najdi.camelHair + '20',
    borderWidth: 1,
    borderColor: tokens.colors.najdi.camelHair + '40',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  inputContainerFocused: {
    borderColor: tokens.colors.najdi.crimson,
    borderWidth: 2,
  },
  input: {
    fontSize: 17,
    color: tokens.colors.text.primary,
    fontFamily: 'SF Arabic',
  },
});
```

## Testing Guidelines

### Visual Testing
- [ ] Test in RTL mode (app default)
- [ ] Verify all touch targets are 44px minimum
- [ ] Check color contrast meets WCAG AA
- [ ] Ensure consistent spacing (8px grid)
- [ ] Verify shadows are subtle (max 0.08 opacity)

### Functional Testing
- [ ] Permission checks work correctly
- [ ] Loading states appear appropriately
- [ ] Error handling displays user-friendly messages
- [ ] Pull-to-refresh works smoothly
- [ ] Search and filters perform quickly

### Performance Testing
- [ ] No layout shifts during state changes
- [ ] Smooth scrolling with 100+ items
- [ ] Quick response to user interactions (<100ms)
- [ ] Efficient re-renders (use React DevTools Profiler)

## Documentation

- **Technical Specs**: `/docs/ACTIVITY_LOG_DASHBOARD.md`
- **Integration Guide**: `/docs/ACTIVITY_LOG_INTEGRATION.md`
- **Design System**: `/CLAUDE.md`
- **Permission System**: `/docs/PERMISSION_SYSTEM_V4.md`

## Contributing

When adding new admin components:

1. **Follow Design System**: Use Najdi Sadu colors, typography, spacing
2. **Ensure Stability**: Fixed heights, single scroll containers
3. **Add Permission Checks**: Verify admin/super_admin role
4. **Include Loading States**: Use shimmer skeletons
5. **Write Documentation**: Add to this README and create detailed docs
6. **Test Thoroughly**: Visual, functional, and performance tests
7. **Commit Atomically**: One feature per commit with clear messages

## Quick Reference

### Import Tokens
```typescript
import { tokens } from '../ui/tokens';
```

### Check User Role
```typescript
const { userProfile } = useAuth();
const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
```

### Supabase Query Pattern
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .order('created_at', { ascending: false });

if (error) {
  Alert.alert('خطأ', 'فشل تحميل البيانات');
  return;
}

setData(data || []);
```

### Memoization Pattern
```typescript
const Component = memo<Props>(({ prop1, prop2 }) => {
  const memoizedValue = useMemo(() => {
    return expensiveCalculation(prop1);
  }, [prop1]);

  const memoizedCallback = useCallback(() => {
    doSomething(prop2);
  }, [prop2]);

  return <View>{/* Component JSX */}</View>;
});
```

---

**Last Updated**: January 2025
**Maintained By**: Alqefari Family Tree Team
