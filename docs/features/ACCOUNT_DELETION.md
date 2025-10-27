# Account Deletion System

**Status**: ✅ Complete - Secure 3-step deletion with OTP verification and rate limiting

**Commit**: `65abafa4a` - "feat(delete-account): Implement secure 3-step account deletion with OTP verification"

## Overview

A secure account deletion system that allows users to permanently delete their account from the Alqefari Family Tree app. The system uses OTP verification and text confirmation to prevent accidental deletions.

## User Flow

### 3-Step Deletion Process

1. **Initial Confirmation**
   - Settings → Advanced Settings (expand) → "حذف الحساب نهائياً"
   - System shows alert warning about permanent action
   - User confirms they want to proceed

2. **OTP Verification**
   - System sends OTP to user's current phone
   - User enters 6-digit OTP code
   - 10-minute expiration window
   - Resend available after countdown

3. **Text Confirmation**
   - User must type exact Arabic text: "نعم"
   - Case-sensitive validation
   - Prevents accidental deletions

4. **Execution**
   - Account deleted
   - Global sign-out across all sessions
   - Redirect to login screen

## Access Location

**Settings Screen**: Hidden under collapsible "Advanced Settings" section

**Path**: Settings → "إظهار الإعدادات المتقدمة" (tap to expand) → "حذف الحساب نهائياً"

**Design Rationale**:
- Not immediately visible to prevent accidental access
- Requires intentional action to expand advanced settings
- Red danger button clearly indicates destructive action

## Components

### DeleteAccountModal
**Location**: `src/components/settings/DeleteAccountModal.js`

3-stage modal that handles the complete deletion flow.

**Props**:
- `visible`: Boolean to show/hide modal
- `onClose`: Callback when modal closes (dismisses on backdrop press)
- `onSuccess`: Callback when deletion succeeds (optional, typically redirects to login)

**Three Stages**:
1. **OTP Entry**: User enters OTP sent to their phone
2. **Text Confirmation**: User types "نعم" exactly
3. **Processing**: Shows loading spinner during deletion

**Features**:
- OTP countdown timer (10 minutes)
- Resend OTP button
- Rate limit detection and display
- Edge case warnings (root node, admin role, children)
- Network guard protection
- Session validation
- Concurrent deletion protection

**Usage**:
```javascript
<DeleteAccountModal
  visible={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onSuccess={() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }}
/>
```

### Service Layer
**Location**: `src/services/deleteAccountOtp.js`

Contains functions for handling account deletion operations:

1. `sendDeleteAccountOtp()` - Send OTP to user's phone
2. `verifyDeleteAccountOtp()` - Verify OTP and execute deletion
3. `checkDeleteAccountRateLimit()` - Check remaining attempts
4. `getRateLimitRetryTime()` - Get time until rate limit resets

## Technical Implementation Details

### OTP Verification

**OTP Type**: Uses Supabase Auth `phone` OTP type
**Expiration**: 10 minutes
**Rate Limit**: 3 attempts per 24 hours

```javascript
// Send OTP
const { error } = await supabase.auth.signInWithOtp({
  phone: userPhone,
  options: {
    channel: 'sms'
  }
});

// Verify OTP
const { error: verifyError } = await supabase.auth.verifyOtp({
  phone: userPhone,
  token: otpCode,
  type: 'sms'
});
```

### Rate Limiting

**Strategy**: 3 attempts per 24 hours with 24-hour lockout after 3rd attempt

**Storage**: `AsyncStorage` with keys:
- `delete_account_attempts` - Comma-separated timestamps of attempts
- `delete_account_locked_until` - ISO timestamp of lockout end

**Implementation**:
```javascript
async function checkDeleteAccountRateLimit() {
  const attemptsStr = await AsyncStorage.getItem('delete_account_attempts');
  const attempts = attemptsStr ? attemptsStr.split(',').map(Number) : [];

  // Filter attempts within last 24 hours
  const now = Date.now();
  const recentAttempts = attempts.filter(t => now - t < 24 * 60 * 60 * 1000);

  // Check if locked out
  const lockedUntil = await AsyncStorage.getItem('delete_account_locked_until');
  if (lockedUntil && new Date(lockedUntil) > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: new Date(lockedUntil)
    };
  }

  // Return remaining attempts
  return {
    allowed: recentAttempts.length < 3,
    remainingAttempts: 3 - recentAttempts.length,
    lockedUntil: null
  };
}
```

**UI Display**:
- Shows remaining attempts: "Attempts remaining: X/3"
- Shows lockout time: "Locked out. Try again after: [date/time]"
- Displays human-readable retry time

### Session Validation

**5-Minute Freshness Check**: Ensures user session is recent before allowing deletion

```javascript
const { data: { session } } = await supabase.auth.getSession();
const sessionAge = Date.now() - new Date(session.user.last_sign_in_at).getTime();
const FIVE_MINUTES = 5 * 60 * 1000;

if (sessionAge > FIVE_MINUTES) {
  throw new Error('Session too old. Please re-login.');
}
```

**Rationale**:
- Prevents deletion from stale sessions
- Ensures user actively intends to delete
- Adds security layer against session hijacking

### Concurrent Deletion Protection

**Advisory Lock**: Prevents multiple simultaneous deletions

```javascript
-- In delete_account_with_otp RPC
PERFORM pg_advisory_xact_lock(hashtext(auth_user_id::text));
```

**Benefits**:
- Prevents race conditions
- Ensures atomic deletion
- Protects against double-delete errors

### Edge Case Handling

The system warns users about these edge cases before deletion:

1. **Root Node Protection**
   - Profiles with `generation = 1` and `father_id IS NULL`
   - Warning: "You are the root of the family tree. Deletion may affect tree structure."

2. **Admin/Moderator Role Warnings**
   - Users with `role IN ('super_admin', 'admin', 'moderator')`
   - Warning: "You have administrative privileges. Consider transferring them first."

3. **Children in Tree**
   - Profiles with descendants (children, grandchildren, etc.)
   - Warning: "You have X descendants. They will remain in the tree but lose their connection to you."

4. **OTP Expiration**
   - Checks if OTP is still valid (10-minute window)
   - Shows countdown timer
   - Allows resend after expiration

5. **Network Offline Protection**
   - Uses network guard before OTP operations
   - Prevents failed attempts that count against rate limit

### Data Deletion Details

**❌ Profile Data DELETED**:
- `user_id` link (set to NULL)
- `can_edit` flag (set to FALSE)
- Admin access (`role` set to NULL)
- Notification preferences
- Pending edit requests

**✅ Profile Data RETAINED**:
- Names (first_name, last_name, nick_name)
- Dates (birth_date, death_date)
- Photos (photo_url)
- Family relationships (father_id, mother_id, spouse links)
- Professional titles
- Location data

**Rationale**: Preserves family history while removing personal account access

**Profile State After Deletion**:
```javascript
{
  user_id: null,           // ← Unlinked from auth
  can_edit: false,         // ← Read-only
  role: null,             // ← No admin access
  // ... all other fields remain
}
```

### Global Sign-Out

**Important**: Deletion triggers sign-out across ALL sessions, not just current device

```javascript
// Sign out globally
await supabase.auth.signOut({ scope: 'global' });
```

**Effect**:
- User logged out on all devices
- All session tokens invalidated
- Forces re-login on all devices
- Ensures immediate revocation of access

### Audit Logging

**Action Type**: `account_deletion`
**Table**: `audit_log_enhanced`

**Logged Data**:
- User ID
- Profile ID
- Timestamp
- Action type
- Old data snapshot (name, phone, role)

**Example**:
```javascript
INSERT INTO audit_log_enhanced (
  user_id,
  action_type,
  table_name,
  record_id,
  old_data,
  new_data
) VALUES (
  user_id,
  'account_deletion',
  'profiles',
  profile_id,
  jsonb_build_object(
    'name', old_name,
    'phone', old_phone,
    'role', old_role
  ),
  NULL
);
```

## Database Migration

**File**: `supabase/migrations/20251026120000_update_delete_account_audit_log.sql`

**Changes**:
- Added `action_type` enum value: `'account_deletion'`
- Extended `audit_log_enhanced` table support
- Created `delete_account_with_otp` RPC function
- Added advisory lock support

**RPC Function**: `delete_account_with_otp(p_user_id UUID, p_otp_code TEXT)`

**Features**:
- OTP verification via Supabase Auth
- Edge case detection and warnings
- Concurrent deletion protection
- Audit log creation
- Profile unlinking (not deletion)
- Global session invalidation

## UI/UX Features

### Collapsible Advanced Settings
- Hidden by default under "Advanced Settings" section
- Requires tap to expand
- Prevents accidental access
- Clear visual hierarchy

### Red Danger Button
- Uses Najdi Crimson (#A13333) for danger actions
- Icon: `trash-outline`
- Text: "حذف الحساب نهائياً" (Delete Account Permanently)
- Stands out from other settings options

### OTP Timer
- 10-minute countdown
- Shows remaining time: "Valid for: 9:32"
- Resend button appears after expiration
- Prevents spam with visual feedback

### Text Confirmation
- Exact match required: "نعم"
- Case-sensitive
- Shows example text
- Clear input field
- Submit button only enabled when text matches

### Error Handling
- Rate limit errors show countdown and lockout time
- Invalid OTP shows retry message
- Network errors show offline alert
- Edge case warnings show specific messages
- Session expiration requires re-login

### Progress Indication
- Loading spinner during deletion
- "Processing..." text
- Modal remains open during deletion
- Dismisses on success

## Usage in Settings

**Integration**:
```javascript
import DeleteAccountModal from '../components/settings/DeleteAccountModal';
import { useState } from 'react';

function SettingsScreen() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <View>
      {/* Advanced Settings Section */}
      <TouchableOpacity onPress={() => setShowAdvanced(!showAdvanced)}>
        <Text>إظهار الإعدادات المتقدمة</Text>
        <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} />
      </TouchableOpacity>

      {showAdvanced && (
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => setShowDeleteModal(true)}
        >
          <Ionicons name="trash-outline" color="#A13333" />
          <Text style={styles.dangerText}>حذف الحساب نهائياً</Text>
        </TouchableOpacity>
      )}

      <DeleteAccountModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          // Navigate to login
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }}
      />
    </View>
  );
}
```

## Testing Checklist

- ✅ Collapsible section expand/collapse
- ✅ Rate limiting (3 attempts, lockout, retry time display)
- ✅ OTP send and verification (correct/incorrect codes)
- ✅ Text input validation (requires exact "نعم")
- ✅ Edge cases (root node, admin role, children in tree)
- ✅ OTP expiration and resend
- ✅ Session validation (5-minute freshness)
- ✅ Global sign-out execution
- ✅ RTL/Arabic numerals support
- ✅ Network offline protection
- ✅ Audit log creation
- ✅ Profile unlinking (user_id → NULL, can_edit → false)
- ✅ Concurrent deletion protection

## Security Considerations

1. **OTP Verification**: Proves phone access (security layer)
2. **Text Confirmation**: Prevents accidental deletions
3. **Rate Limiting**: Prevents abuse (3 attempts per 24 hours)
4. **Session Validation**: Ensures active intent (5-minute freshness)
5. **Concurrent Protection**: Advisory locks prevent race conditions
6. **Global Sign-Out**: Invalidates all sessions immediately
7. **Audit Trail**: Logs deletion for accountability

## Known Limitations

1. **Rate Limiting**: 3 attempts per 24 hours (enforced by Supabase)
2. **OTP Expiration**: 10-minute window (Supabase default)
3. **Network Required**: Cannot send/verify OTP while offline
4. **No Undo**: Deletion is permanent (profile becomes read-only, can_edit=false)
5. **Profile Retained**: Family history preserved (names, dates, photos remain)

## Future Enhancements

- [ ] Add account suspension (temporary disable) as alternative
- [ ] Implement data export before deletion
- [ ] Add grace period (7 days) before permanent deletion
- [ ] Support account transfer (reassign profile to another user)
- [ ] Add deletion statistics dashboard (admin view)

## Related Documentation

- [Phone Change System](./PHONE_CHANGE.md) - Uses similar OTP verification
- [Design System](../DESIGN_SYSTEM.md) - UI components and styling
- [Audit Log System](../UNDO_SYSTEM_TEST_CHECKLIST.md) - Audit logging details
- [Soft Delete Pattern](../SOFT_DELETE_PATTERN.md) - Profile unlinking pattern
