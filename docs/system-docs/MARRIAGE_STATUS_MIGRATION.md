# Marriage Status Migration (Migration 078)

**Date**: January 2025
**Status**: ✅ Deployed
**Migrations**: 077, 078
**Commits**: 2a7cde41f, ad643c193, 84c69f2d1

---

## Overview

Migration 078 simplified marriage status values from 3 stigmatizing options to 2 neutral terms, improving cultural sensitivity and UI simplicity.

### Before (Old System)
- `'married'` (متزوج)
- `'divorced'` (مطلق)
- `'widowed'` (أرمل)

### After (New System)
- `'current'` (حالي) - Active marriage
- `'past'` (سابق) - Ended marriage (any reason)

---

## Why This Migration?

### Cultural Sensitivity
- Terms like "divorced" and "widowed" carry social stigma in many cultures
- Neutral language respects privacy and reduces judgment
- Aligns with inclusive, family-first values

### UI Simplification
- Reduced from 3 options to 2
- Easier for users to understand and select
- Removes need to specify *why* marriage ended

### Data Privacy
- Users don't have to reveal sensitive personal information
- Past marriage reasons remain private
- Focus on current status, not past circumstances

---

## Technical Implementation

### Migration 077: Admin Update Marriage RPC
**File**: `supabase/migrations/077_admin_update_marriage.sql`

Created secure RPC function for updating marriages:
```sql
admin_update_marriage(p_marriage_id UUID, p_updates JSONB)
```

**Features**:
- Permission checks (admin/moderator/inner on either spouse)
- Validates status values (only 'current' or 'past' allowed)
- Audit logging for all changes
- Whitelist approach for security

**Key Fix**: Added `DROP FUNCTION` to avoid parameter name conflicts during deployment.

### Migration 078: Status Value Migration
**File**: `supabase/migrations/078_simplify_marriage_status.sql`

**Steps**:
1. Update existing data: `married→current`, `divorced/widowed→past`
2. Drop old constraint
3. Add new constraint: `CHECK (status IN ('current', 'past'))`
4. Set default value to `'current'`
5. Validate migration success

**Deployment Note**: Must drop constraint FIRST, then update data, then add new constraint. Order matters!

---

## App Code Updates

### Critical Files Updated

**Commit 2a7cde41f** - Core functionality fixes:

1. **TabFamily.js** (Lines 399-400, 598-600)
   - Fixed spouse filters to accept both 'current' and 'married'
   - Updated status badge to show 'سابق' instead of 'مطلق'/'أرمل'
   ```javascript
   // Before
   const activeSpouses = spouses.filter(s => s.status === 'married');

   // After
   const activeSpouses = spouses.filter(s => s.status === 'current' || s.status === 'married');
   ```

2. **EditChildModal.js** (Line 92-94)
   - Removed married-only filter
   - Now shows ALL wives (including divorced/widowed) for mother selection
   ```javascript
   // Before
   const availableSpouses = spouses.filter(s => s.status === 'married');

   // After
   const availableSpouses = spouses; // Show all spouses
   ```

3. **InlineSpouseAdder.js** (Line 106)
   - Changed default status from 'married' to 'current'

4. **profiles.js** (Line 465)
   - Changed default status in createMarriage from 'married' to 'current'

5. **SpouseEditor.js** (Lines 33, 52-55, 93-98, 257-260)
   - Updated all status logic
   - Changed options from 3 to 2
   - Updated conditional rendering

6. **FatherSelectorSimple.js** (Lines 76, 91)
   - Updated status filter to include both old and new values
   - Fixed is_current derivation

7. **MotherSelector.js** (Line 82)
   - Updated is_current to check for both 'current' and 'married'

8. **EditMarriageModal.js** (Lines 34-36, 196-221)
   - Already updated in previous session
   - Uses 'current'/'past' terminology

**Commit ad643c193** - Test updates:
- Updated EditChildModal.test.js mock data
- Updated SelectMotherModal.test.js mock data

**Commit 84c69f2d1** - Tests:
- Added comprehensive EditMarriageModal.test.js

---

## The "Wives Disappeared" Bug

### Problem
After deploying migration 078, wives disappeared from the Family tab.

### Root Cause
`TabFamily.js:399` filtered spouses by `status === 'married'`, but database now had `status === 'current'`.

```javascript
// This caused ALL wives to be filtered out
const activeSpouses = spouses.filter(s => s.status === 'married'); // ❌
```

### Solution
Support both old and new values during transition:
```javascript
const activeSpouses = spouses.filter(s =>
  s.status === 'current' || s.status === 'married' // ✅
);
```

### Lesson Learned
When changing database enum values, **ALL app code must be updated** before or immediately after deployment. Database migrations alone are not enough.

---

## Backward Compatibility

The app now supports BOTH old and new values during the transition period:

```javascript
// Status checks now use OR conditions
if (status === 'current' || status === 'married') {
  // Active marriage
}

if (status === 'past' || status === 'divorced' || status === 'widowed') {
  // Ended marriage
}
```

This ensures:
- Old data still displays correctly during gradual migration
- New records use new terminology
- No data loss or display errors

---

## Files That Still Need Updates (Lower Priority)

These files contain references to old status values but are lower priority:

### Display/Export (Medium Priority)
- `ProfileSheet.js` - Multiple status display logic locations
- `exportService.js` - Export label text
- `simpleExportService.js` - Export label text
- `ModernProfileEditorContent.js` - Status display

### Legacy/Archive (Low Priority - Can Skip)
- `ModernProfileEditor.js` (archive)
- `ModernProfileEditorV2.js` (archive)
- `ModernProfileEditorV3.js` (archive)
- `ModernProfileEditorV4.js` (archive/deprecated)

### Scripts (Skip)
- `generate-mock-data.js` - Only used for mock data generation
- `consolidate-migrations.js` - Historical script

---

## Testing Checklist

### Database
- [x] Migration 078 deployed successfully
- [x] All existing records updated (married→current, divorced/widowed→past)
- [x] New constraint accepts only 'current'/'past'
- [x] Default value set to 'current'

### App Functionality
- [x] Wives appear in Family tab
- [x] Can create new marriages (default to 'current')
- [x] Can edit marriage status (2 options: حالي/سابق)
- [x] Mother selection includes all wives (not just married)
- [x] Status badges show correct labels
- [x] Past marriages show 'سابق' badge

### UI/UX
- [x] EditMarriageModal shows 2 options (not 3)
- [x] Labels use neutral Arabic terms
- [x] No stigmatizing language visible
- [x] End date field shown only for 'past' status

### Tests
- [x] EditMarriageModal.test.js - Comprehensive coverage
- [x] EditChildModal.test.js - Mock data updated
- [x] SelectMotherModal.test.js - Mock data updated

---

## Common Pitfalls & Solutions

### Pitfall 1: Filtering by Old Values
**Problem**: `spouses.filter(s => s.status === 'married')` returns empty array
**Solution**: Support both: `s.status === 'current' || s.status === 'married'`

### Pitfall 2: Creating with Old Default
**Problem**: New marriages created with `status: 'married'` violate constraint
**Solution**: Change default to `'current'` in all creation functions

### Pitfall 3: Conditional Logic
**Problem**: `if (status !== 'married')` doesn't work anymore
**Solution**: Update to `if (status !== 'current')`

### Pitfall 4: Display Labels
**Problem**: Showing old Arabic labels (متزوج/مطلق)
**Solution**: Update to neutral terms (حالي/سابق)

---

## Future Considerations

### Phase Out Backward Compatibility
Once all data is confirmed to use new values (after ~1 month):
1. Remove OR conditions checking for old values
2. Clean up backward compatibility code
3. Simplify conditional logic

### Data Cleanup
Run periodic check to ensure no old values remain:
```sql
SELECT COUNT(*) FROM marriages
WHERE status IN ('married', 'divorced', 'widowed');
-- Should return 0
```

### Documentation Updates
- [x] CLAUDE.md - Migration documented
- [x] CHANGELOG.md - Changes recorded
- [x] marriage-system-analysis.md - Terminology updated
- [x] This file created

---

## References

- **Migrations**: `supabase/migrations/077_admin_update_marriage.sql`, `078_simplify_marriage_status.sql`
- **Commits**:
  - `2a7cde41f` - Core app code fixes
  - `ad643c193` - Test updates
  - `84c69f2d1` - EditMarriageModal tests
  - `900697d05` - Initial EditMarriageModal redesign
- **Related Docs**:
  - `/docs/system-docs/marriage-system-analysis.md`
  - `/docs/project-history/CHANGELOG.md`
  - `CLAUDE.md` - Database Migrations section
