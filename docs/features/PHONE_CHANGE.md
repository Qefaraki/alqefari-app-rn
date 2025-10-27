# Phone Number Change System

**Status**: ✅ Complete - Secure 4-step phone change with OTP verification

## Overview

A secure phone number change system that allows users to update their phone number in the Alqefari Family Tree app settings. The system uses OTP verification for both the current and new phone numbers to ensure security.

## User Flow

### 4-Step Phone Change Process

1. **Verify Current Phone**
   - Send OTP to current phone number
   - User enters OTP code
   - System verifies ownership of current phone

2. **Enter New Phone**
   - User enters new phone number
   - System validates phone format
   - Checks if phone is already in use

3. **Verify New Phone**
   - Send OTP to new phone number
   - User enters OTP code
   - System verifies ownership of new phone

4. **Complete Change**
   - Update phone number in Supabase Auth
   - Log change in audit log
   - Session remains valid (no forced re-login)

## Components

### PhoneInputField
**Location**: `src/components/ui/PhoneInputField.js`

Reusable phone input component used in both authentication and settings.

**Features**:
- Country code selector (defaults to Saudi Arabia +966)
- Real-time format validation
- RTL-compatible layout
- Arabic numerals support
- Disabled state support

**Usage**:
```javascript
<PhoneInputField
  value={phoneNumber}
  onChangeText={setPhoneNumber}
  editable={true}
  placeholder="5xxxxxxxx"
/>
```

### PhoneChangeModal
**Location**: `src/components/settings/PhoneChangeModal.js`

4-step modal that handles the complete phone change flow.

**Props**:
- `visible`: Boolean to show/hide modal
- `onClose`: Callback when modal closes
- `onSuccess`: Callback when phone change succeeds

**Features**:
- Step-by-step progress indicator
- OTP countdown timer with resend button
- Dynamic error handling
- Rate limit detection
- Network guard protection

**Usage**:
```javascript
<PhoneChangeModal
  visible={showPhoneChangeModal}
  onClose={() => setShowPhoneChangeModal(false)}
  onSuccess={() => {
    Alert.alert('نجح', 'تم تغيير رقم الهاتف بنجاح');
  }}
/>
```

### Service Layer
**Location**: `src/services/phoneChange.js`

Contains 7 functions for handling phone change operations:

1. `sendCurrentPhoneOtp()` - Send OTP to current phone
2. `verifyCurrentPhoneOtp()` - Verify current phone OTP
3. `sendNewPhoneOtp()` - Send OTP to new phone
4. `verifyNewPhoneOtp()` - Verify new phone OTP and complete change
5. `checkPhoneAvailable()` - Check if new phone is already in use
6. `getRateLimitInfo()` - Get remaining attempts before lockout
7. `logPhoneChange()` - Log to audit_log_enhanced (non-blocking)

## Technical Implementation Details

### Supabase Auth Integration

Uses Supabase Auth native phone change flow:

```javascript
// Step 1: Update user with new phone
const { error } = await supabase.auth.updateUser({
  phone: newPhoneNumber
});

// Step 2: Verify OTP
const { error: verifyError } = await supabase.auth.verifyOtp({
  phone: newPhoneNumber,
  token: otpCode,
  type: 'phone_change'
});
```

### Profile Phone vs Auth Phone

**Important**: Profile phone and auth phone are SEPARATE fields:
- **Auth phone**: `auth.users.phone` - Used for authentication
- **Profile phone**: `profiles.phone` - Stored in profile data
- **No sync needed**: System keeps them separate by design

### OTP Rate Limiting

**Dynamic Detection** (not hardcoded):
- Parses Supabase error messages for rate limit info
- Extracts remaining time from error: "Please wait X seconds"
- Displays countdown to user
- Shows "locked out" state with retry time

**Example**:
```javascript
const rateLimitMatch = error.message.match(/(\d+)\s*seconds?/i);
if (rateLimitMatch) {
  const waitTime = parseInt(rateLimitMatch[1]);
  setRetryAfter(waitTime);
}
```

### Audit Logging

**Action Type**: `phone_change`
**Table**: `audit_log_enhanced`

**Logged Data**:
- User ID
- Old phone number (from profiles.phone)
- New phone number
- Timestamp
- Action type

**Non-Blocking Design**:
- Phone change succeeds even if audit log fails
- Errors logged to console but don't block user
- Ensures availability over consistency for audit trail

```javascript
try {
  await logPhoneChange(user.id, oldPhone, newPhone);
} catch (logError) {
  console.warn('[PhoneChange] Audit log failed (non-blocking):', logError);
  // Continue anyway - phone change succeeded
}
```

### Network Guard

All OTP operations protected by network guard:

```javascript
import { requireNetwork } from '../utils/networkGuard';

async function sendOtp(phone) {
  await requireNetwork(); // Throws if offline
  // ... proceed with OTP send
}
```

**Benefits**:
- Prevents failed OTP sends that count against rate limit
- Shows offline alert before attempting operation
- Saves user from wasting OTP attempts

### Session Persistence

**Important**: Phone change does NOT force re-login
- Session token remains valid after phone change
- User stays logged in
- No need to re-authenticate

## Database Migration

**File**: `supabase/migrations/20251025000000_add_phone_change_support.sql`

**Changes**:
- Added `action_type` enum value: `'phone_change'`
- Extended `audit_log_enhanced` table support
- No schema changes to profiles table (phone field already exists)

## UI/UX Features

### RTL Compatibility
- All layouts work in RTL mode
- Arabic numerals supported in phone input
- Direction-agnostic spacing

### OTP Timer
- 60-second countdown
- Shows "Resend" button after expiration
- Prevents spam with visual feedback

### Error Handling
- Rate limit errors show countdown
- Phone in use shows specific message
- Invalid OTP shows retry counter
- Network errors show offline alert

### Progress Indication
- 4 steps with visual progress dots
- Current step highlighted
- Back button on steps 2-4
- Cancel button always available

## Usage in Settings

**Location**: Settings → Account Management → "تغيير رقم الهاتف"

**Access**:
```javascript
import PhoneChangeModal from '../components/settings/PhoneChangeModal';

function AccountManagementScreen() {
  const [showPhoneChange, setShowPhoneChange] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setShowPhoneChange(true)}>
        <Text>تغيير رقم الهاتف</Text>
      </TouchableOpacity>

      <PhoneChangeModal
        visible={showPhoneChange}
        onClose={() => setShowPhoneChange(false)}
        onSuccess={handlePhoneChangeSuccess}
      />
    </>
  );
}
```

## Testing Checklist

- ✅ Basic 4-step flow completion
- ✅ Error handling (rate limits, invalid OTP, phone in use)
- ✅ RTL/Arabic numerals display
- ✅ Session persistence after change
- ✅ Offline handling (network guard)
- ✅ OTP expiration & resend functionality
- ✅ Audit log creation (non-blocking)
- ✅ Profile phone remains unchanged (separate from auth phone)

## Known Limitations

1. **Rate Limiting**: Supabase enforces rate limits on OTP sends (typically 3 attempts per hour)
2. **OTP Expiration**: OTP codes expire after 60 seconds
3. **Phone Uniqueness**: Each phone number can only be used by one account
4. **Network Required**: Cannot send/verify OTP while offline

## Future Enhancements

- [ ] Add SMS cost warnings for international numbers
- [ ] Support multiple phone numbers per account
- [ ] Add phone number history view
- [ ] Implement two-factor auth with phone as fallback

## Related Documentation

- [Account Deletion System](./ACCOUNT_DELETION.md) - Uses similar OTP verification
- [Design System](../DESIGN_SYSTEM.md) - UI components and styling
- [Audit Log System](../UNDO_SYSTEM_TEST_CHECKLIST.md) - Audit logging details
