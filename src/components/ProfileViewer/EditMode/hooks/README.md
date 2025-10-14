# TabFamily Custom Hooks

Reusable hooks for family editing logic, extracted from TabFamily.js.

## Purpose

These hooks encapsulate complex family editing logic into reusable units. They are designed for:
- New components that need similar family editing functionality
- Components without existing `useReducer` state management
- Testing and maintaining family editing logic independently

## Available Hooks

### `useFamilyData(person)`

Manages family data fetching, loading states, and mother options.

**Returns:**
```javascript
{
  familyData,          // Family data object from RPC
  loading,             // Initial loading state
  refreshing,          // Pull-to-refresh state
  motherOptions,       // Available mother candidates
  loadingMotherOptions, // Mother options loading state
  loadFamilyData,      // Function to load/refresh data
  handleRefresh,       // Pull-to-refresh handler
}
```

**Example:**
```javascript
const {
  familyData,
  loading,
  refreshing,
  motherOptions,
  loadFamilyData,
  handleRefresh
} = useFamilyData(person);
```

---

### `useSpouseEditor({ onMarriageUpdated, refreshProfile, onDataChanged, personId })`

Manages spouse/marriage inline editing state and actions.

**Returns:**
```javascript
{
  editingMarriage,           // Currently editing marriage object
  handleEditMarriage,        // Activate editor for marriage
  handleMarriageEditorSaved, // Handle successful save
  handleCancelEdit,          // Cancel editing
  isEditingMarriage,         // Check if specific marriage is editing
}
```

**Example:**
```javascript
const {
  editingMarriage,
  handleEditMarriage,
  handleMarriageEditorSaved,
  handleCancelEdit
} = useSpouseEditor({
  onMarriageUpdated: (updated) => setMarriages(...),
  refreshProfile,
  onDataChanged,
  personId: person.id,
});
```

---

### `useChildEditor({ onChildUpdated, refreshProfile, onDataChanged, personId })`

Manages child profile inline editing state and actions.

**Returns:**
```javascript
{
  editingChild,           // Currently editing child object
  handleEditChild,        // Activate editor for child
  handleChildEditorSaved, // Handle successful save
  handleCancelEdit,       // Cancel editing
  isEditingChild,         // Check if specific child is editing
}
```

**Example:**
```javascript
const {
  editingChild,
  handleEditChild,
  handleChildEditorSaved,
  handleCancelEdit
} = useChildEditor({
  onChildUpdated: (updated) => setChildren(...),
  refreshProfile,
  onDataChanged,
  personId: person.id,
});
```

---

### `useMotherPicker({ person, canEditFamily, refreshProfile, onDataChanged, onFamilyDataRefresh, motherOptions })`

Manages mother selection and assignment logic with inline picker UI state.

**Returns:**
```javascript
{
  motherPickerVisible,      // Picker visibility state
  updatingMotherId,         // Currently updating mother ID
  motherFeedback,           // Success/error feedback message
  motherSuggestions,        // Memoized mother candidates
  handleQuickMotherSelect,  // Assign mother
  handleClearMother,        // Remove mother
  handleChangeMother,       // Toggle picker
  handleClosePicker,        // Close picker
  setMotherFeedback,        // Update feedback (for timeout)
}
```

**Example:**
```javascript
const {
  motherPickerVisible,
  motherSuggestions,
  handleQuickMotherSelect,
  handleClearMother,
  handleChangeMother
} = useMotherPicker({
  person,
  canEditFamily,
  refreshProfile,
  onDataChanged,
  onFamilyDataRefresh: loadFamilyData,
  motherOptions,
});
```

---

## Why Not Used in TabFamily.js?

TabFamily.js currently uses `useReducer` for state management, which provides:
- Centralized state updates
- Action-based state transitions
- Better debugging with Redux DevTools
- Optimistic updates for delete operations

Integrating these hooks would create **state duplication** and **synchronization issues** between hook state and reducer state.

## When to Use These Hooks

✅ **Good Use Cases:**
- New family editing components
- Standalone marriage/child editors
- Profile forms outside of TabFamily
- Components without existing reducer patterns

❌ **Not Recommended:**
- Components already using `useReducer` for state
- Components with complex optimistic update patterns
- When state needs to be shared across multiple children

## Migration Path

If you want to use these hooks in TabFamily.js in the future:

1. **Option A: Gradual Migration**
   - Remove reducer state related to one hook at a time
   - Replace with hook state
   - Test thoroughly after each migration

2. **Option B: Complete Rewrite**
   - Remove `useReducer` entirely
   - Use hooks for all state management
   - Combine with `useState` for UI-only state (modals, etc.)

3. **Option C: Hybrid Approach (Current)**
   - Keep reducer for UI state (modals, active editor, optimistic deletes)
   - Use hooks for new features
   - Best of both worlds

## Testing

Each hook is independently testable:

```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import { useFamilyData } from './hooks/useFamilyData';

test('loads family data on mount', async () => {
  const { result, waitForNextUpdate } = renderHook(() =>
    useFamilyData({ id: 'test-person-id' })
  );

  expect(result.current.loading).toBe(true);
  await waitForNextUpdate();
  expect(result.current.loading).toBe(false);
  expect(result.current.familyData).toBeDefined();
});
```

## Performance

All hooks use:
- `useCallback` for stable function references
- `useMemo` for expensive computations
- `useEffect` with proper dependencies
- Optimistic locking for concurrent modification prevention

---

**Created**: Phase 2 of TabFamily.js optimization (January 2025)
**Status**: ✅ Production-ready, documented, tested
**Next**: Use in new components or when refactoring existing ones
