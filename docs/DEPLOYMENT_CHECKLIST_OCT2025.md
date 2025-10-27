# Deployment Checklist - October 2025

**Date Created**: October 27, 2025
**Date Updated**: October 28, 2025
**Features Ready for Deployment**: QR Code & Deep Linking (security fixes applied), Blurhash (partial)

---

## 🎯 Executive Summary

Three major features were developed on October 27, 2025:

1. **QR Code & Deep Linking System** - ✅ Security fixes applied (October 28, 2025)
2. **BlurHash Implementation** - 🚧 Day 1 backend 80% complete, needs deployment
3. **TreeView Performance Fix** - ✅ Complete and deployed

**Current Status**:
- ✅ QR Code system: Security fixes applied, ready for testing (3 migrations deployed)
- 🚧 Blurhash: Backend ready but NOT deployed (10 mins remaining)
- ✅ TreeView Performance: Complete

---

## 📊 Priority Matrix

| Feature | Status | Time to Deploy | Impact | Priority |
|---------|--------|----------------|--------|----------|
| **TreeView Performance** | ✅ Complete | 0 mins | High (eliminates freezes) | ✅ DONE |
| **QR Code Security Fixes** | ✅ Complete | 0 mins | Critical (prevents spam/abuse) | ✅ DONE |
| **QR Code Production Deployment** | ⏳ Ready for testing | 1-2 hours | High (new sharing feature) | 🟡 NEXT |
| **Blurhash Day 1 Completion** | 🚧 80% | 10 mins | Medium (improves perceived UX) | 🟡 MEDIUM |
| **Blurhash Day 2 Frontend** | ⏳ Pending | 8 hours | Medium (visual polish) | 🟢 LOW |

---

## ✅ RESOLVED: QR Code Security Fixes

### Status: COMPLETE (October 28, 2025)

**Implementation Grade**: All 3 critical issues resolved
**Solution Auditor Grade**: B+ (87/100) - Down from self-assessed A- (92/100)
**Migrations Applied**: 3 migrations successfully deployed via Supabase MCP

### Critical Issues (MUST FIX)

#### 1. Analytics RLS Too Permissive ✅ FIXED

**Status**: ✅ Complete (October 28, 2025)
**Migration**: `supabase/migrations/20251028000002_fix_share_events_rls.sql`
**File**: `supabase/migrations/20251027000001_create_profile_share_events.sql` line 38

**Problem**:
```sql
CREATE POLICY "Anyone can insert share events"
  ON public.profile_share_events
  FOR INSERT
  WITH CHECK (true);  -- ❌ Allows ANY user to insert fake data
```

**Risk**:
- Malicious users can spam analytics with fake data
- Database bloat from unlimited inserts
- Corrupted metrics (fake share counts)
- Potential DoS via bulk inserts

**Fix Required**:
```sql
-- Replace with authenticated + validated policy
CREATE POLICY "Authenticated users can insert valid share events"
  ON public.profile_share_events
  FOR INSERT
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    -- Profile must exist and not be deleted
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = profile_share_events.profile_id
        AND deleted_at IS NULL
    )
    -- If sharer_id provided, must exist
    AND (
      profile_share_events.sharer_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = profile_share_events.sharer_id
          AND deleted_at IS NULL
      )
    )
  );
```

**Action Items**:
- [x] Create new migration: `20251028000002_fix_share_events_rls.sql` ✅
- [x] Apply migration via MCP: `mcp__supabase__apply_migration` ✅
- [x] Added scanner_id validation (ties to auth.uid()) ✅
- [x] Verify RLS policy with `check_share_events_rls_health()` function ✅
- [x] Atomic migration (CREATE new policy before DROP old) ✅

**Implementation Details**:
- New policy: `authenticated_users_insert_own_scans_v2`
- Validates: auth.uid(), scanner_id match, profile_id exists, sharer_id exists (if provided)
- Old permissive policy dropped successfully
- Zero-downtime deployment (CREATE before DROP pattern)

**Time Taken**: 45 minutes (including plan-validator fixes)

---

#### 2. No Rate Limiting ✅ FIXED

**Status**: ✅ Complete (October 28, 2025)
**Migration**: `supabase/migrations/20251028000000_add_qr_rate_limiting.sql`
**Files Updated**: `src/utils/deepLinking.ts` (added scanner_id, rate limit error handling)

**Problem**: Users can scan unlimited QR codes (no rate limit)

**Risk**:
- Analytics spam (one user scans 1000+ times)
- Database load from unlimited analytics inserts
- Abuse monitoring impossible

**Fix Required**:
Add per-user rate limiting (20 scans per 5 minutes):

```typescript
// Add before debounce check in handleDeepLink()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_SCANS = 20;
const userScanHistory = new Map<string, number[]>(); // userId -> timestamps

export async function handleDeepLink(hid: string, inviterHid?: string): Promise<void> {
  const treeStore = useTreeStore.getState();
  const userId = treeStore.userProfile?.id;

  if (userId) {
    const now = Date.now();
    const userScans = userScanHistory.get(userId) || [];
    const recentScans = userScans.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    if (recentScans.length >= RATE_LIMIT_MAX_SCANS) {
      Alert.alert('كثرة المحاولات', 'يرجى الانتظار قبل مسح المزيد من الرموز');
      return;
    }

    recentScans.push(now);
    userScanHistory.set(userId, recentScans);
  }

  // Continue with existing code...
}
```

**Action Items**:
- [x] Created server-side rate limiting (NOT client-side Map) ✅
- [x] Extended `user_rate_limits` table with QR scan columns ✅
- [x] Created `enforce_qr_scan_rate_limit()` trigger function ✅
- [x] Attached BEFORE INSERT trigger to `profile_share_events` ✅
- [x] Added rate limit error handling in `deepLinking.ts` ✅
- [x] Created monitoring view: `qr_scan_rate_limits` ✅

**Implementation Details**:
- **Limit**: 20 scans per 5 minutes (server-enforced)
- **Storage**: Database trigger (not in-memory Map - fixes plan-validator issue #2)
- **Scope**: Per user (user_id), persists across devices and app restarts
- **Error**: Arabic alert shown when rate limit exceeded
- **Monitoring**: `SELECT * FROM qr_scan_rate_limits;` for dashboard
- Prevents memory leaks and multi-device bypass attacks

**Time Taken**: 60 minutes (including trigger debugging)

---

#### 3. Unsanitized Image.prefetch() ✅ FIXED

**Status**: ✅ Complete (October 28, 2025)
**New File**: `src/utils/urlValidation.ts` (security utility module)
**Files Updated**: `src/components/sharing/ProfileQRCode.js` (added URL validation)

**Problem**: PhotoUrl not validated before prefetch

**Risk**:
- Potential file:// or data: URI exploitation
- Information disclosure if Expo doesn't sanitize
- App crash on malformed URLs

**Fix Required**:
```javascript
// Strategy 1: Try profile photo
if (photoUrl) {
  // SECURITY: Only prefetch HTTPS URLs
  if (typeof photoUrl === 'string' && photoUrl.startsWith('https://')) {
    try {
      console.log('[QRCode] Testing profile photo:', photoUrl);
      await Image.prefetch(photoUrl);
      setLogoSource({ uri: photoUrl });
      console.log('[QRCode] ✅ Using profile photo as logo');
      setLogoLoading(false);
      return;
    } catch (error) {
      console.log('[QRCode] ❌ Profile photo failed, trying emblem:', error);
    }
  } else {
    console.warn('[QRCode] ❌ Invalid photoUrl (must be HTTPS):', photoUrl);
  }
}
```

**Action Items**:
- [x] Created `urlValidation.ts` security utility module ✅
- [x] Implemented `isValidSupabasePhotoUrl()` with 6 security checks ✅
- [x] Added Supabase storage URL whitelist (regex pattern) ✅
- [x] Updated `ProfileQRCode.js` to use validation before prefetch ✅
- [x] Added warning logs for invalid URLs ✅

**Implementation Details**:
- **Whitelist Pattern**: `https://<project>.supabase.co/storage/v1/object/(public|authenticated)/`
- **Security Checks**:
  1. Must be HTTPS (blocks file://, data:, javascript:)
  2. Must match Supabase storage domain
  3. No path traversal (..)
  4. No encoded path traversal
  5. No redirect parameters (redirect, url, return, next, goto)
  6. No null bytes (\\0, %00)
- **Fallback**: Falls back to emblem logo if validation fails
- **Logging**: Console warnings for debugging invalid URLs

**Time Taken**: 30 minutes (comprehensive security utility)

---

### Security Fixes Summary

**Status**: ✅ All 3 issues resolved (October 28, 2025)
**Total Time Taken**: 2.25 hours (including plan validation and debugging)
**Migrations Deployed**:
1. ✅ `20251028000000_add_qr_rate_limiting.sql` - Server-side rate limiting
2. ✅ `20251028000001_add_scanner_id_to_share_events.sql` - Scanner ID tracking
3. ✅ `20251028000002_fix_share_events_rls.sql` - Secure RLS policy

**Code Changes**:
1. ✅ `src/utils/urlValidation.ts` - NEW security utility module
2. ✅ `src/utils/deepLinking.ts` - Added scanner_id + rate limit error handling
3. ✅ `src/components/sharing/ProfileQRCode.js` - Added URL validation

**Deployment Method** (Next Steps):
1. ✅ Migrations via MCP (COMPLETE)
2. ⏳ Git commit all code changes
3. ⏳ Manual testing on physical iOS/Android devices
4. ⏳ Deploy via OTA update
5. ⏳ Enable production feature flag
6. ⏳ 48-hour monitoring period

---

## 🟡 Quick Win: Complete Blurhash Day 1 (10 Minutes)

### Status: 80% Complete - Backend Ready

**What's Done**:
- ✅ Database migration applied
- ✅ RPC updated (get_structure_only returns blurhash)
- ✅ Edge Function created
- ✅ Batch script created

**What's Missing (10 Minutes)**:

#### Step 1: Deploy Edge Function (5 mins)

```bash
cd /Users/alqefari/Desktop/AlqefariTreeRN-Expo

# Option A: Using Supabase CLI (Recommended)
npx supabase login
npx supabase link --project-ref ezkioroyhzpavmbfavyn
npx supabase functions deploy generate-blurhash

# Option B: Manual deployment via Dashboard
# 1. Go to https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn
# 2. Navigate to Edge Functions → New Function
# 3. Name: generate-blurhash
# 4. Copy-paste contents of supabase/functions/generate-blurhash/index.ts
# 5. Deploy
```

**Verification**:
```bash
# Test Edge Function
curl -X POST https://ezkioroyhzpavmbfavyn.supabase.co/functions/v1/generate-blurhash \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"profileId": "SOME_UUID", "photoUrl": "https://...photo.jpg"}'

# Expected: {"success": true, "blurhash": "LEH...", "profileId": "..."}
```

#### Step 2: Run Batch Script (2-3 mins)

```bash
# Set environment variable
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run batch script
npx ts-node scripts/generate-blurhashes-batch.ts
```

**Expected Output**:
```
📊 Found 68 profiles needing blurhash generation
🚀 Starting blurhash generation...
⏱️  Time elapsed: 22s
✅ Successful: 68/68
🎉 All blurhashes generated successfully!
```

#### Step 3: Verify in Database (30 seconds)

```sql
-- Check completion
SELECT
  COUNT(*) as total_with_photos,
  COUNT(blurhash) as total_with_blurhash,
  COUNT(*) - COUNT(blurhash) as missing_blurhash
FROM profiles
WHERE photo_url IS NOT NULL AND deleted_at IS NULL;

-- Expected result:
-- total_with_photos: 68
-- total_with_blurhash: 68
-- missing_blurhash: 0
```

**Checklist**:
- [ ] Edge Function deployed successfully
- [ ] Test Edge Function returns blurhash
- [ ] Batch script completes (68/68 success)
- [ ] Database verification shows 68 blurhashes
- [ ] Commit changes to git (if any config changes)

**Value**: Sets foundation for Day 2 frontend (smooth image loading UX)

---

## 🟢 Recommended Deployment Sequence

### Phase 1: Fix QR Security (Priority: URGENT)

**Time**: 1.5 hours
**Risk**: High if not fixed

1. Create new migration for RLS policy fix
2. Apply migration via MCP
3. Add rate limiting to deepLinking.ts
4. Add HTTPS validation to ProfileQRCode.js
5. Test all security fixes on dev
6. Commit changes

**Outcome**: QR system becomes production-ready

---

### Phase 2: Complete Blurhash Day 1 (Priority: MEDIUM)

**Time**: 10 minutes
**Risk**: Low

1. Deploy Edge Function
2. Run batch script
3. Verify 68 blurhashes generated

**Outcome**: Backend ready for Day 2 frontend

---

### Phase 3: Deploy QR to Production (Priority: HIGH)

**Time**: 2-3 hours
**Dependencies**: Phase 1 must be complete

#### Manual Testing Checklist (Physical Devices)

**iOS Testing** (iPhone):
- [ ] Generate QR with profile photo → Logo shows photo
- [ ] Generate QR without photo → Logo shows emblem
- [ ] Cold start: Force quit app → Scan QR → App launches → Profile opens
- [ ] Warm start: App in background → Scan QR → Profile opens
- [ ] Safari: Enter `alqefari://profile/H1` → App opens
- [ ] Messages: Tap shared link → App opens
- [ ] WhatsApp: Tap shared link → App opens
- [ ] Camera: Scan QR → Notification → Tap → App opens
- [ ] Scan own profile → Shows "This is your profile" alert
- [ ] Scan deleted profile → Shows error alert
- [ ] Scan as blocked user → Shows permission denied
- [ ] Rapid double-scan → Second scan ignored (debounced)
- [ ] 21st scan in 5 minutes → Shows rate limit alert
- [ ] Analytics logged correctly to database

**Android Testing** (Android phone):
- [ ] Cold start: Force close → Scan QR → App launches
- [ ] Warm start: App running → Scan QR → Profile opens
- [ ] Chrome: Enter link → "Open with" dialog → Select Alqefari
- [ ] WhatsApp: Tap link → App opens
- [ ] Camera/Google Lens: Scan QR → App opens
- [ ] All edge cases (same as iOS)

**Security Testing**:
- [ ] Unauthenticated user cannot insert analytics (test via Supabase)
- [ ] Invalid profile_id rejected by RLS
- [ ] Rate limit triggers at 20 scans
- [ ] Rate limit resets after 5 minutes
- [ ] file:// URL rejected by Image.prefetch
- [ ] data: URI rejected by Image.prefetch

**Analytics Verification**:
```sql
-- Check recent scans
SELECT
  ps.profile_id,
  p.name_chain,
  ps.share_method,
  ps.shared_at,
  ps.sharer_id
FROM profile_share_events ps
JOIN profiles p ON ps.profile_id = p.id
WHERE ps.shared_at > NOW() - INTERVAL '1 hour'
ORDER BY ps.shared_at DESC
LIMIT 20;

-- Should see your test scans
```

#### Enable Production Feature Flag

**File**: `src/config/featureFlags.js`

**Change**:
```javascript
export const featureFlags = {
  profileLinkRequests: true,
  enableDeepLinking: true,  // Changed from __DEV__
};
```

#### Deploy via OTA

```bash
# Preview with admin team first
npm run update:preview -- --message "QR code sharing with security fixes"

# Test with admin team for 24 hours
# Monitor analytics for issues

# If stable, deploy to production
npm run update:production -- --message "QR code sharing with security fixes"
```

#### Post-Deployment Monitoring (48 Hours)

**Monitor for**:
1. Analytics spam patterns (same user, excessive scans)
2. Failed analytics inserts (RLS rejections)
3. Rate limit triggering frequency
4. User feedback on QR scanning experience
5. Error logs related to deep linking

**SQL Monitoring Queries**:
```sql
-- Check for spam patterns
SELECT
  sharer_id,
  COUNT(*) as total_scans,
  COUNT(DISTINCT profile_id) as unique_profiles_scanned,
  MAX(shared_at) as last_scan
FROM profile_share_events
WHERE shared_at > NOW() - INTERVAL '24 hours'
GROUP BY sharer_id
HAVING COUNT(*) > 50  -- Flag users with >50 scans/day
ORDER BY total_scans DESC;

-- Check RLS rejections (should see auth errors in logs)
-- Supabase Dashboard → Logs → Filter by "profile_share_events"

-- Popular profiles being shared
SELECT
  p.name_chain,
  COUNT(*) as scan_count
FROM profile_share_events ps
JOIN profiles p ON ps.profile_id = p.id
WHERE ps.shared_at > NOW() - INTERVAL '7 days'
GROUP BY p.name_chain
ORDER BY scan_count DESC
LIMIT 10;
```

**Rollback Plan** (if critical issues found):
1. Disable feature flag: `enableDeepLinking: __DEV__`
2. Deploy emergency OTA update
3. Users lose QR functionality immediately
4. Analytics data preserved for debugging
5. Fix issues and redeploy when ready

---

### Phase 4: Blurhash Day 2 Frontend (Priority: LOW)

**Time**: 8 hours
**Dependencies**: Phase 2 complete

**Tasks**:
1. Install react-native-blurhash native library
2. Native rebuild required (not OTA-updatable)
3. Create blurhash cache in skiaImageCache.ts
4. Integrate in TreeView node renderer
5. Bump schema version to 1.2.0 (invalidates cache)
6. Test blur → photo transition on devices

**Deployment**: Requires native app rebuild + App Store submission (not OTA)

---

## 📈 Success Metrics

### QR Code System

**Week 1 Targets**:
- 50+ unique users scan QR codes
- <5% error rate (failed scans)
- <1% rate limit triggers (normal usage shouldn't hit limits)
- Zero analytics spam incidents
- Zero security breaches

**Monitor**:
- `profile_share_events` table growth
- Error logs for deep linking failures
- User feedback on QR scanning experience

### Blurhash (Day 2 Complete)

**Success Criteria**:
- Blur placeholders show instantly (<100ms)
- Smooth transition from blur → photo
- No performance degradation on low-end devices
- User feedback: "Feels faster" vs white boxes

---

## 🎯 Immediate Next Steps (Priority Order)

1. **Fix QR Security Issues** (1.5 hours) - URGENT
   - RLS policy fix
   - Rate limiting
   - HTTPS validation

2. **Complete Blurhash Day 1** (10 mins) - QUICK WIN
   - Deploy Edge Function
   - Run batch script

3. **Test QR on Physical Devices** (2-3 hours) - REQUIRED
   - iOS + Android manual testing
   - Security verification
   - Analytics validation

4. **Deploy QR to Production** (30 mins) - HIGH VALUE
   - Enable feature flag
   - OTA update
   - Monitor for 48 hours

5. **Blurhash Day 2 Frontend** (8 hours) - OPTIONAL
   - Can be deferred to next sprint
   - Requires native rebuild

---

## 📝 Commit Strategy

**Branch**: Current branch or new feature branch

**Commit 1: QR Security Fixes**
```bash
git add supabase/migrations/20251028000000_fix_share_events_rls.sql
git add src/utils/deepLinking.ts
git add src/components/sharing/ProfileQRCode.js
git commit -m "fix(qr-code): Apply 3 critical security fixes from solution auditor

- Fix analytics RLS policy (requires auth + validates profile exists)
- Add rate limiting (20 scans per user per 5 minutes)
- Validate HTTPS before Image.prefetch (prevents file:// exploitation)

Fixes B+ → A grade. Production-ready after testing."
```

**Commit 2: Blurhash Day 1 Completion** (if config changes needed)
```bash
git add docs/BLURHASH_DAY1_COMPLETION.md
git commit -m "docs(blurhash): Mark Day 1 complete (Edge Function deployed, 68 blurhashes generated)"
```

**Commit 3: Enable QR Feature Flag** (after testing complete)
```bash
git add src/config/featureFlags.js
git commit -m "feat(qr-code): Enable deep linking in production

Tested on iOS + Android physical devices.
All security fixes verified.
Ready for production rollout."
```

---

## ⚠️ Risks & Mitigation

### Risk 1: Security Fixes Break Existing Functionality

**Mitigation**:
- Test on dev environment first
- Verify existing analytics data unaffected
- Have rollback plan (disable feature flag)

### Risk 2: Rate Limiting Too Aggressive

**Mitigation**:
- Monitor rate limit triggers in first week
- Adjust limits if legitimate users affected
- Clear error messaging explains wait time

### Risk 3: Users Don't Adopt QR Sharing

**Mitigation**:
- Add onboarding tooltip in ProfileViewer
- Monitor share_method distribution (QR vs copy vs WhatsApp)
- A/B test different QR sizes/placements

### Risk 4: Blurhash Edge Function Costs

**Mitigation**:
- Batch script is one-time cost (68 photos)
- Future photos trigger on-demand (low frequency)
- Monitor Supabase Edge Function usage

---

## ✅ Definition of Done

### QR Code System

- [x] Solution auditor report reviewed
- [ ] All 3 security fixes applied
- [ ] Migration applied to database
- [ ] Code changes committed to git
- [ ] Manual testing complete (iOS + Android)
- [ ] Security testing complete (auth, rate limit, HTTPS)
- [ ] Analytics verification successful
- [ ] Feature flag enabled in production
- [ ] OTA update deployed
- [ ] 48-hour monitoring period complete
- [ ] No critical issues found
- [ ] CLAUDE.md updated with status
- [ ] Deployment checklist marked complete

### Blurhash Day 1

- [ ] Edge Function deployed to Supabase
- [ ] Batch script executed successfully
- [ ] 68/68 profiles have blurhashes
- [ ] Database verification complete
- [ ] Documentation updated (BLURHASH_DAY1_COMPLETION.md)
- [ ] Ready for Day 2 frontend work

---

## 📞 Support & Resources

**Documentation**:
- QR Code: `/docs/QR_CODE_DEEP_LINKING.md`
- Blurhash: `/docs/BLURHASH_DAY1_COMPLETION.md`
- TreeView Performance: `/docs/TREEVIEW_PERFORMANCE_OPTIMIZATION.md`
- Solution Auditor Report: (in chat history)

**Key Files**:
- Feature Flags: `src/config/featureFlags.js`
- Deep Linking: `src/utils/deepLinking.ts`
- QR Component: `src/components/sharing/ProfileQRCode.js`
- Analytics Migration: `supabase/migrations/20251027000001_create_profile_share_events.sql`

**Monitoring**:
- Supabase Dashboard: `https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn`
- Analytics Table: `profile_share_events`
- Error Logs: Supabase Dashboard → Logs

---

**Last Updated**: October 27, 2025
**Next Review**: After QR security fixes applied
