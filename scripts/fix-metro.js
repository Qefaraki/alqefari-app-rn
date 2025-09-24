#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Fixing Metro bundler and development client issues...\n');

let hasErrors = false;

// 1. Kill all running processes
console.log('1️⃣  Killing all running Expo/Metro processes...');
const processesToKill = [
  'pkill -f "expo start" || true',
  'pkill -f "node.*metro" || true',
  'pkill -f "react-native" || true',
  'pkill -f "watchman" || true',
  'lsof -ti :8081 | xargs kill -9 2>/dev/null || true',
  'lsof -ti :19000 | xargs kill -9 2>/dev/null || true',
  'lsof -ti :19001 | xargs kill -9 2>/dev/null || true',
];

processesToKill.forEach(cmd => {
  try {
    execSync(cmd, { shell: true, stdio: 'ignore' });
  } catch (e) {
    // Ignore errors - processes might not exist
  }
});

// 2. Clear all caches
console.log('2️⃣  Clearing all caches...');
const cacheDirectories = [
  'node_modules/.cache',
  '.expo',
  '.metro',
  'ios/build',
  'ios/Pods',
  'ios/DerivedData',
  '.expo/prebuild',
];

cacheDirectories.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`   Removing ${dir}...`);
    try {
      execSync(`rm -rf "${fullPath}"`, { stdio: 'ignore' });
    } catch (e) {
      console.log(`   ⚠️  Failed to remove ${dir}`);
      hasErrors = true;
    }
  }
});

// Clear temp directories
console.log('   Clearing temp directories...');
try {
  execSync('rm -rf $TMPDIR/metro-* 2>/dev/null || true', { shell: true, stdio: 'ignore' });
  execSync('rm -rf $TMPDIR/haste-* 2>/dev/null || true', { shell: true, stdio: 'ignore' });
  execSync('rm -rf $TMPDIR/react-* 2>/dev/null || true', { shell: true, stdio: 'ignore' });
  execSync('rm -rf $TMPDIR/expo-* 2>/dev/null || true', { shell: true, stdio: 'ignore' });
} catch (e) {
  // Ignore errors
}

// 3. Reset Watchman
console.log('3️⃣  Resetting Watchman...');
try {
  // Stop watchman completely
  execSync('watchman shutdown-server 2>/dev/null || true', { shell: true, stdio: 'ignore' });

  // Wait a moment for watchman to shut down
  execSync('sleep 1', { shell: true });

  // Clear watchman state
  execSync('rm -rf /usr/local/var/run/watchman 2>/dev/null || true', { shell: true, stdio: 'ignore' });
  execSync('rm -rf ~/Library/LaunchAgents/com.github.facebook.watchman.plist 2>/dev/null || true', { shell: true, stdio: 'ignore' });

  // Re-initialize watchman for the project
  execSync(`watchman watch-del '${process.cwd()}' 2>/dev/null || true`, { shell: true, stdio: 'ignore' });
  execSync(`watchman watch-project '${process.cwd()}'`, { stdio: 'inherit' });
} catch (e) {
  console.log('   ⚠️  Watchman reset had issues (might not be installed)');
}

// 4. Clear iOS Simulator caches
console.log('4️⃣  Clearing iOS Simulator caches...');
try {
  // Clear simulator derived data
  execSync('xcrun simctl shutdown all 2>/dev/null || true', { shell: true, stdio: 'ignore' });
  execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true', { shell: true, stdio: 'ignore' });
  execSync('rm -rf ~/Library/Developer/CoreSimulator/Caches/* 2>/dev/null || true', { shell: true, stdio: 'ignore' });
} catch (e) {
  console.log('   ⚠️  Failed to clear some iOS caches');
}

// 5. Remove problematic patch files
console.log('5️⃣  Cleaning patch files...');
const problematicPatches = [
  'patches/react-native-reanimated+4.1.1.patch',
  'patches/react-native-worklets+0.5.1.patch',
];

problematicPatches.forEach(patch => {
  const fullPath = path.join(process.cwd(), patch);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log(`   Removed ${patch}`);
    } catch (e) {
      console.log(`   ⚠️  Failed to remove ${patch}`);
    }
  }
});

// 6. Apply patches
console.log('6️⃣  Applying patches...');
try {
  execSync('npx patch-package', { stdio: 'inherit' });
} catch (e) {
  console.log('   ⚠️  Some patches failed to apply');
  hasErrors = true;
}

// 7. Reinstall iOS Pods if needed
if (fs.existsSync('ios')) {
  console.log('7️⃣  Reinstalling iOS Pods...');
  try {
    execSync('cd ios && pod install --repo-update', { stdio: 'inherit' });
  } catch (e) {
    console.log('   ⚠️  Pod install failed (CocoaPods might not be installed)');
    hasErrors = true;
  }
}

// 8. Create .expo directory if it doesn't exist
console.log('8️⃣  Ensuring .expo directory exists...');
if (!fs.existsSync('.expo')) {
  fs.mkdirSync('.expo');
}

// 9. Clear React Native packager cache
console.log('9️⃣  Clearing React Native packager cache...');
try {
  execSync('npx react-native start --reset-cache --max-workers 1 &', { shell: true });
  execSync('sleep 2', { shell: true });
  execSync('pkill -f "react-native start" || true', { shell: true, stdio: 'ignore' });
} catch (e) {
  // This is expected to fail, we're just clearing the cache
}

console.log('\n' + (hasErrors ? '⚠️' : '✅') + ' Metro fix ' + (hasErrors ? 'completed with warnings' : 'completed successfully') + '!\n');

if (hasErrors) {
  console.log('⚠️  Some operations had warnings, but the environment should be functional.\n');
}

console.log('📱 Next steps:');
console.log('   1. Run: npm start');
console.log('   2. Press "i" to open iOS simulator');
console.log('   3. If the app shows a white screen, shake the device and reload');
console.log('\n💡 For a completely fresh start:');
console.log('   npm run dev:reset');