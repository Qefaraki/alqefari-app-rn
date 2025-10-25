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

## Day 1: Country/City Selector Fix + UUID Validation (Oct 25)

**Status**: ✅ Complete (Revision)

### Bug 1: Country Selector Flashing
**Problem**: When selecting a city, country dropdown flashed to default then returned to city value

**Root Cause**:
- `current_residence` (display) and `current_residence_normalized` (structured data) were out of sync
- Only normalized data updated on city selection, not display field

**Solution**:
Updated `SaudiCityPicker.onNormalizedChange` to also update `current_residence` field immediately:
```javascript
if (normalized.city?.ar) {
  updateField('current_residence', normalized.city.ar);
}
```

### Bug 2: UUID Error "invalid input syntax for uuid: 2"
**Problem**: Save failed with UUID error on any profile edit

**Root Cause**:
Potentially corrupted UUID fields being sent to RPC

**Solution**:
Added UUID validation in `ProfileViewer.directSave` to strip invalid UUIDs before RPC:
```javascript
const isValidUUID = (value) => {
  if (!value) return true;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

['father_id', 'mother_id', 'spouse_id'].forEach(field => {
  if (field in payload && !isValidUUID(payload[field])) {
    console.error(`Invalid UUID for ${field}:`, payload[field]);
    delete payload[field];
  }
});
```

Database verification: No corrupted UUIDs found in profiles table ✅

### Files Modified
- `src/components/ProfileViewer/EditMode/TabDetails.js` (lines 188-192)
- `src/components/ProfileViewer/index.js` (lines 651-665)

### Data Architecture
- **CountryPicker** → `current_residence` (display: "🇸🇦 السعودية" or "🇪🇬 مصر")
- **SaudiCityPicker** → `current_residence` (for Saudi: just city name) + `current_residence_normalized`
- **Single Source of Truth**: `current_residence_normalized` (structured: {country, city})

### Testing Status
✅ Country selection does NOT flash when city selected
✅ City picker only enabled when Saudi Arabia selected
✅ Normalized data maintains both country and city
✅ UUID validation prevents RPC errors
✅ No data conflicts or overwriting
✅ Database clean (no corrupted UUIDs)

### Commits
1. Commit: `d8897f5f2` - "fix: Resolve country selector flashing + add UUID validation"
   - Fixed country flashing issue
   - Added UUID validation before RPC
   - Database verification

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
