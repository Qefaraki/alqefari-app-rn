# Migrating from Flutter App to React Native

## Step 1: Gather Existing App Information

You need these from your existing Flutter app:

1. **Bundle ID** (e.g., `com.alqefari.familytree` or similar)
   - Find in App Store Connect → Your App → General → App Information
   - Or in your Flutter app's `ios/Runner.xcodeproj`

2. **App Store Connect App ID**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your existing app
   - The App ID is in the URL: `https://appstoreconnect.apple.com/apps/[APP_ID]/...`

3. **Apple Team ID**
   - Go to [Apple Developer Portal](https://developer.apple.com)
   - Click Account → Membership
   - Copy your Team ID (looks like: ABC123XYZ)

## Step 2: Update Your React Native App Configuration

### Update app.json with your existing Bundle ID:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "YOUR_EXISTING_BUNDLE_ID_HERE"
    }
  }
}
```

### Update eas.json for submission:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      }
    }
  }
}
```

## Step 3: Important Considerations

### Version Numbers

- Your new app version MUST be higher than the last Flutter version
- If Flutter was at 1.0.0, start this at 1.1.0 or 2.0.0
- Build number must also be higher

### What This Means:

- ✅ Users will get an UPDATE to their existing app
- ✅ Keeps all reviews and ratings
- ✅ Maintains download history
- ✅ Same App Store listing URL
- ❌ Cannot downgrade - once updated, no going back to Flutter

## Step 4: Build and Deploy

```bash
# Configure credentials with your existing app
npx eas credentials

# Select:
# - iOS
# - production
# - Use existing Apple account credentials

# Build and submit
npm run deploy
```

## Migration Checklist

- [ ] Get Bundle ID from existing Flutter app
- [ ] Get App Store Connect App ID
- [ ] Get Apple Team ID
- [ ] Update app.json with correct Bundle ID
- [ ] Update eas.json with App Store Connect details
- [ ] Ensure version is higher than Flutter version
- [ ] Test thoroughly before deploying
- [ ] Prepare "What's New" text explaining the rebuild

## What's New Text Template

```
تم إعادة بناء التطبيق بالكامل لتحسين الأداء والاستقرار

المميزات الجديدة:
• واجهة مستخدم محسّنة مع دعم كامل للغة العربية
• أداء أسرع وأكثر سلاسة
• تحسينات في عرض شجرة العائلة
• نظام بحث محسّن
• إصلاح جميع المشاكل المعروفة

---

Completely rebuilt app for better performance and stability

New Features:
• Improved UI with full Arabic support
• Faster and smoother performance
• Enhanced family tree display
• Improved search system
• All known issues fixed
```
