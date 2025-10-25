# Day 1: Country/City Selector Fix (Oct 25)

**Issue**: Selecting a city resets the country dropdown to "Choose Country"

**Status**: 🔴 Critical Bug (Blocks User Experience)

---

## Problem Statement

When user:
1. Opens country/city selector
2. Selects "Saudi Arabia"
3. Then selects "Riyadh"
4. The country dropdown reverts to "Choose Country"

This breaks the user flow and requires re-selecting the country.

---

## Root Cause Analysis (To Be Performed)

Potential causes:
1. **State sync issue**: City selection triggers country state reset
2. **Component re-render**: Parent component re-rendering on city change
3. **RLS policy issue**: Query result doesn't match expected format
4. **Form value binding**: Country and city values not properly isolated

---

## Investigation Steps

### Step 1: Locate Component Files
Search for:
- Country/city picker component (likely in `src/screens/ProfileScreen.js` or `src/components/profile/`)
- Look for country/city field implementations
- Check for `TabBasicInfo.js` or similar

**Search terms**: "country", "city", "select", "dropdown", "residence", "birth_place"

### Step 2: Understand Current Implementation
- [ ] Identify how country/city state is managed
- [ ] Check if using single state object or separate states
- [ ] Verify Supabase query for cities (depends on country selection)
- [ ] Check for any side effects on city selection

### Step 3: Identify the Bug
- [ ] Trace the exact state change when city is selected
- [ ] Check if country state is being overwritten
- [ ] Verify form binding/controlled inputs

---

## Fix Strategy

### Expected Fix (Most Likely)
Ensure country and city selections are independent:
- Keep country state separate from city state
- Don't trigger country re-query when city changes
- Verify Supabase cities query filters by country ID, not by name

### Implementation Pattern
```javascript
// WRONG: City change resets country
const [country, setCountry] = useState(null);
const [city, setCity] = useState(null);
const onCityChange = (newCity) => {
  setCountry(null);  // ❌ BUG: Resets country!
  setCity(newCity);
};

// RIGHT: Independent states
const [country, setCountry] = useState(null);
const [city, setCity] = useState(null);
const onCityChange = (newCity) => {
  setCity(newCity);  // ✅ Only update city
};
```

---

## Testing Plan

### Test Cases to Verify Fix

1. **Basic Selection Flow**
   - [ ] Select "Saudi Arabia"
   - [ ] Verify "Riyadh" appears in city dropdown
   - [ ] Select "Riyadh"
   - [ ] Verify country still shows "Saudi Arabia"
   - [ ] Save profile → Verify both saved correctly

2. **State Persistence**
   - [ ] Select country/city → Navigate away → Come back
   - [ ] Verify selections are still there

3. **Multiple Countries**
   - [ ] Select "Saudi Arabia" → "Riyadh"
   - [ ] Change to "Egypt" → City list updates
   - [ ] Verify Egypt stays selected (doesn't revert)

4. **RTL Behavior**
   - [ ] Test in RTL mode (native Arabic)
   - [ ] Verify text alignment is correct
   - [ ] Check dropdown positioning

5. **Edge Cases**
   - [ ] Clear selections (reset to null)
   - [ ] Select country → Don't select city → Save
   - [ ] Select city without country → Should show error

---

## Files to Modify

### Primary Files
- Find and fix the country/city picker component
- Update state management if needed
- Update validation logic

### Files to Test
- Profile editor screens
- ProfileSheet display
- Any forms that use country/city fields

### Files to Commit
- Fixed component file(s)
- Any related utility functions
- No database migrations needed

---

## Acceptance Criteria

✅ Country selection stays when city is selected
✅ City dropdown filters by selected country
✅ Saves both country and city to database correctly
✅ No state resets when navigating between fields
✅ RTL layout works properly
✅ No console errors
✅ Works on both iOS simulator and real device

---

## Time Estimate

| Task | Time |
|------|------|
| Investigation & Root Cause | 1-1.5 hours |
| Implement Fix | 1-2 hours |
| Testing & Edge Cases | 1-1.5 hours |
| Polish & RTL Check | 0.5-1 hour |
| **Total** | **4-6 hours** |

---

## Commit Strategy

**Commit Message**:
```
fix: Resolve country selector reset on city selection

- Fixed state isolation between country and city pickers
- Prevent country selection from resetting when city is selected
- Add comprehensive test coverage for selection flows
```

---

## Success Metrics

- Bug no longer reproducible
- User can complete country/city selection in one go
- No performance impact
- All tests pass

---

## Next Step

**→ Ready to start investigation and implementation**

Please confirm to proceed with Day 1 execution.