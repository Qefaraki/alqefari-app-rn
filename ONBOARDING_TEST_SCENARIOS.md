# Onboarding Flow Test Scenarios

## Core Requirement
**If onboarding is not 100% complete (all the way through profile linking), ALWAYS start from page 1 of onboarding, regardless of authentication status.**

## Test Scenarios

### 1. Fresh Install Test
- Clear all app data
- Open app
- **Expected**: Should see Onboarding page 1
- Enter phone number → OTP → Profile link
- Complete profile linking
- **Expected**: Should see main app tabs

### 2. App Kill During Phone Auth
- Start fresh onboarding
- Enter phone number
- Kill app at OTP screen
- Reopen app
- **Expected**: Should return to Onboarding page 1 (NOT OTP screen)

### 3. App Kill During Profile Linking
- Complete phone auth
- Reach profile linking screen
- Kill app before completing profile link
- Reopen app
- **Expected**: Should return to Onboarding page 1

### 4. Hot Reload During Onboarding
- Start any step of onboarding
- Hot reload (r in terminal)
- **Expected**: Should return to Onboarding page 1

### 5. Pending Approval State
- Complete phone auth
- Request profile link (requiring approval)
- Kill app while pending
- Reopen app
- **Expected**: Should return to Onboarding page 1 until approved

### 6. Complete Sign Out Test
- Complete full onboarding
- Sign out from settings
- **Expected**: Should clear hasCompletedOnboarding and return to Onboarding page 1

### 7. Guest Mode Test
- Enter guest mode
- Kill and reopen app
- **Expected**: Should remain in guest mode (tabs visible)

### 8. Session Restoration Test
- Complete full onboarding (including profile link)
- Kill app
- Reopen app
- **Expected**: Should restore to main app tabs (NOT onboarding)

## Implementation Details

### Key Files Modified

1. **AuthStateMachine.js** (`src/services/AuthStateMachine.js`)
   - Checks `hasCompletedOnboarding` FIRST before session restoration
   - Only allows session restoration if onboarding is complete

2. **NavigationController.js** (`src/components/NavigationController.js`)
   - Forces navigation to Onboarding page 1 if `hasCompletedOnboarding !== 'true'`
   - Overrides any other navigation decisions when onboarding is incomplete

3. **ProfileMatchingScreen.js** (`src/screens/auth/ProfileMatchingScreen.js`)
   - Removed premature `hasCompletedOnboarding` setting on approval request
   - Only sets after successful profile link

4. **SignInModal.js** (`src/components/SignInModal.js`)
   - Removed premature `hasCompletedOnboarding` setting on auth success
   - Lets AuthStateMachine handle this when transitioning to PROFILE_LINKED

5. **forceSignOut.js** (`src/utils/forceSignOut.js`)
   - Already clears `hasCompletedOnboarding` in AsyncStorage

## Testing Commands

```bash
# Clear all data and restart
npx react-native run-ios --simulator="iPhone 15"

# Hot reload
# Press 'r' in Metro terminal

# Check AsyncStorage values (in app console)
AsyncStorage.getAllKeys().then(keys => console.log(keys))
AsyncStorage.getItem('hasCompletedOnboarding').then(v => console.log('Onboarding:', v))

# Force sign out (in app)
# Settings → Sign Out
```

## Success Criteria

✅ App NEVER gets stuck on OTP page
✅ Incomplete onboarding ALWAYS starts from page 1
✅ No navigation to ProfileLinking without going through phone auth first
✅ hasCompletedOnboarding only set after successful profile link
✅ Guest mode and completed onboarding properly restore sessions