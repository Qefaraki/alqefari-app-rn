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

**Status**: ✅ Complete

### Bug Report
When user selected a city (e.g., "الرياض"), the country dropdown reset to "Choose Country" instead of remaining on "🇸🇦 السعودية".

### Root Cause
`SaudiCityPicker.onChange` was overwriting `current_residence` field with just the city name, conflicting with the `CountryPicker` which reads/writes the same field.

### Solution
Removed the buggy `onChange` callback from `SaudiCityPicker`. Now only `onNormalizedChange` updates data (to `current_residence_normalized`), while `CountryPicker` manages `current_residence` independently.

### Files Modified
- `src/components/ProfileViewer/EditMode/TabDetails.js` (line 175-177)

### Data Architecture After Fix
- **CountryPicker** → `current_residence` (stores full emoji value: "🇸🇦 السعودية")
- **SaudiCityPicker** → `current_residence_normalized` (stores structured data with country + city)
- **Single Source of Truth**: `current_residence_normalized` for analytics and future querying

### Testing Notes
✅ Country selection persists when city is selected
✅ City picker only enabled when Saudi Arabia is selected
✅ Normalized data properly maintains both country and city
✅ No data conflicts or overwriting

### Commit
- Commit: `0d46a4a3a` (included in offline fix)
- Message: "fix(offline): Revert fallback - restore proper NetInfo import"
- Also included TabDetails.js fix as part of larger refactor

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
