# TestFlight Deployment with EAS (Expo Application Services)

## Overview

EAS Build handles all the complex iOS building and signing for you - no Xcode needed! It builds in the cloud and can automatically submit to TestFlight.

## Prerequisites

### 1. Accounts Setup

- [ ] Apple Developer Account ($99/year) - [Sign up](https://developer.apple.com/programs/)
- [ ] Expo Account (free) - [Sign up](https://expo.dev/signup)
- [ ] App Store Connect access

### 2. App Information

- **Bundle ID**: `com.alqefari.familytree`
- **App Name**: Alqefari Family Tree
- **Current Version**: See `VERSION` file
- **SKU**: `alqefari-family-tree`

## Step-by-Step Setup

### Step 1: Install EAS CLI

```bash
# Install globally
npm install -g eas-cli

# Verify installation
eas --version
```

### Step 2: Login to Expo

```bash
# Login to your Expo account
eas login

# Verify you're logged in
eas whoami
```

### Step 3: Configure EAS Build

```bash
# Run this in your project directory
cd /Users/alqefari/Desktop/AlqefariTreeRN-Expo

# Initialize EAS
eas build:configure

# This will create eas.json file
```

### Step 4: Set Up Apple Credentials

```bash
# EAS will guide you through setting up Apple credentials
eas credentials

# Select:
# - iOS
# - production
# - Let EAS handle credentials (recommended)
```

EAS will automatically:

- Create App ID in Apple Developer Portal
- Generate certificates
- Create provisioning profiles
- Store everything securely

### Step 5: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "+" → New App
3. Fill in:
   - **Platform**: iOS
   - **Name**: Alqefari Family Tree
   - **Primary Language**: Arabic
   - **Bundle ID**: com.alqefari.familytree
   - **SKU**: alqefari-family-tree

### Step 6: Configure eas.json

EAS should have created this, but let's make sure it's properly configured:

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "ios": {
        "buildNumber": "auto"
      },
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "ios": {
        "buildNumber": "auto"
      },
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### Step 7: Update Version

```bash
# The version in app.json should match semantic versioning
# Update it before each release:

# For patch release (1.0.0 → 1.0.1)
npm run version:patch

# For minor release (1.0.0 → 1.1.0)
npm run version:minor

# For major release (1.0.0 → 2.0.0)
npm run version:major
```

## Building and Deploying to TestFlight

### Option 1: Build and Submit Automatically (Recommended)

```bash
# This single command builds AND submits to TestFlight!
eas build --platform ios --auto-submit

# For production build with auto-submit
eas build --platform ios --profile production --auto-submit
```

### Option 2: Build First, Submit Later

```bash
# Step 1: Build for iOS
eas build --platform ios --profile production

# Step 2: Wait for build to complete (you'll get an email)
# Step 3: Submit to TestFlight
eas submit --platform ios --latest
```

### Option 3: Submit Existing Build

```bash
# If you have a build URL or ID
eas submit --platform ios --url [build-url]
```

## Monitoring Your Build

```bash
# Check build status
eas build:list --platform ios

# View build logs
eas build:view [build-id]

# Cancel a build
eas build:cancel [build-id]
```

## After Submission to TestFlight

1. **Wait for Processing** (10-30 minutes)
   - You'll get an email when it's ready

2. **In App Store Connect:**
   - Go to your app → TestFlight tab
   - Add test information:

   **What to Test:**

   ```
   - شجرة العائلة والتنقل
   - إضافة وتعديل الملفات الشخصية
   - رفع الصور
   - البحث بالأسماء العربية
   - عرض العلاقات الزوجية
   ```

3. **Add Testers:**
   - Internal Testing: Your team (up to 100)
   - External Testing: Beta testers (up to 10,000)

## Version Management Scripts

Add these to your package.json:

```json
{
  "scripts": {
    "version:patch": "node scripts/version-bump.js patch",
    "version:minor": "node scripts/version-bump.js minor",
    "version:major": "node scripts/version-bump.js major",
    "build:testflight": "eas build --platform ios --profile production --auto-submit",
    "build:preview": "eas build --platform ios --profile preview",
    "deploy": "npm run build:testflight"
  }
}
```

## Quick Deploy Command

For the fastest deployment to TestFlight:

```bash
# This does everything!
npm run deploy
```

## Pre-Deployment Checklist

Before running `npm run deploy`:

- [ ] All changes committed to Git
- [ ] Version updated in app.json
- [ ] CHANGELOG.md updated
- [ ] Tested locally on simulator
- [ ] No console.log statements in code
- [ ] Arabic translations complete

## Build Configuration Profiles

### Development

- For testing on simulators
- Includes development tools
- Fast builds

### Preview

- For internal testing
- Real device testing
- TestFlight distribution

### Production

- For App Store release
- Optimized and minified
- Auto-increments build number

## Troubleshooting

### "Missing credentials"

```bash
# Let EAS handle it
eas credentials
# Choose "Let EAS manage credentials"
```

### "Bundle identifier already exists"

- Make sure you're using the right Apple team
- Check App Store Connect for existing apps

### Build fails

```bash
# Check logs
eas build:view [build-id]

# Clear cache and retry
eas build --clear-cache --platform ios
```

### "Invalid provisioning profile"

```bash
# Reset credentials
eas credentials --platform ios --profile production
# Select "Remove and regenerate"
```

## Git Workflow for Releases

```bash
# 1. Commit all changes
git add .
git commit -m "feat: prepare for v1.0.0 release"

# 2. Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0"

# 3. Push to GitHub
git push origin main --tags

# 4. Deploy to TestFlight
npm run deploy

# 5. Create GitHub release
gh release create v1.0.0 \
  --title "Release v1.0.0" \
  --notes-file CHANGELOG.md
```

## Cost

- **EAS Build**:
  - Free tier: 30 builds/month
  - Priority builds: $99/month
- **Apple Developer**: $99/year
- **Expo Account**: Free

## Quick Reference

```bash
# First time setup
npm install -g eas-cli
eas login
eas build:configure
eas credentials

# Every release
npm run version:patch  # Update version
npm run deploy         # Build and submit to TestFlight

# Check status
eas build:list --platform ios --limit 5
```

## Support

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Expo Discord](https://chat.expo.dev/)
- [Apple Developer Support](https://developer.apple.com/support/)
