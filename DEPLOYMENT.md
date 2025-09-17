# 🚀 Alqefari Family Tree - Deployment Guide

## Quick Start for TestFlight

### First Time Setup (One-time only)

```bash
# 1. Login to Expo
npx eas login

# 2. Link to your Expo project (creates project on Expo servers)
npx eas init

# 3. Configure Apple credentials (EAS will guide you)
npx eas credentials
```

### Deploy to TestFlight (Every Release)

```bash
# One command to build and submit!
npm run deploy
```

That's it! EAS handles everything else automatically.

## Version Management

### Update Version Before Deploying

```bash
# Bug fixes (1.0.0 → 1.0.1)
npm run version:patch

# New features (1.0.0 → 1.1.0)
npm run version:minor

# Breaking changes (1.0.0 → 2.0.0)
npm run version:major
```

## Complete Release Workflow

```bash
# 1. Update version
npm run version:patch

# 2. Edit CHANGELOG.md with your changes

# 3. Commit changes
git add .
git commit -m "chore: bump version to 1.0.1"

# 4. Create git tag
git tag -a v1.0.1 -m "Release version 1.0.1"

# 5. Push to GitHub
git push origin main --tags

# 6. Deploy to TestFlight
npm run deploy
```

## Available Commands

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run deploy`         | Build and auto-submit to TestFlight        |
| `npm run deploy:preview` | Build preview version for internal testing |
| `npm run build:ios`      | Build iOS without submitting               |
| `npm run submit:ios`     | Submit latest build to TestFlight          |
| `npm run version:patch`  | Bump patch version (bug fixes)             |
| `npm run version:minor`  | Bump minor version (features)              |
| `npm run version:major`  | Bump major version (breaking)              |

## Build Profiles

### Production (`npm run deploy`)

- Optimized for App Store
- Auto-increments build number
- Submits to TestFlight automatically

### Preview (`npm run deploy:preview`)

- For internal testing
- Faster builds
- Not for App Store submission

## Monitoring Builds

```bash
# Check build status
npx eas build:list --platform ios --limit 5

# View specific build logs
npx eas build:view [build-id]
```

## Requirements

✅ **What You Need:**

- Apple Developer Account ($99/year)
- Expo account (free)
- That's all!

❌ **What You DON'T Need:**

- Xcode
- Manual certificate management
- Complex provisioning profiles
- CI/CD setup

## TestFlight Setup (App Store Connect)

After your first deployment:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to TestFlight tab
4. Add test information:
   - **What to Test**: Features to focus on
   - **Beta App Description**: About your app
5. Add testers (internal or external)

## Troubleshooting

### "Not logged in to EAS"

```bash
npx eas login
```

### "Project not initialized"

```bash
npx eas init
```

### "Missing Apple credentials"

```bash
npx eas credentials
# Select: iOS → Production → Let EAS manage
```

### Build failed

```bash
# View logs
npx eas build:view [build-id]

# Retry with cache clear
npx eas build --clear-cache --platform ios
```

## Build Times

- First build: ~20-30 minutes (setting up credentials)
- Subsequent builds: ~10-15 minutes
- You'll get an email when done!

## Cost

| Service         | Cost      | What You Get              |
| --------------- | --------- | ------------------------- |
| EAS Free Tier   | $0        | 30 builds/month           |
| EAS Priority    | $99/month | Unlimited + faster builds |
| Apple Developer | $99/year  | Required for App Store    |

## Support

- 📖 [EAS Documentation](https://docs.expo.dev/build/introduction/)
- 💬 [Expo Discord](https://chat.expo.dev/)
- 🎯 [Project Issues](https://github.com/Qefaraki/alqefari-app-rn/issues)
