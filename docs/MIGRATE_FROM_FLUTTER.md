# Migrating from Flutter to React Native (Replacing Existing App)

## Important Information for App Store Update

### Your Existing App Details:

- **Bundle ID**: `com.Alqefari.alqefari`
- **Apple ID**: `6497066867`
- **SKU**: `com.Alqefari.alqefari`

### What This Means:

✅ **You're updating the SAME app** - not creating a new one
✅ **Users will get an update** - not a new app install
✅ **Reviews and ratings remain** - they carry over
✅ **Download history preserved** - all stats continue

## Steps to Deploy as an Update

### 1. Answer "Yes" to create EAS project:

```bash
npx eas init
# Answer: Yes
```

### 2. Configure Apple credentials:

```bash
npx eas credentials
```

When asked about the Bundle ID, make sure it shows: `com.Alqefari.alqefari`

### 3. Important Build Configuration:

The **build number** must be HIGHER than your last Flutter release.
Check your last build number in App Store Connect, then update `app.json`:

```json
"ios": {
  "bundleIdentifier": "com.Alqefari.alqefari",
  "buildNumber": "2"  // Must be higher than Flutter version
}
```

### 4. Deploy to TestFlight:

```bash
npm run deploy
```

## Version Number Strategy

### Check Your Flutter App Version:

1. Go to App Store Connect
2. Look at your current live version (e.g., 1.0.0)
3. Your React Native version should be HIGHER

### Recommended Versioning:

- If Flutter was `1.0.0` → React Native should be `2.0.0` (major update)
- Or if Flutter was `1.x.x` → React Native could be `1.(x+1).0` (minor update)

Update in `app.json`:

```json
"version": "2.0.0"  // Higher than Flutter version
```

## What Happens to Flutter App?

1. **For Users**: They see a normal app update
2. **For You**: The Flutter codebase is replaced
3. **On App Store**: Same listing, new technology
4. **Reviews**: All preserved
5. **Analytics**: Continuous (same app ID)

## TestFlight Testing Strategy

### Internal Testing First:

1. Upload to TestFlight
2. Test with internal team
3. Verify all Flutter features work in React Native

### External Testing:

1. Select a small group of beta testers
2. Get feedback on the migration
3. Fix any issues before full release

### Release Notes for Update:

```
What's New in Version 2.0:

🎉 مُحدث بالكامل بتقنيات جديدة
- تصميم جديد كلياً وأسرع
- أداء محسّن بشكل كبير
- واجهة مستخدم أكثر سلاسة
- دعم أفضل للغة العربية

Completely rebuilt with new technology:
- Brand new, faster design
- Significantly improved performance
- Smoother user interface
- Better Arabic language support
```

## Pre-Release Checklist

Before releasing the React Native version:

- [ ] Version number is higher than Flutter version
- [ ] Build number is higher than last Flutter build
- [ ] All core Flutter features are implemented
- [ ] Arabic text displays correctly (RTL)
- [ ] Test on both iPhone and iPad
- [ ] Screenshots updated in App Store Connect
- [ ] App description updated if needed

## Important Warnings

⚠️ **DO NOT**:

- Change the Bundle ID (must stay `com.Alqefari.alqefari`)
- Create a new app in App Store Connect
- Delete the Flutter app from App Store Connect

✅ **DO**:

- Use the same Bundle ID
- Increase version and build numbers
- Test thoroughly before release
- Keep Flutter source code as backup

## Rollback Plan

If issues arise:

1. Keep Flutter source code archived
2. You can always submit a Flutter update if needed
3. Version numbers keep incrementing (no going back)

## Support

For migration issues:

- [Expo Discord](https://chat.expo.dev/)
- [React Native Community](https://reactnative.dev/community)
- Keep Flutter backup until React Native is stable
