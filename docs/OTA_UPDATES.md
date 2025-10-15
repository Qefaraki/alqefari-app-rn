# Over-The-Air (OTA) Updates Guide

**Status**: ✅ Configured and ready to use

## 📖 Table of Contents

1. [Quick Start](#quick-start)
2. [What Can Be Updated OTA](#what-can-be-updated-ota)
3. [Daily Workflow](#daily-workflow)
4. [Emergency Rollback](#emergency-rollback)
5. [Monitoring Updates](#monitoring-updates)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Publishing Your First Update

```bash
# 1. Make changes to your code (JavaScript, styling, assets)
# Example: Fix Arabic text alignment bug

# 2. Test locally
npm start

# 3. Publish to preview (test with admin team first)
npm run update:preview -- --message "Fix Arabic alignment"

# 4. Test on preview build (TestFlight internal or dev build)
# Force close app → Reopen → Force close → Reopen (update applies)

# 5. If good, publish to production
npm run update:production -- --message "Fix Arabic alignment"

# 6. All users get update on next app open (minutes!)
```

### Available Commands

```bash
# Publish updates
npm run update:preview -- --message "Your message"      # Preview channel
npm run update:production -- --message "Your message"   # Production channel

# Monitor updates
npm run update:list                  # List recent updates
npm run update:view                  # View production channel details

# Emergency rollback
npm run update:rollback              # Interactive rollback wizard
```

---

## What Can Be Updated OTA

### ✅ Can Update via OTA (No App Store Needed)

**These changes deploy in MINUTES:**

#### JavaScript & Logic
```javascript
// ✅ Permission calculation fixes
async function checkPermission(userId, targetId) {
  // Changed logic - OTA update!
  const { data } = await supabase.rpc('check_family_permission_v4', {
    p_user_id: userId,
    p_target_id: targetId
  });
  return data;
}

// ✅ Undo system improvements
async function undoAction(auditLogId) {
  // Fixed undo logic - OTA update!
  return await undoService.undoAction(auditLogId);
}

// ✅ Admin dashboard features
function AdminDashboard() {
  // Added new stats card - OTA update!
  return <StatsCard />;
}
```

#### Styling & UI
```javascript
// ✅ Najdi Sadu color adjustments
export const COLORS = {
  background: '#F9F7F3',  // Changed color - OTA!
  primary: '#A13333',     // Changed color - OTA!
};

// ✅ RTL layout fixes
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',  // Fixed RTL - OTA!
    padding: 20,           // Changed spacing - OTA!
  },
});
```

#### Content & Assets
```javascript
// ✅ Arabic translations
const strings = {
  welcome: 'مرحباً بك',  // Fixed typo - OTA!
  save: 'حفظ',
};

// ✅ Image replacements
<Image source={require('./assets/new-logo.png')} />
```

#### Configuration
```javascript
// ✅ API endpoints
const SUPABASE_URL = 'https://new-api.supabase.co';  // Changed - OTA!

// ✅ Feature flags
const ENABLE_NEW_FEATURE = true;  // Toggled - OTA!
```

### ❌ Requires App Store Rebuild (Takes DAYS)

**These changes need new build submission:**

#### Native Modules
```bash
# ❌ Adding new native packages
npm install expo-barcode-scanner  # Has native code
npm install react-native-maps     # Has native code

→ Increment version → Build → Submit to App Store (1-2 days)
```

#### App Configuration
```json
// app.json - These require rebuild:
{
  "expo": {
    "orientation": "landscape",  // ❌ Changed from portrait
    "icon": "./new-icon.png",    // ❌ Changed app icon
    "splash": { ... },           // ❌ Changed splash screen
    "ios": {
      "permissions": ["CAMERA"]  // ❌ Added new permission
    }
  }
}
```

#### Expo SDK Upgrades
```bash
# ❌ Major SDK upgrades
npx expo install expo@latest

→ Increment version → Build → Submit to App Store
```

### Decision Tree

```
Did you change native code? ──┬─ YES → App Store Update Required
                              │        (Increment version, build, submit)
                              │
                              └─ NO → OTA Update Possible
                                      (npm run update:production)
```

---

## Daily Workflow

### Scenario 1: Bug Fix (Most Common)

**Problem:** Users report profile edit button not working

**Steps:**
```bash
# 1. Fix the bug locally
code src/components/ProfileEdit.js

# 2. Test in development
npm start

# 3. Publish to preview (admin team tests)
npm run update:preview -- --message "Fix profile edit button"

# 4. Wait 5 minutes for admin team to test
# Admin opens preview build → Force close → Reopen → Test

# 5. If approved, publish to production
npm run update:production -- --message "Fix profile edit button"

# 6. Monitor adoption
npm run update:view
# Check dashboard: expo.dev/accounts/alqefari/projects/alqefari-family-tree
```

**Timeline:**
- 8:00 AM - Bug reported
- 8:15 AM - Fixed locally
- 8:20 AM - Published to preview
- 8:25 AM - Admin approved
- 8:30 AM - Published to production
- 9:00 AM - 50% of users have fix
- 12:00 PM - 90% of users have fix

**Total time: 30 minutes from bug to production fix**

### Scenario 2: Design Update

**Change:** Adjust Najdi Sadu colors based on feedback

**Steps:**
```bash
# 1. Update colors in config
code src/config/colors.js

# 2. Preview changes locally
npm start

# 3. Publish to production (design changes are low-risk)
npm run update:production -- --message "Refine Najdi Sadu color palette"

# 4. Users see new colors on next app open
```

**Timeline:** 10 minutes from change to production

### Scenario 3: Arabic Text Corrections

**Change:** Fix typos in Arabic translations

**Steps:**
```bash
# 1. Fix translations
code src/config/strings.js

# 2. Publish directly to production (text changes are safe)
npm run update:production -- --message "Fix Arabic translation typos"
```

**Timeline:** 5 minutes from fix to production

### Scenario 4: Permission Logic Update

**Change:** Adjust family permission calculation for edge case

**Steps:**
```bash
# 1. Update permission logic
code src/services/permissionService.js

# 2. Test thoroughly locally (critical logic!)
npm start

# 3. Publish to preview first (always test permission changes)
npm run update:preview -- --message "Fix permission edge case for cousins"

# 4. Admin team tests extensively (30 min)
# Test all permission levels, all relationship types

# 5. If tests pass, publish to production
npm run update:production -- --message "Fix permission edge case for cousins"

# 6. Monitor for issues
# Watch for support messages, check error logs
```

**Timeline:** 1 hour from fix to production (includes testing)

### Scenario 5: Adding New Feature (No Native Code)

**Feature:** Add "Export to PDF" button in profile sheet

**Steps:**
```bash
# 1. Implement feature using existing expo-print
code src/components/ProfileSheet.js

# 2. Test locally
npm start

# 3. Publish to preview
npm run update:preview -- --message "Add profile PDF export"

# 4. Admin team tests
# 5. Publish to production with gradual rollout
npm run update:production -- --message "Add profile PDF export"

# Optional: If risky, use rollout percentage
eas update --channel production \
  --rollout-percentage 10 \
  --message "Add profile PDF export"
```

**Timeline:** 2 hours from implementation to production

---

## Emergency Rollback

### When to Rollback

**Immediate rollback if:**
- Critical bug discovered (data loss, crashes)
- Permission system broken (users can't edit)
- App unusable for most users

**Don't rollback for:**
- Minor UI glitches (fix forward instead)
- Isolated reports (< 5% of users)
- Non-blocking issues

### Rollback Procedure

#### Method 1: Interactive Rollback (Recommended)

```bash
# Start interactive rollback wizard
npm run update:rollback

# Follow prompts:
# 1. Select channel (production)
# 2. Select previous good update
# 3. Confirm rollback

# ✅ Done! All users get old version on next app open
```

#### Method 2: Manual Republish

```bash
# List recent updates
npm run update:list

# Copy the update ID of the last good version
# Example: abc123-def456

# Republish that update
eas update:republish --group abc123-def456

# ✅ Done! Old update is now current
```

### Post-Rollback Steps

1. **Notify admin team** - Let them know rollback happened
2. **Fix the bug** - Address root cause
3. **Test fix** - Publish to preview first
4. **Re-publish** - Push fix to production when ready
5. **Document** - Write post-mortem (what happened, how to prevent)

### Example Rollback Timeline

```
10:00 AM - Published update to production
10:30 AM - User reports critical bug
10:35 AM - Confirmed bug affects all users
10:37 AM - Executed rollback (2 minutes)
10:40 AM - Users opening app get old (good) version
11:00 AM - 50% of users back on good version
12:00 PM - 90% of users back on good version
```

**Total recovery time: 2 hours**

---

## Monitoring Updates

### EAS Dashboard

**Access:** https://expo.dev/accounts/alqefari/projects/alqefari-family-tree

**Key Metrics:**
- **Install Rate** - % of users who downloaded update
- **Adoption Rate** - % of users currently on latest version
- **Download Success** - % of successful downloads
- **Platforms** - iOS vs Android breakdown

### When to Check Dashboard

**Daily:**
- After publishing production update (monitor first 24 hours)
- Check adoption rate (should reach 80%+ within 48 hours)

**Weekly:**
- Review update history
- Check for stuck users (not updating)

**After Rollback:**
- Monitor immediately to ensure rollback propagated
- Watch adoption rate of rolled-back version

### Warning Signs

**🚨 Red Flags:**
- Adoption rate < 50% after 48 hours (users not updating)
- Download success rate < 95% (network issues)
- Sudden drop in daily active users (critical bug)

**Action:**
- Investigate logs
- Check Supabase for errors
- Consider rollback if critical

---

## Best Practices

### 1. Always Test on Preview First

```bash
# ❌ Bad: Publish directly to production
npm run update:production -- --message "Fix bug"

# ✅ Good: Test on preview first
npm run update:preview -- --message "Fix bug"
# Admin tests for 10 minutes
npm run update:production -- --message "Fix bug"
```

**Why:** Catches issues before affecting all users

### 2. Use Descriptive Update Messages

```bash
# ❌ Bad
npm run update:production -- --message "Updates"

# ✅ Good
npm run update:production -- --message "Fix: Arabic alignment in profile cards"
```

**Why:** Helps identify updates when reviewing history or rolling back

### 3. Increment Version When Native Code Changes

```bash
# Changed native code (added expo-camera)?
# 1. Update version in app.json
"version": "2.0.0" → "2.1.0"

# 2. Build new binaries
npm run build:ios
npm run deploy

# 3. After approval, OTA updates work again
npm run update:production -- --message "New features for v2.1"
```

**Why:** Runtime version ties to app version. Mismatch prevents updates.

### 4. Batch Small Updates

```bash
# Instead of:
npm run update:production -- --message "Fix typo 1"
npm run update:production -- --message "Fix typo 2"
npm run update:production -- --message "Fix typo 3"

# Do this:
# Fix all 3 typos
npm run update:production -- --message "Fix multiple Arabic typos in profile screen"
```

**Why:** Reduces noise, easier to track, better user experience

### 5. Use Rollouts for Risky Changes

```bash
# Major refactor? Start with 10%
eas update --channel production \
  --rollout-percentage 10 \
  --message "Refactor: New permission system v5"

# Monitor for 24 hours
# If stable, increase to 50%
eas update:edit --rollout-percentage 50

# If stable, complete rollout
eas update:edit --rollout-percentage 100
```

**Why:** Limits impact if bug discovered

### 6. Monitor After Publishing

**First 30 minutes:**
- Watch for user reports
- Check admin dashboard

**First 24 hours:**
- Monitor adoption rate
- Check error logs

**After 48 hours:**
- Review adoption (should be 80%+)
- Mark as successful

### 7. Document Breaking Changes

**If update changes user-facing behavior:**
- Document in release notes
- Notify admin team
- Consider staged rollout

**Example:**
```bash
# Permission logic changed (users might notice)
npm run update:preview -- --message "Update: Stricter permission checks for extended family"

# Test extensively with admin team
# Document behavior change
# Publish to production
```

---

## Troubleshooting

### Issue: Users Not Receiving Updates

**Symptoms:**
- Low adoption rate after 48 hours
- Users report not seeing new features

**Diagnosis:**
```bash
# Check channel configuration
npm run update:view

# Check update history
npm run update:list

# Verify runtime version matches
cat app.json | grep version
```

**Solutions:**
1. **Runtime version mismatch**
   - Check if you changed native code without incrementing version
   - Rebuild app with correct version

2. **Users not restarting app**
   - Updates only apply on restart
   - Notify users to force close and reopen

3. **Network issues**
   - Check EAS dashboard for download failures
   - Wait for users on better network

### Issue: Update Failed to Publish

**Symptoms:**
- `eas update` command fails
- Error message about authentication or project

**Solutions:**
```bash
# 1. Check login status
eas whoami

# 2. Re-login if needed
eas login

# 3. Verify project ID
eas project:info

# 4. Try again
npm run update:production -- --message "Retry publish"
```

### Issue: App Crashes After Update

**Symptoms:**
- Users report crashes after update
- Automatic rollback triggered

**Immediate Action:**
```bash
# 1. Rollback immediately
npm run update:rollback

# 2. Notify admin team
# 3. Investigate crash logs
```

**Investigation:**
1. Check Supabase logs for errors
2. Review changed code
3. Test locally to reproduce
4. Fix bug
5. Test on preview
6. Republish

### Issue: Different Behavior on iOS vs Android

**Symptoms:**
- Update works on iOS, broken on Android (or vice versa)

**Solution:**
```bash
# Publish platform-specific update
eas update --channel production \
  --platform android \
  --message "Fix Android-specific issue"
```

**Prevention:**
- Always test on both platforms before publishing
- Use preview builds for both iOS and Android

---

## Examples for Your App

### Example 1: Fix Permission Calculation Bug

```bash
# 1. User reports they can't edit their parent's profile
# 2. Debug and find bug in permission calculation

code src/services/permissionService.js

# Fix the logic:
# Old: return permission === 'inner'
# New: return permission === 'inner' || permission === 'admin'

# 3. Test locally with multiple permission levels
npm start

# 4. Publish to preview
npm run update:preview -- --message "Fix: Allow admin to edit all profiles"

# 5. Admin team tests (10 minutes)
# 6. Publish to production
npm run update:production -- --message "Fix: Allow admin to edit all profiles"

# Total time: 30 minutes
```

### Example 2: Adjust Najdi Sadu Colors

```bash
# 1. Design feedback: beige needs to be warmer

code src/config/colors.js

# Change:
# Old: beige: '#D1BBA3'
# New: beige: '#D5C0A8'

# 2. Preview locally
npm start

# 3. Publish to production (low-risk design change)
npm run update:production -- --message "Refine Najdi Sadu beige color"

# Total time: 10 minutes
```

### Example 3: Fix Undo System Logic

```bash
# 1. Bug found in undo cascade delete

code src/services/undoService.js

# Fix the logic in undoAction function

# 2. Test locally (critical feature)
npm start

# 3. Publish to preview (MUST test critical features)
npm run update:preview -- --message "Fix: Undo cascade delete logic"

# 4. Admin team tests extensively (30 minutes)
# Test all undo types, permission levels

# 5. Publish to production
npm run update:production -- --message "Fix: Undo cascade delete logic"

# Total time: 1 hour
```

### Example 4: Add New Admin Dashboard Widget

```bash
# 1. Implement new stats widget

code src/components/admin/StatsWidget.js

# 2. Import in dashboard
code src/screens/admin/AdminDashboard.js

# 3. Test locally
npm start

# 4. Publish to preview
npm run update:preview -- --message "Add: Family statistics widget"

# 5. Admin team reviews (15 minutes)
# 6. Publish to production
npm run update:production -- --message "Add: Family statistics widget"

# Total time: 45 minutes
```

---

## Quick Reference

### Daily Commands

```bash
# Publish update
npm run update:production -- --message "Your message here"

# List updates
npm run update:list

# Rollback
npm run update:rollback
```

### Decision Matrix

| Change Type | OTA? | Command |
|-------------|------|---------|
| Bug fix (JS) | ✅ | `npm run update:production` |
| UI styling | ✅ | `npm run update:production` |
| Arabic text | ✅ | `npm run update:production` |
| Permission logic | ✅ | Test on preview first |
| New feature (JS only) | ✅ | Test on preview first |
| Add native module | ❌ | Rebuild + App Store |
| Expo SDK upgrade | ❌ | Rebuild + App Store |
| App icon/splash | ❌ | Rebuild + App Store |

### Update Timeline

| Time After Publish | Expected Adoption |
|-------------------|------------------|
| 1 hour | 20-30% |
| 6 hours | 50-60% |
| 24 hours | 70-80% |
| 48 hours | 85-95% |

---

## Resources

- **EAS Dashboard:** https://expo.dev/accounts/alqefari/projects/alqefari-family-tree
- **Expo Docs:** https://docs.expo.dev/eas-update/introduction/
- **Rollouts:** https://docs.expo.dev/eas-update/rollouts/
- **Rollbacks:** https://docs.expo.dev/eas-update/rollbacks/

---

**Last Updated:** January 2025
