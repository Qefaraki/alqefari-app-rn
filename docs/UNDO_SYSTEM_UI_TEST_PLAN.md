# Undo System UI Test Plan
**Activity Log Dashboard Manual Testing Guide**

## Overview

This document provides a comprehensive manual test plan for the Activity Log Dashboard undo functionality in the Alqefari Family Tree React Native app. Since Playwright cannot test React Native apps directly, this plan is designed for manual execution on iOS Simulator or physical devices.

**Component Under Test:** `src/screens/admin/ActivityLogDashboard.js`

**Backend Dependencies:**
- `undoService.js` - Service layer for RPC calls
- `undoStore.js` - Zustand state management
- Database RPC functions (93.75% pass rate)

**Test Environment:**
- iOS Simulator (iPhone 14 Pro or similar)
- Physical iOS device (recommended for haptic feedback)
- Android emulator (secondary)

---

## 1. Components & UI Elements Analysis

### 1.1 Undo Button (`ActivityListCard` - Lines 514-576)

**Visibility Logic (Line 520):**
```javascript
const showUndo = activity.is_undoable === true && !activity.undone_at;
```

**Location:** Right side of activity card, above chevron icon

**Visual Properties:**
- Icon: `arrow.uturn.backward` (iOS) / `arrow-undo-outline` (Android)
- Color: `tokens.colors.najdi.crimson` (#A13333)
- Background: `tokens.colors.najdi.crimson + '12'` (crimson with 12% opacity)
- Touch target: 44px minimum (lines 1495-1503)
- Padding: 12px horizontal, 8px vertical
- Border radius: 12px
- Font weight: 600
- Font size: 13px
- Text: "تراجع" (Arabic for "Undo")

**Interaction:**
- `onPress` calls `stopPropagation()` to prevent card press (line 556)
- `activeOpacity={0.7}` for visual feedback
- No haptic feedback (consider adding for tactile response)

### 1.2 Dangerous Badge (`ActivityListCard` - Lines 526, 531-535)

**Visibility Logic:**
```javascript
const severityBadge = getSeverityBadge(activity.severity);
```

**Displays when:** `activity.severity === 'high' || activity.severity === 'critical'`

**Visual Properties:**
- Badge: Rounded pill shape (12px border radius)
- Colors:
  - High: `#D58C4A` (Desert Ochre) background, `#F9F7F3` text
  - Critical: `#A13333` (Najdi Crimson) background, `#F9F7F3` text
- Severity dot: 8x8px circle (line 1476-1480)
- Text: "عالي" (High) or "حرج" (Critical)
- Font size: 11px, weight: 700

### 1.3 "Already Undone" State

**Visibility:** When `activity.undone_at !== null`

**Expected Behavior:**
- Undo button HIDDEN (line 520 condition fails)
- No visual indicator in list view (design gap identified)
- Details sheet shows undone status (not explicitly implemented - **UI BUG FOUND**)

**Recommendation:** Add "تم التراجع" badge when `undone_at` is set

### 1.4 Activity Details Sheet (`ActivityDetailsSheet` - Lines 578-688)

**Undo Button Location:** Bottom action bar (lines 674-684)

**Visual Properties:**
- Full-width red button (flex: 1)
- Icon + text layout
- Background: `tokens.colors.najdi.crimson`
- Text color: `tokens.colors.najdi.alJass` (#F9F7F3)
- Icon: `arrow.uturn.backward` / `arrow-undo`
- Icon margin-start: 4px (RTL adjustment)
- Padding vertical: 12px
- Border radius: 12px

**Behavior:**
- Calls `onUndo(activity)` directly
- Closes sheet automatically after undo (not implemented - **UI BUG FOUND**)

### 1.5 Toast Notifications (`Toast.js` + `useUndoStore`)

**Toast Component Properties:**
- Position: Absolute top (iOS: 60px, Android: 40px)
- Animation: Moti slide-down (300ms duration)
- Auto-dismiss: 3 seconds (configurable)
- Z-index: 9999 (always on top)

**Toast Types:**
- **Success**: Green background (`tokens.colors.success`), checkmark-circle icon, "✓ تم التراجع بنجاح"
- **Error**: Red background (`tokens.colors.danger`), alert-circle icon, custom error message
- **Info**: Accent color background (`tokens.colors.accent`), information-circle icon

**State Management:**
```javascript
const { showToast, hideToast, toastVisible, toastMessage, toastType } = useUndoStore();
```

### 1.6 Error Message Parsing (`parseUndoError` - Lines 814-878)

**Error Types & Messages:**

| Error Type | Detection | User Message | Auto-Refresh |
|------------|-----------|--------------|--------------|
| `version_conflict` | Contains "تم تحديث الملف من مستخدم آخر" or "الإصدار الحالي" | "توجد تغييرات أحدث. قم بالتراجع عن التغييرات الأحدث أولاً (بالترتيب العكسي)." | ✅ Yes (2s delay) |
| `already_undone` | Contains "تم التراجع عن هذا الإجراء بالفعل" | "تم التراجع عن هذا الإجراء بالفعل" | ✅ Yes |
| `parent_deleted` | Contains "محذوف" | "تم حذف ملف الأب/الأم. استعد الملف المحذوف أولاً." | ✅ Yes |
| `stale_data` | Contains "الملف قيد التعديل" or "foreign key" or "constraint" | "تم تحديث الملف. جاري تحديث الصفحة..." | ✅ Yes |
| `network` | Contains "network" or "timeout" or "Failed to fetch" | "خطأ في الاتصال. تحقق من الإنترنت وحاول مرة أخرى." | ❌ No |
| `permission` | Contains "غير مصرح" or "صلاحية" | Original message | ❌ No |
| `unknown` | Default | Original message or "حدث خطأ أثناء التراجع" | ❌ No |

**Auto-Refresh Mechanism (Lines 1174-1179):**
```javascript
if (parsedError.shouldRefresh) {
  setTimeout(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    fetchActivities(false);
  }, 2000);
}
```

### 1.7 Confirmation Dialog

**Status:** NOT IMPLEMENTED ⚠️

**Expected Behavior (from docs):**
- Should appear for dangerous actions (`isDangerousAction(actionType) === true`)
- Dangerous actions: `profile_cascade_delete`, `add_marriage`
- Should block background interaction
- Should require explicit confirmation

**Current Implementation:** No confirmation dialog exists in `ActivityLogDashboard.js`

**Recommendation:** Add Alert.alert() for dangerous actions before calling `undoService.undoAction()`

---

## 2. State Management Flow

### 2.1 handleUndo Function (Lines 1116-1183)

**Flow:**
1. **Auth Check** (lines 1118-1121)
   - Verify `profile?.id` exists
   - Show error toast if not logged in
   - Return early

2. **Permission Check** (lines 1124-1129)
   - Call `undoService.checkUndoPermission(activity.id, profile.id)`
   - Show error toast with `permissionCheck.reason` if denied
   - Return early

3. **Execute Undo** (lines 1131-1136)
   - Call `undoService.undoAction(activity.id, profile.id, activity.action_type, reason)`
   - Reason hardcoded as "تراجع من سجل النشاط"

4. **Success Handler** (lines 1138-1163)
   - Show success toast: "✓ تم التراجع بنجاح"
   - Refetch affected profile from `profiles` table
   - Update tree store with fresh version (lines 1150-1152)
   - Log version change to console (lines 1153-1157)
   - Warn if profile refetch fails (lines 1158-1160)
   - Refresh activity log (line 1163)

5. **Error Handler** (lines 1164-1180)
   - Parse error with `parseUndoError(error)`
   - Show error toast with Arabic message
   - Auto-refresh if `parsedError.shouldRefresh === true`
   - Wait 2 seconds before refresh
   - Trigger haptic notification on refresh

### 2.2 Tree Store Refresh (Lines 1141-1161)

**Purpose:** Prevent stale version errors after undo

**Implementation:**
```javascript
const profileId = activity.record_id;
if (profileId) {
  const { data: freshProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (freshProfile && !fetchError) {
    useTreeStore.getState().updateNode(profileId, freshProfile);
    console.log('[ActivityLogDashboard] Profile refreshed after undo:', {
      profileId,
      oldVersion: activity.new_data?.version,
      newVersion: freshProfile.version
    });
  }
}
```

**Why This Matters:**
- Undo increments profile version
- Without refresh, next edit will fail with version conflict
- Tree store must have latest version for optimistic locking

---

## 3. Manual Test Checklist

### 3.A. Visual Regression Tests

#### 3.A.1 Undo Button Appearance
- [ ] **Prerequisite:** Create a test profile update (change name)
- [ ] Navigate to Activity Log Dashboard
- [ ] Verify undo button appears on the newest entry
- [ ] Verify button is on the RIGHT side of card (RTL layout)
- [ ] Verify button has red background tint (`#A1333312`)
- [ ] Verify button text is "تراجع" in crimson (#A13333)
- [ ] Verify icon is `arrow.uturn.backward` (iOS) or `arrow-undo-outline` (Android)
- [ ] Verify button has 12px border radius (rounded corners)
- [ ] Verify minimum touch target is 44px (easy to tap)

#### 3.A.2 Dangerous Badge Display
- [ ] **Prerequisite:** Have admin perform a cascade delete operation
- [ ] Navigate to Activity Log Dashboard
- [ ] Find the cascade delete entry
- [ ] Verify severity dot appears (8x8px red circle)
- [ ] Verify severity tag appears with "حرج" text
- [ ] Verify tag background is crimson (#A13333)
- [ ] Verify tag text is white (#F9F7F3)

#### 3.A.3 Already Undone State
- [ ] **Prerequisite:** Undo a profile update
- [ ] Refresh activity log
- [ ] Find the previously undone entry
- [ ] Verify undo button does NOT appear
- [ ] **⚠️ KNOWN ISSUE:** No "تم التراجع" badge currently shown (design gap)
- [ ] Open details sheet for undone entry
- [ ] **⚠️ KNOWN ISSUE:** No visual indicator of undone status in sheet

#### 3.A.4 Loading States
- [ ] Initiate an undo action
- [ ] Verify NO loading spinner on undo button (not implemented)
- [ ] Verify app remains responsive during undo
- [ ] Verify activity log auto-refreshes after success (lines 1163, 1177)

#### 3.A.5 RTL Layout Correctness
- [ ] Verify app is running in RTL mode (`I18nManager.isRTL === true`)
- [ ] Verify undo button is on RIGHT side of card
- [ ] Verify chevron points LEFT (RTL)
- [ ] Verify Arabic text renders correctly
- [ ] Verify icon directions are RTL-correct

---

### 3.B. User Flow Tests

#### 3.B.1 Happy Path: Profile Update Undo
**Objective:** Verify basic undo functionality works end-to-end

**Steps:**
1. Log in as regular user
2. Edit your own profile (e.g., change bio from "Test 1" to "Test 2")
3. Navigate to Activity Log Dashboard (Admin Dashboard → سجل النشاط)
4. Verify newest entry shows the profile update
5. Verify undo button appears on the card
6. Tap the undo button
7. **Expected:** Success toast appears with "✓ تم التراجع بنجاح"
8. **Expected:** Toast auto-dismisses after 3 seconds
9. **Expected:** Activity log auto-refreshes (undo entry appears)
10. **Expected:** Undo button disappears from original entry
11. Navigate to your profile
12. **Expected:** Bio is reverted to "Test 1"
13. Check console logs for version increment confirmation

**Pass Criteria:**
- ✅ Toast shows success message
- ✅ Profile data reverted correctly
- ✅ Activity log shows new undo entry
- ✅ Undo button removed from original entry
- ✅ Version incremented in console logs

#### 3.B.2 Dangerous Action: Cascade Delete Undo (Admin Only)
**Objective:** Verify admin-only dangerous operations work correctly

**Prerequisites:**
- Admin user account
- Test profile with 2-3 descendants (children/grandchildren)

**Steps:**
1. Log in as admin
2. Navigate to a test profile with descendants
3. Perform cascade delete (Admin Dashboard → Cascade Delete)
4. Navigate to Activity Log Dashboard
5. Find the cascade delete entry
6. Verify severity badge shows "حرج" (Critical)
7. Verify undo button appears
8. Tap undo button
9. **⚠️ EXPECTED (NOT IMPLEMENTED):** Confirmation dialog appears
   - Title: "تأكيد التراجع"
   - Message: "هذا إجراء خطير. هل تريد استعادة جميع الملفات المحذوفة؟"
   - Buttons: "إلغاء" | "تأكيد"
10. **⚠️ CURRENT BEHAVIOR:** Undo executes immediately (no confirmation)
11. **Expected:** Success toast shows "✓ تم التراجع بنجاح"
12. **Expected:** All descendants restored
13. Navigate to tree view
14. **Expected:** Verify all profiles are visible again

**Pass Criteria:**
- ✅ Cascade undo restores all descendants
- ✅ Activity log shows undo entry
- ⚠️ Confirmation dialog (NOT IMPLEMENTED - design gap)

#### 3.B.3 Permission Denied: User Tries to Undo Admin Action
**Objective:** Verify permission system correctly blocks unauthorized undos

**Prerequisites:**
- Regular user account
- Admin user account
- Admin has made a profile update on another user's profile

**Steps:**
1. Log in as admin
2. Edit a different user's profile (e.g., change their bio)
3. Log out and log in as the affected regular user
4. Navigate to Activity Log Dashboard
5. Find the admin's update entry
6. **Expected:** Undo button does NOT appear (permission check prevents it)
7. Open details sheet
8. **Expected:** Undo button in sheet is also NOT visible
9. Attempt to manually call undo (via developer console if possible)
10. **Expected:** Permission denied error toast

**Pass Criteria:**
- ✅ Undo button hidden from non-permitted users
- ✅ Error message shows permission denial if attempted

#### 3.B.4 Time Limit: User Tries to Undo 31-Day-Old Action
**Objective:** Verify 30-day time limit for regular users

**Prerequisites:**
- Database entry with `created_at` > 30 days ago
- OR manually set `created_at` in database for testing

**Steps:**
1. Log in as regular user (not admin)
2. Navigate to Activity Log Dashboard
3. Set date filter to "all time"
4. Find an entry > 30 days old
5. **Expected:** Undo button does NOT appear
6. Open details sheet
7. **Expected:** Undo button NOT visible in sheet
8. Log in as admin
9. Navigate to same old entry
10. **Expected:** Admin sees undo button (no time limit)

**Pass Criteria:**
- ✅ Regular users cannot undo old actions
- ✅ Admins can undo regardless of age

#### 3.B.5 Version Conflict: Profile Updated After Change
**Objective:** Verify version conflict detection and user guidance

**Prerequisites:**
- Two user sessions (User A and User B)
- User A's profile

**Steps:**
1. **Session A (User A):** Edit bio to "Version 1"
2. **Session B (Admin):** Edit User A's bio to "Version 2"
3. **Session A:** Navigate to Activity Log Dashboard
4. **Session A:** Attempt to undo the "Version 1" change
5. **Expected:** Error toast appears:
   - "توجد تغييرات أحدث. قم بالتراجع عن التغييرات الأحدث أولاً (بالترتيب العكسي)."
6. **Expected:** Auto-refresh triggers after 2 seconds
7. **Expected:** Haptic notification on refresh (iOS only)
8. **Expected:** Activity log reloads with fresh data
9. **Session A:** Find the newer "Version 2" entry
10. **Session A:** Undo "Version 2" first
11. **Session A:** Then undo "Version 1"
12. **Expected:** Both undos succeed

**Pass Criteria:**
- ✅ Version conflict detected
- ✅ User-friendly error message in Arabic
- ✅ Auto-refresh after 2 seconds
- ✅ Haptic feedback on iOS
- ✅ Undo order enforced (newest first)

---

### 3.C. Error Handling Tests

#### 3.C.1 Network Timeout
**Objective:** Verify graceful handling of network failures

**Steps:**
1. Enable Airplane Mode on device
2. Navigate to Activity Log Dashboard
3. Attempt to undo an action
4. **Expected:** Error toast appears:
   - "خطأ في الاتصال. تحقق من الإنترنت وحاول مرة أخرى."
5. **Expected:** Toast type is 'error' (red background)
6. **Expected:** No auto-refresh (network is down)
7. Disable Airplane Mode
8. Retry undo
9. **Expected:** Undo succeeds

**Pass Criteria:**
- ✅ Network error detected
- ✅ User-friendly Arabic message
- ✅ No infinite retry loops
- ✅ App remains responsive

#### 3.C.2 Already Undone Error
**Objective:** Verify idempotency protection

**Steps:**
1. Undo a profile update successfully
2. Quickly tap the undo button again before UI updates
3. **Expected:** Error toast appears:
   - "تم التراجع عن هذا الإجراء بالفعل"
4. **Expected:** Auto-refresh after 2 seconds
5. **Expected:** Undo button disappears after refresh
6. Open details sheet
7. **Expected:** Undo button removed from sheet as well

**Pass Criteria:**
- ✅ Double-undo prevented
- ✅ Clear error message
- ✅ UI updates to reflect undone state

#### 3.C.3 Parent Profile Deleted
**Objective:** Verify referential integrity error handling

**Prerequisites:**
- Profile with father_id/mother_id reference
- Parent profile is soft-deleted

**Steps:**
1. Admin soft-deletes a parent profile
2. User updates child profile (changes bio)
3. User attempts to undo the child profile update (which would restore old father_id)
4. **Expected:** Error toast appears:
   - "تم حذف ملف الأب/الأم. استعد الملف المحذوف أولاً."
5. **Expected:** Auto-refresh after 2 seconds
6. Admin restores parent profile
7. User retries undo
8. **Expected:** Undo succeeds

**Pass Criteria:**
- ✅ Parent validation error detected
- ✅ Helpful error message guides user
- ✅ Undo succeeds after parent restored

#### 3.C.4 Stale Data / Foreign Key Constraint
**Objective:** Verify handling of concurrent modifications

**Steps:**
1. **Session A:** Edit profile bio
2. **Session B:** Change profile's father_id
3. **Session A:** Undo bio change (now has stale father_id)
4. **Expected:** Error toast appears:
   - "تم تحديث الملف. جاري تحديث الصفحة..."
5. **Expected:** Auto-refresh after 2 seconds
6. **Expected:** Activity log reloads
7. **Session A:** Retry undo with fresh data
8. **Expected:** Undo succeeds

**Pass Criteria:**
- ✅ Foreign key error detected
- ✅ Auto-refresh loads fresh data
- ✅ Retry succeeds after refresh

#### 3.C.5 Permission Denied Mid-Flight
**Objective:** Verify permission revocation handling

**Prerequisites:**
- User with temporary admin privileges

**Steps:**
1. Log in as temporary admin
2. Open Activity Log Dashboard
3. Locate an admin-only undoable action
4. **During undo:** Super admin revokes admin privileges
5. Complete undo operation
6. **Expected:** Error toast appears:
   - "ليس لديك صلاحية للتراجع عن هذا الإجراء"
7. **Expected:** No auto-refresh (permission issue)

**Pass Criteria:**
- ✅ Permission change detected
- ✅ Clear error message
- ✅ No data corruption

---

### 3.D. UI State Tests

#### 3.D.1 Loading Spinner During Undo
**Objective:** Verify loading states provide user feedback

**Steps:**
1. Navigate to Activity Log Dashboard
2. Tap undo button on any entry
3. **⚠️ EXPECTED (NOT IMPLEMENTED):** Undo button shows spinner/loading state
4. **⚠️ CURRENT BEHAVIOR:** No loading indicator
5. **Expected:** Toast appears after operation completes

**Pass Criteria:**
- ⚠️ Loading state NOT IMPLEMENTED (minor UX gap)
- ✅ Toast provides completion feedback

**Recommendation:** Add `ActivityIndicator` to undo button during operation

#### 3.D.2 Activity Log Auto-Refresh
**Objective:** Verify list updates after undo

**Steps:**
1. Undo a profile update
2. Wait for success toast
3. **Expected:** Activity log scrolls to top (NOT IMPLEMENTED)
4. **Expected:** New "undo" entry appears at top
5. **Expected:** Original entry's undo button disappears
6. Pull-to-refresh
7. **Expected:** Same state persists

**Pass Criteria:**
- ✅ List refreshes automatically
- ✅ Undo entry appears
- ⚠️ No scroll-to-top animation (minor UX gap)

#### 3.D.3 Toast Auto-Dismiss Timing
**Objective:** Verify toast behaves correctly

**Steps:**
1. Undo any action successfully
2. Observe success toast
3. **Expected:** Toast visible for exactly 3 seconds
4. **Expected:** Toast fades out smoothly (300ms animation)
5. **Expected:** Toast does not block UI interaction
6. Tap outside toast while visible
7. **Expected:** Toast remains visible (no manual dismiss)

**Pass Criteria:**
- ✅ 3-second duration
- ✅ Smooth fade animation
- ✅ Non-blocking UI

#### 3.D.4 Confirmation Dialog Interaction
**Objective:** Verify dangerous action confirmation

**⚠️ STATUS:** NOT IMPLEMENTED - Test cannot be performed

**Expected Steps (if implemented):**
1. Navigate to cascade delete entry
2. Tap undo button
3. Confirmation dialog appears
4. Tap outside dialog
5. Dialog remains open (blocks background)
6. Tap "إلغاء" (Cancel)
7. Dialog closes, no undo performed
8. Retry undo, tap "تأكيد" (Confirm)
9. Undo executes

**Recommendation:** Implement using `Alert.alert()` for dangerous actions

#### 3.D.5 Details Sheet Undo Button
**Objective:** Verify sheet behavior during undo

**Steps:**
1. Open activity details sheet
2. Tap undo button in bottom action bar
3. **Expected:** Undo executes
4. **Expected:** Success toast appears
5. **⚠️ EXPECTED (NOT IMPLEMENTED):** Sheet auto-closes after success
6. **⚠️ CURRENT BEHAVIOR:** Sheet remains open
7. Manually close sheet
8. **Expected:** Activity log shows refreshed data

**Pass Criteria:**
- ✅ Undo executes from sheet
- ⚠️ Sheet does not auto-close (minor UX gap)

**Recommendation:** Add `onClose()` call after successful undo in sheet

---

## 4. Test Data Requirements

### 4.1 User Accounts

| Role | Username | Purpose |
|------|----------|---------|
| Regular User A | `test_user_a` | Primary test account for undo operations |
| Regular User B | `test_user_b` | Secondary account for concurrent modification tests |
| Admin | `test_admin` | Admin-level undo operations |
| Super Admin | `test_super_admin` | Full permission testing |

### 4.2 Test Profiles

| Profile | Relationship | Purpose |
|---------|-------------|---------|
| Profile A | Self (User A) | Basic undo testing |
| Profile B | Child of Profile A | Parent-child relationship testing |
| Profile C | Grandchild of Profile A | Cascade delete testing |
| Profile D | Munasib (spouse) | Marriage undo testing |

### 4.3 Audit Log Entries

| Action Type | Created At | Undone At | Purpose |
|-------------|-----------|-----------|---------|
| `profile_update` | < 1 hour ago | `null` | Basic undo testing |
| `profile_update` | > 31 days ago | `null` | Time limit testing |
| `profile_update` | < 1 hour ago | < 1 hour ago | Already undone testing |
| `profile_soft_delete` | < 1 hour ago | `null` | Soft delete undo testing |
| `profile_cascade_delete` | < 7 days ago | `null` | Dangerous action testing |
| `add_marriage` | < 1 hour ago | `null` | Marriage undo testing |

### 4.4 Database Setup Script

```sql
-- Create test users (run as super admin)
INSERT INTO profiles (name, hid, phone) VALUES
  ('Test User A', 'TST001', '+966501234001'),
  ('Test User B', 'TST002', '+966501234002'),
  ('Test Child', 'TST003', '+966501234003'),
  ('Test Grandchild', 'TST004', '+966501234004');

-- Create test audit entries
INSERT INTO audit_log_enhanced (
  action_type,
  record_id,
  actor_id,
  is_undoable,
  old_data,
  new_data,
  created_at
) VALUES (
  'profile_update',
  '<profile_a_id>',
  '<user_a_id>',
  true,
  '{"bio": "Old Bio"}',
  '{"bio": "New Bio"}',
  NOW()
);

-- Create old entry for time limit testing
INSERT INTO audit_log_enhanced (
  action_type,
  record_id,
  actor_id,
  is_undoable,
  created_at
) VALUES (
  'profile_update',
  '<profile_a_id>',
  '<user_a_id>',
  true,
  NOW() - INTERVAL '31 days'
);
```

---

## 5. Expected vs Actual Results

| Test Case | Code Reference | Expected Behavior | Status | Notes |
|-----------|----------------|-------------------|--------|-------|
| **Undo button visibility** | Line 520 | Shows when `is_undoable === true && !undone_at` | ✅ TO TEST | Condition implemented correctly |
| **Success toast** | Line 1139 | "✓ تم التراجع بنجاح" | ✅ TO TEST | Toast service integrated |
| **Error toast** | Lines 1165-1171 | Shows parsed Arabic error message | ✅ TO TEST | `parseUndoError()` implemented |
| **Auto-refresh on error** | Lines 1174-1179 | Refreshes after 2s for stale data errors | ✅ TO TEST | Conditional refresh logic |
| **Version conflict message** | Lines 819-825 | "توجد تغييرات أحدث. قم بالتراجع..." | ✅ TO TEST | Detailed user guidance |
| **Already undone message** | Lines 828-834 | "تم التراجع عن هذا الإجراء بالفعل" | ✅ TO TEST | Idempotency detection |
| **Network error message** | Lines 855-861 | "خطأ في الاتصال. تحقق من الإنترنت..." | ✅ TO TEST | Network failure handling |
| **Permission denied** | Lines 1126-1129 | Shows `permissionCheck.reason` | ✅ TO TEST | Backend permission check |
| **Tree store refresh** | Lines 1144-1161 | Updates version after undo | ✅ TO TEST | Prevents stale version errors |
| **Haptic feedback on refresh** | Line 1176 | Notification haptic on auto-refresh | ✅ TO TEST | iOS only |
| **Dangerous badge** | Lines 526, 531-535 | Shows for high/critical severity | ✅ TO TEST | Severity badge component |
| **"Already undone" badge** | N/A | Shows "تم التراجع" when undone | ❌ NOT IMPLEMENTED | **Design gap** |
| **Confirmation dialog** | N/A | Shows for dangerous actions | ❌ NOT IMPLEMENTED | **Design gap** |
| **Undo button loading state** | N/A | Shows spinner during operation | ❌ NOT IMPLEMENTED | **UX gap** |
| **Sheet auto-close** | N/A | Closes sheet after successful undo | ❌ NOT IMPLEMENTED | **UX gap** |
| **Toast manual dismiss** | N/A | Tap toast to dismiss early | ❌ NOT IMPLEMENTED | Auto-dismiss only |

---

## 6. Code Analysis Findings

### 6.1 UI Bugs Identified

#### 🐛 **BUG-001: No "Already Undone" Visual Indicator in List View**
**Severity:** Medium
**File:** `ActivityLogDashboard.js`, lines 514-576
**Issue:** When `activity.undone_at !== null`, undo button disappears but there's no badge/label indicating the action was undone.
**Recommendation:**
```javascript
// Add after line 535 (inside ActivityListCard)
{activity.undone_at && (
  <View style={styles.undoneBadge}>
    <Text style={styles.undoneText}>تم التراجع</Text>
  </View>
)}
```

#### 🐛 **BUG-002: No Confirmation Dialog for Dangerous Actions**
**Severity:** High
**File:** `ActivityLogDashboard.js`, handleUndo function
**Issue:** Dangerous actions (cascade delete, marriage operations) execute immediately without confirmation.
**Recommendation:**
```javascript
// Add before line 1131 (in handleUndo)
if (undoService.isDangerousAction(activity.action_type)) {
  Alert.alert(
    "تأكيد التراجع",
    "هذا إجراء خطير. هل تريد المتابعة؟",
    [
      { text: "إلغاء", style: "cancel" },
      { text: "تأكيد", style: "destructive", onPress: () => executeUndo() }
    ]
  );
  return;
}
```

#### 🐛 **BUG-003: Details Sheet Does Not Auto-Close After Undo**
**Severity:** Low
**File:** `ActivityLogDashboard.js`, lines 678-683
**Issue:** After successful undo from details sheet, sheet remains open instead of closing.
**Recommendation:**
```javascript
// Modify handleUndo success handler (after line 1163)
if (result.success) {
  showToast("✓ تم التراجع بنجاح", "success");

  if (detailsVisible) {
    setDetailsVisible(false);
    setSelectedActivity(null);
  }

  // ... rest of success handler
}
```

#### 🐛 **BUG-004: No Loading State on Undo Button**
**Severity:** Low
**File:** `ActivityLogDashboard.js`, lines 552-564
**Issue:** Undo button doesn't show loading spinner during operation, leaving users uncertain if tap registered.
**Recommendation:** Add local state `const [undoingActivityId, setUndoingActivityId] = useState(null);` and show spinner when `undoingActivityId === activity.id`

### 6.2 Accessibility Issues

#### ♿ **A11Y-001: Undo Button Touch Target Size**
**Status:** ✅ Compliant
**File:** `ActivityLogDashboard.js`, lines 1495-1503
**Analysis:** Button padding (12px horizontal, 8px vertical) + icon (16px) + text (13px) = ~44px total height. **Meets iOS minimum.**

#### ♿ **A11Y-002: Color Contrast for Undo Button**
**Status:** ✅ Compliant
**Analysis:** Crimson text (#A13333) on semi-transparent crimson background (#A1333312) provides sufficient contrast. Text remains readable.

#### ♿ **A11Y-003: Screen Reader Support**
**Status:** ⚠️ Needs Improvement
**Recommendation:** Add `accessibilityLabel` to undo button:
```javascript
<TouchableOpacity
  accessibilityLabel={`تراجع عن ${activity.action_type}`}
  accessibilityHint="انقر للتراجع عن هذا الإجراء"
  style={styles.undoPill}
  onPress={onUndo}
>
```

### 6.3 RTL Layout Concerns

#### ↔️ **RTL-001: Icon Direction Handling**
**Status:** ✅ Correct
**File:** `ActivityLogDashboard.js`, lines 151-166 (SFIcon component)
**Analysis:** Component correctly uses `rtlFallback` for directional icons (chevrons). Undo icon (`arrow.uturn.backward`) is non-directional and doesn't need flipping.

#### ↔️ **RTL-002: Undo Button Position**
**Status:** ✅ Correct
**File:** `ActivityLogDashboard.js`, lines 1491-1494 (`cardTrailing` style)
**Analysis:** Uses `alignItems: "flex-end"` which correctly positions undo button on the RIGHT side in RTL mode.

#### ↔️ **RTL-003: Toast Position**
**Status:** ✅ Correct
**File:** `Toast.js`, lines 82-83
**Analysis:** Uses `left` and `right` with equal margins (`tokens.spacing.md`), centering toast in both LTR and RTL.

### 6.4 Performance Issues

#### ⚡ **PERF-001: Multiple Profile Refetches**
**Severity:** Medium
**File:** `ActivityLogDashboard.js`, lines 1144-1161
**Issue:** After undo, code refetches single profile then refetches entire activity log. Could batch these.
**Recommendation:** Consider using `Promise.all()` to parallelize fetches.

#### ⚡ **PERF-002: Real-Time Subscription for Large Logs**
**Severity:** Low
**File:** `ActivityLogDashboard.js`, lines 1005-1035
**Issue:** Real-time subscription adds every new activity to list, potentially causing memory issues with large logs.
**Mitigation:** Already limited by pagination (PAGE_SIZE = 50). Low risk.

### 6.5 Error Handling Gaps

#### 🚨 **ERROR-001: No Retry Mechanism for Network Failures**
**Severity:** Medium
**File:** `ActivityLogDashboard.js`, parseUndoError function
**Issue:** Network errors show toast but don't offer retry button.
**Recommendation:** Add "إعادة المحاولة" action to error toast for network failures.

#### 🚨 **ERROR-002: Silent Failure on Profile Refetch**
**Severity:** Low
**File:** `ActivityLogDashboard.js`, lines 1158-1160
**Issue:** If profile refetch after undo fails, error is logged but user not notified.
**Recommendation:** Show warning toast if profile refetch fails (version might be stale).

---

## 7. Recommendations for Automated Testing

Since React Native apps cannot be tested with Playwright, consider these alternatives:

### 7.1 Detox (Recommended)
**Framework:** End-to-end testing for React Native
**Pros:**
- Native app testing on iOS/Android simulators
- Gray-box testing (access to app internals)
- Synchronization with React Native bridge

**Setup:**
```bash
npm install --save-dev detox detox-cli
```

**Example Test:**
```javascript
// e2e/undoSystem.e2e.js
describe('Undo System', () => {
  it('should undo profile update', async () => {
    await element(by.id('activity-log-card-0')).tap();
    await element(by.id('undo-button')).tap();
    await expect(element(by.text('✓ تم التراجع بنجاح'))).toBeVisible();
  });
});
```

### 7.2 Appium
**Framework:** Cross-platform mobile automation
**Pros:**
- Works with iOS and Android
- Standard WebDriver protocol
- Can test on real devices

**Cons:**
- Slower than Detox
- Less React Native-specific features

### 7.3 Jest + React Native Testing Library (Unit/Integration)
**Framework:** Component-level testing
**Pros:**
- Fast test execution
- Good for testing logic/state
- Already in project (likely)

**Example:**
```javascript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ActivityLogDashboard from '../ActivityLogDashboard';

test('undo button calls handleUndo', async () => {
  const { getByText } = render(<ActivityLogDashboard />);
  const undoButton = getByText('تراجع');

  fireEvent.press(undoButton);

  await waitFor(() => {
    expect(getByText('✓ تم التراجع بنجاح')).toBeTruthy();
  });
});
```

---

## 8. Known Limitations

### 8.1 React Native vs Web Testing
| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No Playwright support | Cannot use existing browser automation | Use Detox for E2E testing |
| Slow simulator startup | Longer test execution times | Use physical devices for CI/CD |
| Platform-specific UI | Need separate iOS/Android tests | Focus on iOS, spot-check Android |
| No DevTools | Harder to debug tests | Use Detox's `--loglevel trace` |

### 8.2 Manual Testing Constraints
| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Time-dependent tests | Hard to test 30-day limit without DB manipulation | Use database scripts to backdate entries |
| Concurrency tests | Requires multiple devices/sessions | Use iOS Simulator + physical device |
| Network simulation | Hard to test offline scenarios | Use iOS Simulator Network Link Conditioner |
| Haptic feedback | Cannot verify on simulators | Require physical device testing |

### 8.3 Backend Testing Assumptions
| Assumption | Risk | Verification |
|------------|------|--------------|
| RPC functions work correctly | UI tests fail if backend broken | Run backend test suite first (93.75% pass rate) |
| Permission checks are accurate | UI shows wrong buttons | Cross-verify with database queries |
| Version increments correctly | Stale version errors | Check console logs during undo |
| Audit log writes succeed | Missing undo entries | Monitor database after each undo |

---

## 9. Test Execution Workflow

### 9.1 Pre-Test Setup (5 minutes)
1. Ensure backend RPC functions are deployed and passing
2. Reset test database to known state (run setup script from Section 4.4)
3. Clear app data on simulator/device
4. Verify network connectivity
5. Open Activity Log Dashboard

### 9.2 Execution Order (90 minutes total)
1. **Visual Regression Tests** (20 minutes)
   - 3.A.1 through 3.A.5
   - Screenshot each state for regression baseline

2. **Happy Path Tests** (20 minutes)
   - 3.B.1 (Profile Update Undo)
   - Verify end-to-end flow works before edge cases

3. **Permission & Time Limit Tests** (15 minutes)
   - 3.B.3, 3.B.4
   - Verify security constraints

4. **Error Handling Tests** (20 minutes)
   - 3.C.1 through 3.C.5
   - Test all error types from parseUndoError()

5. **UI State Tests** (15 minutes)
   - 3.D.1 through 3.D.5
   - Verify loading/refresh behaviors

### 9.3 Post-Test Validation
1. Check console logs for errors
2. Verify database state (no orphaned records)
3. Document any unexpected behaviors
4. Screenshot all failures
5. Submit bug reports for identified issues

---

## 10. Success Criteria

### 10.1 Pass Thresholds
- **Critical Tests:** 100% pass (happy path, permissions, data integrity)
- **Error Handling:** 90% pass (network errors may vary)
- **UI/UX Tests:** 80% pass (known design gaps documented)

### 10.2 Required Fixes Before Production
1. **BUG-002:** Implement confirmation dialog for dangerous actions
2. **ERROR-001:** Add retry mechanism for network failures
3. **A11Y-003:** Add screen reader labels

### 10.3 Recommended Enhancements
1. **BUG-001:** Add "تم التراجع" badge
2. **BUG-003:** Auto-close details sheet after undo
3. **BUG-004:** Add loading spinner to undo button
4. **PERF-001:** Parallelize profile + activity log refetch

---

## Appendix A: Quick Reference

### Console Log Markers
```javascript
// Look for these in Xcode/Metro console during testing:
'[ActivityLogDashboard] Profile refreshed after undo:'  // Version increment confirmation
'Check undo permission error:'  // Permission check failed
'Undo error:'  // Undo operation failed
'Get undoable actions error:'  // Failed to fetch undoable actions
```

### Test Data Query
```sql
-- Find recent undoable actions
SELECT
  id,
  action_type,
  created_at,
  undone_at,
  is_undoable,
  actor_name_current,
  target_name_current
FROM activity_log_detailed
WHERE is_undoable = true
ORDER BY created_at DESC
LIMIT 10;

-- Check undo permission for specific entry
SELECT * FROM check_undo_permission(
  '<audit_log_id>',
  '<user_profile_id>'
);
```

### Color Hex Codes
- **Najdi Crimson:** `#A13333` (undo button, error states)
- **Al-Jass White:** `#F9F7F3` (button text)
- **Desert Ochre:** `#D58C4A` (high severity badge)
- **Camel Hair Beige:** `#D1BBA3` (card backgrounds)

---

## Document Metadata

**Created:** 2025-01-15
**Author:** Claude (Anthropic)
**Component Version:** ActivityLogDashboard.js (as of migration 20251015050000)
**Backend RPC Pass Rate:** 93.75% (15/16 tests passing)
**Target Platform:** iOS 14+, Android 10+
**Test Duration:** ~90 minutes for full manual suite
**Last Updated:** 2025-01-15

---

**End of Manual Test Plan**
