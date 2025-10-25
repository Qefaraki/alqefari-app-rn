# Final Sprint Before Release (Oct 25-29, 2025)

**Deadline**: October 29, 2025
**Scope**: Non-PTS feedback items requiring testing, fixes, and polish
**Status**: 🚧 In Progress

---

## 📋 Master Task List

| # | Feature | Status | Priority | Days |
|---|---------|--------|----------|------|
| 1 | Country/City Selector Fix | ✅ Complete | 🔴 Critical | Day 1 |
| 2 | Login Phone Change with OTP | ⏳ Not Started | 🔴 Critical | Day 2 |
| 3 | Permission System Testing | ⏳ Not Started | 🟡 High | Day 3 |
| 4 | Cousin Marriage Polish & Test | ⏳ Not Started | 🟡 High | Day 3 PM |
| 5 | Activity Logs UI Polish | ⏳ Not Started | 🟡 High | Day 4 AM |
| 6 | Quick Child Add Testing | ⏳ Not Started | 🟡 High | Day 4 PM |
| 7 | Onboarding Approval UX Testing | ⏳ Not Started | 🟡 High | Day 5 |

**Overall Progress**: 1/7 complete (14%)

---

## Day 1: Country/City Selector Fix (Oct 25)

**Status**: ✅ Complete (FINAL SOLUTION)

### Problems Identified

**Problem 1: UUID Error "invalid input syntax for uuid: 2"**
- Root cause: Sending `current_residence_normalized` with nested objects containing numeric IDs to RPC
- `city.id: 2` was being cast as UUID → PostgreSQL error
- **Solution**: Stop sending normalized data to RPC entirely

**Problem 2: Country Selector Flashing**
- Root cause: Overcomplicated state sync between `current_residence` and `current_residence_normalized`
- **Solution**: Use simple local state for display, send only strings to database

**Problem 3: Version Field Missing After Edits via Search**
- Root cause: `search_name_chain()` RPC was missing the `version` field that `get_branch_data()` includes
- When users searched for profiles and edited them, they got `version=undefined`, breaking saves
- Temporary workaround: Bumped TREE_DATA_SCHEMA_VERSION to invalidate cache
- **Permanent Solution**: Added `version INT` field to `search_name_chain()` RPC
  - Migration: `20251025120000_add_version_to_search_name_chain.sql`
  - Now all profile retrieval methods return version for optimistic locking
  - Frontend needs zero code changes (field just appears)

### Final Simplified Architecture

**Storage** (Database only):
- `current_residence` = Plain Arabic strings (no emoji, no nested objects)
  - Saudi with city: `"الرياض"`
  - Other country: `"مصر"`

**Display** (Local React State):
- `selectedCountry` = Local state for CountryPicker
- `selectedCity` = Local state for SaudiCityPicker
- Pickers read from local state, not form draft
- No sync issues because they're independent

**On Save**:
- Remove `current_residence_normalized` from RPC payload
- Send only `current_residence` (simple string)
- No UUID errors, no nested objects

### Implementation

**TabDetails.js Changes**:
```javascript
const [selectedCountry, setSelectedCountry] = useState(draft?.current_residence || '');
const [selectedCity, setSelectedCity] = useState('');

<CountryPicker
  value={selectedCountry}
  onChange={(country) => {
    setSelectedCountry(country);
    if (!country.includes('السعودية')) setSelectedCity('');
    updateField('current_residence', country);
  }}
/>

<SaudiCityPicker
  value={selectedCity}
  onChange={(city) => {
    setSelectedCity(city);
    updateField('current_residence', city);
  }}
  enabled={selectedCountry.includes('السعودية')}
/>
```

**ProfileViewer.js Changes**:
```javascript
// Simply delete normalized data before RPC
delete payload.current_residence_normalized;
```

### Testing Status
✅ Country selector doesn't flash
✅ City picker only enabled when Saudi selected
✅ No UUID errors on save
✅ Simple Arabic strings stored in database
✅ No nested objects, no emoji, no IDs sent to RPC

### Why This is Better

1. **No complexity**: Just strings, no normalization
2. **No sync issues**: Local state independent from form
3. **No errors**: Numeric IDs never sent to RPC
4. **Maintainable**: Anyone can understand the code
5. **Best practice**: Separation of display state and database state

### Commits
1. `d8897f5f2`, `bf967531e`, `d331fc3d7`, `5d2b799a8` - Previous attempts (iterations)
2. `8f42e29de` - "fix: Simplify country/city selector - remove overcomplicated normalization"
   - Removes normalization entirely
   - Uses simple local state
   - Deletes normalized data from RPC
   - Clean, simple, maintainable
3. `c7a1b33c6` - "docs: Update Day 1 completion status"
4. `3934028ca` - "fix(cache): Bump TREE_DATA_SCHEMA_VERSION to force refresh"
   - Temporary cache invalidation workaround
   - Added version field validation
   - Added diagnostics for missing version
5. `ee7233fac` - **PERMANENT FIX**: "fix(rpc): Add version field to search_name_chain for optimistic locking"
   - Adds `version INT` to search_name_chain() RETURNS TABLE
   - All search results now include version field
   - Enables optimistic locking for searched profiles
   - No frontend code changes needed

---

## Day 2: Login Phone Change with OTP (Oct 26)

**Status**: ⏳ Planned

_Detailed plan and execution to follow_

---

## Day 3 AM: Permission System Testing (Oct 27)

**Status**: ⏳ Planned

_Detailed plan and execution to follow_

---

## Day 3 PM: Cousin Marriage Polish & Test (Oct 27)

**Status**: ⏳ Planned

_Detailed plan and execution to follow_

---

## Day 4 AM: Activity Logs UI Polish (Oct 28)

**Status**: ⏳ Planned

_Detailed plan and execution to follow_

---

## Day 4 PM: Quick Child Add Testing (Oct 28)

**Status**: ⏳ Planned

_Detailed plan and execution to follow_

---

## Day 5: Onboarding Approval UX Testing (Oct 29)

**Status**: ⏳ Planned

_Detailed plan and execution to follow_

---

## 📊 Overall Progress

```
Day 1: ✅ Complete      (Country/City selector fixed)
Day 2: ⏳ Planned       (Phone change with OTP)
Day 3: ⏳ Planned       (Permission testing + Cousin marriage)
Day 4: ⏳ Planned       (Activity logs + Quick child add)
Day 5: ⏳ Planned       (Onboarding UX testing)
```

**Time Invested**: ~1 hour
**Estimated Total**: 26-35 hours
**Remaining**: ~25-34 hours (4 days)

---

## 🎯 Success Criteria (EOD Oct 29)

✅ All 7 features complete and production-ready
✅ All critical bugs fixed
✅ All workflows tested end-to-end
✅ No regressions in existing features
✅ Ready for release

---

## 📝 Notes

- Excluding PTS items (tree, LOD, highlighting UI, name chain display)
- Focus on user-facing features and critical bugs
- Test on both RTL and LTR if applicable
- Commit after each day's work
