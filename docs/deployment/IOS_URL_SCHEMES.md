# iOS URL Schemes Configuration

**Platform**: iOS 9+
**Configuration File**: `app.json`
**Critical Requirement**: URL schemes MUST be declared before using `Linking.canOpenURL()`

## Overview

iOS 9 and later require apps to declare URL schemes in their Info.plist before they can query whether those apps are installed using `Linking.canOpenURL()`. In Expo/React Native projects, this is done via `app.json` configuration.

## Declared URL Schemes

The following URL schemes are currently declared in the Alqefari Family Tree app:

### whatsapp
**Purpose**: WhatsApp deep linking
**Usage**: `whatsapp://send?phone=...`
**Feature**: Share profiles, send messages via WhatsApp

**Example**:
```javascript
const url = `whatsapp://send?phone=+966501234567&text=Check out this profile!`;
const canOpen = await Linking.canOpenURL(url);
if (canOpen) {
  await Linking.openURL(url);
}
```

### tel
**Purpose**: Phone call links
**Usage**: `tel:` URLs
**Feature**: Direct phone calls from profile sheets

**Example**:
```javascript
const url = `tel:+966501234567`;
const canOpen = await Linking.canOpenURL(url);
if (canOpen) {
  await Linking.openURL(url);
}
```

### https
**Purpose**: Web fallbacks for WhatsApp
**Usage**: `https://wa.me/...`
**Feature**: WhatsApp Web fallback when app not installed

**Example**:
```javascript
// Fallback if WhatsApp app not installed
const url = `https://wa.me/+966501234567?text=Check out this profile!`;
await Linking.openURL(url);
```

## Configuration in app.json

**Location**: `app.json → expo.ios.infoPlist.LSApplicationQueriesSchemes`

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": [
          "whatsapp",
          "tel",
          "https"
        ]
      }
    }
  }
}
```

## Critical Notes

### ⚠️ DO NOT Edit Info.plist Directly

**Wrong Approach**:
```bash
# ❌ WRONG - Don't edit this file directly
vim ios/Alqefari/Info.plist
```

**Why**: Direct Info.plist edits get overwritten when running `expo prebuild`

**Correct Approach**: Always edit `app.json` and rebuild

### Changes Require Native Rebuild

URL scheme changes are **NOT OTA-updatable**:
- Changes require full native rebuild
- Must deploy via App Store or TestFlight
- Cannot be pushed via `eas update`

**Deployment Process**:
1. Edit `app.json`
2. Run `eas build --platform ios` or `npx expo prebuild --clean`
3. Submit to App Store / TestFlight

### Verification After Prebuild

After running `expo prebuild`, verify the changes in the generated Info.plist:

```bash
# View generated Info.plist
cat ios/Alqefari/Info.plist | grep -A 10 "LSApplicationQueriesSchemes"
```

**Expected Output**:
```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>whatsapp</string>
  <string>tel</string>
  <string>https</string>
</array>
```

## Adding New URL Schemes

### Step 1: Update app.json

Add the new scheme to the array:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": [
          "whatsapp",
          "tel",
          "https",
          "instagram",  // ← New scheme
          "maps"        // ← New scheme
        ]
      }
    }
  }
}
```

### Step 2: Rebuild Native Project

**Option A: EAS Build** (Recommended for production):
```bash
eas build --platform ios
```

**Option B: Local Prebuild** (For development):
```bash
npx expo prebuild --clean
```

### Step 3: Test Both APIs

Test the scheme with both `canOpenURL` and `openURL`:

```javascript
// Test 1: Check if app supports the URL
const instagramUrl = 'instagram://user?username=alqefari';
const canOpen = await Linking.canOpenURL(instagramUrl);
console.log('Can open Instagram:', canOpen);

// Test 2: Actually open the URL
if (canOpen) {
  await Linking.openURL(instagramUrl);
}
```

### Step 4: Verify in Generated Info.plist

```bash
cat ios/Alqefari/Info.plist | grep -A 15 "LSApplicationQueriesSchemes"
```

Ensure your new scheme appears in the list.

## Common URL Schemes

Here are commonly used URL schemes for popular apps:

| App | URL Scheme | Example Usage |
|-----|------------|---------------|
| WhatsApp | `whatsapp://` | `whatsapp://send?phone=...` |
| Instagram | `instagram://` | `instagram://user?username=...` |
| Twitter | `twitter://` | `twitter://user?screen_name=...` |
| Facebook | `fb://` | `fb://profile/12345` |
| Google Maps | `comgooglemaps://` | `comgooglemaps://?q=...` |
| Apple Maps | `maps://` | `maps://?q=...` |
| Telegram | `tg://` | `tg://resolve?domain=...` |
| YouTube | `youtube://` | `youtube://watch?v=...` |

## Common Error

### Error Message
```
Error: Unable to open URL: whatsapp://...
Reason: -canOpenURL: failed for URL: "whatsapp://" - error:
"This app is not allowed to query for scheme whatsapp"
Add whatsapp to LSApplicationQueriesSchemes in Info.plist
```

### Solution

1. Add missing scheme to `app.json`
2. Rebuild the app
3. Test again

**Example Fix**:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": [
          "whatsapp"  // ← Add the missing scheme
        ]
      }
    }
  }
}
```

## Best Practices

### 1. Declare Only What You Need

Don't add schemes you don't use - it increases app review scrutiny.

**Good**:
```json
["whatsapp", "tel", "https"]  // Only what we use
```

**Bad**:
```json
["whatsapp", "instagram", "twitter", "facebook", ...]  // Kitchen sink approach
```

### 2. Test on Physical Device

Scheme queries behave differently on simulators vs physical devices:
- Simulator: May always return `true`
- Physical Device: Accurate results

**Always test on physical device before deploying.**

### 3. Provide Fallbacks

Not all users have all apps installed. Provide fallbacks:

```javascript
async function openWhatsApp(phone, message) {
  const whatsappUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
  const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

  if (canOpenWhatsApp) {
    await Linking.openURL(whatsappUrl);
  } else {
    // Fallback to web
    await Linking.openURL(webUrl);
  }
}
```

### 4. Handle Errors Gracefully

```javascript
try {
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    Alert.alert('خطأ', 'التطبيق غير مثبت');
  }
} catch (error) {
  console.error('Failed to open URL:', error);
  Alert.alert('خطأ', 'فشل فتح الرابط');
}
```

### 5. Document in Code

When using URL schemes, document why they're needed:

```javascript
// NOTE: Requires 'whatsapp' in LSApplicationQueriesSchemes (app.json)
// iOS 9+ requires pre-declaration for Linking.canOpenURL()
async function shareViaWhatsApp(profile) {
  const url = `whatsapp://send?phone=${profile.phone}`;
  // ...
}
```

## Debugging

### Check Current Schemes

View currently declared schemes:

```bash
# From project root
cat app.json | grep -A 10 "LSApplicationQueriesSchemes"
```

### Test Scheme Query

Add debug logging:

```javascript
async function testScheme(scheme) {
  try {
    const url = `${scheme}://`;
    const canOpen = await Linking.canOpenURL(url);
    console.log(`[URLScheme] ${scheme}: ${canOpen ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    return canOpen;
  } catch (error) {
    console.error(`[URLScheme] ${scheme} ERROR:`, error);
    return false;
  }
}

// Test all schemes
await testScheme('whatsapp');
await testScheme('tel');
await testScheme('https');
```

### Verify After Build

After building, check the final Info.plist in the IPA/app bundle:

```bash
# Extract Info.plist from IPA (if available)
unzip -p YourApp.ipa Payload/YourApp.app/Info.plist | grep -A 10 "LSApplicationQueriesSchemes"
```

## App Store Review Considerations

Apple reviews the declared URL schemes during App Store submission.

### What Apple Checks

1. **Usage Justification**: Are you actually using the declared schemes?
2. **Privacy Concerns**: Are you querying schemes to fingerprint devices?
3. **Legitimate Purpose**: Do the schemes serve a clear user benefit?

### Best Practices for Review

1. **Declare only what you use**: Don't add schemes "just in case"
2. **Document usage**: Be prepared to explain why each scheme is needed
3. **User-facing features**: Link schemes to visible app features (e.g., "Share via WhatsApp" button)

### Example App Review Notes

> **LSApplicationQueriesSchemes Usage**:
> - `whatsapp`: Share profile feature (ProfileSheet → Share button)
> - `tel`: Direct call feature (ProfileSheet → Call button)
> - `https`: WhatsApp Web fallback when app not installed

## Android Equivalent

Android doesn't require pre-declaration of URL schemes, but uses intent filters instead.

**Android Configuration**: `app.json → expo.android.intentFilters`

```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "alqefari"
            }
          ],
          "category": [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    }
  }
}
```

## Related Documentation

- [QR Code & Deep Linking System](../features/QR_CODE_DEEP_LINKING.md) - Uses `alqefari://` custom scheme
- [Message Templates](../MESSAGE_TEMPLATE_SYSTEM.md) - Uses WhatsApp deep links
- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/) - Official Expo guide
- [Apple URL Scheme Documentation](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)

## Troubleshooting

### Issue: Scheme query returns false even after adding to app.json

**Solution**:
1. Clean build folders: `npx expo prebuild --clean`
2. Rebuild the app: `eas build --platform ios`
3. Verify in Info.plist after build
4. Test on physical device (not simulator)

### Issue: Changes not reflecting after prebuild

**Solution**:
1. Check that you edited `app.json`, not `Info.plist`
2. Run `expo prebuild --clean` to force regeneration
3. Verify the generated `ios/Alqefari/Info.plist`

### Issue: Works in development, fails in production

**Solution**:
1. Production build may have different configuration
2. Check `eas.json` build profiles
3. Verify Info.plist in production IPA
4. Ensure scheme is in `app.json`, not just manually added to Xcode

## Summary

- ✅ Declare schemes in `app.json`, not `Info.plist` directly
- ✅ Rebuild app after adding new schemes (not OTA-updatable)
- ✅ Test on physical devices, not just simulators
- ✅ Provide fallbacks for apps that may not be installed
- ✅ Only declare schemes you actually use
- ✅ Document usage for App Store review
