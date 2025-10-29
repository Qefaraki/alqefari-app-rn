# QR Code & Deep Linking System Documentation

**Status**: ✅ Active
**Last Updated**: October 27, 2025
**Platforms**: iOS + Android

---

## 📖 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [URL Formats](#url-formats)
3. [iOS Setup](#ios-setup)
4. [Android Setup](#android-setup)
5. [Implementation Details](#implementation-details)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Analytics & Monitoring](#analytics--monitoring)

---

## Architecture Overview

### Flow Diagram

```
User A generates QR code
    ↓
QR code contains: alqefari://profile/H12345
    ↓
User B scans QR with camera
    ↓
OS recognizes custom scheme
    ↓
App launches (or foregrounds)
    ↓
Linking event fires
    ↓
parseProfileLink() extracts HID
    ↓
handleDeepLink() opens profile
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Feature Flag | `src/config/featureFlags.js` | Enable/disable deep linking |
| Event Listeners | `app/_layout.tsx` lines 79+ | Catch deep link events |
| Link Parser | `src/utils/deepLinking.ts` | Parse and validate URLs |
| QR Generator | `src/components/sharing/ProfileQRCode.js` | Render QR with logo |
| QR Display | `src/components/sharing/ShareProfileSheet.js` | Modal UI for sharing |

---

## URL Formats

### Custom Scheme (Primary)

**Format**: `alqefari://profile/{HID}[?inviter={INVITER_HID}]`

**Examples**:
- `alqefari://profile/H12345`
- `alqefari://profile/R1.1.1.1.1.1`
- `alqefari://profile/H12345?inviter=H67890`

**Platform Support**:
- ✅ iOS (via URL scheme in app.json)
- ✅ Android (via intent filters in app.json)

**Pros**:
- No server infrastructure needed
- Works offline
- Instant app launch

**Cons**:
- Shows "Open in Alqefari?" prompt (iOS)
- Doesn't work in mobile browsers

---

### Universal Links (Future - Phase 2B)

**Format**: `https://alqefari.com/profile/{HID}[?inviter={INVITER_HID}]`

**Examples**:
- `https://alqefari.com/profile/H12345`
- `https://alqefari.com/profile/H12345?inviter=H67890`

**Requirements**:
- Apple App Site Association (AASA) file deployed to server
- Associated domains configured in app.json
- Native app rebuild required

**Status**: ⏳ Deferred - Will implement when WordPress access is ready

---

## iOS Setup

### 1. URL Scheme Configuration

**File**: `app.json` line 58

```json
{
  "expo": {
    "scheme": "alqefari"
  }
}
```

**Status**: ✅ Already configured

---

### 2. Deep Link Event Listeners

**File**: `app/_layout.tsx` after line 78

```javascript
import * as Linking from 'expo-linking';
import { handleDeepLink, parseProfileLink, parseInviterHID } from '../src/utils/deepLinking';
import { FEATURE_FLAGS } from '../src/config/featureFlags';

useEffect(() => {
  if (!FEATURE_FLAGS.enableDeepLinking) return;

  // Cold start: App opened from link
  const handleInitialURL = async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      const hid = parseProfileLink(url);
      if (hid) handleDeepLink(hid);
    }
  };

  // Warm start: App already running
  const subscription = Linking.addEventListener('url', (event) => {
    const hid = parseProfileLink(event.url);
    if (hid) handleDeepLink(hid);
  });

  handleInitialURL();
  return () => subscription.remove();
}, []);
```

---

### 3. Testing on iOS

**Simulator**:
```bash
xcrun simctl openurl booted alqefari://profile/H1
```

**Real Device**:
1. Send link via Messages/WhatsApp
2. Tap link → App should open
3. Or open Safari → Enter `alqefari://profile/H1` in address bar

**Camera QR Scanning**:
1. Open Camera app
2. Point at QR code
3. Notification appears: "Open in Alqefari"
4. Tap → App launches

---

## Android Setup

### 1. Intent Filters Configuration

**File**: `app.json` in android section

```json
{
  "android": {
    "package": "com.Alqefari.alqefari",
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [
          {
            "scheme": "alqefari",
            "host": "profile"
          }
        ],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

**Status**: ✅ Configured in Phase 1.3

---

### 2. Testing on Android

**Emulator**:
```bash
adb shell am start -a android.intent.action.VIEW -d "alqefari://profile/H1"
```

**Real Device**:
1. Send link via WhatsApp/Telegram
2. Tap link → "Open with" dialog appears
3. Select Alqefari → App launches

**Camera QR Scanning**:
1. Open Camera app or Google Lens
2. Point at QR code
3. Tap notification → App opens

---

## Implementation Details

### QR Code Generation

**Component**: `ProfileQRCode.js`

**Key Props**:
- `hid` (required): Profile HID to generate link for
- `photoUrl` (optional): Profile photo for logo
- `inviterHid` (optional): Tracking for invites
- `size` (default: 240px): QR code size

**Logo Strategy**:
1. Try profile photo (if `photoUrl` provided)
2. Fall back to emblem logo
3. Fall back to plain QR (no logo)

**Implementation**:
```javascript
// Smart logo fallback
useEffect(() => {
  async function loadLogo() {
    if (photoUrl) {
      try {
        await Image.prefetch([photoUrl]);
        setLogoSource({ uri: photoUrl });
        return;
      } catch {}
    }

    // Fallback to emblem
    const emblem = require('../../assets/logo/Alqefari Emblem (Transparent).png');
    setLogoSource(emblem);
  }
  loadLogo();
}, [photoUrl]);
```

---

### Deep Link Handling

**Function**: `handleDeepLink(hid, inviterHid)` in `deepLinking.ts`

**Flow**:
1. Validate HID format
2. Check network connectivity
3. Find profile in tree store
4. Enrich profile if needed (Progressive Loading)
5. Check permissions
6. Open ProfileViewer
7. Log analytics event

**Edge Cases Handled**:
- Own profile scan → Alert shown
- Deleted profile → Alert shown
- Blocked user → Permission denied
- Network offline → Network guard alert
- Invalid HID → Validation fails
- Rapid scans → Debounced (1 sec)

---

## Testing Guide

### Unit Tests

**File**: `src/utils/__tests__/deepLinking.test.ts`

```bash
npm test -- deepLinking.test.ts
```

**Coverage**: >80% for deep linking utilities

---

### Manual Testing Checklist

#### iOS Testing

- [ ] Cold start: Force quit app → Scan QR → App launches
- [ ] Warm start: App in background → Scan QR → App foregrounds
- [ ] Safari: Enter `alqefari://profile/H1` → App opens
- [ ] Messages: Tap shared link → App opens
- [ ] WhatsApp: Tap shared link → App opens
- [ ] Camera: Scan QR → Notification → Tap → App opens
- [ ] Profile with photo → Logo shows photo
- [ ] Profile without photo → Logo shows emblem
- [ ] Scan own profile → Alert "This is your profile"
- [ ] Scan deleted profile → Alert "Profile no longer available"
- [ ] Rapid double-scan → Second scan ignored (debounced)

#### Android Testing

- [ ] Cold start: Force close app → Scan QR → App launches
- [ ] Warm start: App in background → Scan QR → App foregrounds
- [ ] Chrome: Enter `alqefari://profile/H1` → "Open with" dialog
- [ ] WhatsApp: Tap link → Select Alqefari → App opens
- [ ] Camera/Google Lens: Scan QR → App opens
- [ ] Logo displays correctly
- [ ] Edge cases work (same as iOS)

---

## Troubleshooting

### Issue: QR code doesn't open app

**Symptoms**: Scanning QR opens browser instead of app

**iOS Solutions**:
1. Check URL scheme in app.json: `"scheme": "alqefari"`
2. Verify link format: `alqefari://profile/H1` (not `http://`)
3. Rebuild app after config changes: `eas build`
4. Test in dev mode: Feature flag enabled?

**Android Solutions**:
1. Check intentFilters in app.json
2. Verify `autoVerify: true` is set
3. Rebuild app: Intent filters require native rebuild
4. Clear defaults: Settings → Apps → Alqefari → Open by default → Clear

---

### Issue: "Unknown user" displays in QR sheet

**Symptoms**: ShareProfileSheet shows "مجهول" instead of name

**Root Cause**: Profile doesn't have `name_chain` field populated

**Solution**:
1. Check if profile is enriched
2. Verify `build_name_chain` RPC returns name
3. Check ProfileViewer passes correct field: `profile?.name_chain`

---

### Issue: Logo doesn't display in QR code

**Symptoms**: QR code is plain (no logo)

**Root Cause**: Profile photo failed to load OR emblem missing

**Debug**:
1. Check console logs: `[QRCode] Testing profile photo:`
2. Verify emblem exists: `assets/logo/Alqefari Emblem (Transparent).png`
3. Test Image.prefetch: Does photo URL work?

**Solution**:
- If photo fails → Emblem fallback should work
- If emblem missing → Plain QR (acceptable)
- Check photoUrl format: Should be full URL

---

### Issue: Deep link doesn't navigate to profile

**Symptoms**: App opens but stays on current screen

**Debug**:
1. Check console: `[DeepLink] Initial URL:` or `[DeepLink] URL event:`
2. Check feature flag: `FEATURE_FLAGS.enableDeepLinking`
3. Verify HID format: `H12345` or `R1.1.1`
4. Check permissions: User allowed to view profile?

**Solution**:
1. Enable feature flag in dev mode
2. Test with valid HID from your tree
3. Check permission system: `check_family_permission_v4`

---

### Issue: App crashes on QR scan

**Symptoms**: App crashes when scanning QR code

**Debug**:
1. Check error logs: Look for deep linking errors
2. Verify tree is loaded before handling deep link
3. Check for null profile references

**Solution**:
1. Add null checks in handleDeepLink
2. Wait for tree to load before processing links
3. Test with smaller tree first

---

## Analytics & Monitoring

### Tracking QR Scans

**Table**: `profile_share_events`

**Query**: Recent QR scans
```sql
SELECT
  ps.profile_id,
  p.name_chain,
  COUNT(*) as scan_count,
  COUNT(DISTINCT ps.sharer_id) as unique_scanners
FROM profile_share_events ps
JOIN profiles p ON ps.profile_id = p.id
WHERE ps.share_method = 'qr_scan'
  AND ps.shared_at > NOW() - INTERVAL '7 days'
GROUP BY ps.profile_id, p.name_chain
ORDER BY scan_count DESC
LIMIT 20;
```

---

### Share Method Comparison

**Query**: QR scans vs other methods
```sql
SELECT
  share_method,
  COUNT(*) as total_shares,
  COUNT(DISTINCT sharer_id) as unique_sharers,
  COUNT(DISTINCT profile_id) as unique_profiles_shared
FROM profile_share_events
WHERE shared_at > NOW() - INTERVAL '30 days'
GROUP BY share_method
ORDER BY total_shares DESC;
```

**Expected Methods**:
- `qr_scan` - Deep link via QR code
- `copy_link` - Copy link button
- `whatsapp` - WhatsApp share
- `native_share` - iOS share sheet

---

### Error Monitoring

**Query**: Deep link errors
```sql
SELECT
  message,
  COUNT(*) as error_count,
  MAX(created_at) as last_seen
FROM error_logs
WHERE message LIKE '%DeepLink%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY message
ORDER BY error_count DESC;
```

---

## Future Enhancements

### Phase 2B: Universal Links

**When WordPress Access Ready**:
1. Deploy AASA file to `/.well-known/apple-app-site-association`
2. Add `associatedDomains` to app.json
3. Rebuild app with entitlements
4. Test: `https://alqefari.com/profile/H1` opens app directly

**Benefits**:
- No "Open in Alqefari?" prompt
- Links work in browsers
- Better SEO
- Web fallback possible

---

### QR Code Analytics Dashboard

**Proposed Features**:
- Scan heatmap (which profiles most scanned)
- Conversion tracking (scans → profile views)
- Geographic distribution (if IP logged)
- Scanner demographics (logged-in users only)

---

### Dynamic QR Codes

**Idea**: Short links that redirect
- `alqefari.com/q/abc123` → Redirects to profile
- Can change target without regenerating QR
- Track individual QR instances
- Privacy concerns (tracking)

**Status**: Not planned - Privacy first

---

## Security Fixes (October 28, 2025)

**Status**: ✅ Complete - All 3 critical security issues resolved
**Implementation Grade**: Complete - 3 migrations + 3 code updates

### Issue #1: Secure RLS Policy ✅

**Problem**: Permissive `WITH CHECK (true)` policy allowed User A to insert analytics as User B.

**Fix**: Migration `20251028000002_fix_share_events_rls.sql`

**Implementation**:
- Replaced permissive policy with secure authentication
- Ties `scanner_id` to `auth.uid()` (prevents impersonation)
- Validates `profile_id` exists, `sharer_id` exists (if provided)
- Rejects deleted profiles
- Atomic migration (CREATE new policy before DROP old, zero downtime)

**Monitoring**:
- Added `check_share_events_rls_health()` diagnostic function
- Returns policy details and validation status

**Security Impact**: Prevents analytics spoofing, ensures audit trail integrity

---

### Issue #2: Server-Side Rate Limiting ✅

**Problem**: Client-side Map-based rate limiting could be bypassed (memory leaks, multi-device).

**Fix**: Migration `20251028000000_add_qr_rate_limiting.sql`

**Implementation**:
- Database trigger enforces 20 scans per 5 minutes per user
- New table: `user_rate_limits` (tracks per-user scan counts + window start time)
- Trigger: `enforce_qr_scan_rate_limit()` BEFORE INSERT on `profile_share_events`
- Error handling: Arabic alert shown when rate limit exceeded (`deepLinking.ts` lines 283-291)

**Benefits**:
- ✅ Persists across devices
- ✅ Survives app restarts
- ✅ No memory leaks
- ✅ Multi-device safe

**Monitoring**:
- View: `qr_scan_rate_limits` for admin dashboard
- Shows current counts and window reset times

**Security Impact**: Prevents QR scan spam and abuse, protects against automated scraping

---

### Issue #3: URL Validation & Whitelisting ✅

**Problem**: No validation before `Image.prefetch()` allowed SSRF attacks (file://, javascript:, path traversal).

**Fix**: New file `src/utils/urlValidation.ts` + updated `src/components/sharing/ProfileQRCode.js` (lines 75-92)

**Implementation - 6 Security Checks**:
1. **HTTPS Only**: Blocks `file://`, `data:`, `javascript:` schemes
2. **Domain Whitelist**: Only allows `https://<project>.supabase.co/storage/v1/object/(public|authenticated)/`
3. **Path Traversal**: Rejects `..` in URL path
4. **Encoded Traversal**: Blocks `%2e%2e` (URL-encoded `..`)
5. **Redirect Parameters**: Rejects `redirect`, `url`, `return`, `next`, `goto` params
6. **Null Bytes**: Blocks `\0` and `%00`

**Validation Function**:
```javascript
import { validateSupabaseImageUrl } from './utils/urlValidation';

const isValid = validateSupabaseImageUrl(photoUrl, 'ezkioroyh zpavmbfavyn');
if (isValid) {
  await Image.prefetch(photoUrl);  // Safe to prefetch
} else {
  // Fallback to emblem logo (graceful degradation)
}
```

**Security Impact**: Prevents SSRF attacks, path traversal, and malicious URL injection

---

### Additional Enhancement: Scanner ID Column

**Migration**: `20251028000001_add_scanner_id_to_share_events.sql`

**Changes**:
- Added `scanner_id UUID` column to `profile_share_events` table
- Separates "who scanned" from "who shared" for accurate analytics
- Enables RLS policy to tie analytics to authenticated user
- Created 2 admin views: `top_qr_scanners`, `most_scanned_profiles`
- Indexes: `idx_share_events_scanner_id`, `idx_share_events_scanner_shared_at`

**Purpose**: Fixes plan-validator issue #1 (RLS policy needs user identification)

---

### Deployment Status

**Migrations Applied** (October 28, 2025):
1. ✅ `20251028000000_add_qr_rate_limiting.sql` - Rate limiting
2. ✅ `20251028000001_add_scanner_id_to_share_events.sql` - Scanner ID column
3. ✅ `20251028000002_fix_share_events_rls.sql` - Secure RLS policy

**Code Updates**:
1. ✅ `src/utils/urlValidation.ts` - URL validation utility (new file)
2. ✅ `src/components/sharing/ProfileQRCode.js` - URL validation before prefetch
3. ✅ `src/utils/deepLinking.ts` - Rate limit error handling

**Testing Checklist**:
- ⏳ Manual testing on physical devices (iOS + Android)
  - [ ] Test rate limiting (21st scan shows alert)
  - [ ] Test RLS policy (unauthenticated insert fails)
  - [ ] Test URL validation (file:// URLs rejected)
  - [ ] Test analytics logging (scanner_id matches auth user)
- ⏳ Enable production feature flag: `enableDeepLinking: true`
- ⏳ Deploy via OTA: `npm run update:production`
- ⏳ Monitor `profile_share_events` table for spam/abuse (first 48 hours)

**Rollback Plan** (if needed):
```sql
-- Emergency rollback: Drop triggers and policies
DROP TRIGGER IF EXISTS tr_enforce_qr_scan_rate_limit ON profile_share_events;
DROP POLICY IF EXISTS "Users can log their own scans" ON profile_share_events;
-- Restore old permissive policy (temporary, until fix is deployed)
```

**Security Status**: Ready for manual testing and production deployment. All blocking security issues resolved.

---

## Support

For implementation questions:
- Review code in `src/utils/deepLinking.ts`
- Check test cases in `__tests__/deepLinking.test.ts`
- Refer to CLAUDE.md for system patterns

For bugs:
- Check error logs in Supabase
- Review analytics for scan success rates
- Test with feature flag disabled for rollback

---

**End of Documentation**
