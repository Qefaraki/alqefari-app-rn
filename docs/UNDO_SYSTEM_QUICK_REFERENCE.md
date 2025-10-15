# Undo System - Quick Reference Card

**For QA Testers | React Native Mobile App | iOS/Android**

---

## 🎯 What You're Testing

The **Activity Log Dashboard** undo functionality - allows users to revert profile changes, deletions, and admin operations.

**Component:** `src/screens/admin/ActivityLogDashboard.js`
**Test Duration:** ~90 minutes for full suite
**Platform:** iOS Simulator (primary), Physical Device (recommended for haptics)

---

## 📱 How to Access

1. Open app → **Admin Dashboard**
2. Scroll to **Quick Actions**
3. Tap **"سجل النشاط"** (Activity Log)
4. Look for activity entries with red **"تراجع"** (Undo) button

---

## ✅ Quick Checklist (Essential Tests)

### 1. Happy Path (5 minutes)
- [ ] Edit your profile (change bio)
- [ ] Open Activity Log
- [ ] Tap **تراجع** on newest entry
- [ ] ✅ Success toast appears: "✓ تم التراجع بنجاح"
- [ ] ✅ Profile reverted to old value
- [ ] ✅ Undo button disappears

### 2. Permission Check (3 minutes)
- [ ] Log in as regular user
- [ ] Find admin's edit on your profile
- [ ] ✅ Undo button should NOT appear
- [ ] Open details sheet
- [ ] ✅ No undo button in sheet either

### 3. Error Handling (5 minutes)
- [ ] Edit profile twice (Version 1 → Version 2)
- [ ] Undo Version 1 (skipping Version 2)
- [ ] ✅ Error: "توجد تغييرات أحدث..."
- [ ] ✅ Page auto-refreshes after 2 seconds
- [ ] Undo Version 2 first, then Version 1
- [ ] ✅ Both succeed

### 4. Already Undone (2 minutes)
- [ ] Undo an action successfully
- [ ] Refresh activity log
- [ ] ✅ Undo button gone from original entry
- [ ] ⚠️ **BUG:** No "تم التراجع" badge shown (known issue)

### 5. Dangerous Action (Admin Only - 3 minutes)
- [ ] Log in as admin
- [ ] Perform cascade delete (if available)
- [ ] Open Activity Log
- [ ] Find cascade delete entry
- [ ] ✅ Red badge shows "حرج" (Critical)
- [ ] Tap undo
- [ ] ⚠️ **BUG:** No confirmation dialog (should ask "هل تريد المتابعة؟")

---

## 🚨 What to Report as Bugs

### Visual Issues
- Undo button not appearing when it should (check `is_undoable = true` in DB)
- Undo button appearing when it shouldn't (after `undone_at` is set)
- Wrong colors (should be crimson #A13333)
- Button not positioned on RIGHT side (RTL issue)
- Toast not appearing or wrong color/message

### Functional Issues
- Undo fails with error (note exact error message in Arabic)
- Profile data not reverted correctly
- Activity log not refreshing after undo
- App crashes or freezes during undo
- Version conflict not detected (when editing between undo)

### UX Issues
- No feedback during undo operation (loading spinner missing - known issue)
- Details sheet doesn't close after undo (known issue)
- Toast doesn't auto-dismiss after 3 seconds
- No haptic feedback on iOS (minor - not critical)

---

## 🔍 What to Screenshot

1. **Undo button appearance** (before tap)
2. **Success toast** (green, checkmark icon)
3. **Error toast** (red, alert icon)
4. **Dangerous badge** (red "حرج" label)
5. **Activity list after undo** (showing new undo entry)
6. **Any crashes or unexpected behavior**

Save screenshots with naming: `undo_[feature]_[result].png`
Example: `undo_profile_update_success.png`

---

## 📊 Expected Behaviors (Paste this in bug reports)

| Test | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Undo button visibility | Shows when `is_undoable = true` | | ☐ |
| Success toast | "✓ تم التراجع بنجاح" for 3 seconds | | ☐ |
| Profile reversion | Data reverts to old value | | ☐ |
| Version conflict | Shows error + auto-refresh | | ☐ |
| Permission denied | No undo button visible | | ☐ |
| Time limit (31+ days) | No undo button (regular user) | | ☐ |
| Already undone | Button disappears after undo | | ☐ |
| Network error | "خطأ في الاتصال..." message | | ☐ |
| Dangerous action | Confirmation dialog (⚠️ not implemented) | | ☐ |

---

## 🎨 Visual Reference

### Undo Button (Normal)
```
┌──────────────────────────┐
│  ↩️  تراجع               │ ← Red text (#A13333)
└──────────────────────────┘
    ↑ Light red background
```

### Dangerous Badge
```
┌──────────────────────────────────┐
│ 🔴 Activity Name                 │
│ ⚠️ حرج | 2 دقائق                │ ← Red "حرج" badge
└──────────────────────────────────┘
```

### Success Toast
```
┌────────────────────────────────┐
│ ✓  تم التراجع بنجاح           │ ← Green background
└────────────────────────────────┘
     ↑ Checkmark icon
```

### Error Toast
```
┌────────────────────────────────┐
│ ⚠️  توجد تغييرات أحدث...       │ ← Red background
└────────────────────────────────┘
     ↑ Alert icon
```

---

## 🛠 Test Data Setup (For QA Lead)

### Database Query to Create Test Entry
```sql
-- Create undoable profile update
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
  '<test_profile_id>',
  '<test_user_id>',
  true,
  '{"bio": "Original Bio"}',
  '{"bio": "Updated Bio"}',
  NOW()
);
```

### Database Query to Check Undo Permission
```sql
SELECT * FROM check_undo_permission(
  '<audit_log_id>',  -- From activity log entry
  '<user_profile_id>' -- Current logged-in user's profile ID
);
-- Returns: {can_undo: boolean, reason: string}
```

---

## 🚀 Quick Smoke Test (2 minutes)

**Before each testing session, run this:**

1. Log in as regular user
2. Edit your bio: "Test 1"
3. Edit again: "Test 2"
4. Open Activity Log
5. Undo "Test 2" change
6. ✅ Bio should revert to "Test 1"
7. ✅ Toast shows success
8. ✅ Activity log refreshes

**If this fails, STOP and report immediately.**

---

## 📝 Bug Report Template

```
**Bug Title:** [Short description]

**Severity:** [Critical/High/Medium/Low]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [Third step]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Screenshots:**
[Attach screenshots]

**Device Info:**
- Platform: iOS/Android
- Device: iPhone 14 Pro / Pixel 7
- OS Version: iOS 17.2 / Android 13
- App Version: [Check settings]

**Console Logs:**
[Paste any relevant error messages from Xcode/Metro console]

**Additional Notes:**
[Any other relevant information]
```

---

## 🔑 Key Terminology

| Arabic | English | Meaning |
|--------|---------|---------|
| تراجع | Undo | The action of reverting a change |
| سجل النشاط | Activity Log | Dashboard showing all user actions |
| حرج | Critical | Dangerous operation (cascade delete) |
| عالي | High | High-severity action |
| تم التراجع | Already Undone | Action has been reverted |
| المصفيات | Filters | Filter controls in activity log |

---

## ⚡ Common Issues & Solutions

### Issue: "Undo button not appearing"
**Check:**
1. Is `is_undoable = true` in database?
2. Is `undone_at` still NULL?
3. Does user have permission? (check with permission query above)
4. Is action within time limit? (30 days for users, unlimited for admins)

### Issue: "Undo fails with error"
**First Steps:**
1. Screenshot the exact error message (in Arabic)
2. Check console logs for stack trace
3. Note the action type (profile_update, profile_delete, etc.)
4. Verify network connection (Airplane mode test)

### Issue: "Profile not reverting"
**Debug:**
1. Check if undo actually succeeded (look for new undo entry in activity log)
2. Refresh the profile page manually
3. Check console for "[ActivityLogDashboard] Profile refreshed after undo" log
4. Verify version increment in console logs

---

## 📞 Who to Contact

- **UI Bugs:** Frontend team (screenshots required)
- **Permission Issues:** Backend team (include user IDs and audit log IDs)
- **Database Queries:** DevOps team (include SQL and error messages)
- **Urgent Production Issues:** Escalate immediately to tech lead

---

## 🎓 Training Tips

### For New Testers:
1. **Start with Happy Path:** Get comfortable with basic undo flow first
2. **Learn the Arabic Terms:** Understand what each UI label means
3. **Use Real Data Carefully:** Don't undo production data unless authorized
4. **Document Everything:** Screenshots and console logs are your friends
5. **Test on Physical Device:** Haptics and performance differ from simulator

### Time-Saving Shortcuts:
- **⌘ + R** (Simulator): Reload app quickly
- **⌘ + K** (Metro): Clear console
- **Pull to Refresh:** Reload activity log without reopening
- **Filter by User:** Test specific user's actions only

---

## 📚 Related Docs

- **Full Test Plan:** `UNDO_SYSTEM_UI_TEST_PLAN.md` (90-minute detailed guide)
- **Analysis Report:** `UNDO_SYSTEM_UI_ANALYSIS.md` (bugs, recommendations, security)
- **Backend Tests:** `UNDO_SYSTEM_TEST_CHECKLIST.md` (RPC function tests - 93.75% pass)
- **Design System:** `DESIGN_SYSTEM.md` (Najdi Sadu colors and spacing)

---

**Last Updated:** 2025-01-15
**Version:** 1.0
**Status:** Ready for Testing
