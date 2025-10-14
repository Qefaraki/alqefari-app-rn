# Undo System - Manual Testing Checklist

**Version**: 1.0
**Date**: 2025-10-15
**Status**: ✅ Deployed and Ready for Testing

---

## 📋 Pre-Testing Setup

### Database Verification
- [x] All 5 undo functions exist in database
  - `check_undo_permission` ✅
  - `undo_profile_update` ✅
  - `undo_profile_delete` ✅
  - `undo_cascade_delete` ✅
  - `undo_marriage_create` ✅
- [x] Action types are standardized (lowercase_underscore format)
  - `profile_update` ✅
  - `profile_soft_delete` ✅
  - `profile_cascade_delete` ✅
  - `add_marriage` ✅
- [x] `audit_log_enhanced` table has undo columns
  - `undone_at` (timestamp)
  - `undone_by` (uuid)
  - `undo_reason` (text)
  - `is_undoable` (boolean)
  - `undo_blocked_reason` (text)

### Test Accounts Required
- [ ] **Admin Account** (role: `admin` or `super_admin`)
- [ ] **Regular User Account** (role: `user`)
- [ ] **Test Profile** (for making changes)

---

## 🧪 Test Cases

### 1. Profile Update - Regular User

**Setup**:
1. Log in as regular user
2. Open a profile you have permission to edit (self, child, spouse, etc.)
3. Make a simple change (e.g., update phone number)

**Tests**:
- [ ] Change appears in Activity Log Dashboard
- [ ] Undo button visible on activity row (refresh if needed)
- [ ] Dangerous badge NOT shown (profile_update is not dangerous)
- [ ] Click undo button
- [ ] NO confirmation dialog (profile_update is safe)
- [ ] Success alert appears
- [ ] Activity log refreshes
- [ ] Original value is restored in profile
- [ ] Activity row shows as undone (no undo button)

**Edge Cases**:
- [ ] Try to undo after 30 days (should fail with "انتهت صلاحية التراجع")
- [ ] Try to undo same action twice (should fail with "تم التراجع عن هذا الإجراء بالفعل")

---

### 2. Profile Soft Delete - Regular User

**Setup**:
1. Log in as regular user (admin mode)
2. Create a test profile (child or sibling)
3. Soft delete the profile

**Tests**:
- [ ] Delete action appears in Activity Log
- [ ] Undo button visible
- [ ] Dangerous badge NOT shown (soft delete is not dangerous)
- [ ] Click undo button
- [ ] NO confirmation dialog
- [ ] Success alert appears
- [ ] Profile is restored (no longer soft deleted)
- [ ] Activity shows as undone

**Edge Cases**:
- [ ] Verify 30-day time limit applies
- [ ] Try undoing after profile was hard-deleted (should fail gracefully)

---

### 3. Profile Cascade Delete - Admin Only

**Setup**:
1. Log in as admin
2. Create a parent profile with 2-3 children
3. Perform cascade delete on parent

**Tests**:
- [ ] Cascade delete action appears in Activity Log
- [ ] Undo button visible ONLY for admin (not regular users)
- [ ] Dangerous badge IS shown (⚠️ warning icon)
- [ ] Click undo button
- [ ] Confirmation dialog appears: "هذه عملية خطرة: حذف متعدد. هل أنت متأكد من التراجع؟"
- [ ] Click "تأكيد" (confirm)
- [ ] Success alert appears
- [ ] All profiles restored (parent + all descendants)
- [ ] Activity shows as undone

**Edge Cases**:
- [ ] Regular user should NOT see undo button for cascade delete
- [ ] Verify admin has unlimited time (no 30-day limit)
- [ ] Try undoing cascade delete with 100+ descendants (should work, but verify performance)

---

### 4. Add Marriage - Admin Only

**Setup**:
1. Log in as admin
2. Create a marriage between two test profiles

**Tests**:
- [ ] Marriage creation appears in Activity Log
- [ ] Undo button visible ONLY for admin
- [ ] Dangerous badge IS shown (⚠️)
- [ ] Click undo button
- [ ] Confirmation dialog appears: "هذه عملية خطرة: إضافة زواج. هل أنت متأكد من التراجع؟"
- [ ] Click "تأكيد"
- [ ] Success alert appears
- [ ] Marriage record deleted from `marriages` table
- [ ] Activity shows as undone

**Edge Cases**:
- [ ] Regular user should NOT see undo button
- [ ] Admin has unlimited time window
- [ ] Undoing marriage doesn't cascade-delete children (verify safety)

---

### 5. Permission Checks

**Test Matrix**:

| User Role | Action Type | Expected Behavior |
|-----------|-------------|-------------------|
| Regular User | `profile_update` (own action) | ✅ Can undo (30 days) |
| Regular User | `profile_update` (other's action) | ❌ Cannot undo |
| Regular User | `profile_cascade_delete` | ❌ No undo button shown |
| Regular User | `add_marriage` | ❌ No undo button shown |
| Admin | `profile_update` (any action) | ✅ Can undo (unlimited) |
| Admin | `profile_cascade_delete` | ✅ Can undo (unlimited) |
| Admin | `add_marriage` | ✅ Can undo (unlimited) |

**Tests**:
- [ ] Regular user cannot undo another user's profile_update
- [ ] Admin can undo ANY profile_update (even from other admins)
- [ ] Admin can undo dangerous operations (cascade delete, marriage)
- [ ] Regular user never sees undo button for dangerous operations

---

### 6. Time Limits

**Regular User (30-day limit)**:
- [ ] Action created TODAY → Undo works
- [ ] Action created 29 days ago → Undo works
- [ ] Action created 31 days ago → Undo fails with "انتهت صلاحية التراجع"

**Admin (Unlimited)**:
- [ ] Action created 60 days ago → Admin can still undo
- [ ] Action created 180 days ago → Admin can still undo

**Note**: To test old actions, use SQL to manually backdate `created_at`:
```sql
UPDATE audit_log_enhanced
SET created_at = created_at - INTERVAL '31 days'
WHERE id = 'your-test-audit-id';
```

---

### 7. UI/UX Verification

**Activity Log Dashboard**:
- [ ] Undo button appears to the right of activity row
- [ ] Undo button is red (#A13333)
- [ ] Loading spinner shows during undo operation
- [ ] Success toast notification appears after undo
- [ ] Activity log auto-refreshes after undo
- [ ] Undone activities show NO undo button
- [ ] Dangerous badge (⚠️) appears for dangerous actions

**Visual States**:
- [ ] Undo button: `arrow-undo-outline` icon, 18px, red
- [ ] Loading state: ActivityIndicator, red
- [ ] Dangerous badge: Warning icon, orange/red background
- [ ] Touch target: 44x44px minimum (accessibility)

---

### 8. Error Handling

**Test Error Scenarios**:
- [ ] Network timeout during undo → User-friendly error message
- [ ] Database connection lost → Graceful error handling
- [ ] Audit log entry deleted → "لا يمكن التراجع عن هذا الإجراء"
- [ ] Profile no longer exists → "الملف غير موجود"
- [ ] User logged out during undo → "غير مصرح. يجب تسجيل الدخول."
- [ ] Concurrent undo attempts → Only first succeeds

**Error Messages** (from `undoService.js`):
- [ ] `UNAUTHORIZED`: "غير مصرح. يجب تسجيل الدخول."
- [ ] `PERMISSION_DENIED`: "ليس لديك صلاحية للتراجع عن هذا الإجراء"
- [ ] `INVALID_ACTION_TYPE`: "نوع الإجراء غير مدعوم للتراجع"
- [ ] `PROFILE_NOT_FOUND`: "الملف غير موجود"
- [ ] `ALREADY_UNDONE`: "تم التراجع عن هذا الإجراء بالفعل"
- [ ] `EXPIRED`: "انتهت صلاحية التراجع (أكثر من 30 يوماً)"

---

### 9. Edge Cases & Safety

**Concurrent Operations**:
- [ ] User A undoes action → User B tries to undo same action → Second undo fails gracefully

**Data Integrity**:
- [ ] Undoing profile_update restores EXACT old values (not current values)
- [ ] Undoing cascade delete restores all profiles with correct relationships
- [ ] Version numbers increment after undo (optimistic locking works)

**Performance**:
- [ ] Undo operation completes in < 2 seconds
- [ ] Activity log refresh completes in < 1 second
- [ ] No UI freezing during undo

**Safety Checks**:
- [ ] Cannot undo non-existent audit log entry
- [ ] Cannot undo already-undone action
- [ ] Dangerous operations require confirmation
- [ ] No SQL injection via undo_reason field

---

### 10. Integration Tests

**Full User Flow**:
1. [ ] User makes profile update → Sees in activity log → Undoes → Verifies restored
2. [ ] Admin deletes profile → Sees in activity log → Undoes → Verifies profile restored
3. [ ] Admin creates marriage → Sees in activity log → Undoes → Verifies marriage deleted
4. [ ] Regular user tries to undo admin action → Cannot see undo button
5. [ ] Admin undoes 60-day-old action → Success (no time limit)

**Multi-Step Scenario**:
1. [ ] Create profile
2. [ ] Update phone number (Action A)
3. [ ] Update email (Action B)
4. [ ] Undo Action B → Email reverted
5. [ ] Verify Action A still undoable
6. [ ] Undo Action A → Phone reverted
7. [ ] Profile now has original phone + original email

---

## 📊 Test Results Summary

**Date Tested**: __________
**Tester**: __________
**Environment**: Production / Staging / Local

| Category | Pass | Fail | Notes |
|----------|------|------|-------|
| Profile Update | ☐ | ☐ | |
| Profile Soft Delete | ☐ | ☐ | |
| Cascade Delete | ☐ | ☐ | |
| Add Marriage | ☐ | ☐ | |
| Permission Checks | ☐ | ☐ | |
| Time Limits | ☐ | ☐ | |
| UI/UX | ☐ | ☐ | |
| Error Handling | ☐ | ☐ | |
| Edge Cases | ☐ | ☐ | |
| Integration | ☐ | ☐ | |

**Overall Status**: ☐ Pass ☐ Fail ☐ Needs Fixes

---

## 🐛 Known Issues

_(Document any issues found during testing)_

1.
2.
3.

---

## 📝 Notes

- All tests should be performed on a non-production database first
- Use test profiles that can be safely modified/deleted
- Verify database backups exist before testing cascade operations
- Test on both iOS and Android (if applicable)
- Test with poor network conditions (airplane mode toggle)

---

## ✅ Sign-Off

**Tester Signature**: __________
**Date**: __________
**Approved By**: __________

---

## 🔧 Troubleshooting

**Undo button not appearing?**
- Refresh activity log (pull to refresh)
- Check user role (admin vs regular user)
- Verify action is undoable (`is_undoable = true`)
- Check action hasn't already been undone (`undone_at IS NULL`)

**Permission denied error?**
- Verify user is actor of the action (regular users)
- Verify admin role (for dangerous operations)
- Check time limit (30 days for regular users)

**Profile not restored after undo?**
- Check audit log for `old_data` field (must not be empty)
- Verify profile version matches (optimistic locking)
- Check for concurrent updates (version conflict)

**Dangerous operations require double confirmation?**
- Expected behavior for `profile_cascade_delete` and `add_marriage`
- Prevents accidental undos of critical operations

---

**End of Checklist**
