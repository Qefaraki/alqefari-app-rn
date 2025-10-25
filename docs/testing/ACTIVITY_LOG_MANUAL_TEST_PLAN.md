# Activity Log & Undo System - Comprehensive Manual Test Plan

**Test Date**: _____________
**Tester**: _____________
**Device**: iPhone ___ (iOS Version: ___)
**App Version**: _____________

---

## 🎯 Test Objective

Verify that the Activity Log dashboard and Undo system function correctly with proper pagination, filtering, undo capabilities, and error handling.

**Total Test Cases**: 105
**Estimated Time**: 2-3 hours
**Pass Criteria**: 95%+ pass rate (max 5 failures)

---

## 📋 Pre-Test Setup

### Prerequisites
- [ ] Fresh app install (or clear AsyncStorage)
- [ ] Logged in as admin or moderator user
- [ ] Network connection stable (WiFi recommended)
- [ ] Device has >1GB free RAM
- [ ] Screen recording enabled (optional, for bug documentation)

### Test Data
- [ ] Ensure 200+ activities in the database
- [ ] Have both individual and batch operations
- [ ] Include recent activities (today, yesterday, this week)
- [ ] Mix of different action types (create, update, delete, marriage)

### Navigation
1. Open app → Admin Dashboard → Activity Log
2. Should see loading skeleton, then list of recent activities

---

## Section A: PAGINATION TESTING (15 scenarios)

### A.1: Initial Load
- [ ] **A.1.1** App loads Activity Log
  - **Expected**: Skeleton loader visible
  - **Then**: 50 activities displayed after 1-2 seconds
  - **Verify**: Page shows "عرض 50 من XXX نتيجة" at footer
  - **Pass**: ___

- [ ] **A.1.2** Timestamp shows latest activity
  - **Expected**: Header shows "آخر تحديث [relative time]"
  - **Verify**: Time is recent (within last hour)
  - **Pass**: ___

### A.2: Infinite Scroll & Load More
- [ ] **A.2.1** Scroll to bottom naturally
  - **Action**: Scroll SectionList to bottom
  - **Expected**: "جاري التحميل..." spinner appears
  - **Then**: 50 more items load (100 total now)
  - **Verify**: Footer updates to "عرض 100 من XXX نتيجة"
  - **Pass**: ___

- [ ] **A.2.2** Manual Load More button click
  - **Action**: Stop scrolling before end reached
  - **Expected**: "تحميل المزيد" button visible with count
  - **Action**: Tap button
  - **Expected**: Spinner shows, then 50 more load
  - **Pass**: ___

- [ ] **A.2.3** Throttling prevents duplicate loads
  - **Action**: Rapidly scroll to trigger load more twice
  - **Expected**: Only one request made (not 2)
  - **Verify**: Check network logs / console
  - **Pass**: ___

- [ ] **A.2.4** End of list message
  - **Action**: Keep loading until no more results
  - **Expected**: Footer shows "لا توجد نتائج أخرى"
  - **And**: "تم عرض جميع XXX نتيجة"
  - **Pass**: ___

### A.3: Pagination with Filters
- [ ] **A.3.1** Filter change resets pagination
  - **Action**: Load 150 items, apply category filter "tree"
  - **Expected**: Back to first page (50 items)
  - **Verify**: Total count changes to filtered amount
  - **Pass**: ___

- [ ] **A.3.2** Multiple filters maintain pagination
  - **Action**: Apply 2-3 filters (category, severity, user)
  - **Expected**: Pagination works with filtered results
  - **Verify**: Load more button still functions
  - **Pass**: ___

- [ ] **A.3.3** Date range changes pagination
  - **Action**: Select "اليوم" (today only)
  - **Expected**: Shows only today's activities
  - **Verify**: Total count lower than before
  - **Pass**: ___

### A.4: Edge Cases
- [ ] **A.4.1** Empty results pagination
  - **Action**: Apply filter with no matching results
  - **Expected**: Empty state shows, no pagination footer
  - **Verify**: No errors in console
  - **Pass**: ___

- [ ] **A.4.2** Single page of results (< 50 items)
  - **Setup**: Use date filter to get <50 items
  - **Expected**: "تحميل المزيد" button doesn't appear
  - **Verify**: Footer shows "لا توجد نتائج أخرى"
  - **Pass**: ___

- [ ] **A.4.3** Exactly 50 items
  - **Setup**: Filter to get exactly 50 items
  - **Expected**: Load more button appears
  - **Action**: Click it
  - **Expected**: No more items load
  - **Pass**: ___

### A.5: Performance
- [ ] **A.5.1** Scroll performance smooth
  - **Action**: Scroll through 200+ items rapidly
  - **Expected**: Smooth 60fps scrolling
  - **Verify**: No stutters or jank
  - **Pass**: ___

- [ ] **A.5.2** Load more doesn't block UI
  - **Action**: Trigger load more, then start scrolling
  - **Expected**: Scroll remains smooth during load
  - **Verify**: No frozen UI
  - **Pass**: ___

---

## Section B: UNDO SYSTEM TESTING (40 scenarios)

### B.1: Undo Visibility & Permissions

- [ ] **B.1.1** Undo button visible on activity row
  - **Action**: View recent "profile_update" activity
  - **Expected**: "تراجع" button appears on right
  - **Pass**: ___

- [ ] **B.1.2** Undo button hidden for already undone action
  - **Setup**: Find activity with "تم التراجع" badge
  - **Expected**: No undo button visible
  - **Verify**: Badge shows status clearly
  - **Pass**: ___

- [ ] **B.1.3** Undo button hidden for non-undoable actions
  - **Setup**: View "suggestion_rejected" or "marriage_update"
  - **Expected**: No undo button appears
  - **Pass**: ___

- [ ] **B.1.4** Permission check on click
  - **Action**: Try to undo as non-admin on others' actions
  - **Expected**: Error: "ليس لديك صلاحية للتراجع عن هذا الإجراء"
  - **Pass**: ___

### B.2: Undo for Non-Dangerous Actions

- [ ] **B.2.1** Simple text field undo
  - **Setup**: Find "profile_update" action (name change)
  - **Action**: Click undo button
  - **Expected**: No confirmation dialog (non-dangerous)
  - **And**: Loading spinner appears on button
  - **Then**: Success toast: "تم التراجع بنجاح"
  - **Then**: Activity list refreshes
  - **Pass**: ___

- [ ] **B.2.2** Verify undo actually restored value
  - **Action**: Navigate to affected profile
  - **Expected**: Field has old value restored
  - **Verify**: New value is gone
  - **Pass**: ___

- [ ] **B.2.3** Marriage delete undo (non-dangerous)
  - **Setup**: Find "marriage_soft_delete" action
  - **Action**: Click undo
  - **Expected**: Direct execution (no confirmation)
  - **And**: Success message shows
  - **Verify**: Marriage reappears in profile
  - **Pass**: ___

### B.3: Undo for Dangerous Actions

- [ ] **B.3.1** Cascade delete shows confirmation
  - **Setup**: Find "profile_cascade_delete" action
  - **Action**: Click undo button
  - **Expected**: Alert shows: "تأكيد التراجع"
  - **And**: Message explains: "هذا إجراء حساس"
  - **And**: Shows which profile(s) will be restored
  - **Pass**: ___

- [ ] **B.3.2** Cancel dangerous undo
  - **Action**: Confirm dialog appears, tap "إلغاء"
  - **Expected**: Dialog closes, nothing happens
  - **Verify**: Undo not executed
  - **Pass**: ___

- [ ] **B.3.3** Confirm dangerous undo
  - **Action**: Dialog appears, tap "تأكيد التراجع"
  - **Expected**: Loading spinner on button
  - **Then**: Success toast
  - **Then**: List refreshes showing undo
  - **And**: Navigate to profile → should be restored
  - **Pass**: ___

- [ ] **B.3.4** Add marriage undo (dangerous)
  - **Setup**: Find "add_marriage" action
  - **Action**: Click undo
  - **Expected**: Confirmation dialog (dangerous operation)
  - **Action**: Confirm
  - **Expected**: Marriage deleted
  - **Pass**: ___

### B.4: Undo Time Limits

- [ ] **B.4.1** Recent action shows remaining time
  - **Setup**: Find action from today
  - **Action**: Expand bottom sheet details
  - **Expected**: Shows "متبقي XX يوم" or "متبقي XX ساعة"
  - **Pass**: ___

- [ ] **B.4.2** Admin has unlimited undo
  - **Setup**: As admin, find action from 60+ days ago
  - **Expected**: Undo still available
  - **Verify**: Shows "غير محدود (مدير)" or similar
  - **Pass**: ___

- [ ] **B.4.3** Regular user cannot undo after 30 days
  - **Setup**: As regular user, find action from 31 days ago
  - **Expected**: Undo button disabled or hidden
  - **And**: Shows "انتهت مدة التراجع عن هذا الإجراء"
  - **Pass**: ___

- [ ] **B.4.4** Undo button disabled during cooldown
  - **Action**: Click undo button
  - **Expected**: Button disabled (loading state)
  - **Verify**: Cannot click again during load
  - **Pass**: ___

### B.5: Error Handling

- [ ] **B.5.1** Network error during undo
  - **Setup**: Turn off network
  - **Action**: Try to undo
  - **Expected**: Error toast: "خطأ في الاتصال"
  - **Verify**: Activity not marked as undone
  - **Pass**: ___

- [ ] **B.5.2** Version conflict (profile updated)
  - **Setup**: Find old update, update profile separately
  - **Action**: Try to undo old update
  - **Expected**: Error: "توجد تغييرات أحدث"
  - **And**: Message suggests: "قم بالتراجع عن التغييرات الأحدث أولاً"
  - **Pass**: ___

- [ ] **B.5.3** Already undone error
  - **Setup**: Find activity that's already undone
  - **Action**: Try to undo again (if button still visible)
  - **Expected**: Error: "تم التراجع عن هذا الإجراء بالفعل"
  - **Pass**: ___

- [ ] **B.5.4** Permission denied
  - **Setup**: As regular user, try to undo admin action
  - **Expected**: Error: "ليس لديك صلاحية"
  - **And**: Activity not affected
  - **Pass**: ___

- [ ] **B.5.5** Profile not found
  - **Setup**: Undo delete of profile, then navigate
  - **Expected**: Restored profile appears
  - **Verify**: Can navigate to it
  - **Pass**: ___

### B.6: Undo Success States

- [ ] **B.6.1** Success toast shows correct message
  - **Action**: Undo any action
  - **Expected**: Toast: "تم التراجع بنجاح" (or action-specific)
  - **Verify**: Toast duration 2-3 seconds
  - **Pass**: ___

- [ ] **B.6.2** Activity marked as undone
  - **Action**: Scroll back to undone activity
  - **Expected**: Shows "تم التراجع" badge
  - **And**: Undo button no longer visible
  - **Pass**: ___

- [ ] **B.6.3** Tree updates after undo
  - **Setup**: Undo profile creation
  - **Action**: Close Activity Log, go to Tree
  - **Expected**: Profile no longer in tree
  - **Pass**: ___

- [ ] **B.6.4** Multiple undos in sequence
  - **Action**: Undo 3 different activities back-to-back
  - **Expected**: All succeed
  - **Verify**: List shows all as "تم التراجع"
  - **Pass**: ___

### B.7: Batch Operation Undo

- [ ] **B.7.1** Batch operation card visible
  - **Setup**: View batch operation (10+ operations)
  - **Expected**: "عملية جماعية" card with count
  - **Verify**: Can expand to see individual operations
  - **Pass**: ___

- [ ] **B.7.2** Undo all in batch
  - **Action**: Click undo on batch card
  - **Expected**: Confirmation shows count
  - **Then**: All operations undone
  - **Verify**: All marked "تم التراجع"
  - **Pass**: ___

- [ ] **B.7.3** Partial undo of batch
  - **Setup**: One operation in batch already undone
  - **Expected**: Shows partial undo state
  - **Verify**: Accurate count shown
  - **Pass**: ___

---

## Section C: FILTERING TESTING (25 scenarios)

### C.1: Category Filtering

- [ ] **C.1.1** "الجميع" shows all activities
  - **Action**: Apply "الجميع" filter
  - **Expected**: Shows all action types
  - **Pass**: ___

- [ ] **C.1.2** "الشجرة" filters to profile actions
  - **Action**: Apply "الشجرة" filter
  - **Expected**: Shows only: profile_create, profile_update, etc.
  - **Verify**: No marriage or photo actions
  - **Pass**: ___

- [ ] **C.1.3** "الأزواج" filters to marriage actions
  - **Action**: Apply "الأزواج" filter
  - **Expected**: Shows only marriage-related activities
  - **Pass**: ___

- [ ] **C.1.4** "الصور" filters to photo actions
  - **Action**: Apply "الصور" filter
  - **Expected**: Shows only: upload_photo, update_photo, delete_photo
  - **Pass**: ___

- [ ] **C.1.5** "الإدارة" filters to admin actions
  - **Action**: Apply "الإدارة" filter
  - **Expected**: Shows only: grant_admin, revoke_admin, update_settings
  - **Pass**: ___

### C.2: Severity Filtering

- [ ] **C.2.1** "كل المستويات" shows all
  - **Action**: Apply severity "كل المستويات"
  - **Expected**: Shows all severities
  - **Pass**: ___

- [ ] **C.2.2** "عالي" shows high + critical
  - **Action**: Apply "عالي" filter
  - **Expected**: Shows activities with severity high or critical
  - **Verify**: No normal severity actions
  - **Pass**: ___

- [ ] **C.2.3** "حرج" shows only critical
  - **Action**: Apply "حرج" filter
  - **Expected**: Shows only critical severity
  - **Pass**: ___

- [ ] **C.2.4** Severity badge visible
  - **Action**: View filtered activities
  - **Expected**: Red/orange badge shows severity level
  - **Pass**: ___

### C.3: Date Range Filtering

- [ ] **C.3.1** "اليوم" shows only today's activities
  - **Action**: Apply "اليوم" preset
  - **Expected**: Shows only activities from today
  - **Verify**: Time range correct (00:00 - 23:59)
  - **Pass**: ___

- [ ] **C.3.2** "أمس" shows yesterday's activities
  - **Action**: Apply "أمس" preset
  - **Expected**: Shows yesterday's activities only
  - **Pass**: ___

- [ ] **C.3.3** "الأسبوع" shows week's activities
  - **Action**: Apply "الأسبوع" preset
  - **Expected**: Shows last 7 days
  - **Verify**: Includes today and past 6 days
  - **Pass**: ___

- [ ] **C.3.4** "الشهر" shows month's activities
  - **Action**: Apply "الشهر" preset
  - **Expected**: Shows current month
  - **Pass**: ___

- [ ] **C.3.5** Custom date range
  - **Action**: Select custom date range (e.g., Oct 15-20)
  - **Expected**: Shows only activities in that range
  - **Verify**: Start and end dates applied correctly
  - **Pass**: ___

### C.4: User Filtering

- [ ] **C.4.1** Filter by specific user
  - **Action**: Select a user from user filter modal
  - **Expected**: Shows only activities by that user
  - **Verify**: All actor names are the selected user
  - **Pass**: ___

- [ ] **C.4.2** User filter combines with others
  - **Action**: Apply user + category filters together
  - **Expected**: Shows activities by user AND in category
  - **Pass**: ___

- [ ] **C.4.3** Clear user filter
  - **Action**: Select another user, then clear
  - **Expected**: Shows all users again
  - **Pass**: ___

### C.5: Combined Filters

- [ ] **C.5.1** Multiple filters combine correctly
  - **Action**: Apply category + severity + date
  - **Expected**: Respects all filters (AND logic)
  - **Verify**: Count decreases appropriately
  - **Pass**: ___

- [ ] **C.5.2** Filters reset when changed
  - **Action**: Apply filters, then change one
  - **Expected**: Pagination resets to page 1
  - **And**: New results shown
  - **Pass**: ___

- [ ] **C.5.3** Filter count badge shows
  - **Action**: Apply 2+ filters
  - **Expected**: Filter button shows count badge "3+"
  - **Pass**: ___

### C.6: Search Functionality

- [ ] **C.6.1** Search by actor name
  - **Action**: Type name in search
  - **Expected**: Shows activities by that actor
  - **Verify**: Case-insensitive
  - **Pass**: ___

- [ ] **C.6.2** Search by phone number
  - **Action**: Type phone number
  - **Expected**: Shows activities related to that phone
  - **Pass**: ___

- [ ] **C.6.3** Search by description
  - **Action**: Type partial description
  - **Expected**: Shows matching activities
  - **Pass**: ___

- [ ] **C.6.4** Search clearing
  - **Action**: Type search, then clear
  - **Expected**: All activities shown again
  - **Pass**: ___

---

## Section D: DETAIL VIEW TESTING (15 scenarios)

### D.1: Activity Details

- [ ] **D.1.1** Bottom sheet opens
  - **Action**: Tap any activity row
  - **Expected**: Bottom sheet slides up with details
  - **Verify**: Smooth animation
  - **Pass**: ___

- [ ] **D.1.2** What changed section
  - **Expected**: Shows each changed field
  - **And**: Shows "قبل" (before) and "بعد" (after) values
  - **Pass**: ___

- [ ] **D.1.3** Who did it section
  - **Expected**: Shows actor name with profile link
  - **Verify**: Name chain complete
  - **Pass**: ___

- [ ] **D.1.4** Navigate to profile
  - **Action**: Tap profile name in details
  - **Expected**: Navigates to profile page
  - **Pass**: ___

- [ ] **D.1.5** Timestamp display
  - **Expected**: Shows both relative and absolute time
  - **Verify**: Timezone correct
  - **Pass**: ___

### D.2: Advanced Details

- [ ] **D.2.1** Open advanced details
  - **Action**: Tap "معلومات متقدمة" button
  - **Expected**: Modal opens with full JSON
  - **Pass**: ___

- [ ] **D.2.2** JSON display
  - **Expected**: Shows old_data and new_data
  - **Verify**: Properly formatted and readable
  - **Pass**: ___

- [ ] **D.2.3** Advanced details scrollable
  - **Action**: Scroll in advanced modal
  - **Expected**: JSON content scrolls
  - **Pass**: ___

### D.3: Close Behavior

- [ ] **D.3.1** Swipe down to close
  - **Action**: Swipe down on bottom sheet
  - **Expected**: Sheet closes smoothly
  - **Pass**: ___

- [ ] **D.3.2** Tap outside to close
  - **Action**: Tap dark area outside sheet
  - **Expected**: Sheet closes
  - **Pass**: ___

- [ ] **D.3.3** Tap close button (if present)
  - **Action**: Tap X or close button
  - **Expected**: Sheet closes
  - **Pass**: ___

---

## Section E: EMPTY STATES & ERROR HANDLING (10 scenarios)

### E.1: Empty States

- [ ] **E.1.1** No activities
  - **Setup**: Filter to get zero results
  - **Expected**: "لا توجد نشاطات في هذا النطاق"
  - **And**: Icon and reset button shown
  - **Pass**: ___

- [ ] **E.1.2** Empty filter message
  - **Expected**: Suggests changing filters
  - **Verify**: Reset button works
  - **Pass**: ___

### E.2: Error States

- [ ] **E.2.1** Network error on initial load
  - **Setup**: Turn off network
  - **Action**: Refresh page
  - **Expected**: Error message with retry button
  - **Pass**: ___

- [ ] **E.2.2** Error recovery
  - **Action**: Turn on network, tap retry
  - **Expected**: Data loads successfully
  - **Pass**: ___

- [ ] **E.2.3** Timeout handling
  - **Setup**: Slow network (throttle to 2G)
  - **Action**: Load activities
  - **Expected**: Loading > 5s, then timeout error
  - **Verify**: Error message clear
  - **Pass**: ___

---

## Section F: RTL & LOCALIZATION (5 scenarios)

### F.1: Arabic UI

- [ ] **F.1.1** All text in Arabic
  - **Expected**: All labels, buttons, messages in Arabic
  - **Verify**: No English text visible
  - **Pass**: ___

- [ ] **F.1.2** RTL layout correct
  - **Expected**: Buttons on left, content flows right-to-left
  - **Verify**: No left-aligned elements on right side
  - **Pass**: ___

- [ ] **F.1.3** Numerals in Arabic format (optional)
  - **Expected**: Counts show in Arabic numerals (if enabled)
  - **Pass**: ___

- [ ] **F.1.4** Names with Arabic characters
  - **Expected**: Proper text rendering for names with ي, ع, ر, etc.
  - **Verify**: No character corruption
  - **Pass**: ___

- [ ] **F.1.5** Date formatting
  - **Expected**: Dates show in Arabic (e.g., "٢٥ أكتوبر")
  - **Pass**: ___

---

## Section G: PERFORMANCE TESTING (5 scenarios)

### G.1: Performance Metrics

- [ ] **G.1.1** Initial load time < 2 seconds
  - **Measure**: Skeleton shows → first 50 items visible
  - **Pass**: ___

- [ ] **G.1.2** Load more time < 1 second
  - **Measure**: Tap "تحميل المزيد" → 50 items appear
  - **Pass**: ___

- [ ] **G.1.3** Smooth scrolling 60fps
  - **Action**: Scroll through 200+ items rapidly
  - **Verify**: No dropped frames or stuttering
  - **Pass**: ___

- [ ] **G.1.4** Filter apply < 500ms
  - **Measure**: Tap filter → list updates
  - **Pass**: ___

- [ ] **G.1.5** Memory usage stable
  - **Monitor**: RAM usage while loading 500+ items
  - **Verify**: Doesn't exceed 50MB for list data
  - **Pass**: ___

---

## 📊 Test Summary

### Test Results

| Section | Total | Passed | Failed | Pass Rate |
|---------|-------|--------|--------|-----------|
| A. Pagination | 15 | ___ | ___ | ___% |
| B. Undo System | 40 | ___ | ___ | ___% |
| C. Filtering | 25 | ___ | ___ | ___% |
| D. Detail View | 15 | ___ | ___ | ___% |
| E. Errors | 10 | ___ | ___ | ___% |
| F. RTL/i18n | 5 | ___ | ___ | ___% |
| G. Performance | 5 | ___ | ___ | ___% |
| **TOTAL** | **115** | **___** | **___** | **___**% |

### Critical Issues Found

| # | Section | Description | Severity | Fix Status |
|---|---------|-------------|----------|-----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### Nice-to-Have Improvements

- [ ] Add haptic feedback on button taps
- [ ] Animated section headers
- [ ] Swipe actions on rows (e.g., swipe to undo)
- [ ] Keyboard shortcuts for power users

---

## Sign-Off

**Tester Signature**: _________________ **Date**: _________

**Reviewer Signature**: _________________ **Date**: _________

---

## Appendix: Quick Reference

### Common Test Failures & Solutions

**Issue**: "تحميل المزيد" not appearing
- **Fix**: Check `hasMore` state, verify total > 50
- **Debug**: Console log in onEndReached callback

**Issue**: Undo fails with version error
- **Cause**: Profile updated between audit log creation and undo attempt
- **Fix**: User should undo newer changes first (reverse order)

**Issue**: Search doesn't work
- **Cause**: Debounce timeout (500ms) not elapsed
- **Fix**: Wait half second after typing before verifying

**Issue**: Bottom sheet won't close
- **Fix**: Swipe down more forcefully, or tap outside area
- **Debug**: Check if modal is blocking interaction

**Issue**: Pagination resets unexpectedly
- **Cause**: Filter changed while loading
- **Fix**: Don't change filters during pagination load

